import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import ActionButton from "@/components/ActionButton";
import Badge from "@/components/common/Badge";
import { FinanceTreeSelector } from "@/components/finance/FinanceTreeSelector";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import {
  DEFAULT_PRIMARY_CURRENCY,
  PRIMARY_CURRENCY_OPTION_DEFINITIONS,
} from "@/config/financePreferences";
import { useToast } from "@/contexts/ToastContext";
import type {
  CashflowSourceNode,
  CashflowSnapshotCreatePayload,
  CashflowSnapshotDetail,
} from "@/services/api/finance";
import type { UUID } from "@/types/primitive";
import { coerceCurrencyCode, normalizeCurrencyCode } from "@/utils/core";
import { formatMonthInTimezone } from "@/utils/datetime";
import { resolvePreferredTimezone, zonedDateTimeToUtc } from "@/utils/datetime";
import { formatDecimalValue, flattenTree } from "@/features/finance/shared";
import { ExchangeRateInputGrid } from "@/features/finance/shared/components/ExchangeRateInputGrid";
import { TextArea, TextInput } from "@/components/forms";

type AmountMap = Record<string, string>;
type NoteMap = Record<string, string>;
type CurrencyMap = Record<string, string>;
type ExchangeRateState = Record<string, string>;

const CASHFLOW_CURRENCY_OPTIONS: EnumOption[] =
  PRIMARY_CURRENCY_OPTION_DEFINITIONS.map((option) => ({
    value: option.code,
    label: option.code,
  }));

const getDefaultMonth = (timezone: string) =>
  formatMonthInTimezone(new Date().toISOString(), timezone) ||
  new Date().toISOString().slice(0, 7);

const monthRangeToIso = (month: string, timezone?: string) => {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNumber = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber)) {
    throw new Error("invalid month");
  }
  const tz = resolvePreferredTimezone(timezone);
  const startUtc = zonedDateTimeToUtc(year, monthNumber, 1, 0, 0, 0, 0, tz);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
  const endUtc = zonedDateTimeToUtc(
    nextYear,
    nextMonthNumber,
    1,
    0,
    0,
    0,
    0,
    tz,
  );
  return { startIso: startUtc.toISOString(), endIso: endUtc.toISOString() };
};

export const CASHFLOW_SNAPSHOT_FORM_ID = "finance-cashflow-snapshot-form";

interface CashflowSnapshotFormProps {
  mode: "create" | "edit";
  sources: CashflowSourceNode[];
  latestSnapshotDetail?: CashflowSnapshotDetail | null;
  editingSnapshotDetail?: CashflowSnapshotDetail | null;
  submitting: boolean;
  onCancel: () => void;
  treeId: UUID | null;
  treeName: string | null;
  treeOptions: Array<{ value: UUID; label: string }>;
  onChangeTree: (id: UUID) => void;
  treeSelectionDisabled: boolean;
  onCreateSnapshot: (
    payload: CashflowSnapshotCreatePayload,
  ) => Promise<void> | void;
  onUpdateSnapshot?: (
    id: UUID,
    payload: CashflowSnapshotCreatePayload,
  ) => Promise<void> | void;
  headerActions?: ReactNode;
  autoBillingSources?: CashflowSourceNode[];
  manualBillingSources?: CashflowSourceNode[];
  onApplyBillingCycles?: (month: string) => Promise<void> | void;
  onManageBillingSource?: (month: string, source: CashflowSourceNode) => void;
  applyBillingPending?: boolean;
  timezone?: string;
}

