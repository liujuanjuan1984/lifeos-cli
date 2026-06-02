import { useTranslation } from "react-i18next";

import type { FinanceAccountNode } from "@/services/api/finance";
import ActionButton, {
  DeleteButton,
  EditButton,
} from "@/components/ActionButton";
import Badge from "@/components/common/Badge";
import ResponsiveActionButtonGroup from "@/components/ResponsiveActionButtonGroup";
import { FinanceTree } from "@/features/finance/shared/components/FinanceTree";

interface AccountTreeProps {
  accounts: FinanceAccountNode[];
  onCreateChild?: (node: FinanceAccountNode) => void;
  onEdit?: (node: FinanceAccountNode) => void;
  onDelete?: (node: FinanceAccountNode) => void;
  onViewTimeline?: (node: FinanceAccountNode) => void;
  actionsDisabled?: boolean;
}

export function AccountTree({
  accounts,
  onCreateChild,
  onEdit,
  onDelete,
  onViewTimeline,
  actionsDisabled = false,
}: AccountTreeProps) {
  const { t } = useTranslation();
  return (
    <FinanceTree
      nodes={accounts}
      emptyState={
        <div className="rounded-lg border border-dashed border-base-200 bg-base-100 p-6 text-sm text-base-content/70">
          {t("finance.emptyAccounts")}
        </div>
      }
      childrenClassName="ml-6 border-l border-base-200 pl-4"
      renderNode={({ node, depth, isExpanded, hasChildren, toggle }) => {
        const actionsAvailable = Boolean(
          onCreateChild || onEdit || onDelete || onViewTimeline,
        );
        const indent = depth * 20;

        return (
          <div
            style={{ marginLeft: indent }}
            className="rounded-lg border border-base-200 bg-base-100 p-3 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {hasChildren ? (
                  <ActionButton
                    label=""
                    iconName={isExpanded ? "chevron-down" : "chevron-right"}
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    onClick={toggle}
                    ariaLabel={
                      isExpanded ? t("finance.collapse") : t("finance.expand")
                    }
                    iconOnly
                    shape="circle"
                  />
                ) : (
                  <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center text-base-content/30">
                    •
                  </span>
                )}
                <div className="min-w-0 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <p className="truncate font-semibold text-base-content">
                    {node.name}
                  </p>
                  <div className="inline-flex flex-wrap items-center gap-1 text-xs text-base-content/70 sm:flex-nowrap">
                    {node.nature ? (
                      <Badge tone="ghost" size="sm">
                        {node.nature}
                      </Badge>
                    ) : null}
                    <span className="rounded-full bg-base-200 px-2 py-0.5">
                      {node.currency_code}
                    </span>
                    <span>{formatInterestRate(node.interest_rate)}</span>
                  </div>
                </div>
              </div>

              {actionsAvailable ? (
                <ResponsiveActionButtonGroup
                  gap="sm"
                  align="end"
                  mobileVisibleCount={2}
                  mediumVisibleCount={3}
                  largeVisibleCount={4}
                  className="sm:self-start"
                >
                  {onViewTimeline ? (
                    <ActionButton
                      label=""
                      iconName="timer"
                      color="primary"
                      onClick={() => onViewTimeline(node)}
                      disabled={actionsDisabled}
                      ariaLabel={t("finance.viewAccountTimeline")}
                      iconOnly
                    />
                  ) : null}
                  {onEdit ? (
                    <EditButton
                      onClick={() => onEdit(node)}
                      size="sm"
                      disabled={actionsDisabled}
                    />
                  ) : null}
                  {onCreateChild ? (
                    <ActionButton
                      label=""
                      iconName="plus"
                      color="neutral"
                      onClick={() => onCreateChild(node)}
                      disabled={actionsDisabled}
                      ariaLabel={t("finance.addChildAccount")}
                      iconOnly
                    />
                  ) : null}
                  {onDelete ? (
                    <DeleteButton
                      onClick={() => onDelete(node)}
                      size="sm"
                      disabled={actionsDisabled}
                    />
                  ) : null}
                </ResponsiveActionButtonGroup>
              ) : null}
            </div>
          </div>
        );
      }}
    />
  );
}

function formatInterestRate(rate: string | null | undefined) {
  const value = Number(rate ?? "0");
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  return value.toLocaleString(undefined, {
    style: "percent",
    minimumFractionDigits: 2,
  });
}
