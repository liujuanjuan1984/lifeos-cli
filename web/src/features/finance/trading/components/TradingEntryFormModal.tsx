import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import { FormActions } from "@/components/ActionButton";
import type {
  TradingEntryPayload,
  TradingEntryResponse,
  TradingInstrumentResponse,
} from "@/services/api/finance";
import { TradingEntryForm } from "./TradingEntryForm";

interface TradingEntryFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  planId: string;
  instruments: TradingInstrumentResponse[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: TradingEntryPayload) => Promise<void>;
  initialEntry?: TradingEntryResponse | null;
  defaultInstrumentId?: string | null;
}

export function TradingEntryFormModal({
  open,
  mode,
  planId,
  instruments,
  submitting,
  onClose,
  onSubmit,
  initialEntry = null,
  defaultInstrumentId = null,
}: TradingEntryFormModalProps) {
  const { t } = useTranslation();
  const formId = useId();
  const title =
    mode === "edit"
      ? t("finance.trading.entries.modal.edit")
      : t("finance.trading.entries.modal.create");
  const formKey = useMemo(() => {
    return mode === "edit"
      ? `edit-${initialEntry?.id ?? "unknown"}`
      : `create-${defaultInstrumentId ?? "default"}`;
  }, [mode, initialEntry?.id, defaultInstrumentId]);

  return (
    <ModalBase
      isOpen={open}
      onClose={onClose}
      title={title ?? ""}
      size="xl"
      bodyOverflow="auto"
      footer={
        <FormActions
          onCancel={onClose}
          onSubmit={() => {
            const form = document.getElementById(formId);
            form?.dispatchEvent(
              new Event("submit", { cancelable: true, bubbles: true }),
            );
          }}
          loading={submitting}
          submitText={
            mode === "edit"
              ? t("common.save")
              : t("finance.trading.entries.form.submit")
          }
        />
      }
    >
      <TradingEntryForm
        key={formKey}
        formId={formId}
        planId={planId}
        instruments={instruments}
        submitting={submitting}
        onSubmit={onSubmit}
        mode={mode}
        initialEntry={initialEntry}
        defaultInstrumentId={defaultInstrumentId}
        showSubmitButton={false}
      />
    </ModalBase>
  );
}
