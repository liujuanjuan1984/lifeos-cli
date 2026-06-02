import { useTranslation } from "react-i18next";

import type { CashflowSourceNode } from "@/services/api/finance";
import ActionButton, { EditButton } from "@/components/ActionButton";
import Badge from "@/components/common/Badge";
import ResponsiveActionButtonGroup from "@/components/ResponsiveActionButtonGroup";
import { FinanceTree } from "@/features/finance/shared/components/FinanceTree";

interface CashflowSourceTreeProps {
  sources: CashflowSourceNode[];
  onCreateChild?: (node: CashflowSourceNode) => void;
  onEdit?: (node: CashflowSourceNode) => void;
  onViewManualBilling?: (node: CashflowSourceNode) => void;
  actionsDisabled?: boolean;
}

function CashflowSourceTree({
  sources,
  onCreateChild,
  onEdit,
  onViewManualBilling,
  actionsDisabled = false,
}: CashflowSourceTreeProps) {
  const { t } = useTranslation();
  const parseAnchorDate = (value: string | null): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  return (
    <FinanceTree
      nodes={sources}
      emptyState={
        <div className="rounded-lg border border-dashed border-base-200 bg-base-100 p-6 text-sm text-base-content/70">
          {t("finance.emptyCashflowSources")}
        </div>
      }
      resetExpandedOnNodesChange
      renderNode={({ node, depth, isExpanded, hasChildren, toggle }) => {
        const indent = Math.min(depth, 6) * 1.25;

        const badges: string[] = [];
        if (hasChildren || node.children_count > 0 || node.is_rollup) {
          badges.push(t("finance.rollupLabelShort"));
        }
        if (node.kind === "billing") {
          badges.push(t("finance.billingLabel"));
        }
        if (node.billing_requires_manual_input && node.kind === "billing") {
          badges.push(t("finance.manualEntry"));
        }

        let billingAnchorLabel: string | null = null;
        if (node.kind === "billing") {
          const anchorDate = parseAnchorDate(node.billing_anchor_date);
          switch (node.billing_cycle_type) {
            case "month":
              if (node.billing_anchor_day) {
                billingAnchorLabel = t("finance.billingAnchorMonthlyLabel", {
                  day: node.billing_anchor_day,
                });
              }
              break;
            case "year":
              if (anchorDate) {
                billingAnchorLabel = t("finance.billingAnchorYearlyLabel", {
                  month: anchorDate.getMonth() + 1,
                  day: anchorDate.getDate(),
                });
              }
              break;
            case "week":
              if (anchorDate) {
                const weekdayIndex = anchorDate.getDay();
                const weekdayKeys = [
                  "sunday",
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                ] as const;
                const weekdayKey = weekdayKeys[weekdayIndex] ?? "monday";
                billingAnchorLabel = t("finance.billingAnchorWeeklyLabel", {
                  weekday: t(`weekdays.${weekdayKey}`),
                });
              }
              break;
            case "day":
              billingAnchorLabel = t("finance.billingAnchorDailyLabel");
              break;
            default:
              break;
          }
          if (!billingAnchorLabel && anchorDate) {
            billingAnchorLabel = t("finance.billingAnchorDateLabel", {
              date: anchorDate.toISOString().slice(0, 10),
            });
          }
        }

        const defaultAmountLabel =
          node.kind === "billing" &&
          !node.billing_requires_manual_input &&
          node.billing_default_amount
            ? (() => {
                const numeric = Number(node.billing_default_amount);
                const amountText = Number.isFinite(numeric)
                  ? numeric.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })
                  : String(node.billing_default_amount);
                return t("finance.billingDefaultAmountLabel", {
                  amount: amountText,
                });
              })()
            : null;

        const billingDetails = [billingAnchorLabel, defaultAmountLabel].filter(
          (item): item is string => Boolean(item),
        );
        const inlineSeparator = t("finance.inlineSeparator");
        const billingSummaryText = billingDetails.length
          ? billingDetails.join(inlineSeparator)
          : null;

        const actionButtons = (
          <ResponsiveActionButtonGroup
            gap="sm"
            align="end"
            mobileVisibleCount={2}
            mediumVisibleCount={3}
            largeVisibleCount={4}
          >
            {onViewManualBilling &&
            node.kind === "billing" &&
            node.billing_requires_manual_input ? (
              <ActionButton
                label=""
                iconName="document-text"
                iconOnly
                ariaLabel={t("finance.viewBilling")}
                onClick={() => onViewManualBilling(node)}
                disabled={actionsDisabled}
                size="xs"
                color="primary"
              />
            ) : null}
            {onCreateChild ? (
              <ActionButton
                label=""
                iconName="plus"
                iconOnly
                ariaLabel={t("finance.addChildSource")}
                onClick={() => onCreateChild(node)}
                disabled={actionsDisabled}
                size="xs"
              />
            ) : null}
            {onEdit ? (
              <EditButton
                onClick={() => onEdit(node)}
                disabled={actionsDisabled}
                size="xs"
              />
            ) : null}
          </ResponsiveActionButtonGroup>
        );

        return (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-base-200 bg-base-100 px-3 py-2 shadow-sm"
            style={{ marginLeft: `${indent}rem` }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {hasChildren ? (
                <ActionButton
                  label=""
                  iconName={isExpanded ? "chevron-down" : "chevron-right"}
                  iconOnly
                  ariaLabel={
                    isExpanded ? t("finance.collapse") : t("finance.expand")
                  }
                  onClick={toggle}
                  size="xs"
                  variant="ghost"
                  color="neutral"
                />
              ) : (
                <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center text-base-content/30">
                  •
                </span>
              )}
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="truncate font-medium text-base-content">
                  {node.name}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                  {badges.map((badge) => (
                    <Badge
                      key={badge}
                      size="sm"
                      variant="outline"
                      className="font-normal"
                    >
                      {badge}
                    </Badge>
                  ))}
                  {node.aggregated_amount ? (
                    <span className="text-base-content">
                      {t("finance.aggregatedAmountLabel", {
                        amount: node.aggregated_amount,
                      })}
                    </span>
                  ) : null}
                  {billingSummaryText ? (
                    <span className="whitespace-nowrap text-base-content/60">
                      {billingSummaryText}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {actionButtons}
          </div>
        );
      }}
    />
  );
}

export default CashflowSourceTree;
