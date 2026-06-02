import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import { FormActions } from "@/components/ActionButton";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import { FormField, TextInput } from "@/components/forms";
import type { FinanceAccountCreatePayload } from "@/services/api/finance";
import { normalizeCurrencyCode } from "@/utils/core";

type ParentOption = {
  id: string;
  label: string;
};

type FinanceAccountFormMode = "create" | "edit";

type FinanceAccountFormValues = Partial<FinanceAccountCreatePayload> & {
  interest_rate?: string | null;
};

interface FinanceAccountFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: FinanceAccountCreatePayload) => Promise<void>;
  submitting: boolean;
  parentOptions: ParentOption[];
  defaultCurrency: string;
  mode?: FinanceAccountFormMode;
  initialValues?: FinanceAccountFormValues | null;
}

function formatInterestRateForInput(value?: string | null) {
  if (value === null || value === undefined) {
    return "";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }

  const percent = Number((numeric * 100).toFixed(6));
  if (!Number.isFinite(percent)) {
    return "";
  }

  return percent.toString();
}

function FinanceAccountFormModal({
  open,
  onClose,
  onSubmit,
  submitting,
  parentOptions,
  defaultCurrency,
  mode = "create",
  initialValues,
}: FinanceAccountFormModalProps) {
  const { t } = useTranslation();
  const formId = "finance-account-form";

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [currency, setCurrency] = useState<string>(
    normalizeCurrencyCode(defaultCurrency || ""),
  );
  const [interestRate, setInterestRate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const applyInitialValues = useCallback(
    (values?: FinanceAccountFormValues | null) => {
      const baseCurrency = normalizeCurrencyCode(defaultCurrency || "");
      const resolvedCurrency = normalizeCurrencyCode(
        (values?.currency_code as string | undefined) ?? baseCurrency,
      );

      setName(values?.name?.toString() ?? "");
      const nextParent = values?.parent_id ?? null;
      setParentId(nextParent ? String(nextParent) : "");
      setCurrency(resolvedCurrency || baseCurrency);
      setInterestRate(formatInterestRateForInput(values?.interest_rate));
      setError(null);
    },
    [defaultCurrency],
  );

  useEffect(() => {
    if (open) {
      applyInitialValues(initialValues);
    } else {
      applyInitialValues(null);
    }
  }, [open, initialValues, applyInitialValues]);

  const resolvedMode: FinanceAccountFormMode = mode ?? "create";

  const modalTitle =
    resolvedMode === "edit"
      ? t("finance.editAccountTitle")
      : t("finance.createAccountTitle");

  const modalSubtitle =
    resolvedMode === "edit"
      ? t("finance.editAccountSubtitle")
      : t("finance.createAccountSubtitle");

  const submitLabel =
    resolvedMode === "edit" ? t("common.saveChanges") : t("common.save");
  const parentSelectOptions = useMemo<EnumOption[]>(
    () => [
      { value: "", label: t("common.none") },
      ...parentOptions.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    ],
    [parentOptions, t],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setError(t("finance.accountNameLabel") + t("common.required"));
      return;
    }

    if (!currency.trim()) {
      setError(t("finance.accountCurrencyLabel") + t("common.required"));
      return;
    }

    setError(null);

    const trimmedInterest = interestRate.trim();
    let normalizedInterest: string | undefined;

    if (trimmedInterest) {
      const cleaned = trimmedInterest.replace(/%/g, "");
      const interestNumeric = Number(cleaned);

      if (!Number.isFinite(interestNumeric)) {
        setError(t("finance.accountInterestInvalid"));
        return;
      }

      const treatedAsPercent = Math.abs(interestNumeric) > 1;
      const fraction = treatedAsPercent
        ? interestNumeric / 100
        : interestNumeric;
      normalizedInterest = fraction.toString();
    }

    try {
      await onSubmit({
        name: name.trim(),
        parent_id: parentId ? (parentId as string) : null,
        type: "asset",
        currency_code: normalizeCurrencyCode(currency),
        interest_rate: normalizedInterest,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("finance.createAccountFailed");
      setError(message);
    }
  };

  const handleCancel = () => {
    if (!submitting) {
      onClose();
    }
  };

  return (
    <ModalBase
      isOpen={open}
      onClose={handleCancel}
      closeDisabled={submitting}
      title={modalTitle}
      size="lg"
      loading={submitting}
      showLoadingOverlay={true}
      showLoadingSpinner={true}
      loadingOverlayText={t("common.saving")}
      error={error}
      onErrorDismiss={() => setError(null)}
      errorDisplayMode={error ? "inline" : "none"}
      footer={
        <FormActions
          loading={submitting}
          onCancel={handleCancel}
          onSubmit={() => {
            const form = document.getElementById(
              formId,
            ) as HTMLFormElement | null;
            form?.requestSubmit();
          }}
          submitText={submitLabel}
          cancelText={t("common.cancel")}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-base-content/70">{modalSubtitle}</p>

        <FormField
          label={t("finance.accountNameLabel")}
          htmlFor="finance-account-name"
          required
        >
          <TextInput
            id="finance-account-name"
            name="name"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("finance.accountNamePlaceholder")}
            disabled={submitting}
            required
          />
        </FormField>

        <FormField
          label={t("finance.accountParentLabel")}
          htmlFor="finance-account-parent"
        >
          <EnumSelect
            id="finance-account-parent"
            value={parentId}
            onChange={(value) => setParentId(String(value ?? ""))}
            options={parentSelectOptions}
            includeEmptyOption
            showLabel={false}
            className="w-full"
            disabled={submitting || parentOptions.length === 0}
          />
        </FormField>

        <FormField
          label={t("finance.accountCurrencyLabel")}
          htmlFor="finance-account-currency"
          required
        >
          <TextInput
            id="finance-account-currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            placeholder="USD"
            disabled={submitting}
            required
          />
        </FormField>

        <FormField
          label={t("finance.accountInterestLabel")}
          htmlFor="finance-account-interest"
        >
          <TextInput
            id="finance-account-interest"
            name="interest_rate"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            value={interestRate}
            onChange={(event) => setInterestRate(event.target.value)}
            placeholder={t("finance.accountInterestPlaceholder")}
            disabled={submitting}
          />
        </FormField>
      </form>
    </ModalBase>
  );
}

export default FinanceAccountFormModal;
