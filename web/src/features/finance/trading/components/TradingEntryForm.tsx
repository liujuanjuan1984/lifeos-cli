import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import { FormField, TextInput } from "@/components/forms";
import ActionButton from "@/components/ActionButton";
import ErrorDisplay from "@/components/ErrorDisplay";
import type {
  TradingEntryPayload,
  TradingEntryResponse,
  TradingInstrumentResponse,
} from "@/services/api/finance";
import { utcToLocalDateTimeLocal } from "@/utils/datetime";
import {
  computeEntryPriceFromDeltas,
  deriveEntryDirection,
} from "@/features/finance/trading/utils";

interface TradingEntryFormProps {
  planId: string;
  instruments: TradingInstrumentResponse[];
  submitting: boolean;
  onSubmit: (payload: TradingEntryPayload) => Promise<void>;
  mode?: "create" | "edit";
  initialEntry?: TradingEntryResponse | null;
  defaultInstrumentId?: string | null;
  formId?: string;
  showSubmitButton?: boolean;
  submitLabel?: string;
  onSubmitSuccess?: () => void;
}

export function TradingEntryForm({
  planId,
  instruments,
  submitting,
  onSubmit,
  mode = "create",
  initialEntry = null,
  defaultInstrumentId = null,
  formId,
  showSubmitButton = true,
  submitLabel,
  onSubmitSuccess,
}: TradingEntryFormProps) {
  const { t } = useTranslation();
  const defaultInstrumentChoice = useMemo(
    () => defaultInstrumentId ?? instruments[0]?.id ?? "",
    [defaultInstrumentId, instruments],
  );
  const instrumentOptions = useMemo<EnumOption[]>(
    () =>
      instruments.map((instrument) => ({
        value: instrument.id,
        label: instrument.symbol,
      })),
    [instruments],
  );
  const [instrumentId, setInstrumentId] = useState<string>(
    initialEntry?.instrument_id ?? defaultInstrumentChoice,
  );
  const [tradeTime, setTradeTime] = useState<string>(() =>
    initialEntry
      ? utcToLocalDateTimeLocal(initialEntry.trade_time)
      : utcToLocalDateTimeLocal(new Date().toISOString()),
  );
  const [baseDelta, setBaseDelta] = useState(initialEntry?.base_delta ?? "");
  const [quoteDelta, setQuoteDelta] = useState(initialEntry?.quote_delta ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instrumentId && defaultInstrumentChoice) {
      setInstrumentId(defaultInstrumentChoice);
    }
  }, [defaultInstrumentChoice, instrumentId]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instrumentId) {
      setError(t("finance.trading.errors.instrumentRequired"));
      return;
    }
    if (!tradeTime) {
      setError(t("finance.trading.errors.tradeTimeRequired"));
      return;
    }
    const computedDirection = deriveEntryDirection(baseDelta, quoteDelta);
    const computedPrice = computeEntryPriceFromDeltas(baseDelta, quoteDelta);
    const payload: TradingEntryPayload = {
      plan_id: planId,
      instrument_id: instrumentId,
      trade_time: new Date(tradeTime).toISOString(),
      direction: computedDirection,
      base_delta: baseDelta || "0",
      quote_delta: quoteDelta || "0",
      price: computedPrice,
      fee_asset: initialEntry?.fee_asset ?? null,
      fee_amount: initialEntry?.fee_amount ?? null,
      source: initialEntry?.source ?? "manual",
      note: initialEntry?.note ?? null,
    };
    try {
      await onSubmit(payload);
      if (!isMountedRef.current) {
        return;
      }
      if (mode === "create") {
        setBaseDelta("");
        setQuoteDelta("");
        setTradeTime(utcToLocalDateTimeLocal(new Date().toISOString()));
        if (defaultInstrumentChoice) {
          setInstrumentId(defaultInstrumentChoice);
        }
      }
      setError(null);
      onSubmitSuccess?.();
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : t("finance.trading.errors.saveFailed");
      setError(message);
    }
  };

  const selectedInstrument = instruments.find(
    (inst) => inst.id === instrumentId,
  );
  const baseLabel = t("finance.trading.entries.form.baseDeltaSymbol", {
    symbol: selectedInstrument?.base_asset ?? "BASE",
  });
  const quoteLabel = t("finance.trading.entries.form.quoteDeltaSymbol", {
    symbol: selectedInstrument?.quote_asset ?? "QUOTE",
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit}
      id={formId ?? undefined}
    >
      <ErrorDisplay error={error} className="text-sm" />
      <FormField label={t("finance.trading.entries.form.instrument")} required>
        <EnumSelect
          value={instrumentId}
          onChange={(value) => setInstrumentId(String(value ?? ""))}
          options={instrumentOptions}
          showLabel={false}
          className="w-full"
        />
      </FormField>

      <FormField label={t("finance.trading.entries.form.tradeTime")} required>
        <TextInput
          type="datetime-local"
          value={tradeTime}
          onChange={(e) => setTradeTime(e.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label={baseLabel}>
          <TextInput
            value={baseDelta}
            onChange={(e) => setBaseDelta(e.target.value)}
          />
        </FormField>
        <FormField label={quoteLabel}>
          <TextInput
            value={quoteDelta}
            onChange={(e) => setQuoteDelta(e.target.value)}
          />
        </FormField>
      </div>

      {showSubmitButton && (
        <ActionButton
          label={submitLabel ?? t("finance.trading.entries.form.submit") ?? ""}
          type="submit"
          color="primary"
          size="md"
          variant="solid"
          disabled={submitting}
        />
      )}
    </form>
  );
}
