import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import ActionButton from "@/components/ActionButton";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorDisplay from "@/components/ErrorDisplay";
import { TextInput } from "@/components/forms";
import { useToast } from "@/contexts/ToastContext";
import { financeApi } from "@/services/api/finance";
import type {
  BillingCycleEntry,
  CashflowSourceNode,
} from "@/services/api/finance";

interface ManualBillingEntriesModalProps {
  open: boolean;
  source: CashflowSourceNode | null;
  onClose: () => void;
  onSaved: () => void;
}

type EditableEntry = {
  amount: string;
  note: string;
};

type MonthFormState = Record<string, EditableEntry>;

type Mode = "view" | "edit";

const DEFAULT_VISIBLE_MONTHS = 12;
const OLDER_MONTHS_BATCH = 6;

const formatMonthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const startOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const formatMonthDisplay = (month: string | null | undefined): string =>
  month ? month.slice(0, 7) : "";

const addMonths = (date: Date, offset: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1);

const monthKeyToDate = (month: string): Date => {
  const [year, monthStr] = month.split("-");
  return new Date(Number(year), Number(monthStr) - 1, 1);
};

const generateRecentMonths = (count: number, today: Date): string[] => {
  const result: string[] = [];
  let cursor = startOfMonth(today);
  for (let index = 0; index < count; index += 1) {
    result.push(formatMonthKey(cursor));
    cursor = addMonths(cursor, -1);
  }
  return result;
};

const getCycleKey = (cycle: BillingCycleEntry): string =>
  `${cycle.cycle_start}_${cycle.cycle_end}`;

