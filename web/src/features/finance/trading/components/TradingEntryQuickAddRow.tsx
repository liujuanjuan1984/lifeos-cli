import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import ActionButton from "@/components/ActionButton";
import { TextInput } from "@/components/forms";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import type {
  TradingEntryPayload,
  TradingInstrumentResponse,
} from "@/services/api/finance";
import { utcToLocalDateTimeLocal } from "@/utils/datetime";
import {
  computeEntryPriceFromDeltas,
  deriveEntryDirection,
} from "@/features/finance/trading/utils";

interface TradingEntryQuickAddRowProps {
  planId: string | null;
  instruments: TradingInstrumentResponse[];
  submitting?: boolean;
  onSubmit: (payload: TradingEntryPayload) => Promise<void>;
  presetInstrumentId?: string | null;
  onPresetInstrumentConsumed?: () => void;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function TradingEntryQuickAddRow({
  planId,
  instruments,
  submitting = false,
  onSubmit,
  presetInstrumentId = null,
  onPresetInstrumentConsumed,
  containerRef,
}: TradingEntryQuickAddRowProps) {
  const { t } = useTranslation();
  const initialInstrumentId = useMemo(
    () => instruments[0]?.id ?? "",
    [instruments],
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
    presetInstrumentId ?? initialInstrumentId,
  );
  const [tradeTime, setTradeTime] = useState(() =>
    utcToLocalDateTimeLocal(new Date().toISOString()),
  );
  const [baseAmount, setBaseAmount] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const baseInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!instrumentId && initialInstrumentId) {
      setInstrumentId(initialInstrumentId);
    }
  }, [instrumentId, initialInstrumentId]);

  useEffect(() => {
    if (presetInstrumentId) {
      setInstrumentId(presetInstrumentId);
      baseInputRef.current?.focus();
      onPresetInstrumentConsumed?.();
      containerRef?.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [presetInstrumentId, onPresetInstrumentConsumed, containerRef]);

  const selectedInstrument = instruments.find(
    (instrument) => instrument.id === instrumentId,
  );

  if (!planId || !instruments.length) {
    return (
      <div
        ref={containerRef}
        className="rounded-xl border border-dashed border-base-300 bg-base-100/70 p-4 text-sm text-base-content/70"
      >
        {t("finance.trading.entries.form.disabled")}
      </div>
    );
  }

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
    const direction = deriveEntryDirection(baseAmount, quoteAmount);
    const price = computeEntryPriceFromDeltas(baseAmount, quoteAmount);
    const payload: TradingEntryPayload = {
      plan_id: planId,
      instrument_id: instrumentId,
      trade_time: new Date(tradeTime).toISOString(),
      direction,
      base_delta: baseAmount || "0",
      quote_delta: quoteAmount || "0",
      price,
      fee_asset: null,
      fee_amount: null,
      source: "manual",
      note: null,
    };
    try {
      await onSubmit(payload);
      setBaseAmount("");
      setQuoteAmount("");
      setTradeTime(utcToLocalDateTimeLocal(new Date().toISOString()));
      setError(null);
      baseInputRef.current?.focus();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("finance.trading.errors.saveFailed");
      setError(message);
    }
  };

  const handleReset = () => {
    setBaseAmount("");
    setQuoteAmount("");
    setTradeTime(utcToLocalDateTimeLocal(new Date().toISOString()));
    setError(null);
  };

  const baseLabel = t("finance.trading.entries.form.baseDeltaSymbol", {
    symbol: selectedInstrument?.base_asset ?? "BASE",
  });
  const quoteLabel = t("finance.trading.entries.form.quoteDeltaSymbol", {
    symbol: selectedInstrument?.quote_asset ?? "QUOTE",
  });

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-dashed border-base-300 bg-base-100/70 p-3"
    >
      <form className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit}>
        {error ? (
          <div className="basis-full rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        ) : null}
        <div className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("finance.trading.entries.form.instrument")}
          </span>
          <EnumSelect
            value={instrumentId}
            onChange={(value) => setInstrumentId(String(value ?? ""))}
            options={instrumentOptions}
            showLabel={false}
            size="sm"
            className="w-full"
          />
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("finance.trading.entries.form.tradeTime")}
          </span>
          <TextInput
            type="datetime-local"
            size="sm"
            className="w-full"
            value={tradeTime}
            onChange={(event) => setTradeTime(event.target.value)}
          />
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {baseLabel}
          </span>
          <TextInput
            ref={baseInputRef}
            type="text"
            size="sm"
            className="w-full font-mono"
            value={baseAmount}
            onChange={(event) => setBaseAmount(event.target.value)}
            placeholder="0"
          />
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {quoteLabel}
          </span>
          <TextInput
            type="text"
            size="sm"
            className="w-full font-mono"
            value={quoteAmount}
            onChange={(event) => setQuoteAmount(event.target.value)}
            placeholder="0"
          />
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            label={t("finance.trading.entries.quickAdd.submit")}
            iconName="check"
            color="primary"
            size="sm"
            variant="solid"
            type="submit"
            disabled={submitting}
            iconOnly
            title={t("finance.trading.entries.quickAdd.submit") ?? undefined}
          />
          <ActionButton
            label={t("common.reset")}
            iconName="refresh"
            onClick={handleReset}
            size="sm"
            iconOnly
            title={t("common.reset") ?? undefined}
            type="button"
          />
        </div>
      </form>
    </div>
  );
}
