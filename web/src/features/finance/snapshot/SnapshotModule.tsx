import type { ReactNode, RefObject } from "react";

import ActionButton, { CreateNewButton } from "@/components/ActionButton";
import LoadingSpinner from "@/components/LoadingSpinner";
import { SnapshotToolbar } from "@/components/finance/SnapshotToolbar";

export interface SnapshotOption<ID extends string> {
  value: ID;
  label: string;
  disabled?: boolean;
}

export interface SnapshotToolbarConfig<ID extends string> {
  show: boolean;
  options: SnapshotOption<ID>[];
  selectedId: ID | null;
  onSelect: (id: ID) => void;
  placeholder: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  leftSlot?: ReactNode;
  manageLabel?: string;
  exportLabel?: string;
  onManage?: () => void;
  onExport?: () => void;
  createLabel: string;
  createAriaLabel?: string;
  createIconOnly?: boolean;
  onCreate: () => void;
  createDisabled: boolean;
  previousAriaLabel: string;
  nextAriaLabel: string;
  disabled?: boolean;
}

export interface SnapshotSectionConfig<
  ID extends string,
  Summary,
  Detail,
  CreatePayload,
  UpdatePayload,
> {
  hasSnapshots: boolean;
  orderedSnapshotsCount: number;
  currentSnapshot: Summary | null;
  snapshotDetail: Detail | null | undefined;
  snapshotDetailLoading: boolean;
  isSnapshotFormVisible: boolean;
  snapshotFormRef: RefObject<HTMLDivElement | null>;
  snapshotFormMode: "create" | "edit";
  snapshotSubmissionPending: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  currentPosition: number;
  onPrevious: () => void;
  onNext: () => void;
  onOpenSnapshotForm: () => void;
  onCloseSnapshotForm?: () => void;
  onCreateSnapshot: (payload: CreatePayload) => void;
  onUpdateSnapshot: (id: ID, payload: UpdatePayload) => void;
  onEditSnapshot?: (snapshot: Summary) => void;
  onDeleteSnapshot?: (snapshot: Summary) => void;
  formHeaderActions?: ReactNode;
  snapshotNavigatorActionSlot?: ReactNode;
  snapshotDetailPlaceholder: string;
  emptyStateLabel: string;
  emptyCreateLabel: string;
  emptyCreateDisabled: boolean;
  emptySelectLabel?: string;
}

interface SnapshotModuleProps<
  ID extends string,
  Summary,
  Detail,
  CreatePayload,
  UpdatePayload,
> {
  toolbar: SnapshotToolbarConfig<ID>;
  section: SnapshotSectionConfig<
    ID,
    Summary,
    Detail,
    CreatePayload,
    UpdatePayload
  >;
  renderNavigator: (
    section: SnapshotSectionConfig<
      ID,
      Summary,
      Detail,
      CreatePayload,
      UpdatePayload
    >,
  ) => ReactNode;
  renderForm: (
    section: SnapshotSectionConfig<
      ID,
      Summary,
      Detail,
      CreatePayload,
      UpdatePayload
    >,
  ) => ReactNode;
  renderDetail: (
    detail: Detail,
    section: SnapshotSectionConfig<
      ID,
      Summary,
      Detail,
      CreatePayload,
      UpdatePayload
    >,
  ) => ReactNode;
}

export function SnapshotModule<
  ID extends string,
  Summary,
  Detail,
  CreatePayload,
  UpdatePayload,
>({
  toolbar,
  section,
  renderNavigator,
  renderForm,
  renderDetail,
}: SnapshotModuleProps<ID, Summary, Detail, CreatePayload, UpdatePayload>) {
  const showManageAction = Boolean(toolbar.manageLabel && toolbar.onManage);
  const showExportAction = Boolean(toolbar.exportLabel && toolbar.onExport);

  return (
    <>
      {toolbar.show ? (
        <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
          <SnapshotToolbar
            leftSlot={
              <div className="flex gap-2">
                {toolbar.leftSlot}
                {showManageAction ? (
                  <ActionButton
                    label={toolbar.manageLabel ?? ""}
                    onClick={toolbar.onManage}
                    size="sm"
                    variant="outline"
                  />
                ) : null}
                {showExportAction ? (
                  <ActionButton
                    label={toolbar.exportLabel ?? ""}
                    iconName="document-text"
                    onClick={toolbar.onExport}
                    size="sm"
                  />
                ) : null}
              </div>
            }
            rightSlot={
              <CreateNewButton
                label={toolbar.createLabel}
                onClick={toolbar.onCreate}
                size="sm"
                color="primary"
                variant="solid"
                disabled={toolbar.createDisabled}
                ariaLabel={toolbar.createAriaLabel}
                showLabel={!toolbar.createIconOnly}
              />
            }
            options={toolbar.options}
            selectedId={toolbar.selectedId}
            onSelect={toolbar.onSelect}
            placeholder={toolbar.placeholder}
            hasPrevious={toolbar.hasPrevious}
            hasNext={toolbar.hasNext}
            onPrevious={toolbar.onPrevious}
            onNext={toolbar.onNext}
            previousAriaLabel={toolbar.previousAriaLabel}
            nextAriaLabel={toolbar.nextAriaLabel}
            disabled={toolbar.disabled}
          />
        </section>
      ) : null}

      {!section.hasSnapshots ? (
        section.isSnapshotFormVisible ? (
          <section
            ref={section.snapshotFormRef}
            className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm"
          >
            {renderForm(section)}
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-base-200 bg-base-100 p-8 text-center text-sm text-base-content/70">
            <p>{section.emptyStateLabel}</p>
            <div className="mt-4 flex justify-center">
              <CreateNewButton
                label={section.emptyCreateLabel}
                onClick={section.onOpenSnapshotForm}
                size="sm"
                color="primary"
                variant="solid"
                disabled={section.emptyCreateDisabled}
              />
            </div>
          </div>
        )
      ) : (
        <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
          {renderNavigator(section)}
          <div
            className="mt-4"
            ref={
              section.isSnapshotFormVisible
                ? section.snapshotFormRef
                : undefined
            }
          >
            {section.isSnapshotFormVisible ? (
              renderForm(section)
            ) : section.snapshotDetailLoading ? (
              <div className="py-6">
                <LoadingSpinner />
              </div>
            ) : section.snapshotDetail ? (
              renderDetail(section.snapshotDetail, section)
            ) : (
              <p className="py-4 text-sm text-base-content/70">
                {section.emptySelectLabel ?? section.snapshotDetailPlaceholder}
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
