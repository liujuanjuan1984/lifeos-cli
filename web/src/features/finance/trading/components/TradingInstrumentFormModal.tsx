import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import { FormActions } from "@/components/ActionButton";
import { FormField, TextArea, TextInput } from "@/components/forms";
import type {
  TradingInstrumentPayload,
  TradingInstrumentResponse,
} from "@/services/api/finance";

type InstrumentFormMode = "create" | "edit";

interface TradingInstrumentFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: InstrumentFormMode;
  loading: boolean;
  onSubmit: (payload: TradingInstrumentPayload) => Promise<void>;
  initialValues?: TradingInstrumentResponse | null;
}

export function TradingInstrumentFormModal({
  open,
  onClose,
  mode,
  loading,
  onSubmit,
  initialValues,
}: TradingInstrumentFormModalProps) {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState("");
  const [strategyTag, setStrategyTag] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSymbol("");
      setExchange("");
      setStrategyTag("");
      setNote("");
      setError(null);
      return;
    }
    if (initialValues) {
      setSymbol(initialValues.symbol ?? "");
      setExchange(initialValues.exchange ?? "");
      setStrategyTag(initialValues.strategy_tag ?? "");
      setNote(initialValues.note ?? "");
    } else {
      setSymbol("");
      setExchange("");
      setStrategyTag("");
      setNote("");
    }
    setError(null);
  }, [open, initialValues]);

  const title =
    mode === "edit"
      ? t("finance.trading.modals.editInstrument")
      : t("finance.trading.modals.createInstrument");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!symbol.trim()) {
      setError(t("finance.trading.errors.symbolRequired"));
      return;
    }
    const payload: TradingInstrumentPayload = {
      symbol: symbol.trim(),
      exchange: exchange.trim() || null,
      strategy_tag: strategyTag.trim() || null,
      note: note.trim() || null,
    };
    const submission = onSubmit(payload);
    submission.catch((err) => {
      console.error("Failed to save trading instrument:", err);
    });
    onClose();
  };

  return (
    <ModalBase
      isOpen={open}
      onClose={onClose}
      title={title}
      size="md"
      error={error}
      onErrorDismiss={() => setError(null)}
    >
      <form
        id="trading-instrument-form"
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        <FormField label={t("finance.trading.fields.symbol")} required>
          <TextInput
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
        </FormField>
        <FormField label={t("finance.trading.fields.exchange")}>
          <TextInput
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
          />
        </FormField>
        <FormField label={t("finance.trading.fields.strategyTag")}>
          <TextInput
            value={strategyTag}
            onChange={(e) => setStrategyTag(e.target.value)}
          />
        </FormField>
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
            const form = document.getElementById("trading-instrument-form");
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
