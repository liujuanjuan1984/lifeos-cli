import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ActionButton, { CreateNewButton } from "@/components/ActionButton";
import ErrorDisplay from "@/components/ErrorDisplay";
import LoadingSpinner from "@/components/LoadingSpinner";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import { Checkbox, RadioGroup, TextInput } from "@/components/forms";
import ModalBase from "@/layouts/ModalBase";
import CashflowSourceTree from "@/components/finance/CashflowSourceTree";
import { FinanceTreeSelector } from "@/components/finance/FinanceTreeSelector";
import {
  DEFAULT_PRIMARY_CURRENCY,
  PRIMARY_CURRENCY_OPTION_DEFINITIONS,
} from "@/config/financePreferences";
import type {
  CashflowSourceCreatePayload,
  CashflowSourceNode,
  CashflowSourceUpdatePayload,
} from "@/services/api/finance";
import type { UUID } from "@/types/primitive";
import { flattenTree } from "@/features/finance/shared";
import ManualBillingEntriesModal from "./ManualBillingEntriesModal";

interface CashflowSourceModalProps {
  open: boolean;
  onClose: () => void;
  sources: CashflowSourceNode[];
  loading: boolean;
  error?: string | null;
  treeId: UUID | null;
  treeOptions: Array<{ value: UUID; label: string }>;
  onChangeTree: (id: UUID) => void;
  onManageTree: () => void;
  onCreateSource: (
    payload: CashflowSourceCreatePayload,
  ) => Promise<void> | void;
  onUpdateSource: (
    id: UUID,
    payload: CashflowSourceUpdatePayload,
  ) => Promise<void> | void;
  creating: boolean;
  updating: boolean;
  onManualBillingSaved?: () => void;
}

type FormState =
  | { mode: "create"; parentId?: UUID | null }
  | { mode: "edit"; source: CashflowSourceNode };

type CashflowSourceFormValues = {
  name: string;
  parentId: string;
  kind: "regular" | "billing";
  currencyCode: string;
  billing_cycle_type: "day" | "week" | "month" | "year";
  billing_cycle_interval: string;
  billing_anchor_date: string;
  billing_anchor_day: string;
  billing_post_to: "start" | "end";
  billing_requires_manual_input: boolean;
  billing_default_amount: string;
  billing_default_note: string;
};

