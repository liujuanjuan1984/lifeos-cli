import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorDisplay from "@/components/ErrorDisplay";
import ActionButton from "@/components/ActionButton";
import { TextInput } from "@/components/forms";
import { useToastMutation } from "@/hooks/useToastMutation";
import { financeApi } from "@/services/api/finance";
import { financeKeys } from "@/services/api/queryKeys";
import type { CashflowSourceNode } from "@/services/api/finance";
import type { BillingCycleHistoryResponse } from "@/services/api/finance";

interface BillingCycleHistoryModalProps {
  open: boolean;
  onClose: () => void;
  month: string;
  source: CashflowSourceNode | null;
  onSaved: () => void;
}

type EditableEntry = {
  amount: string;
  note: string;
};

const BillingCycleHistoryModal = ({
  open,
  onClose,
  month,
  source,
  onSaved,
}: BillingCycleHistoryModalProps) => {
  const { t } = useTranslation();

  const isEnabled = open && Boolean(source) && Boolean(month);

  const historyQuery = useQuery<BillingCycleHistoryResponse>({
    queryKey: financeKeys.billingCycleHistory(source?.id, month),
    queryFn: () => financeApi.getBillingCycleHistory(source!.id, month),
    enabled: isEnabled,
  });

  const [entries, setEntries] = useState<Record<string, EditableEntry>>({});

  useEffect(() => {
    if (!historyQuery.data) {
      setEntries({});
      return;
    }
    const next: Record<string, EditableEntry> = {};
    historyQuery.data.cycles.forEach((cycle) => {
      const key = `${cycle.cycle_start}_${cycle.cycle_end}`;
      next[key] = {
        amount: cycle.amount ?? "",
        note: cycle.note ?? "",
      };
    });
    setEntries(next);
  }, [historyQuery.data]);

  const cycles = historyQuery.data?.cycles ?? [];

  const mutation = useToastMutation({
    mutationFn: async () => {
      if (!source) {
        throw new Error("缺少来源信息");
      }
      const payloadEntries = Object.entries(entries)
        .filter(([, value]) => value.amount.trim())
        .map(([key, value]) => {
          const [cycleStart, cycleEnd] = key.split("_");
          return {
            cycle_start: cycleStart,
            cycle_end: cycleEnd,
            amount: value.amount.trim(),
            note: value.note.trim() || undefined,
          };
        });
      await financeApi.upsertBillingCycleEntries(source.id, {
        month,
        entries: payloadEntries,
      });
    },
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.billingSaved"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description: error instanceof Error ? error.message : undefined,
    }),
    onSuccess: async () => {
      await historyQuery.refetch();
      onSaved();
    },
  });

  const handleChange = (
    key: string,
    field: keyof EditableEntry,
    value: string,
  ) => {
    setEntries((prev) => ({
      ...prev,
      [key]: {
        amount: field === "amount" ? value : (prev[key]?.amount ?? ""),
        note: field === "note" ? value : (prev[key]?.note ?? ""),
      },
    }));
  };

  const modalTitle = useMemo(() => {
    if (!source) return t("finance.billingHistory");
    return t("finance.billingHistoryFor", {
      name: source.name,
    });
  }, [source, t]);

  if (!open || !source) {
    return null;
  }

  return (
    <ModalBase isOpen={open} onClose={onClose} title={modalTitle} size="lg">
      {historyQuery.isLoading ? (
        <div className="py-10">
          <LoadingSpinner />
        </div>
      ) : historyQuery.isError ? (
        <ErrorDisplay
          error={(historyQuery.error as Error)?.message ?? t("common.error")}
        />
      ) : cycles.length === 0 ? (
        <p className="py-6 text-sm text-base-content/60">
          {t("finance.noBillingCycles")}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-base-200/60 text-xs uppercase text-base-content/60">
                <tr>
                  <th className="px-4 py-2 text-left">
                    {t("finance.billingCycle")}
                  </th>
                  <th className="px-4 py-2 text-right">
                    {t("finance.amount")}
                  </th>
                  <th className="px-4 py-2 text-left">{t("finance.note")}</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((cycle) => {
                  const key = `${cycle.cycle_start}_${cycle.cycle_end}`;
                  const value = entries[key] ?? { amount: "", note: "" };
                  const numericAmount = Number(value.amount);
                  const amountClass =
                    numericAmount < 0
                      ? "text-error"
                      : numericAmount > 0
                        ? "text-success"
                        : "text-base-content";
                  return (
                    <tr key={key} className="border-t border-base-200">
                      <td className="px-4 py-2 text-base-content">
                        {formatMonthDisplay(cycle.posted_month ?? month)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <TextInput
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          className={`w-28 tabular-nums ${amountClass}`}
                          value={value.amount}
                          placeholder="0"
                          onChange={(event) =>
                            handleChange(key, "amount", event.target.value)
                          }
                          disabled={mutation.isPending}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <TextInput
                          type="text"
                          size="sm"
                          value={value.note}
                          placeholder={t("finance.optional")}
                          onChange={(event) =>
                            handleChange(key, "note", event.target.value)
                          }
                          disabled={mutation.isPending}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <ActionButton
          label={t("common.cancel")}
          size="sm"
          variant="ghost"
          onClick={onClose}
          disabled={mutation.isPending}
        />
        <ActionButton
          label={t("common.save")}
          size="sm"
          color="primary"
          variant="solid"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || cycles.length === 0}
        />
      </div>
    </ModalBase>
  );
};

export default BillingCycleHistoryModal;

function formatMonthDisplay(month: string | null | undefined): string {
  return month ? month.slice(0, 7) : "";
}
