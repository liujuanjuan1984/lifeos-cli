import { normalizeCurrencyCode } from "@/utils/core";

export const DEFAULT_PRIMARY_CURRENCY = "USD";

type CurrencyDefinition = {
  code: string;
  name: string;
};

const currencyDefinitions: CurrencyDefinition[] = [
  { code: "USD", name: "United States Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "INR", name: "Indian Rupee" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "BTC", name: "Bitcoin" },
  { code: "ETH", name: "Ethereum" },
  { code: "USDT", name: "Tether (USDt)" },
];

type CurrencyOptionDefinition = {
  code: string;
};

export const PRIMARY_CURRENCY_OPTION_DEFINITIONS: CurrencyOptionDefinition[] =
  currencyDefinitions.map(({ code }) => {
    const normalizedCode = normalizeCurrencyCode(code);
    return {
      code: normalizedCode,
    };
  });
