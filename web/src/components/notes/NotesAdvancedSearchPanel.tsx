import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import Card from "@/layouts/Card";
import { FormField, TextInput } from "@/components/forms";
import ActionButton from "@/components/ActionButton";
import TagSelector from "@/components/selects/TagSelector";
import PersonSelector from "@/components/selects/PersonSelector";
import TaskSelector from "@/components/selects/TaskSelector";
import { dateStringToISO, formatDateInTimezone } from "@/utils/datetime";
import type {
  NotePersonFilterMode,
  NoteTagFilterMode,
  NoteTaskFilterMode,
} from "@/services/api/notes";
import type { Tag } from "@/services/api/tags";
import type { UUID } from "@/types/primitive";

export interface NotesAdvancedSearchFormState {
  start_date: Date | null;
  end_date: Date | null;
  tag_mode: NoteTagFilterMode;
  tag_ids: UUID[];
  person_mode: NotePersonFilterMode;
  person_ids: UUID[];
  task_filter: NoteTaskFilterMode;
  task_id: UUID | null;
  keyword: string;
  sort_order: "asc" | "desc";
}

interface NotesAdvancedSearchPanelProps {
  params: NotesAdvancedSearchFormState;
  onParamsChange: (params: NotesAdvancedSearchFormState) => void;
  onSearch: () => void;
  onReset: () => void;
  onExport?: () => void;
  onCopyResults: () => void;
  availableTags: Tag[];
  onCreateTag: (tagName: string) => Promise<Tag>;
  availableTasks: { id: UUID; name: string }[];
  isSelectMode: boolean;
  onSelectModeToggle: (value: boolean) => void;
  selectedNoteIds: Set<UUID>;
  onSelectAll: () => void;
  onSelectInverse: () => void;
  onClearSelection: () => void;
  onOpenBatchEdit: () => void;
  onBatchDelete: () => void;
  totalResults: number;
  timezone?: string;
  isLoading?: boolean;
  canCopyResults: boolean;
}

