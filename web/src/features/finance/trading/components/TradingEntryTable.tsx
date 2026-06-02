import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import ActionButton from "@/components/ActionButton";
import EmptyState from "@/components/EmptyState";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import type {
  TradingEntryResponse,
  TradingInstrumentResponse,
} from "@/services/api/finance";
import { formatDateTime } from "@/utils/datetime";
import { computeEntryPriceFromDeltas } from "@/features/finance/trading/utils";
import { AssetAmountText } from "./AssetAmountText";

interface TradingEntryTableProps {
  entries: TradingEntryResponse[];
  instruments: Map<string, TradingInstrumentResponse>;
  loading?: boolean;
  onDelete: (entry: TradingEntryResponse) => void;
  onEdit: (entry: TradingEntryResponse) => void;
  instrumentOptions: TradingInstrumentResponse[];
  instrumentFilter: string;
  onInstrumentFilterChange: (value: string) => void;
}

export function TradingEntryTable({
  entries,
  instruments,
  loading,
  onDelete,
  onEdit,
  instrumentOptions,
  instrumentFilter,
  onInstrumentFilterChange,
}: TradingEntryTableProps) {
  const { t } = useTranslation();

  const rows = useMemo(() => entries ?? [], [entries]);
  const instrumentFilterOptions = useMemo<EnumOption[]>(
    () => [
      {
        value: "",
        label: t("finance.trading.labels.allInstruments"),
      },
      ...instrumentOptions.map((instrument) => ({
        value: instrument.id,
        label: instrument.symbol,
      })),
    ],
    [instrumentOptions, t],
  );
  const resolveAmountClass = (value: number) => {
    if (!Number.isFinite(value) || value === 0) {
      return "font-semibold";
    }
    if (value < 0) {
      return "text-error font-semibold";
    }
    return "text-success font-semibold";
  };

  if (!rows.length && !loading) {
    return (
      <EmptyState
        icon={<span>📓</span>}
        title={t("finance.trading.entries.emptyTitle")}
        description={t("finance.trading.entries.emptyDescription") ?? ""}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>{t("finance.trading.entries.table.tradeTime")}</th>
            <th className="align-top">
              <div className="flex flex-col gap-1">
                <span>{t("finance.trading.entries.table.symbol")}</span>
                <EnumSelect
                  value={instrumentFilter}
                  onChange={(value) =>
                    onInstrumentFilterChange(String(value ?? ""))
                  }
                  options={instrumentFilterOptions}
                  includeEmptyOption
                  showLabel={false}
                  size="sm"
                  className="w-full min-w-[10rem]"
                />
              </div>
            </th>
            <th>{t("finance.trading.entries.table.baseAmount")}</th>
            <th>{t("finance.trading.entries.table.quoteAmount")}</th>
            <th>{t("finance.trading.entries.table.price")}</th>
            <th>{t("finance.trading.entries.table.source")}</th>
            <th>{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => {
            const instrument = instruments.get(entry.instrument_id);
            const computedPrice =
              entry.price && entry.price !== ""
                ? entry.price
                : computeEntryPriceFromDeltas(
                    entry.base_delta,
                    entry.quote_delta,
                  );
            const baseAmountValue = Number(entry.base_delta);
            const quoteAmountValue = Number(entry.quote_delta);
            return (
              <tr key={entry.id}>
                <td className="whitespace-nowrap">
                  {formatDateTime(entry.trade_time)}
                </td>
                <td>{instrument?.symbol ?? entry.instrument_id}</td>
                <td>
                  <AssetAmountText
                    value={entry.base_delta}
                    symbol={instrument?.base_asset}
                    amountClassName={resolveAmountClass(baseAmountValue)}
                  />
                </td>
                <td>
                  <AssetAmountText
                    value={entry.quote_delta}
                    symbol={instrument?.quote_asset}
                    amountClassName={resolveAmountClass(quoteAmountValue)}
                  />
                </td>
                <td>
                  <AssetAmountText
                    value={computedPrice}
                    symbol={instrument?.quote_asset}
                    amountClassName="font-semibold"
                  />
                </td>
                <td>
                  {t(`finance.trading.entries.source.${entry.source}` as const)}
                </td>
                <td>
                  <div className="flex gap-1">
                    <ActionButton
                      label={
                        t("finance.trading.entries.actions.edit") ??
                        t("common.edit")
                      }
                      onClick={() => onEdit(entry)}
                      iconName="edit"
                      size="xs"
                      iconOnly
                      title={
                        t("finance.trading.entries.actions.edit") ?? undefined
                      }
                    />
                    <ActionButton
                      label={t("common.delete")}
                      onClick={() => onDelete(entry)}
                      iconName="trash"
                      size="xs"
                      color="error"
                      iconOnly
                      title={t("common.delete") ?? undefined}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {loading && (
        <div className="flex justify-center py-4">
          <span className="loading loading-spinner loading-md text-primary"></span>
        </div>
      )}
    </div>
  );
}
