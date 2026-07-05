import React, { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import ActionButton from "./ActionButton";
import BatchEditModal from "./BatchEditModal";
import TaskSelector from "./selects/TaskSelector";
import AreaSelect from "./selects/AreaSelect";
import { SelectorSpecialValue } from "./selects/selectorTypes";
import { ALL_TASK_STATUSES } from "@/utils/constants";
import Card from "@/layouts/Card";
import { useDefaultInboxVision } from "@/hooks/queries/useDefaultInboxVision";
import { dateStringToISO, formatDateInTimezone } from "@/utils/datetime";
import { FormField, TextInput } from "./forms";
import { FORM_LABEL_COMPACT_CLASS } from "./forms/styles";
import type { UUID } from "@/types/primitive";

interface AdvancedSearchParams {
  start_date: Date;
  end_date: Date;
  area_id: UUID | null | undefined;
  description_keyword: string | null;
  task_id: UUID | null | undefined; // null means no linked task; undefined means all tasks.
  with_task: boolean;
}

interface AdvancedSearchPanelProps {
  params: AdvancedSearchParams;
  onParamsChange: (params: AdvancedSearchParams) => void;
  onSearch: () => void;
  onReset: () => void;
  // Task selector source data.
  tasks: { id: UUID; name: string }[];
  // Batch operation controls.
  isSelectMode: boolean;
  onSelectModeToggle: (value: boolean) => void;
  selectedEntryIds: Set<UUID>;
  onSelectAll: () => void;
  onSelectInverse: () => void;
  onClearSelection: () => void;
  onBatchDelete: () => void;
  filteredEntriesCount: number;
  onBatchEditSuccess: () => void;
  // Optional timezone for local date rendering.
  timezone?: string;
}

const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({
  params,
  onParamsChange,
  onSearch,
  onReset,
  tasks,
  isSelectMode,
  onSelectModeToggle,
  selectedEntryIds,
  onSelectAll,
  onSelectInverse,
  onClearSelection,
  onBatchDelete,
  filteredEntriesCount,
  onBatchEditSuccess,
  timezone,
}) => {
  const { t } = useTranslation();
  // Get user's default inbox vision for proper vision_id assignment
  const { defaultInboxVision } = useDefaultInboxVision();
  // Local state for immediate UI updates
  const [localKeyword, setLocalKeyword] = useState(
    params.description_keyword || "",
  );

  // Batch edit modal state
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);

  // Use ref to get latest params without dependency
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Debounced update of parent state - use ref to store timeout ID
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const debouncedUpdateParent = useCallback(
    (keyword: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onParamsChange({
          ...paramsRef.current,
          description_keyword: keyword || null,
        });
      }, 300); // 300ms debounce
    },
    [onParamsChange],
  );

  // Handle keyword input change with debouncing
  const handleKeywordChange = useCallback(
    (value: string) => {
      setLocalKeyword(value);
      debouncedUpdateParent(value);
    },
    [debouncedUpdateParent],
  );

  // Ensure pending debounced keyword is flushed before triggering actions
  const flushKeywordToParent = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (paramsRef.current.description_keyword !== localKeyword) {
      onParamsChange({
        ...paramsRef.current,
        description_keyword: localKeyword || null,
      });
    }
  }, [localKeyword, onParamsChange]);

  const handleSearchClick = useCallback(() => {
    flushKeywordToParent();
    // Defer to next tick to allow parent state to commit before search
    setTimeout(() => onSearch(), 0);
  }, [flushKeywordToParent, onSearch]);

  // Handle other parameter changes
  const handleParamChange = useCallback(
    (
      key: keyof AdvancedSearchParams,
      value: string | Date | number | null | undefined,
    ) => {
      onParamsChange({
        ...paramsRef.current,
        [key]: value,
      });
    },
    [onParamsChange],
  );

  // TaskSelector props for advanced search - similar to TimeEntryModal
  const stableFilterStatus = useMemo(() => ALL_TASK_STATUSES, []);

  const preloadedTasks = useMemo(() => {
    // Use default inbox vision if available, otherwise use null as fallback
    // Following data protocol: UUID fields should use null for empty values
    const visionId = defaultInboxVision || null;

    return tasks.map((task) => ({
      id: task.id,
      content: task.name,
      status: "todo",
      vision_id: visionId,
      parent_task_id: null,
      priority: 1,
      display_order: 0,
      estimated_effort: null,
      actual_effort_self: 0,
      actual_effort_total: 0,
      notes_count: 0,
      created_at: "1970-01-01T00:00:00.000Z",
      updated_at: "1970-01-01T00:00:00.000Z",
    }));
  }, [tasks, defaultInboxVision]);

  const taskSelectorValue = useMemo(() => {
    if (params.with_task) {
      return SelectorSpecialValue.Has as unknown as UUID;
    }
    if (params.task_id === undefined) {
      return SelectorSpecialValue.All as unknown as UUID;
    }
    if (params.task_id === null) {
      return SelectorSpecialValue.None as unknown as UUID;
    }
    return params.task_id;
  }, [params.task_id, params.with_task]);

  const taskSelectorProps = useMemo(() => {
    return {
      value: taskSelectorValue,
      placeholder: t("task.selectTaskPlaceholder"),
      disabled: false,
      filterStatus: stableFilterStatus,
      deferRemoteLoad: true,
      expandFilterForSelected: true,
      showSpecialOptions: true,
      preloadedTasks,
      clearBehavior: "all" as const,
    };
  }, [taskSelectorValue, t, stableFilterStatus, preloadedTasks]);

  // Sync local keyword with params when they change externally
  React.useEffect(
    () => {
      if (params.description_keyword !== localKeyword) {
        setLocalKeyword(params.description_keyword || "");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.description_keyword],
  );

  return (
    <>
      <Card title={t("timeLog.advancedSearch.title")}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {/* Start Date */}
          <div>
            <label
              htmlFor="start-date"
              className={FORM_LABEL_COMPACT_CLASS}
            >
              {t("timeLog.advancedSearch.startDateRequired")}
            </label>
            <TextInput
              id="start-date"
              name="start-date"
              type="date"
              value={formatDateInTimezone(params.start_date, timezone)}
              onChange={(e) => {
                const isoString = dateStringToISO(
                  e.target.value,
                  timezone,
                  false,
                );
                handleParamChange("start_date", new Date(isoString));
              }}
              size="sm"
            />
          </div>

          {/* End Date */}
          <div>
            <label
              htmlFor="end-date"
              className={FORM_LABEL_COMPACT_CLASS}
            >
              {t("timeLog.advancedSearch.endDate")}
            </label>
            <TextInput
              id="end-date"
              name="end-date"
              type="date"
              value={formatDateInTimezone(params.end_date, timezone)}
              onChange={(e) => {
                const isoString = dateStringToISO(
                  e.target.value,
                  timezone,
                  true,
                );
                handleParamChange("end_date", new Date(isoString));
              }}
              size="sm"
            />
          </div>

          {/* Area Selection */}
          <div>
            <AreaSelect
              value={
                params.area_id === undefined
                  ? undefined
                  : params.area_id
              }
              onChange={(value) => handleParamChange("area_id", value)}
              showAllOption={true}
              showNoneOption={true}
              noneLabel={t("common.noArea")}
              placeholder={t("common.all")}
              id="advanced-search-area-id-select"
            />
          </div>

          {/* Task Selection */}
          <div>
            <TaskSelector
              {...taskSelectorProps}
              onChange={(taskId) => {
                if (taskId === undefined) {
                  onParamsChange({
                    ...paramsRef.current,
                    task_id: undefined,
                    with_task: false,
                  });
                  return;
                }
                if (taskId === null) {
                  onParamsChange({
                    ...paramsRef.current,
                    task_id: null,
                    with_task: false,
                  });
                  return;
                }
                const rawValue = taskId as unknown as string;
                if (rawValue === SelectorSpecialValue.All) {
                  onParamsChange({
                    ...paramsRef.current,
                    task_id: undefined,
                    with_task: false,
                  });
                  return;
                }
                if (rawValue === SelectorSpecialValue.Has) {
                  onParamsChange({
                    ...paramsRef.current,
                    task_id: undefined,
                    with_task: true,
                  });
                  return;
                }
                onParamsChange({
                  ...paramsRef.current,
                  task_id: taskId,
                  with_task: false,
                });
              }}
              className="w-full"
              idPrefix="advanced-search-task"
            />
          </div>

          {/* Description Keyword */}
          <FormField
            label={t("timeLog.advancedSearch.keyword")}
            htmlFor="description-keyword"
            description={t("timeLog.advancedSearch.keywordDescription")}
          >
            <TextInput
              id="description-keyword"
              name="description-keyword"
              type="text"
              value={localKeyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              placeholder={t("timeLog.advancedSearch.keywordPlaceholder")}
              size="sm"
            />
          </FormField>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left side buttons */}
          <div className="flex flex-wrap gap-2">
            {!isSelectMode && (
              <ActionButton
                label={t("timeLog.advancedSearch.enableBatchOperations")}
                iconName="switch"
                color="primary"
                variant="outline"
                onClick={() => onSelectModeToggle(true)}
              />
            )}
          </div>

          {/* Right side buttons */}
          <div className="flex flex-wrap gap-2">
            <ActionButton
              label={t("timeLog.advancedSearch.search")}
              iconName="search"
              color="success"
              variant="outline"
              onClick={handleSearchClick}
            />
            <ActionButton
              label={t("timeLog.advancedSearch.reset")}
              iconName="refresh"
              color="primary"
              variant="outline"
              onClick={onReset}
            />
          </div>
        </div>

        {/* Batch Operations Section */}
        <div className="mt-6 pt-4">
          <div className="flex flex-col items-center gap-3">
            {/* Batch operations controls - only show when in select mode */}
            {isSelectMode && (
              <div className="flex w-full flex-wrap justify-start gap-2">
                <ActionButton
                  label={t("timeLog.advancedSearch.selectAll")}
                  iconName="check"
                  color="primary"
                  onClick={onSelectAll}
                  disabled={filteredEntriesCount === 0}
                />
                <ActionButton
                  label={t("timeLog.advancedSearch.selectInverse")}
                  iconName="repeat"
                  color="primary"
                  onClick={onSelectInverse}
                  disabled={filteredEntriesCount === 0}
                />
                <ActionButton
                  label={t("common.edit")}
                  iconName="edit"
                  color="primary"
                  onClick={() => setShowBatchEditModal(true)}
                  disabled={selectedEntryIds.size === 0}
                />
                <ActionButton
                  label={t("common.delete")}
                  iconName="trash"
                  color="error"
                  onClick={onBatchDelete}
                  disabled={selectedEntryIds.size === 0}
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

          {/* Selection info */}
          {isSelectMode && (
            <div className="mt-2 text-sm">
              {t("timeLog.advancedSearch.selectedRecords", {
                count: selectedEntryIds.size,
              })}
              {selectedEntryIds.size > 0 && (
                <span className="ml-2 text-primary">
                  {t("timeLog.advancedSearch.canBatchOperations")}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Batch Edit Modal */}
      <BatchEditModal
        isOpen={showBatchEditModal}
        onClose={() => setShowBatchEditModal(false)}
        selectedEntryIds={selectedEntryIds}
        onSuccess={onBatchEditSuccess}
      />
    </>
  );
};

export default AdvancedSearchPanel;