export function CashflowSourceModal({
  open,
  onClose,
  sources,
  loading,
  error,
  treeId,
  treeOptions,
  onChangeTree,
  onManageTree,
  onCreateSource,
  onUpdateSource,
  creating,
  updating,
  onManualBillingSaved,
}: CashflowSourceModalProps) {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<FormState | null>(null);
  const [manualBillingViewer, setManualBillingViewer] =
    useState<CashflowSourceNode | null>(null);

  useEffect(() => {
    if (!open) {
      setFormState(null);
      setManualBillingViewer(null);
    }
  }, [open]);

  const actionsDisabled = creating || updating;
  const handleCloseForm = () => {
    if (creating || updating) {
      return;
    }
    setFormState(null);
  };

  const handleSubmitForm = async (values: CashflowSourceFormValues) => {
    if (!formState) {
      return;
    }

    const parentId = values.parentId ? (values.parentId as UUID) : null;
    const kind = values.kind;

    const buildBillingPayload = () => {
      if (kind !== "billing") {
        return {
          billing_cycle_type: null,
          billing_cycle_interval: null,
          billing_anchor_day: null,
          billing_anchor_date: null,
          billing_post_to: null,
          billing_default_amount: null,
          billing_default_note: null,
          billing_requires_manual_input: false,
        };
      }

      const payload: Partial<CashflowSourceCreatePayload> = {
        billing_cycle_type: values.billing_cycle_type,
        billing_cycle_interval: Number(values.billing_cycle_interval) || 1,
        billing_anchor_date: values.billing_anchor_date || undefined,
        billing_post_to: values.billing_post_to,
        billing_requires_manual_input: values.billing_requires_manual_input,
      };

      if (
        values.billing_cycle_type === "month" ||
        values.billing_cycle_type === "year"
      ) {
        payload.billing_anchor_day = values.billing_anchor_day
          ? Number(values.billing_anchor_day)
          : null;
      } else {
        payload.billing_anchor_day = null;
      }

      const trimmedAmount = values.billing_default_amount.trim();
      if (trimmedAmount) {
        payload.billing_default_amount = trimmedAmount;
      } else {
        payload.billing_default_amount = null;
      }

      const trimmedNote = values.billing_default_note.trim();
      if (trimmedNote) {
        payload.billing_default_note = trimmedNote;
      } else {
        payload.billing_default_note = null;
      }

      return payload;
    };

    const submit = async () => {
      if (formState.mode === "create") {
        const billingPayload = buildBillingPayload();
        const createPayload: CashflowSourceCreatePayload = {
          name: values.name.trim(),
          kind,
          currency_code: values.currencyCode,
        };
        if (parentId) {
          createPayload.parent_id = parentId;
        }
        Object.assign(createPayload, billingPayload);
        await onCreateSource(createPayload);
        return;
      }

      const { source } = formState;
      const billingPayload = buildBillingPayload();
      const updatePayload: CashflowSourceUpdatePayload = {
        name: values.name.trim(),
        kind,
        currency_code: values.currencyCode,
      };
      if (parentId !== (source.parent_id ?? null)) {
        updatePayload.parent_id = parentId;
      }
      Object.assign(updatePayload, billingPayload);
      await onUpdateSource(source.id as UUID, updatePayload);
    };

    setFormState(null);
    await submit();
  };

  return (
    <>
      <ModalBase
        isOpen={open}
        onClose={onClose}
        title={t("finance.cashflowSources")}
        size="xl"
      >
        {loading ? (
          <div className="py-10">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <ErrorDisplay error={error} />
        ) : (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-200 bg-base-200/40 px-4 py-2">
              <FinanceTreeSelector
                label={t("finance.cashflowTreeLabel")}
                options={treeOptions}
                value={treeId}
                onChange={onChangeTree}
                disabled={actionsDisabled}
                showManage={false}
              />
              <ActionButton
                label={t("finance.manageTrees")}
                onClick={onManageTree}
                size="sm"
                variant="outline"
                disabled={actionsDisabled}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-base-content/70">
                {t("finance.cashflowSourceHint")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <CreateNewButton
                  label={t("finance.addSource")}
                  size="sm"
                  onClick={() =>
                    setFormState({ mode: "create", parentId: null })
                  }
                  disabled={actionsDisabled}
                  loading={creating}
                />
              </div>
            </div>
            <CashflowSourceTree
              sources={sources ?? []}
              onCreateChild={(node) =>
                setFormState({ mode: "create", parentId: node.id as UUID })
              }
              onEdit={(node) => setFormState({ mode: "edit", source: node })}
              onViewManualBilling={(node) => {
                if (node.kind === "billing") {
                  setManualBillingViewer(node);
                }
              }}
              actionsDisabled={actionsDisabled}
            />
          </div>
        )}
      </ModalBase>

      <CashflowSourceFormModal
        open={Boolean(formState)}
        mode={formState?.mode ?? "create"}
        sources={sources ?? []}
        submitting={formState?.mode === "edit" ? updating : creating}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
        defaultParentId={
          formState?.mode === "create"
            ? (formState.parentId ?? null)
            : undefined
        }
        editingSource={
          formState?.mode === "edit" ? formState.source : undefined
        }
      />

      <ManualBillingEntriesModal
        open={Boolean(manualBillingViewer)}
        onClose={() => setManualBillingViewer(null)}
        source={manualBillingViewer}
        onSaved={onManualBillingSaved ?? (() => void 0)}
      />
    </>
  );
}

interface CashflowSourceFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  sources: CashflowSourceNode[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: CashflowSourceFormValues) => Promise<void> | void;
  defaultParentId?: UUID | null;
  editingSource?: CashflowSourceNode;
}