const ManualBillingEntriesModal = ({
  open,
  source,
  onClose,
  onSaved,
}: ManualBillingEntriesModalProps) => {
  const { t } = useTranslation();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>("view");
  const [visibleMonths, setVisibleMonths] = useState<string[]>([]);
  const [monthEntries, setMonthEntries] = useState<
    Record<string, BillingCycleEntry[]>
  >({});
  const [formState, setFormState] = useState<Record<string, MonthFormState>>(
    {},
  );
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentMonthKey = useMemo(
    () => formatMonthKey(startOfMonth(new Date())),
    [],
  );
  const addOlderMonths = useCallback(() => {
    if (!visibleMonths.length) {
      setVisibleMonths(
        generateRecentMonths(DEFAULT_VISIBLE_MONTHS, new Date()),
      );
      return;
    }
    const lastMonth = monthKeyToDate(
      visibleMonths[visibleMonths.length - 1] ?? currentMonthKey,
    );
    const additions: string[] = [];
    let cursor = addMonths(lastMonth, -1);
    for (let index = 0; index < OLDER_MONTHS_BATCH; index += 1) {
      const key = formatMonthKey(cursor);
      if (!visibleMonths.includes(key) && !additions.includes(key)) {
        additions.push(key);
      }
      cursor = addMonths(cursor, -1);
    }
    if (!additions.length) {
      return;
    }
    setVisibleMonths((prev) => [...prev, ...additions]);
  }, [visibleMonths, currentMonthKey]);

  const resetState = useCallback(() => {
    setMode("view");
    setVisibleMonths([]);
    setMonthEntries({});
    setFormState({});
    setLoadingError(null);
    setSaving(false);
  }, []);

  const rebuildFormState = useCallback(
    (months: string[], entriesMap: Record<string, BillingCycleEntry[]>) => {
      setFormState((prev) => {
        const next = { ...prev };
        months.forEach((month) => {
          const cycles = entriesMap[month] ?? [];
          next[month] = cycles.reduce<MonthFormState>((acc, cycle) => {
            const key = getCycleKey(cycle);
            acc[key] = {
              amount: cycle.amount ?? "",
              note: cycle.note ?? "",
            };
            return acc;
          }, {});
        });
        return next;
      });
    },
    [],
  );

  const loadInitialMonths = useCallback(async () => {
    if (!source) {
      return;
    }
    setInitialLoading(true);
    setLoadingError(null);
    try {
      const response = await financeApi.listBillingMonths(source.id, {
        size: DEFAULT_VISIBLE_MONTHS,
        direction: "desc",
      });
      const fallbackMonths = generateRecentMonths(
        DEFAULT_VISIBLE_MONTHS,
        new Date(),
      );
      const monthsFromApi = response.items ?? [];
      const combined = monthsFromApi.length
        ? Array.from(new Set([...fallbackMonths, ...monthsFromApi]))
        : fallbackMonths;
      const filtered = combined
        .filter((month) => month <= currentMonthKey)
        .sort((a, b) => (a < b ? 1 : -1))
        .slice(0, DEFAULT_VISIBLE_MONTHS);
      setVisibleMonths(filtered.length ? filtered : fallbackMonths);
    } catch (error) {
      setLoadingError(
        error instanceof Error ? error.message : t("common.error"),
      );
    } finally {
      setInitialLoading(false);
    }
  }, [source, t, currentMonthKey]);

  useEffect(() => {
    if (!open || !source) {
      resetState();
      return;
    }
    resetState();
    void loadInitialMonths();
  }, [open, source, loadInitialMonths, resetState]);

  useEffect(() => {
    if (!open || !source || !visibleMonths.length) {
      return;
    }
    const monthsToFetch = visibleMonths.filter((month) => !monthEntries[month]);
    if (!monthsToFetch.length) {
      return;
    }

    let cancelled = false;
    const fetchMonths = async () => {
      setLoadingMonths(true);
      try {
        const history = await financeApi.getBillingCycleHistoryBulk(
          source.id,
          monthsToFetch,
        );
        const monthsMap = history.months ?? {};
        const results = monthsToFetch.map((month) => ({
          month,
          cycles: monthsMap[month] ?? [],
        }));
        if (cancelled) {
          return;
        }
        setMonthEntries((prev) => {
          const next = { ...prev };
          results.forEach(({ month, cycles }) => {
            next[month] = cycles;
          });
          return next;
        });
        rebuildFormState(
          results.map((item) => item.month),
          Object.fromEntries(results.map((item) => [item.month, item.cycles])),
        );
      } catch (error) {
        if (!cancelled) {
          setLoadingError(
            error instanceof Error ? error.message : t("common.error"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingMonths(false);
        }
      }
    };

    void fetchMonths();
    return () => {
      cancelled = true;
    };
  }, [open, source, visibleMonths, monthEntries, rebuildFormState, t]);

  const handleChange = useCallback(
    (
      month: string,
      cycleKey: string,
      field: keyof EditableEntry,
      event: ChangeEvent<HTMLInputElement>,
    ) => {
      const { value } = event.target;
      setFormState((prev) => {
        const monthState = prev[month] ?? {};
        const current = monthState[cycleKey] ?? { amount: "", note: "" };
        return {
          ...prev,
          [month]: {
            ...monthState,
            [cycleKey]: {
              amount: field === "amount" ? value : current.amount,
              note: field === "note" ? value : current.note,
            },
          },
        };
      });
    },
    [],
  );

  const handleEnterEdit = useCallback(() => {
    setMode("edit");
  }, []);

  const handleCancelEdit = useCallback(() => {
    rebuildFormState(visibleMonths, monthEntries);
    setMode("view");
  }, [visibleMonths, monthEntries, rebuildFormState]);

  const rowsToSubmit = useMemo(() => {
    const result: Array<{
      month: string;
      entries: Array<{
        key: string;
        amount: string;
        note: string;
      }>;
    }> = [];
    visibleMonths.forEach((month) => {
      const fields = formState[month];
      if (!fields) return;
      const entries = Object.entries(fields)
        .map(([key, value]) => ({
          key,
          amount: value.amount.trim(),
          note: value.note.trim(),
        }))
        .filter((item) => item.amount);
      if (entries.length) {
        result.push({ month, entries });
      }
    });
    return result;
  }, [formState, visibleMonths]);

  const handleSave = useCallback(async () => {
    if (!source) {
      return;
    }
    if (!rowsToSubmit.length) {
      toast.showInfo(t("common.notice"), t("finance.noBillingChanges"));
      setMode("view");
      return;
    }
    setSaving(true);
    try {
      for (const row of rowsToSubmit) {
        const payloadEntries = row.entries.map((item) => {
          const [cycleStart, cycleEnd] = item.key.split("_");
          return {
            cycle_start: cycleStart,
            cycle_end: cycleEnd,
            amount: item.amount,
            note: item.note || undefined,
          };
        });
        await financeApi.upsertBillingCycleEntries(source.id, {
          month: row.month,
          entries: payloadEntries,
        });
        const refreshed = await financeApi.getBillingCycleHistory(
          source.id,
          row.month,
        );
        setMonthEntries((prev) => ({
          ...prev,
          [row.month]: refreshed.cycles ?? [],
        }));
        rebuildFormState([row.month], { [row.month]: refreshed.cycles ?? [] });
      }
      toast.showSuccess(t("common.success"), t("finance.billingSaved"));
      setMode("view");
      onSaved();
    } catch (error) {
      toast.showError(
        t("common.error"),
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  }, [source, rowsToSubmit, toast, rebuildFormState, t, onSaved]);

  const modalTitle = useMemo(() => {
    if (!source) {
      return t("finance.manualBillingQuickFill");
    }
    return t("finance.manualBillingQuickFillFor", {
      name: source.name,
    });
  }, [source, t]);

  if (!open || !source) {
    return null;
  }

  const manualOnly =
    source.kind === "billing" && source.billing_requires_manual_input;

  return (
    <ModalBase
      isOpen={open}
      onClose={() => {
        if (!saving) {
          onClose();
        }
      }}
      size="xl"
      title={modalTitle}
    >
      {!manualOnly ? (
        <p className="py-6 text-sm text-base-content/70">
          {t("finance.manualBillingOnly")}
        </p>
      ) : loadingError ? (
        <ErrorDisplay error={loadingError} />
      ) : initialLoading ? (
        <div className="py-10">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ActionButton
                label={t("finance.addOlderBillingMonths")}
                size="xs"
                variant="outline"
                onClick={addOlderMonths}
                disabled={loadingMonths || saving}
              />
            </div>
            {mode === "view" ? (
              <ActionButton
                label={t("common.edit")}
                size="sm"
                variant="solid"
                color="primary"
                onClick={handleEnterEdit}
                disabled={loadingMonths || saving}
              />
            ) : (
              <div className="flex items-center gap-2">
                <ActionButton
                  label={t("common.cancel")}
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={saving}
                />
                <ActionButton
                  label={t("common.save")}
                  size="sm"
                  color="primary"
                  variant="solid"
                  onClick={handleSave}
                  disabled={saving || rowsToSubmit.length === 0}
                />
              </div>
            )}
          </div>

          {loadingMonths && (
            <div className="py-6">
              <LoadingSpinner />
            </div>
          )}

          {!visibleMonths.length ? (
            <p className="py-6 text-sm text-base-content/60">
              {t("finance.noBillingCycles")}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <div className="rounded-lg border border-base-200 bg-base-100 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-base-200/40 text-xs uppercase text-base-content/60">
                      <tr>
                        <th className="px-4 py-2 text-left w-32">
                          {t("finance.postedMonthHeader")}
                        </th>
                        <th className="px-4 py-2 text-left">
                          {t("finance.billingCycle")}
                        </th>
                        <th className="px-4 py-2 text-right w-32">
                          {t("finance.amount")}
                        </th>
                        <th className="px-4 py-2 text-left">
                          {t("finance.note")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMonths.flatMap((month) => {
                        const cycles = monthEntries[month] ?? [];
                        const monthState = formState[month] ?? {};
                        if (!cycles.length) {
                          return [
                            <tr
                              key={`${month}-empty`}
                              className="border-t border-base-200"
                            >
                              <td className="px-4 py-2 text-base-content">
                                {formatMonthDisplay(month)}
                              </td>
                              <td
                                colSpan={3}
                                className="px-4 py-2 text-center text-xs text-base-content/60"
                              >
                                {t("finance.noBillingCycles")}
                              </td>
                            </tr>,
                          ];
                        }
                        return cycles.map((cycle) => {
                          const key = getCycleKey(cycle);
                          const value = monthState[key] ?? {
                            amount: "",
                            note: "",
                          };
                          const numericAmount = Number(value.amount);
                          const amountClass =
                            numericAmount < 0
                              ? "text-error"
                              : numericAmount > 0
                                ? "text-success"
                                : "text-base-content";
                          return (
                            <tr
                              key={`${month}-${key}`}
                              className="border-t border-base-200"
                            >
                              <td className="px-4 py-2 text-base-content">
                                {formatMonthDisplay(month)}
                              </td>
                              <td className="px-4 py-2 text-base-content">
                                {formatMonthDisplay(
                                  cycle.posted_month ?? month,
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {mode === "edit" ? (
                                  <TextInput
                                    type="text"
                                    inputMode="decimal"
                                    size="sm"
                                    className="w-28 tabular-nums"
                                    value={value.amount}
                                    placeholder="0"
                                    onChange={(event) =>
                                      handleChange(month, key, "amount", event)
                                    }
                                    disabled={saving}
                                  />
                                ) : (
                                  <span
                                    className={`inline-block min-w-[2rem] text-right tabular-nums ${amountClass}`}
                                  >
                                    {value.amount || "—"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                {mode === "edit" ? (
                                  <TextInput
                                    type="text"
                                    size="sm"
                                    value={value.note}
                                    placeholder={t("finance.optional")}
                                    onChange={(event) =>
                                      handleChange(month, key, "note", event)
                                    }
                                    disabled={saving}
                                  />
                                ) : (
                                  <span className="inline-block text-base-content">
                                    {value.note || "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ModalBase>
  );
};

export default ManualBillingEntriesModal;
