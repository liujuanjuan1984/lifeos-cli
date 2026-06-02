import { useTranslation } from "react-i18next";

import ActionButton from "@/components/ActionButton";
import MetricCard from "@/components/finance/MetricCard";
import SnapshotNavigatorBase from "@/components/finance/SnapshotNavigatorBase";
import CashflowSnapshotTree from "./CashflowSnapshotTree";
import type {
  CashflowSnapshotDetail,
  CashflowSnapshotSummary,
  CashflowSourceNode,
} from "@/services/api/finance";
import { formatMonthInTimezone } from "@/utils/datetime";
import { formatDecimalValue } from "@/features/finance/shared";

interface SnapshotNavigatorProps {
  snapshot: CashflowSnapshotSummary;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  currentPosition: number;
  total: number;
  showNavigationControls?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  actionsDisabled?: boolean;
  timezone?: string;
  hideActions?: boolean;
}

export function SnapshotNavigator({
  snapshot,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  currentPosition,
  total,
  showNavigationControls = true,
  onEdit,
  onDelete,
  actionsDisabled = false,
  timezone,
  hideActions = false,
}: SnapshotNavigatorProps) {
  const { t } = useTranslation();
  const timestampLabel = formatMonthInTimezone(snapshot.period_start, timezone);
  const positionLabel = t("finance.snapshotPosition", {
    index: currentPosition,
    total,
  });

  const actionButtons =
    !hideActions && (onEdit || onDelete) ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onEdit ? (
          <ActionButton
            label={t("common.edit")}
            size="xs"
            variant="outline"
            onClick={onEdit}
            disabled={actionsDisabled}
          />
        ) : null}
        {onDelete ? (
          <ActionButton
            label={t("common.delete")}
            size="xs"
            color="error"
            variant="ghost"
            onClick={onDelete}
            disabled={actionsDisabled}
          />
        ) : null}
      </div>
    ) : null;

  const rightSlot = (
    <div className="flex flex-col items-end gap-2 text-right text-sm text-base-content/70">
      {actionButtons}
    </div>
  );

  return (
    <SnapshotNavigatorBase
      title={timestampLabel}
      positionLabel={showNavigationControls ? positionLabel : undefined}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      onPrevious={onPrevious}
      onNext={onNext}
      showNavigationControls={showNavigationControls}
      previousAriaLabel={t("finance.previousSnapshot")}
      nextAriaLabel={t("finance.nextSnapshot")}
      rightSlot={rightSlot}
    />
  );
}

interface CashflowSnapshotDetailCardProps {
  snapshot: CashflowSnapshotDetail;
  sources: CashflowSourceNode[];
  treeName: string | null;
}

export function CashflowSnapshotDetailCard({
  snapshot,
  sources,
  treeName,
}: CashflowSnapshotDetailCardProps) {
  const { t } = useTranslation();

  const formatCurrency = (amount: string) => {
    return formatDecimalValue(amount) ?? amount;
  };

  const totalIncome = formatCurrency(snapshot.total_income);
  const totalExpense = formatCurrency(snapshot.total_expense);
  const netCashflow = formatCurrency(snapshot.net_cashflow);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          title={t("finance.cashflowIncome")}
          value={totalIncome}
          currency={snapshot.primary_currency}
        />
        <MetricCard
          title={t("finance.cashflowExpense")}
          value={totalExpense}
          currency={snapshot.primary_currency}
        />
        <MetricCard
          title={t("finance.cashflowNet")}
          value={netCashflow}
          currency={snapshot.primary_currency}
          highlighted
        />
      </div>

      <CashflowSnapshotTree sources={sources} snapshot={snapshot} />

      <div className="rounded-lg border border-dashed border-base-200 p-3 text-sm text-base-content/70">
        <p className="font-medium text-base-content">
          {t("finance.cashflowTreeLabel")}
        </p>
        <p className="mt-1 text-sm text-base-content/80">{treeName || "—"}</p>
      </div>

      {snapshot.note ? (
        <div className="rounded-lg border border-dashed border-base-200 p-3 text-sm text-base-content/70">
          <p className="font-medium text-base-content">
            {t("finance.cashflowNote")}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{snapshot.note}</p>
        </div>
      ) : null}
    </div>
  );
}
