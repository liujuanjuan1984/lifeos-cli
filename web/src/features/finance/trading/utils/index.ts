import type { TradingDirection } from "@/services/api/finance";
import { formatDate } from "@/utils/datetime";

export {
  formatCurrencyValue,
  formatDecimalValue,
  formatPercentValue,
} from "@/features/finance/shared";

export function formatTradingPlanPeriod(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
  fallback: string,
): string {
  if (periodStart && periodEnd) {
    return `${formatDate(periodStart)} → ${formatDate(periodEnd)}`;
  }
  return fallback;
}

export interface ParsedImportRow {
  instrument_symbol: string;
  trade_time: string;
  direction: string;
  base_delta: string;
  quote_delta: string;
  price?: string;
  fee_asset?: string;
  fee_amount?: string;
  source?: string;
  note?: string;
}

export function getTradingCsvTemplate(): string {
  return [
    "instrument_symbol,trade_time,direction,base_delta,quote_delta,price,fee_asset,fee_amount,source,note",
    "BTC/USDT,2025-01-01T00:00:00Z,buy,0.1,-4200,42000,USDT,5,manual,example",
  ].join("\n");
}

export function parseTradingCsv(content: string): ParsedImportRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",").map((col) => col.trim().toLowerCase());
  const rows: ParsedImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const segments = splitCsvLine(lines[i]);
    if (!segments.length) continue;
    const row: Record<string, string> = {};
    header.forEach((key, idx) => {
      row[key] = segments[idx] ?? "";
    });
    rows.push({
      instrument_symbol: row.instrument_symbol ?? row.symbol ?? "",
      trade_time: row.trade_time ?? "",
      direction: row.direction ?? "",
      base_delta: row.base_delta ?? "",
      quote_delta: row.quote_delta ?? "",
      price: row.price ?? "",
      fee_asset: row.fee_asset ?? "",
      fee_amount: row.fee_amount ?? "",
      source: row.source ?? "manual",
      note: row.note ?? "",
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((value) => value.trim());
}

export function deriveEntryDirection(
  baseDelta: string | number,
  quoteDelta: string | number,
): TradingDirection {
  const base = Number(baseDelta);
  const quote = Number(quoteDelta);
  if (Number.isFinite(base) && Number.isFinite(quote)) {
    if (base > 0 && quote < 0) {
      return "buy";
    }
    if (base < 0 && quote > 0) {
      return "sell";
    }
  }
  return "transfer";
}

export function computeEntryPriceFromDeltas(
  baseDelta: string | number,
  quoteDelta: string | number,
): string | null {
  const base = Number(baseDelta);
  const quote = Number(quoteDelta);
  if (!Number.isFinite(base) || !Number.isFinite(quote) || base === 0) {
    return null;
  }
  const absBase = Math.abs(base);
  const absQuote = Math.abs(quote);
  if (!absBase || !absQuote) {
    return null;
  }
  const price = absQuote / absBase;
  if (!Number.isFinite(price) || price === 0) {
    return null;
  }
  return price.toString();
}
