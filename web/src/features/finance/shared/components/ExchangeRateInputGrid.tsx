import { useTranslation } from "react-i18next";
import { TextInput } from "@/components/forms";

interface ExchangeRateInputGridProps {
  primaryCurrency: string;
  currencies: string[];
  rates: Record<string, string>;
  onChange: (currency: string, value: string) => void;
  disabled?: boolean;
}

export function ExchangeRateInputGrid({
  primaryCurrency,
  currencies,
  rates,
  onChange,
  disabled = false,
}: ExchangeRateInputGridProps) {
  const { t } = useTranslation();

  if (!currencies.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-dashed border-base-200 p-3">
      <h3 className="text-sm font-semibold text-base-content">
        {t("finance.exchangeRateTitle", {
          currency: primaryCurrency,
        })}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {currencies.map((currency) => (
          <label key={currency} className="text-sm text-base-content/80">
            <span className="mb-1 block font-medium">1 {currency}</span>
            <TextInput
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              size="sm"
              value={rates[currency] ?? ""}
              onChange={(event) => onChange(currency, event.target.value)}
              placeholder={t("finance.exchangeRatePlaceholder", {
                currency: primaryCurrency,
              })}
              disabled={disabled}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
