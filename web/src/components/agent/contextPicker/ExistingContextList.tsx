import type { TFunction } from "i18next";
import ScrollArea from "@/layouts/ScrollArea";
import LoadingSpinner from "@/components/LoadingSpinner";
import ActionButton, { ActionButtonGroup } from "@/components/ActionButton";
import type { ContextBoxSummary } from "@/types/cardbox";
import { formatDateTime as formatDateTimeUtil } from "@/utils/datetime";
import { TextInput } from "@/components/forms";

interface ExistingContextListProps {
  t: TFunction;
  search: string;
  onSearchChange: (value: string) => void;
  listLoading: boolean;
  filteredBoxes: ContextBoxSummary[];
  existingIds: Set<string>;
  pendingAddId: string | null;
  isUpdating: boolean;
  deleteState: { isPending: boolean; targetId: string | null };
  moduleLabelMap: Record<string, string>;
  onPreview: (summary: ContextBoxSummary) => void;
  onDelete: (summary: ContextBoxSummary) => void;
  onAdd: (summary: ContextBoxSummary) => void;
}

const ExistingContextList: React.FC<ExistingContextListProps> = ({
  t,
  search,
  onSearchChange,
  listLoading,
  filteredBoxes,
  existingIds,
  pendingAddId,
  isUpdating,
  deleteState,
  moduleLabelMap,
  onPreview,
  onDelete,
  onAdd,
}) => {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-col gap-2 mb-4 flex-shrink-0">
        <label className="text-sm font-medium text-base-content/80">
          {t("agent.context.search.contextBox")}
        </label>
        <TextInput
          type="text"
          placeholder={t("agent.context.search.placeholder")}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-base-content/60 mb-3 flex-shrink-0">
        <span>{t("agent.context.availableContextBoxes")}</span>
        {listLoading && <LoadingSpinner size="sm" />}
      </div>

      <ScrollArea className="space-y-2 pr-1 flex-1">
        {filteredBoxes.length === 0 && !listLoading ? (
          <div className="text-xs text-base-content/60">
            {t("agent.context.noMatchingContextBoxes")}
          </div>
        ) : (
          filteredBoxes.map((summary) => {
            const alreadyInSession = existingIds.has(summary.box_id);
            const isPending = pendingAddId === summary.box_id;
            const isDeleting =
              deleteState.isPending && deleteState.targetId === summary.box_id;

            return (
              <div
                key={summary.box_id}
                className="border border-base-300 rounded-md p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-base-content">
                      {summary.display_name || summary.name}
                    </div>
                    <div className="text-xs text-base-content/60 mt-1">
                      {moduleLabelMap[summary.module] ?? summary.module}
                      {" · "}
                      {summary.card_count} {t("cardbox.labels.cards")}
                    </div>
                  </div>
                  <ActionButtonGroup gap="sm" align="end">
                    <ActionButton
                      label={t("common.preview")}
                      size="xs"
                      variant="solid"
                      onClick={() => onPreview(summary)}
                      iconName="eye"
                    />
                    {summary.module !== "chat" ? (
                      <ActionButton
                        label={
                          isDeleting ? t("common.deleting") : t("common.delete")
                        }
                        size="xs"
                        variant="outline"
                        color="error"
                        onClick={() => onDelete(summary)}
                        disabled={isDeleting}
                        iconName="trash"
                      />
                    ) : null}
                  </ActionButtonGroup>
                </div>
                <div className="flex items-center justify-between text-xs text-base-content/60">
                  <span>
                    {t("cardbox.labels.lastUpdated")}:
                    {summary.updated_at
                      ? formatDateTimeUtil(summary.updated_at)
                      : "--"}
                  </span>
                  <ActionButton
                    label={
                      alreadyInSession
                        ? t("agent.context.status.added")
                        : isPending
                          ? t("agent.context.status.adding")
                          : t("agent.context.buttons.addToSession")
                    }
                    size="xs"
                    color="primary"
                    variant="solid"
                    onClick={() => onAdd(summary)}
                    disabled={alreadyInSession || isPending || isUpdating}
                    iconName="plus"
                  />
                </div>
              </div>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
};

export default ExistingContextList;
