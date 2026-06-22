import type { FinancePurpose, FinanceTreeNode } from "@/services/api/finance";
import type { UUID } from "@/types/primitive";

export type PresetConfig = {
  purpose: FinancePurpose;
  titleKey: string;
  descriptionKey: string;
  amountLabelKey: string;
  timeMode: "instant" | "period";
};

export type FinanceTab = FinancePurpose | "rates";

export type TreeNodeWithChildren = FinanceTreeNode & {
  children: TreeNodeWithChildren[];
};

export type SnapshotAmountState = Record<UUID, string>;
export type SnapshotNoteState = Record<UUID, string>;

export type RateSnapshotFormMode = "create" | "edit";

export type RateRowState = {
  baseAmount: string;
  baseCurrency: string;
  quoteAmount: string;
  quoteCurrency: string;
};

export type FinanceNodeFormState =
  | { mode: "create"; parentId?: UUID | null }
  | { mode: "edit"; node: TreeNodeWithChildren };