const NotesAdvancedSearchPanel = ({
  params,
  onParamsChange,
  onSearch,
  onReset,
  onExport,
  onCopyResults,
  availableTags,
  onCreateTag,
  availableTasks,
  isSelectMode,
  onSelectModeToggle,
  selectedNoteIds,
  onSelectAll,
  onSelectInverse,
  onClearSelection,
  onOpenBatchEdit,
  onBatchDelete,
  totalResults,
  timezone,
  isLoading = false,
  canCopyResults,
}: NotesAdvancedSearchPanelProps) => {
  const { t } = useTranslation();

  const initialKeyword = params.keyword || "";
  const [keywordDraft, setKeywordDraft] = useState(initialKeyword);

  const keywordDraftRef = useRef(initialKeyword);
  const hasPendingKeywordRef = useRef(false);
  const searchTriggerRef = useRef(false);

  const paramsRef = useRef({ ...params, keyword: initialKeyword });

  useEffect(() => {
    keywordDraftRef.current = keywordDraft;
  }, [keywordDraft]);

  useEffect(() => {
    paramsRef.current = { ...params, keyword: keywordDraftRef.current };
  }, [params, keywordDraft]);

  useEffect(() => {
    const externalKeyword = params.keyword || "";
    const currentDraft = keywordDraftRef.current;
    if (!hasPendingKeywordRef.current || externalKeyword !== currentDraft) {
      hasPendingKeywordRef.current = false;
      if (externalKeyword !== currentDraft) {
        setKeywordDraft(externalKeyword);
      }
    }

    // 如果搜索触发标志为true，则执行搜索
    if (searchTriggerRef.current) {
      searchTriggerRef.current = false;
      onSearch();
    }
  }, [params.keyword, onSearch]);

  const handleKeywordChange = useCallback((value: string) => {
    setKeywordDraft(value);
    hasPendingKeywordRef.current = true;
  }, []);

  const commitKeyword = useCallback(() => {
    const currentDraft = keywordDraftRef.current;
    hasPendingKeywordRef.current = false;
    searchTriggerRef.current = true;

    // 总是触发参数更新
    onParamsChange({
      ...paramsRef.current,
      keyword: currentDraft,
    });
  }, [onParamsChange]);

  const commitKeywordForExport = useCallback(() => {
    const currentDraft = keywordDraftRef.current;
    const currentParams = paramsRef.current;
    if (currentParams.keyword === currentDraft) {
      hasPendingKeywordRef.current = false;
      return;
    }
    hasPendingKeywordRef.current = false;
    onParamsChange({
      ...currentParams,
      keyword: currentDraft,
    });
  }, [onParamsChange]);

  const handleDateChange = useCallback(
    (key: "start_date" | "end_date", value: string) => {
      if (!value) {
        onParamsChange({
          ...paramsRef.current,
          [key]: null,
        });
        return;
      }
      let iso: string;
      try {
        iso = dateStringToISO(value, timezone, key === "end_date");
      } catch (error) {
        console.error("Failed to convert date string", error);
        return;
      }
      if (!iso) {
        return;
      }
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) {
        return;
      }
      const nextParams = {
        ...paramsRef.current,
        [key]: parsed,
      } as NotesAdvancedSearchFormState;
      onParamsChange(nextParams);
    },
    [onParamsChange, timezone],
  );

  const preloadedTasks = useMemo(
    () =>
      availableTasks.map((task) => ({
        id: task.id,
        content: task.name,
        status: "todo",
        vision_id: task.id,
        parent_task_id: null,
        priority: 1,
        display_order: 0,
        estimated_effort: null,
        actual_effort_self: 0,
        actual_effort_total: 0,
        notes_count: 0,
        created_at: "1970-01-01T00:00:00.000Z",
        updated_at: "1970-01-01T00:00:00.000Z",
      })),
    [availableTasks],
  );

  const renderModeButton = (
    mode: string,
    current: string,
    label: string,
    onClick: () => void,
  ) => (
    <ActionButton
      label={label}
      size="sm"
      variant={mode === current ? "solid" : "outline"}
      color={mode === current ? "primary" : "neutral"}
      onClick={onClick}
    />
  );

  return (
    <Card
      title={t("notes.advancedSearch.title")}
      className="w-full min-w-0"
      contentClassName="min-w-0"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 min-w-0">
        <FormField
          label={t("notes.advancedSearch.startDate")}
          htmlFor="notes-advanced-start"
        >
          <TextInput
            id="notes-advanced-start"
            type="date"
            value={
              params.start_date
                ? formatDateInTimezone(params.start_date, timezone)
                : ""
            }
            onChange={(event) =>
              handleDateChange("start_date", event.target.value)
            }
            size="sm"
          />
        </FormField>
        <FormField
          label={t("notes.advancedSearch.endDate")}
          htmlFor="notes-advanced-end"
        >
          <TextInput
            id="notes-advanced-end"
            type="date"
            value={
              params.end_date
                ? formatDateInTimezone(params.end_date, timezone)
                : ""
            }
            onChange={(event) =>
              handleDateChange("end_date", event.target.value)
            }
            size="sm"
          />
        </FormField>
        <FormField
          label={t("notes.advancedSearch.sortOrder")}
          useLabelElement={false}
        >
          <div className="flex items-center gap-2">
            {renderModeButton(
              "desc",
              params.sort_order,
              t("notes.advancedSearch.sortNewest"),
              () =>
                onParamsChange({
                  ...paramsRef.current,
                  sort_order: "desc",
                }),
            )}
            {renderModeButton(
              "asc",
              params.sort_order,
              t("notes.advancedSearch.sortOldest"),
              () =>
                onParamsChange({
                  ...paramsRef.current,
                  sort_order: "asc",
                }),
            )}
          </div>
        </FormField>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4 min-w-0">
        <div className="space-y-3">
          <FormField
            label={t("notes.advancedSearch.tagFilter")}
            labelId="tag-filter-label"
            useLabelElement={false}
          >
            <div role="group" aria-labelledby="tag-filter-label">
              <div className="flex flex-wrap gap-2 mb-2">
                {renderModeButton(
                  "any",
                  params.tag_mode,
                  t("notes.advancedSearch.tagModeAny"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      tag_mode: "any",
                    }),
                )}
                {renderModeButton(
                  "all",
                  params.tag_mode,
                  t("notes.advancedSearch.tagModeAll"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      tag_mode: "all",
                    }),
                )}
                {renderModeButton(
                  "none",
                  params.tag_mode,
                  t("notes.advancedSearch.tagModeNone"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      tag_mode: "none",
                      tag_ids: [],
                    }),
                )}
              </div>
              {params.tag_mode !== "none" && (
                <TagSelector
                  availableTags={availableTags}
                  selectedTagIds={params.tag_ids}
                  onTagsChange={(tagIds) =>
                    onParamsChange({
                      ...paramsRef.current,
                      tag_ids: tagIds,
                    })
                  }
                  onCreateTag={onCreateTag}
                  size="sm"
                />
              )}
            </div>
          </FormField>

          <FormField
            label={t("notes.advancedSearch.personFilter")}
            labelId="person-filter-label"
            useLabelElement={false}
          >
            <div role="group" aria-labelledby="person-filter-label">
              <div className="flex flex-wrap gap-2 mb-2">
                {renderModeButton(
                  "any",
                  params.person_mode,
                  t("notes.advancedSearch.personModeAny"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      person_mode: "any",
                    }),
                )}
                {renderModeButton(
                  "all",
                  params.person_mode,
                  t("notes.advancedSearch.personModeAll"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      person_mode: "all",
                    }),
                )}
                {renderModeButton(
                  "none",
                  params.person_mode,
                  t("notes.advancedSearch.personModeNone"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      person_mode: "none",
                      person_ids: [],
                    }),
                )}
              </div>
              {params.person_mode !== "none" && (
                <PersonSelector
                  selectedPersonIds={params.person_ids}
                  onSelectionChange={(personIds) =>
                    onParamsChange({
                      ...paramsRef.current,
                      person_ids: personIds,
                    })
                  }
                  multiple={true}
                  size="sm"
                  showNoPersonOption={false}
                />
              )}
            </div>
          </FormField>
        </div>

        <div className="space-y-3">
          <FormField
            label={t("notes.advancedSearch.taskFilter")}
            labelId="task-filter-label"
            useLabelElement={false}
          >
            <div role="group" aria-labelledby="task-filter-label">
              <div className="flex flex-wrap gap-2 mb-2">
                {renderModeButton(
                  "any",
                  params.task_filter,
                  t("notes.advancedSearch.taskModeAny"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      task_filter: "any",
                      task_id: null,
                    }),
                )}
                {renderModeButton(
                  "none",
                  params.task_filter,
                  t("notes.advancedSearch.taskModeNone"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      task_filter: "none",
                      task_id: null,
                    }),
                )}
                {renderModeButton(
                  "has",
                  params.task_filter,
                  t("notes.advancedSearch.taskModeHas"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      task_filter: "has",
                      task_id: null,
                    }),
                )}
                {renderModeButton(
                  "specific",
                  params.task_filter,
                  t("notes.advancedSearch.taskModeSpecific"),
                  () =>
                    onParamsChange({
                      ...paramsRef.current,
                      task_filter: "specific",
                    }),
                )}
              </div>
              {params.task_filter === "specific" && (
                <TaskSelector
                  value={params.task_id}
                  placeholder={t("notes.advancedSearch.selectTaskPlaceholder")}
                  onChange={(value) =>
                    onParamsChange({
                      ...params,
                      task_filter: value !== null ? "specific" : "none",
                      task_id: value,
                    })
                  }
                  deferRemoteLoad={true}
                  preloadedTasks={preloadedTasks}
                  showSpecialOptions={false}
                  expandFilterForSelected={true}
                  idPrefix="notes-advanced-task"
                  className="w-full"
                />
              )}
            </div>
          </FormField>

          <FormField
            label={t("notes.advancedSearch.keyword")}
            htmlFor="notes-advanced-keyword"
            description={t("notes.advancedSearch.keywordDescription")}
          >
            <TextInput
              id="notes-advanced-keyword"
              name="notes-advanced-keyword"
              type="text"
              value={keywordDraft}
              onChange={(e) => handleKeywordChange(e.target.value)}
              onCompositionEnd={(e) =>
                handleKeywordChange((e.target as HTMLInputElement).value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitKeyword();
                }
              }}
              size="sm"
              placeholder={t("notes.advancedSearch.keywordPlaceholder")}
            />
          </FormField>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0">
        <div className="flex flex-wrap gap-2 min-w-0 flex-shrink-0">
          <ActionButton
            label={
              isLoading ? t("common.loading") : t("notes.advancedSearch.search")
            }
            iconName="search"
            color="success"
            variant="outline"
            onClick={() => {
              commitKeyword();
            }}
            disabled={isLoading}
          />
          <ActionButton
            label={t("notes.advancedSearch.reset")}
            iconName="refresh"
            color="neutral"
            variant="outline"
            onClick={() => {
              hasPendingKeywordRef.current = false;
              keywordDraftRef.current = "";
              setKeywordDraft("");
              onReset();
            }}
          />
          <ActionButton
            label={t("notes.advancedSearch.copyResults")}
            iconName="clipboard"
            color="primary"
            variant="outline"
            onClick={onCopyResults}
            disabled={!canCopyResults || isLoading}
          />
          {onExport && (
            <ActionButton
              label={t("notes.advancedSearch.export")}
              iconName="upload"
              color="primary"
              variant="outline"
              onClick={() => {
                commitKeywordForExport();
                // 使用相同的策略来确保参数更新后再执行导出
                setTimeout(() => {
                  onExport();
                }, 0);
              }}
              disabled={isLoading || totalResults === 0}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center flex-shrink-0">
          {!isSelectMode && (
            <ActionButton
              label={t("notes.advancedSearch.enableBatch")}
              iconName="switch"
              color="primary"
              variant="outline"
              onClick={() => onSelectModeToggle(true)}
              disabled={totalResults === 0}
            />
          )}
          {isSelectMode && (
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label={t("notes.advancedSearch.selectAll")}
                iconName="check"
                onClick={onSelectAll}
                color="primary"
              />
              <ActionButton
                label={t("notes.advancedSearch.selectInverse")}
                iconName="repeat"
                onClick={onSelectInverse}
                color="primary"
              />
              <ActionButton
                label={t("notes.advancedSearch.batchEdit")}
                iconName="edit"
                onClick={onOpenBatchEdit}
                color="primary"
                disabled={selectedNoteIds.size === 0}
              />
              <ActionButton
                label={t("notes.advancedSearch.batchDelete")}
                iconName="trash"
                onClick={onBatchDelete}
                color="error"
                disabled={selectedNoteIds.size === 0}
              />
              <ActionButton
                label={t("common.cancel")}
                iconName="x-mark"
                color="neutral"
                onClick={() => {
                  onSelectModeToggle(false);
                  onClearSelection();
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 text-sm text-base-content/70 flex flex-wrap items-center gap-3">
        <span>
          {t("notes.advancedSearch.totalResults", { count: totalResults })}
        </span>
        {isSelectMode && (
          <span>
            {t("notes.advancedSearch.selectedCount", {
              count: selectedNoteIds.size,
            })}
          </span>
        )}
      </div>
    </Card>
  );
};

export default NotesAdvancedSearchPanel;
