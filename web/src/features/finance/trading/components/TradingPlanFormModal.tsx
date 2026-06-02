import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import { FormActions } from "@/components/ActionButton";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import { FormField, TextArea, TextInput } from "@/components/forms";
import type {
  TradingPlanPayload,
  TradingPlanResponse,
} from "@/services/api/finance";
import { utcToLocalDateTimeLocal } from "@/utils/datetime";

type PlanFormMode = "create" | "edit";

interface TradingPlanFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: PlanFormMode;
  loading: boolean;
  onSubmit: (payload: TradingPlanPayload) => Promise<void>;
  initialValues?: TradingPlanResponse | null;
  existingPlans: TradingPlanResponse[];
}

const PLAN_STATUSES: Array<{
  value: TradingPlanPayload["status"];
  labelKey: string;
}> = [
  { value: "draft", labelKey: "finance.trading.statusDraft" },
  { value: "active", labelKey: "finance.trading.statusActive" },
  { value: "archived", labelKey: "finance.trading.statusArchived" },
];

function toDateTimeInput(value?: string | null): string {
  if (!value) return "";
  return utcToLocalDateTimeLocal(value);
}

function normalizeRoiInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed.replace(/%/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (Math.abs(numeric) > 1) {
    return (numeric / 100).toString();
  }
  return numeric.toString();
}

export function TradingPlanFormModal({
  open,
  onClose,
  mode,
  loading,
  onSubmit,
  initialValues,
  existingPlans,
}: TradingPlanFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [targetRoi, setTargetRoi] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<TradingPlanPayload["status"]>("draft");
  const [copySourceId, setCopySourceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const copyablePlans = useMemo(
    () => existingPlans.filter((plan) => plan.id !== initialValues?.id),
    [existingPlans, initialValues?.id],
  );
  const copySourceOptions = useMemo<EnumOption[]>(
    () => [
      {
        value: "",
        label: t("finance.trading.modals.copyPlaceholder"),
      },
      ...copyablePlans.map((plan) => ({
        value: plan.id,
        label: plan.name,
      })),
    ],
    [copyablePlans, t],
  );
  const statusOptions = useMemo<EnumOption[]>(
    () =>
      PLAN_STATUSES.map((option) => ({
        value: String(option.value),
        label: t(option.labelKey),
      })),
    [t],
  );

  useEffect(() => {
    if (!open) {
      setName("");
      setPeriodStart("");
      setPeriodEnd("");
      setTargetRoi("");
      setNote("");
      setStatus("draft");
      setCopySourceId("");
      setError(null);
      return;
    }

    if (initialValues) {
      setName(initialValues.name ?? "");
      setPeriodStart(toDateTimeInput(initialValues.period_start));
      setPeriodEnd(toDateTimeInput(initialValues.period_end));
      setTargetRoi(initialValues.target_roi ?? "");
      setNote(initialValues.note ?? "");
      setStatus(initialValues.status ?? "draft");
    } else {
      setName("");
      setPeriodStart("");
      setPeriodEnd("");
      setTargetRoi("");
      setNote("");
      setStatus("draft");
    }
    setCopySourceId("");
    setError(null);
  }, [open, initialValues]);

  const title =
    mode === "edit"
      ? t("finance.trading.modals.editPlan")
      : t("finance.trading.modals.createPlan");

  const handleCopyFrom = (planId: string) => {
    setCopySourceId(planId);
    if (!planId) return;
    const source = existingPlans.find((plan) => plan.id === planId);
    if (!source) return;
    setName(`${source.name} ${t("finance.trading.modals.copySuffix")}`.trim());
    setPeriodStart(toDateTimeInput(source.period_start));
    setPeriodEnd(toDateTimeInput(source.period_end));
    setTargetRoi(source.target_roi ?? "");
    setNote(source.note ?? "");
    setStatus(source.status ?? "draft");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("finance.trading.errors.nameRequired"));
      return;
    }

    const payload: TradingPlanPayload = {
      name: name.trim(),
      period_start: periodStart ? new Date(periodStart).toISOString() : null,
      period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
      target_roi: normalizeRoiInput(targetRoi ?? ""),
      note: note?.trim() ? note.trim() : null,
    };

    if (mode === "edit") {
      payload.status = status;
    }

    if (
      payload.period_start &&
      payload.period_end &&
      new Date(payload.period_end).getTime() <
        new Date(payload.period_start).getTime()
    ) {
      setError(t("finance.trading.errors.invalidPeriod"));
      return;
    }

    const submission = onSubmit(payload);
    submission.catch((err) => {
      console.error("Failed to save trading plan:", err);
    });
    onClose();
  };

  return (
    <ModalBase
      isOpen={open}
      onClose={onClose}
      title={title}
      size="lg"
      error={error}
      onErrorDismiss={() => setError(null)}
    >
      <form
        id="trading-plan-form"
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        {mode === "create" && copyablePlans.length > 0 && (
          <FormField
            label={t("finance.trading.modals.copyLabel")}
            description={t("finance.trading.modals.copyDescription") ?? ""}
          >
            <EnumSelect
              value={copySourceId}
              onChange={(value) => handleCopyFrom(String(value ?? ""))}
              options={copySourceOptions}
              includeEmptyOption
              showLabel={false}
              className="w-full"
            />
          </FormField>
        )}

        <FormField label={t("finance.trading.fields.name")} required>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={t("finance.trading.fields.periodStart")}>
            <TextInput
              type="datetime-local"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </FormField>
          <FormField label={t("finance.trading.fields.periodEnd")}>
            <TextInput
              type="datetime-local"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label={t("finance.trading.fields.targetRoi")}
          description={t("finance.trading.fields.targetRoiHelper") ?? ""}
        >
          <TextInput
            value={targetRoi}
            onChange={(e) => setTargetRoi(e.target.value)}
            placeholder="12%"
          />
        </FormField>

        {mode === "edit" && (
          <FormField label={t("finance.trading.fields.status")}>
            <EnumSelect
              value={status}
              onChange={(value) =>
                setStatus(String(value) as TradingPlanPayload["status"])
              }
              options={statusOptions}
              showLabel={false}
              className="w-full"
            />
          </FormField>
        )}

        <FormField label={t("finance.trading.fields.note")}>
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </FormField>
      </form>

      <div className="mt-6">
        <FormActions
          onCancel={onClose}
          onSubmit={() => {
            const form = document.getElementById("trading-plan-form");
            form?.dispatchEvent(
              new Event("submit", { cancelable: true, bubbles: true }),
            );
          }}
          loading={loading}
          submitText={
            mode === "edit" ? t("common.save") : t("common.create_new")
          }
        />
      </div>
    </ModalBase>
  );
}