function CashflowSourceFormModal({
  open,
  mode,
  sources,
  submitting,
  onClose,
  onSubmit,
  defaultParentId = null,
  editingSource,
}: CashflowSourceFormModalProps) {
  const { t } = useTranslation();

  const flattened = useMemo(() => flattenTree(sources ?? []), [sources]);

  const excludedParentIds = useMemo(() => {
    if (mode !== "edit" || !editingSource) {
      return new Set<string>();
    }
    const ids = new Set<string>([editingSource.id]);
    const walk = (node: CashflowSourceNode) => {
      node.children?.forEach((child) => {
        ids.add(child.id);
        walk(child);
      });
    };
    walk(editingSource);
    return ids;
  }, [mode, editingSource]);

  const parentOptions = useMemo(() => {
    const options = flattened
      .filter((node) => !excludedParentIds.has(node.id))
      .map((node) => ({
        value: node.id,
        label: `${"— ".repeat(node.depth)}${node.name}`.trim() || node.name,
      }));
    return [{ value: "", label: t("finance.rootSource") }, ...options];
  }, [flattened, excludedParentIds, t]);
  const parentSelectOptions = useMemo<EnumOption[]>(
    () =>
      parentOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [parentOptions],
  );
  const currencyOptions = useMemo<EnumOption[]>(
    () =>
      PRIMARY_CURRENCY_OPTION_DEFINITIONS.map((option) => ({
        value: option.code,
        label: option.code,
      })),
    [],
  );
  const billingCycleOptions = useMemo<EnumOption[]>(
    () => [
      { value: "day", label: t("finance.cycleDay") },
      { value: "week", label: t("finance.cycleWeek") },
      { value: "month", label: t("finance.cycleMonth") },
      { value: "year", label: t("finance.cycleYear") },
    ],
    [t],
  );
  const billingPostToOptions = useMemo<EnumOption[]>(
    () => [
      { value: "end", label: t("finance.postToEnd") },
      { value: "start", label: t("finance.postToStart") },
    ],
    [t],
  );

  const [values, setValues] = useState<CashflowSourceFormValues>(() =>
    buildInitialValues({ mode, defaultParentId, editingSource }),
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setValues(buildInitialValues({ mode, defaultParentId, editingSource }));
  }, [open, mode, defaultParentId, editingSource]);

  const handleChange = <Key extends keyof CashflowSourceFormValues>(
    key: Key,
    value: CashflowSourceFormValues[Key],
  ) => {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.name.trim()) {
      return;
    }
    if (
      values.kind === "billing" &&
      (!values.billing_anchor_date || !values.billing_anchor_date.trim())
    ) {
      return;
    }
    await onSubmit(values);
  };

  return (
    <ModalBase
      isOpen={open}
      onClose={onClose}
      title={
        mode === "edit"
          ? t("finance.editCashflowSource")
          : t("finance.addCashflowSource")
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-base-content">
            {t("finance.newSourceName")}
            <TextInput
              value={values.name}
              onChange={(event) => handleChange("name", event.target.value)}
              placeholder={t("finance.newSourcePlaceholder")}
              size="sm"
              disabled={submitting}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-base-content">
            {t("finance.parentSource")}
            <EnumSelect
              value={values.parentId}
              onChange={(value) =>
                handleChange("parentId", String(value ?? ""))
              }
              options={parentSelectOptions}
              includeEmptyOption
              showLabel={false}
              size="sm"
              className="w-full"
              disabled={submitting}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-base-content">
            {t("finance.cashflowSourceDefaultCurrency")}
            <EnumSelect
              value={values.currencyCode}
              onChange={(value) =>
                handleChange("currencyCode", String(value ?? ""))
              }
              options={currencyOptions}
              showLabel={false}
              size="sm"
              className="w-full"
              disabled={submitting}
            />
          </label>
        </div>

        <RadioGroup
          direction="horizontal"
          size="sm"
          disabled={submitting}
          value={values.kind}
          options={[
            {
              value: "regular",
              label: t("finance.kindRegular"),
            },
            {
              value: "billing",
              label: t("finance.billingLabel"),
            },
          ]}
          onChange={(nextValue) =>
            handleChange("kind", nextValue as "regular" | "billing")
          }
        />

        <p className="text-xs text-base-content/60">
          {t("finance.rollupHint")}
        </p>

        {values.kind === "billing" ? (
          <div className="space-y-3 rounded-lg border border-dashed border-base-200 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-base-content/60">
                {t("finance.billingCycleType")}
                <EnumSelect
                  value={values.billing_cycle_type}
                  onChange={(value) =>
                    handleChange(
                      "billing_cycle_type",
                      String(value) as "day" | "week" | "month" | "year",
                    )
                  }
                  options={billingCycleOptions}
                  showLabel={false}
                  size="sm"
                  className="w-full"
                  disabled={submitting}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-base-content/60">
                {t("finance.billingInterval")}
                <TextInput
                  type="number"
                  min={1}
                  value={values.billing_cycle_interval}
                  onChange={(event) =>
                    handleChange("billing_cycle_interval", event.target.value)
                  }
                  size="sm"
                  disabled={submitting}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-base-content/60">
                {t("finance.billingAnchorDate")}
                <TextInput
                  type="date"
                  value={values.billing_anchor_date}
                  onChange={(event) =>
                    handleChange("billing_anchor_date", event.target.value)
                  }
                  size="sm"
                  disabled={submitting}
                />
              </label>
              {(values.billing_cycle_type === "month" ||
                values.billing_cycle_type === "year") && (
                <label className="flex flex-col gap-1 text-xs text-base-content/60">
                  {t("finance.billingAnchorDay")}
                  <TextInput
                    type="number"
                    min={1}
                    max={28}
                    value={values.billing_anchor_day}
                    onChange={(event) =>
                      handleChange("billing_anchor_day", event.target.value)
                    }
                    size="sm"
                    disabled={submitting}
                  />
                </label>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-base-content/60">
                {t("finance.billingPostTo")}
                <EnumSelect
                  value={values.billing_post_to}
                  onChange={(value) =>
                    handleChange(
                      "billing_post_to",
                      String(value) as "start" | "end",
                    )
                  }
                  options={billingPostToOptions}
                  showLabel={false}
                  size="sm"
                  className="w-full"
                  disabled={submitting}
                />
              </label>
              <div className="pt-4 sm:pt-6">
                <Checkbox
                  checked={values.billing_requires_manual_input}
                  onCheckedChange={(checked) =>
                    handleChange("billing_requires_manual_input", checked)
                  }
                  disabled={submitting}
                  size="sm"
                  label={t("finance.manualBillingInput")}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-base-content/60">
                {t("finance.defaultAmount")}
                <TextInput
                  type="text"
                  inputMode="decimal"
                  value={values.billing_default_amount}
                  onChange={(event) =>
                    handleChange("billing_default_amount", event.target.value)
                  }
                  placeholder="0"
                  size="sm"
                  disabled={submitting}
                />
                <span className="text-[0.68rem] text-base-content/50">
                  {values.billing_requires_manual_input
                    ? t("finance.optionalDefaultAmount")
                    : t("finance.requiredDefaultAmount")}
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs text-base-content/60">
                {t("finance.defaultNote")}
                <TextInput
                  type="text"
                  value={values.billing_default_note}
                  onChange={(event) =>
                    handleChange("billing_default_note", event.target.value)
                  }
                  placeholder={t("finance.optional")}
                  size="sm"
                  disabled={submitting}
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <ActionButton
            type="button"
            variant="ghost"
            label={t("common.cancel")}
            onClick={onClose}
            disabled={submitting}
          />
          <ActionButton
            type="submit"
            color="primary"
            variant="solid"
            label={
              mode === "edit" ? t("common.saveChanges") : t("finance.addSource")
            }
            disabled={submitting}
          />
        </div>
      </form>
    </ModalBase>
  );
}

function buildInitialValues({
  mode,
  defaultParentId,
  editingSource,
}: {
  mode: "create" | "edit";
  defaultParentId: UUID | null;
  editingSource?: CashflowSourceNode;
}): CashflowSourceFormValues {
  if (mode === "edit" && editingSource) {
    return {
      name: editingSource.name,
      parentId: editingSource.parent_id ?? "",
      kind: editingSource.kind as "regular" | "billing",
      currencyCode: editingSource.currency_code || DEFAULT_PRIMARY_CURRENCY,
      billing_cycle_type:
        (editingSource.billing_cycle_type as
          | "day"
          | "week"
          | "month"
          | "year") ?? "month",
      billing_cycle_interval:
        editingSource.billing_cycle_interval != null
          ? String(editingSource.billing_cycle_interval)
          : "1",
      billing_anchor_date: editingSource.billing_anchor_date ?? "",
      billing_anchor_day:
        editingSource.billing_anchor_day != null
          ? String(editingSource.billing_anchor_day)
          : "12",
      billing_post_to:
        (editingSource.billing_post_to as "start" | "end") ?? "end",
      billing_requires_manual_input:
        editingSource.billing_requires_manual_input ?? true,
      billing_default_amount: editingSource.billing_default_amount ?? "",
      billing_default_note: editingSource.billing_default_note ?? "",
    };
  }

  return {
    name: "",
    parentId: defaultParentId ?? "",
    kind: "regular",
    currencyCode: DEFAULT_PRIMARY_CURRENCY,
    billing_cycle_type: "month",
    billing_cycle_interval: "1",
    billing_anchor_date: "",
    billing_anchor_day: "12",
    billing_post_to: "end",
    billing_requires_manual_input: true,
    billing_default_amount: "",
    billing_default_note: "",
  };
}
