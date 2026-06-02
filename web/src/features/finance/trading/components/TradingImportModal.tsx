import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import ActionButton, { FormActions } from "@/components/ActionButton";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import { TextInput } from "@/components/forms";
import type {
  TradingEntryPayload,
  TradingInstrumentResponse,
} from "@/services/api/finance";
import {
  getTradingCsvTemplate,
  parseTradingCsv,
  type ParsedImportRow,
} from "@/features/finance/trading/utils";

interface TradingImportModalProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  instruments: TradingInstrumentResponse[];
  submitting: boolean;
  onSubmitRows: (rows: TradingEntryPayload[]) => Promise<void>;
}

type ImportRowState = {
  id: string;
  payload: TradingEntryPayload;
  errors: string[];
  symbol: string;
};

export function TradingImportModal({
  open,
  onClose,
  planId,
  instruments,
  submitting,
  onSubmitRows,
}: TradingImportModalProps) {
  const { t } = useTranslation();
  const instrumentMap = useMemo(() => {
    const map = new Map<string, TradingInstrumentResponse>();
    instruments.forEach((instrument) => {
      map.set(instrument.symbol.toUpperCase(), instrument);
    });
    return map;
  }, [instruments]);

  const [rows, setRows] = useState<ImportRowState[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const directionOptions = useMemo<EnumOption[]>(
    () => [
      {
        value: "buy",
        label: t("finance.trading.entries.direction.buy"),
      },
      {
        value: "sell",
        label: t("finance.trading.entries.direction.sell"),
      },
      {
        value: "transfer",
        label: t("finance.trading.entries.direction.transfer"),
      },
    ],
    [t],
  );

  useEffect(() => {
    if (!open) {
      setRows([]);
      setParseError(null);
    }
  }, [open]);

  const downloadTemplate = () => {
    const blob = new Blob([getTradingCsvTemplate()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trading_entries_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    const text = await file.text();
    const parsed = parseTradingCsv(text);
    if (!parsed.length) {
      setParseError(t("finance.trading.import.emptyFile"));
      setRows([]);
      return;
    }
    const mapped = parsed.map((row, idx) => buildImportRow(row, idx));
    setRows(mapped);
    setParseError(null);
  };

  const buildImportRow = (
    row: ParsedImportRow,
    idx: number,
  ): ImportRowState => {
    const instrument = instrumentMap.get(
      row.instrument_symbol?.toUpperCase() ?? "",
    );
    const payload: TradingEntryPayload = {
      plan_id: planId,
      instrument_id: instrument?.id ?? ("" as string),
      trade_time: row.trade_time ? new Date(row.trade_time).toISOString() : "",
      direction: (row.direction as TradingEntryPayload["direction"]) || "buy",
      base_delta: row.base_delta || "0",
      quote_delta: row.quote_delta || "0",
      price: row.price || null,
      fee_asset: row.fee_asset || null,
      fee_amount: row.fee_amount || null,
      source: (row.source as TradingEntryPayload["source"]) || "import",
      note: row.note || null,
    };
    const errors = validateRow(payload, instrument);
    return {
      id: `${Date.now()}-${idx}`,
      payload,
      symbol: row.instrument_symbol,
      errors,
    };
  };

  const validateRow = (
    payload: TradingEntryPayload,
    instrument?: TradingInstrumentResponse,
  ) => {
    const issues: string[] = [];
    if (!instrument) {
      issues.push(t("finance.trading.import.errors.instrument"));
    }
    if (!payload.trade_time || Number.isNaN(Date.parse(payload.trade_time))) {
      issues.push(t("finance.trading.import.errors.time"));
    }
    if (!payload.base_delta) {
      issues.push(t("finance.trading.import.errors.amount"));
    }
    if (!payload.quote_delta) {
      issues.push(t("finance.trading.import.errors.amount"));
    }
    if (!payload.instrument_id) {
      issues.push(t("finance.trading.import.errors.instrument"));
    }
    return issues;
  };

  const updateRow = (
    rowId: string,
    updater: (prev: ImportRowState) => ImportRowState,
  ) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? updater(row) : row)),
    );
  };

  const handleSubmit = async () => {
    if (!rows.length) {
      setParseError(t("finance.trading.import.emptyRows"));
      return;
    }
    const invalid = rows.some((row) => row.errors.length);
    if (invalid) {
      setParseError(t("finance.trading.import.fixErrors"));
      return;
    }
    await onSubmitRows(rows.map((row) => row.payload));
    onClose();
  };

  const removeRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  return (
    <ModalBase
      isOpen={open}
      onClose={onClose}
      title={t("finance.trading.import.title")}
      size="xl"
      error={parseError}
      onErrorDismiss={() => setParseError(null)}
    >
      <div className="space-y-4">
        <p className="text-sm text-base-content/70">
          {t("finance.trading.import.description")}
        </p>
        <div className="flex gap-2">
          <ActionButton
            label={t("finance.trading.import.downloadTemplate")}
            onClick={downloadTemplate}
            iconName="download"
            color="neutral"
          />
          <label className="btn btn-outline">
            {t("finance.trading.import.selectFile")}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-base-300 p-6 text-center text-sm text-base-content/70">
            {t("finance.trading.import.noRows")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{t("finance.trading.entries.table.symbol")}</th>
                  <th>{t("finance.trading.entries.table.tradeTime")}</th>
                  <th>{t("finance.trading.entries.table.direction")}</th>
                  <th>{t("finance.trading.entries.table.baseDelta")}</th>
                  <th>{t("finance.trading.entries.table.quoteDelta")}</th>
                  <th>{t("finance.trading.entries.table.price")}</th>
                  <th>{t("finance.trading.entries.table.fee")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.errors.length ? "bg-error/10" : ""}
                  >
                    <td>
                      <TextInput
                        value={row.symbol}
                        onChange={(e) =>
                          updateRow(row.id, (prev) => {
                            const instrument = instrumentMap.get(
                              e.target.value.toUpperCase(),
                            );
                            const payload = {
                              ...prev.payload,
                              instrument_id: instrument?.id ?? ("" as string),
                            };
                            return {
                              ...prev,
                              symbol: e.target.value,
                              payload,
                              errors: validateRow(payload, instrument),
                            };
                          })
                        }
                      />
                    </td>
                    <td>
                      <TextInput
                        value={row.payload.trade_time}
                        onChange={(e) =>
                          updateRow(row.id, (prev) => {
                            const payload = {
                              ...prev.payload,
                              trade_time: e.target.value,
                            };
                            return {
                              ...prev,
                              payload,
                              errors: validateRow(
                                payload,
                                instrumentMap.get(prev.symbol.toUpperCase()),
                              ),
                            };
                          })
                        }
                      />
                    </td>
                    <td>
                      <EnumSelect
                        value={row.payload.direction}
                        onChange={(value) =>
                          updateRow(row.id, (prev) => ({
                            ...prev,
                            payload: {
                              ...prev.payload,
                              direction: String(
                                value,
                              ) as TradingEntryPayload["direction"],
                            },
                          }))
                        }
                        options={directionOptions}
                        showLabel={false}
                        size="sm"
                        className="min-w-[8rem]"
                      />
                    </td>
                    <td>
                      <TextInput
                        value={row.payload.base_delta}
                        onChange={(e) =>
                          updateRow(row.id, (prev) => ({
                            ...prev,
                            payload: {
                              ...prev.payload,
                              base_delta: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <TextInput
                        value={row.payload.quote_delta}
                        onChange={(e) =>
                          updateRow(row.id, (prev) => ({
                            ...prev,
                            payload: {
                              ...prev.payload,
                              quote_delta: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <TextInput
                        value={row.payload.price ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, (prev) => ({
                            ...prev,
                            payload: { ...prev.payload, price: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <TextInput
                        value={row.payload.fee_amount ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, (prev) => ({
                            ...prev,
                            payload: {
                              ...prev.payload,
                              fee_amount: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <ActionButton
                        label={t("finance.trading.import.removeRow")}
                        iconName="trash"
                        size="xs"
                        color="error"
                        onClick={() => removeRow(row.id)}
                      />
                      {row.errors.length > 0 && (
                        <div className="text-xs text-error mt-1">
                          {row.errors.join(" · ")}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4">
        <FormActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitText={t("finance.trading.import.submit")}
          loading={submitting}
        />
      </div>
    </ModalBase>
  );
}
