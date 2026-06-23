import ActionButton, {
  CreateNewButton,
  DeleteButton,
  EditButton,
} from "@/components/ActionButton";
import Badge from "@/components/common/Badge";
import EnumSelect from "@/components/selects/EnumSelect";
import type { FinanceSnapshot, FinanceTree } from "@/services/api/finance";
import type { UUID } from "@/types/primitive";
import { useTranslation } from "react-i18next";

import { snapshotLabel, type PresetConfig } from "./utils";

export function SnapshotSelectorToolbar({
  badges,
  manageLabel,
  manageAriaLabel,
  selectValue,
  selectOptions,
  selectPlaceholder,
  hasPrevious,
  hasNext,
  description,
  createLabel,
  createDisabled,
  onSelect,
  onPrevious,
  onNext,
  onManage,
  onCreate,
}: {
  badges: React.ReactNode;
  manageLabel: string;
  manageAriaLabel?: string;
  selectValue?: UUID | null;
  selectOptions: { value: UUID; label: string }[];
  selectPlaceholder: string;
  hasPrevious: boolean;
  hasNext: boolean;
  description: string;
  createLabel: string;
  createDisabled?: boolean;
  onSelect: (snapshotId: UUID) => void;
  onPrevious: () => void;
  onNext: () => void;
  onManage: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {badges}
          <ActionButton
            label={manageLabel}
            onClick={onManage}
            size="sm"
            variant="outline"
            iconName="settings"
            ariaLabel={manageAriaLabel ?? manageLabel}
          />
        </div>

        <div className="flex flex-1 items-center justify-center gap-1 sm:gap-2 min-w-0 whitespace-nowrap">
          <ActionButton
            label=""
            iconName="chevron-left"
            iconOnly
            ariaLabel={t("finance.snapshot.previous")}
            size="sm"
            variant="ghost"
            shape="circle"
            onClick={onPrevious}
            disabled={!selectOptions.length || !hasPrevious}
          />

          <EnumSelect
            value={selectValue ?? undefined}
            onChange={(value) => {
              if (value) onSelect(String(value) as UUID);
            }}
            options={selectOptions}
            placeholder={selectPlaceholder}
            showLabel={false}
            size="sm"
            className="w-auto min-w-[12rem] sm:min-w-[16rem] max-w-full"
            autoWidth
            disabled={!selectOptions.length}
          />

          <ActionButton
            label=""
            iconName="chevron-right"
            iconOnly
            ariaLabel={t("finance.snapshot.next")}
            size="sm"
            variant="ghost"
            shape="circle"
            onClick={onNext}
            disabled={!selectOptions.length || !hasNext}
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <CreateNewButton
            label={createLabel}
            onClick={onCreate}
            size="sm"
            color="primary"
            variant="solid"
            disabled={createDisabled}
            ariaLabel={createLabel}
          />
        </div>
      </div>

      <p className="mt-3 text-sm text-base-content/70">{description}</p>
    </section>
  );
}

export function SnapshotToolbar({
  tree,
  preset,
  snapshots,
  selectedSnapshotId,
  hasPrevious,
  hasNext,
  onSelect,
  onPrevious,
  onNext,
  onManageTree,
  onCreateSnapshot,
  createDisabled,
}: {
  tree: FinanceTree;
  preset: PresetConfig;
  snapshots: FinanceSnapshot[];
  selectedSnapshotId: UUID | null;
  hasPrevious: boolean;
  hasNext: boolean;
  onSelect: (snapshotId: UUID) => void;
  onPrevious: () => void;
  onNext: () => void;
  onManageTree: () => void;
  onCreateSnapshot: () => void;
  createDisabled: boolean;
}) {
  const { t } = useTranslation();
  const options = snapshots.map((snapshot) => ({
    value: snapshot.id,
    label: snapshotLabel(snapshot),
  }));

  return (
    <SnapshotSelectorToolbar
      badges={
        <>
          <Badge tone="primary" variant="outline" size="sm">
            {tree.name}
          </Badge>
          <Badge tone="neutral" variant="outline" size="sm">
            {tree.primary_currency}
          </Badge>
        </>
      }
      manageLabel={t("finance.tree.manage")}
      selectValue={selectedSnapshotId}
      selectOptions={options}
      selectPlaceholder={t("finance.snapshot.selectSnapshot")}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      description={t(preset.descriptionKey)}
      createLabel={t("finance.snapshot.new")}
      createDisabled={createDisabled}
      onSelect={onSelect}
      onPrevious={onPrevious}
      onNext={onNext}
      onManage={onManageTree}
      onCreate={onCreateSnapshot}
    />
  );
}

export function SnapshotActionButtons({
  editLabel,
  deleteLabel,
  disabled,
  deleteDisabled,
  onEdit,
  onDelete,
}: {
  editLabel: string;
  deleteLabel: string;
  disabled?: boolean;
  deleteDisabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <EditButton
        onClick={onEdit}
        size="sm"
        variant="ghost"
        ariaLabel={editLabel}
        disabled={disabled}
      />
      <DeleteButton
        onClick={onDelete}
        size="sm"
        variant="ghost"
        ariaLabel={deleteLabel}
        disabled={deleteDisabled ?? disabled}
      />
    </div>
  );
}

export function SnapshotNavigator({
  title,
  positionLabel,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  rightSlot,
}: {
  title: string;
  positionLabel?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  rightSlot?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-grow flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ActionButton
            label=""
            iconName="chevron-left"
            iconOnly
            ariaLabel={t("finance.snapshot.previous")}
            size="sm"
            variant="ghost"
            shape="circle"
            onClick={onPrevious}
            disabled={!hasPrevious}
          />
          <ActionButton
            label=""
            iconName="chevron-right"
            iconOnly
            ariaLabel={t("finance.snapshot.next")}
            size="sm"
            variant="ghost"
            shape="circle"
            onClick={onNext}
            disabled={!hasNext}
          />
        </div>
        <div>
          {positionLabel ? (
            <p className="text-xs uppercase tracking-wide text-base-content/60">
              {positionLabel}
            </p>
          ) : null}
          <p className="text-lg font-semibold text-base-content">{title}</p>
        </div>
      </div>
      {rightSlot ? <div className="text-right text-sm text-base-content/70">{rightSlot}</div> : null}
    </header>
  );
}