export function CashflowSnapshotForm({
  mode,
  sources,
  latestSnapshotDetail,
  editingSnapshotDetail,
  submitting,
  onCancel,
  treeId,
  treeName,
  treeOptions,
  onChangeTree,
  treeSelectionDisabled,
  onCreateSnapshot,
  onUpdateSnapshot,
  headerActions,
  autoBillingSources,
  manualBillingSources,
  onApplyBillingCycles,
  onManageBillingSource,
  applyBillingPending = false,
  timezone,
}: CashflowSnapshotFormProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const effectiveTimezone = resolvePreferredTimezone(timezone);
  const primaryCurrency = useMemo(
    () =>
      coerceCurrencyCode(
        editingSnapshotDetail?.primary_currency ??
          latestSnapshotDetail?.primary_currency ??
          DEFAULT_PRIMARY_CURRENCY,
        DEFAULT_PRIMARY_CURRENCY,
      ),
    [
      editingSnapshotDetail?.primary_currency,
      latestSnapshotDetail?.primary_currency,
    ],
  );

  const flattenedSources = useMemo(() => flattenTree(sources ?? []), [sources]);

  const defaultMonth = useMemo(
    () => getDefaultMonth(effectiveTimezone),
    [effectiveTimezone],
  );
  const [periodMonth, setPeriodMonth] = useState(defaultMonth);
  const [amounts, setAmounts] = useState<AmountMap>({});
  const [entryNotes, setEntryNotes] = useState<NoteMap>({});
  const [entryCurrencies, setEntryCurrencies] = useState<CurrencyMap>({});
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateState>({});
  const [notes, setNotes] = useState("");

  const monthKey = useMemo(() => periodMonth || "", [periodMonth]);
  const nonPrimaryCurrencies = useMemo(() => {
    const result = new Set<string>();
    Object.entries(amounts).forEach(([id, amount]) => {
      if (!amount.trim()) {
        return;
      }
      const normalized = normalizeCurrencyCode(
        entryCurrencies[id] || primaryCurrency,
      );
      if (normalized && normalized !== primaryCurrency) {
        result.add(normalized);
      }
    });
    return Array.from(result).sort();
  }, [amounts, entryCurrencies, primaryCurrency]);

  const autoBillingNames = useMemo(
    () => autoBillingSources?.map((item) => item.name).join("、") ?? "",
    [autoBillingSources],
  );

  const applySnapshotDetail = useCallback(
    (detail: CashflowSnapshotDetail) => {
      const entries: AmountMap = {};
      const notesMap: NoteMap = {};
      const currencyMap: CurrencyMap = {};
      const ratesMap: ExchangeRateState = {};
      detail.entries.forEach((entry) => {
        entries[entry.source_id] = entry.amount ?? "";
        notesMap[entry.source_id] = entry.note ?? "";
        currencyMap[entry.source_id] = coerceCurrencyCode(
          entry.currency_code ?? primaryCurrency,
          primaryCurrency,
        );
      });
      detail.exchange_rates?.forEach((rate) => {
        ratesMap[rate.quote_currency] = rate.rate ?? "";
      });
      setPeriodMonth(
        formatMonthInTimezone(detail.period_start, effectiveTimezone),
      );
      setAmounts(entries);
      setEntryNotes(notesMap);
      setEntryCurrencies(currencyMap);
      setExchangeRates(ratesMap);
      setNotes(detail.note ?? "");
    },
    [effectiveTimezone, primaryCurrency],
  );

  useEffect(() => {
    if (mode === "edit" && editingSnapshotDetail) {
      applySnapshotDetail(editingSnapshotDetail);
      return;
    }

    if (mode === "create" && latestSnapshotDetail) {
      applySnapshotDetail(latestSnapshotDetail);
      return;
    }

    if (mode === "create" && !latestSnapshotDetail && !editingSnapshotDetail) {
      setPeriodMonth(defaultMonth);
      setAmounts({});
      setEntryNotes(() => {
        const defaults: NoteMap = {};
        flattenedSources.forEach((source) => {
          if (source.billing_default_note) {
            defaults[source.id] = source.billing_default_note;
          }
        });
        return defaults;
      });
      setEntryCurrencies(() => {
        const defaults: CurrencyMap = {};
        flattenedSources.forEach((source) => {
          defaults[source.id] = coerceCurrencyCode(
            source.currency_code || primaryCurrency,
            primaryCurrency,
          );
        });
        return defaults;
      });
      setExchangeRates({});
      setNotes("");
    }
  }, [
    mode,
    latestSnapshotDetail,
    editingSnapshotDetail,
    applySnapshotDetail,
    defaultMonth,
    flattenedSources,
    primaryCurrency,
  ]);

  useEffect(() => {
    if (!flattenedSources.length) {
      return;
    }
    setEntryCurrencies((prev) => {
      const next = { ...prev };
      let updated = false;
      flattenedSources.forEach((source) => {
        if (!next[source.id]) {
          next[source.id] = coerceCurrencyCode(
            source.currency_code || primaryCurrency,
            primaryCurrency,
          );
          updated = true;
        }
      });
      return updated ? next : prev;
    });
  }, [flattenedSources, primaryCurrency]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!periodMonth) {
      toast.showError(t("common.error"), t("finance.cashflowPeriodRequired"));
      return;
    }

    const entries = Object.entries(amounts)
      .map(([id, amount]) => {
        const normalized = amount.trim();
        if (!normalized) {
          return null;
        }
        const entryNote = entryNotes[id]?.trim();
        const currencyCode = coerceCurrencyCode(
          entryCurrencies[id] || primaryCurrency,
          primaryCurrency,
        );
        return {
          id: id as UUID,
          amount: normalized,
          currency_code: currencyCode,
          note: entryNote || undefined,
        };
      })
      .filter(Boolean) as CashflowSnapshotCreatePayload["entries"];

    if (!entries.length) {
      toast.showInfo(t("finance.noBalanceEntered"), t("finance.snapshotHint"));
      return;
    }

    let monthRange;
    try {
      monthRange = monthRangeToIso(periodMonth, effectiveTimezone);
    } catch (error) {
      toast.showError(t("common.error"), t("finance.cashflowPeriodRequired"));
      return;
    }

    const requiredCurrencies = new Set<string>();
    entries.forEach((entry) => {
      if (entry.currency_code && entry.currency_code !== primaryCurrency) {
        requiredCurrencies.add(entry.currency_code);
      }
    });

    const missingRates = new Set<string>();
    requiredCurrencies.forEach((currency) => {
      const rate = exchangeRates[currency];
      if (!rate || !rate.trim()) {
        missingRates.add(currency);
      }
    });

    const hasAnyRateInput = Object.values(exchangeRates).some(
      (value) => value && value.trim() !== "",
    );

    if (hasAnyRateInput && missingRates.size) {
      toast.showError(
        t("common.error"),
        t("finance.missingRates", {
          currencies: Array.from(missingRates).join(", "),
        }),
      );
      return;
    }

    const exchangeRatesPayload = hasAnyRateInput
      ? Array.from(requiredCurrencies).map((currency) => ({
          quote_currency: currency,
          rate: exchangeRates[currency].trim(),
        }))
      : [];

    const payload: CashflowSnapshotCreatePayload = {
      period_start: monthRange.startIso,
      period_end: monthRange.endIso,
      entries,
      exchange_rates: exchangeRatesPayload,
      note: notes.trim() || undefined,
    };

    if (mode === "edit" && editingSnapshotDetail && onUpdateSnapshot) {
      onUpdateSnapshot(editingSnapshotDetail.id as UUID, payload);
      return;
    }

    onCreateSnapshot(payload);
  };

  const snapshotTitle =
    mode === "edit"
      ? t("finance.editCashflowSnapshotTitle")
      : t("finance.newCashflowSnapshot");

  return (
    <section className="rounded-2xl border border-base-200 bg-base-100 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-base-200 bg-base-200/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-base-content">
            {snapshotTitle}
          </h2>
          <p className="text-xs text-base-content/60 sm:text-sm">
            {t("finance.cashflowSnapshotInlineHint")}
          </p>
        </div>
        {headerActions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {headerActions}
          </div>
        ) : null}
      </div>

      <div className="px-4 py-4 sm:px-6">
        <div className="mb-4">
          {treeSelectionDisabled ? (
            <div className="rounded-lg border border-base-200 bg-base-200/40 px-4 py-2">
              <p className="text-xs text-base-content/60">
                {t("finance.cashflowTreeLabel")}
              </p>
              <p className="text-sm font-semibold text-base-content">
                {treeName || "—"}
              </p>
            </div>
          ) : (
            <FinanceTreeSelector
              label={t("finance.cashflowTreeLabel")}
              options={treeOptions}
              value={treeId}
              onChange={onChangeTree}
              disabled={submitting}
              showManage={false}
            />
          )}
        </div>
        <form
          id={CASHFLOW_SNAPSHOT_FORM_ID}
          className="space-y-4"
          onSubmit={handleSubmit}
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-base-content">
            {t("finance.periodMonth")}
            <TextInput
              type="month"
              size="sm"
              className="max-w-xs"
              value={periodMonth}
              onChange={(event) => setPeriodMonth(event.target.value)}
              disabled={submitting}
            />
          </label>

          {autoBillingSources?.length || manualBillingSources?.length ? (
            <div className="rounded-lg border border-dashed border-base-200 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-base-content">
                  {t("finance.billingSectionTitle")}
                </h3>
                {autoBillingSources?.length ? (
                  <ActionButton
                    label={t("finance.applyBillingCycles")}
                    size="sm"
                    color="primary"
                    variant="solid"
                    onClick={() => {
                      if (
                        !monthKey ||
                        !onApplyBillingCycles ||
                        applyBillingPending
                      ) {
                        return;
                      }
                      void onApplyBillingCycles(monthKey);
                    }}
                    disabled={
                      applyBillingPending ||
                      submitting ||
                      !monthKey ||
                      !onApplyBillingCycles
                    }
                  />
                ) : null}
              </div>
              {autoBillingSources?.length ? (
                <p className="text-xs text-base-content/60">
                  {t("finance.autoBillingHint", {
                    names: autoBillingNames || t("common.none"),
                  })}
                </p>
              ) : null}
              {manualBillingSources?.length ? (
                <div className="flex flex-wrap gap-2">
                  {manualBillingSources.map((source) => (
                    <ActionButton
                      key={source.id}
                      label={t("finance.manageBilling", {
                        name: source.name,
                      })}
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        if (!onManageBillingSource || !monthKey) {
                          return;
                        }
                        onManageBillingSource(monthKey, source);
                      }}
                      disabled={
                        submitting || !onManageBillingSource || !monthKey
                      }
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <CashflowAmountTable
            sources={flattenedSources}
            amounts={amounts}
            notes={entryNotes}
            onAmountChange={(id, value) =>
              setAmounts((prev) => ({ ...prev, [id]: value }))
            }
            onNoteChange={(id, value) =>
              setEntryNotes((prev) => ({ ...prev, [id]: value }))
            }
            currencies={entryCurrencies}
            onCurrencyChange={(id, value) =>
              setEntryCurrencies((prev) => ({ ...prev, [id]: value }))
            }
            primaryCurrency={primaryCurrency}
            exchangeRates={exchangeRates}
            disabled={submitting}
          />

          <ExchangeRateInputGrid
            primaryCurrency={primaryCurrency}
            currencies={nonPrimaryCurrencies}
            rates={exchangeRates}
            onChange={(currency, value) =>
              setExchangeRates((prev) => ({ ...prev, [currency]: value }))
            }
            disabled={submitting}
          />

          <p className="text-xs text-base-content/50">
            {t("finance.cashflowSignHint")}
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-base-content">
              {t("finance.cashflowNote")}
            </label>
            <TextArea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("finance.cashflowNotePlaceholder")}
              disabled={submitting}
            />
          </div>
        </form>

        {headerActions ? null : (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <ActionButton
              label={t("common.cancel")}
              onClick={() => onCancel()}
              size="sm"
              variant="ghost"
              disabled={submitting}
            />
            <ActionButton
              label={
                mode === "edit"
                  ? t("common.saveChanges")
                  : t("finance.saveSnapshot")
              }
              type="submit"
              size="sm"
              color="primary"
              variant="solid"
              disabled={submitting}
            />
          </div>
        )}
      </div>
    </section>
  );
}

interface CashflowAmountTableProps {
  sources: CashflowSourceNode[];
  amounts: AmountMap;
  notes: NoteMap;
  onAmountChange: (sourceId: UUID, value: string) => void;
  onNoteChange: (sourceId: UUID, value: string) => void;
  currencies: CurrencyMap;
  onCurrencyChange: (sourceId: UUID, value: string) => void;
  primaryCurrency: string;
  exchangeRates: ExchangeRateState;
  disabled?: boolean;
}

function CashflowAmountTable({
  sources,
  amounts,
  notes,
  onAmountChange,
  onNoteChange,
  currencies,
  onCurrencyChange,
  primaryCurrency,
  exchangeRates,
  disabled,
}: CashflowAmountTableProps) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const expandableKnownRef = useRef<Set<string>>(new Set());

  const parentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    sources.forEach((item) => {
      map.set(item.id, item.parent_id ?? null);
    });
    return map;
  }, [sources]);

  useEffect(() => {
    const expandableIds = new Set<string>();
    sources.forEach((source) => {
      if ((source.children_count ?? 0) > 0) {
        expandableIds.add(source.id);
      }
    });

    setExpandedIds((prev) => {
      const next = new Set(prev);
      Array.from(next).forEach((id) => {
        if (!expandableIds.has(id)) {
          next.delete(id);
        }
      });
      expandableIds.forEach((id) => {
        if (!expandableKnownRef.current.has(id)) {
          next.add(id);
        }
      });
      return next;
    });

    expandableKnownRef.current = expandableIds;
  }, [sources]);

  const visibleSources = useMemo(() => {
    return sources.filter((source) => {
      let parentId = source.parent_id ?? null;
      while (parentId) {
        if (!expandedIds.has(parentId)) {
          return false;
        }
        parentId = parentMap.get(parentId) ?? null;
      }
      return true;
    });
  }, [sources, expandedIds, parentMap]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const numericAmounts = useMemo(() => {
    const map = new Map<string, number>();
    Object.entries(amounts).forEach(([id, raw]) => {
      const normalized = raw.replace(/,/g, ".").trim();
      if (!normalized) {
        return;
      }
      const value = Number(normalized);
      if (!Number.isNaN(value)) {
        map.set(id, value);
      }
    });
    return map;
  }, [amounts]);

  const convertedAmounts = useMemo(() => {
    const map = new Map<string, number>();
    Object.entries(amounts).forEach(([id, raw]) => {
      const normalized = raw.replace(/,/g, ".").trim();
      if (!normalized) {
        return;
      }
      const value = Number(normalized);
      if (Number.isNaN(value)) {
        return;
      }
      const currency = normalizeCurrencyCode(currencies[id] || primaryCurrency);
      if (currency === primaryCurrency) {
        map.set(id, value);
        return;
      }
      const rate = Number(exchangeRates[currency]);
      if (!Number.isNaN(rate) && rate > 0) {
        map.set(id, value * rate);
      }
    });
    return map;
  }, [amounts, currencies, exchangeRates, primaryCurrency]);

  const currencyHeader = t("finance.cashflowCurrency");
  const amountHeader = t("finance.cashflowAmount");
  return (
    <div className="overflow-x-auto rounded-lg border border-base-200">
      <table className="table w-full">
        <thead className="bg-base-200/60 text-xs uppercase text-base-content/60">
          <tr>
            <th className="w-1/2">{t("finance.cashflowSource")}</th>
            <th className="w-24 text-center">{currencyHeader}</th>
            <th className="w-32 text-right">{amountHeader}</th>
            <th className="min-w-[12rem]">{t("finance.cashflowNote")}</th>
          </tr>
        </thead>
        <tbody className="align-top text-sm text-base-content/80">
          {visibleSources.map((source) => {
            const isRollupNode = source.is_rollup || source.children_count > 0;
            const inputDisabled = disabled || isRollupNode;
            const indent = Math.min(source.depth, 6) * 1.5;
            const value = amounts[source.id] ?? "";
            const noteValue = notes[source.id] ?? "";
            const entryCurrency = normalizeCurrencyCode(
              currencies[source.id] || primaryCurrency,
            );
            const placeholder = isRollupNode
              ? t("finance.rollupAutoPlaceholder")
              : "0";
            let aggregatedValue: number | null = null;
            if (isRollupNode) {
              const prefix = `${source.path}/`;
              let sum = 0;
              let hasValue = false;
              let hasMissingRate = false;
              sources.forEach((node) => {
                if (node.path.startsWith(prefix)) {
                  const rawValue = numericAmounts.get(node.id);
                  if (rawValue === undefined) {
                    return;
                  }
                  hasValue = true;
                  const converted = convertedAmounts.get(node.id);
                  if (converted === undefined) {
                    hasMissingRate = true;
                    return;
                  }
                  sum += converted;
                }
              });
              aggregatedValue = hasValue && !hasMissingRate ? sum : null;
            }
            const summaryAmount = source.aggregated_amount ?? aggregatedValue;
            const hasChildren = (source.children_count ?? 0) > 0;
            const isExpanded = expandedIds.has(source.id);
            const badges: string[] = [];
            if (source.kind === "billing") {
              badges.push(t("finance.billingLabel"));
              if (source.billing_requires_manual_input) {
                badges.push(t("finance.manualEntry"));
              }
            }
            if (isRollupNode) {
              badges.push(t("finance.rollupLabelShort"));
            }

            const amountDisplay =
              summaryAmount != null && summaryAmount !== ""
                ? formatDecimalValue(summaryAmount)
                : null;

            return (
              <tr key={source.id} className="border-base-200">
                <td className="align-top">
                  <div
                    className="flex items-start gap-2"
                    style={{ paddingLeft: `${indent}rem` }}
                  >
                    {hasChildren ? (
                      <ActionButton
                        label=""
                        iconName={isExpanded ? "chevron-down" : "chevron-right"}
                        iconOnly
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        ariaLabel={
                          isExpanded ? t("common.collapse") : t("common.expand")
                        }
                        ariaExpanded={isExpanded}
                        onClick={() => handleToggle(source.id)}
                      />
                    ) : (
                      <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center text-base-content/30">
                        •
                      </span>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-base-content">
                          {source.name}
                        </span>
                        {badges.map((badge) => (
                          <Badge
                            key={`${source.id}-${badge}`}
                            size="xs"
                            variant="outline"
                            className="font-normal"
                          >
                            {badge}
                          </Badge>
                        ))}
                      </div>
                      {source.metadata?.description ? (
                        <div className="text-xs text-base-content/60">
                          {String(source.metadata.description)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="w-24 align-top text-center">
                  {inputDisabled ? (
                    summaryAmount != null ? (
                      <span className="text-xs text-base-content/70">
                        {primaryCurrency}
                      </span>
                    ) : (
                      <span className="text-base-content/40">—</span>
                    )
                  ) : (
                    <EnumSelect
                      value={entryCurrency}
                      onChange={(value) =>
                        onCurrencyChange(source.id, String(value ?? ""))
                      }
                      options={CASHFLOW_CURRENCY_OPTIONS}
                      showLabel={false}
                      size="sm"
                      className="w-full"
                      disabled={disabled}
                    />
                  )}
                </td>
                <td className="w-32 align-top text-right">
                  {inputDisabled ? (
                    amountDisplay ? (
                      <span className="tabular-nums text-base-content">
                        {amountDisplay}
                      </span>
                    ) : (
                      <span className="text-base-content/40">—</span>
                    )
                  ) : (
                    <TextInput
                      type="text"
                      inputMode="decimal"
                      size="sm"
                      className="text-right"
                      value={value}
                      onChange={(event) =>
                        onAmountChange(source.id, event.target.value)
                      }
                      placeholder={placeholder}
                      disabled={disabled}
                    />
                  )}
                </td>
                <td className="align-top">
                  {inputDisabled ? (
                    noteValue ? (
                      <span className="block min-h-[2.25rem] text-sm text-base-content">
                        {noteValue}
                      </span>
                    ) : (
                      <span className="text-base-content/40">—</span>
                    )
                  ) : (
                    <TextArea
                      size="sm"
                      className="textarea-xs"
                      rows={1}
                      value={noteValue}
                      placeholder={t("finance.cashflowEntryNotePlaceholder")}
                      onChange={(event) =>
                        onNoteChange(source.id, event.target.value)
                      }
                      disabled={disabled}
                    />
                  )}
                </td>
              </tr>
            );
          })}
          {!visibleSources.length ? (
            <tr>
              <td
                colSpan={4}
                className="py-4 text-center text-xs text-base-content/60"
              >
                —
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
