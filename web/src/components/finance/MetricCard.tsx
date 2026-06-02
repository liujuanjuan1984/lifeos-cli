interface MetricCardProps {
  title: string;
  value?: string | null;
  currency: string;
  highlighted?: boolean;
  fallbackValue?: string;
}

function MetricCard({
  title,
  value,
  currency,
  highlighted = false,
  fallbackValue = "0.00",
}: MetricCardProps) {
  const displayValue = value ?? fallbackValue;
  const containerClass = highlighted
    ? "rounded-lg border p-4 border-primary bg-primary/10"
    : "rounded-lg border p-4 border-base-200 bg-base-100";

  return (
    <div className={containerClass}>
      <p className="text-xs uppercase tracking-wide text-base-content/60">
        {title}
      </p>
      <p className="mt-2 text-xl font-semibold text-base-content">
        {displayValue} {currency}
      </p>
    </div>
  );
}

export default MetricCard;
