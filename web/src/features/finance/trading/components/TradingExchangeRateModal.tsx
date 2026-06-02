import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import { FormField, TextInput } from "@/components/forms";
import { FormActions } from "@/components/ActionButton";
import type { UUID } from "@/types/primitive";
import type { CreateExchangeRatePayload } from "@/services/api/finance/exchangeRates";

interface TradingExchangeRateModalProps {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  onSubmit: (payload: CreateExchangeRatePayload) => Promise<void>;
  planId: UUID | null;
  initialBase?: string | null;
  initialQuote?: string | null;
  initialRate?: string | null;
}

function toDateTimeLocal(value: Date): string {
  return value.toISOString().slice(0, 16);
}

export function TradingExchangeRateModal({
  open,
  onClose,
  submitting,
  onSubmit,
  planId,
  initialBase,
  initialQuote,
  initialRate,
}: TradingExchangeRateModalProps) {
  const { t } = useTranslation();
  const formId = "plan-exchange-rate-form";
  const [baseAsset, setBaseAsset] = useState("");
  const [quoteAsset, setQuoteAsset] = useState("");
  const [rate, setRate] = useState("");
  const [capturedAt, setCapturedAt] = useState(toDateTimeLocal(new Date()));
  const [source, setSource] = useState("manual");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBaseAsset(initialBase?.trim()?.toUpperCase() ?? "");
    setQuoteAsset(initialQuote?.trim()?.toUpperCase() ?? "");
    setRate(initialRate ?? "");
    setCapturedAt(toDateTimeLocal(new Date()));
    setSource("manual");
    setError(null);
  }, [open, initialBase, initialQuote, initialRate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!planId) {
      setError(t("finance.trading.exchangeRates.errors.planRequired"));
      return;
    }
    if (!baseAsset.trim() || !quoteAsset.trim() || !rate.trim()) {
      setError(t("finance.trading.exchangeRates.errors.rateRequired"));
      return;
    }
    const isoCaptured = capturedAt
      ? new Date(capturedAt).toISOString()
      : new Date().toISOString();
    const submission = onSubmit({
      plan_id: planId,
      base_asset: baseAsset.trim().toUpperCase(),
      quote_asset: quoteAsset.trim().toUpperCase(),
      rate: rate.trim(),
      captured_at: isoCaptured,
      source: source.trim() || null,
    });
    submission.catch((err) => {
      console.error("Failed to save exchange rate:", err);
    });
    onClose();
  };

  return (
    <ModalBase
      isOpen={open}
      onClose={onClose}
      title={t("finance.trading.exchangeRates.modalTitle")}
      size="md"
      error={error}
      onErrorDismiss={() => setError(null)}
    >
      <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-base-content/70">
          {t("finance.trading.exchangeRates.modalDescription")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label={t("finance.trading.exchangeRates.fields.base")}
            required
          >
            <TextInput
              value={baseAsset}
              onChange={(e) => setBaseAsset(e.target.value)}
              placeholder="BTC"
            />
          </FormField>
          <FormField
            label={t("finance.trading.exchangeRates.fields.quote")}
            required
          >
            <TextInput
              value={quoteAsset}
              onChange={(e) => setQuoteAsset(e.target.value)}
              placeholder="USDT"
            />
          </FormField>
        </div>
        <FormField
          label={t("finance.trading.exchangeRates.fields.rate")}
          required
        >
          <TextInput
            type="number"
            min="0"
            step="any"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="42000"
          />
        </FormField>
        <FormField label={t("finance.trading.exchangeRates.fields.capturedAt")}>
          <TextInput
            type="datetime-local"
            value={capturedAt}
            onChange={(e) => setCapturedAt(e.target.value)}
          />
        </FormField>
        <FormField label={t("finance.trading.exchangeRates.fields.source")}>
          <TextInput
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </FormField>
        <div className="pt-2">
          <FormActions
            onCancel={onClose}
            onSubmit={() => {
              const form = document.getElementById(formId);
              form?.dispatchEvent(
                new Event("submit", { cancelable: true, bubbles: true }),
              );
            }}
            loading={submitting}
            submitText={t("common.save")}
          />
        </div>
      </form>
    </ModalBase>
  );
}
