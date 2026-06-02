import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";
import ScrollArea from "@/layouts/ScrollArea";
import type {
  ContextBoxItem,
  SessionContextBox,
  SessionContextSelectionResponse,
} from "@/types/cardbox";
import type { ActualEvent } from "@/services/api/actualEvents";
import type { Note } from "@/services/api/notes";
import type { Task } from "@/services/api/tasks";
import DimensionSelect from "@/components/selects/DimensionSelect";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import TagSelector from "@/components/selects/TagSelector";
import PersonSelector from "@/components/selects/PersonSelector";
import VisionSelector from "@/components/selects/VisionSelector";
import type { VisionWithTasks } from "@/services/api/visions";
import ConfirmDialog from "@/components/ConfirmDialog";
import ActionButton, { ActionButtonGroup } from "@/components/ActionButton";
import { TextInput } from "@/components/forms";
import {
  formatDate,
  formatDateInTimezone,
  formatDateTime as formatDateTimeUtil,
} from "@/utils/datetime";
import { useToast } from "@/contexts/ToastContext";
import {
  canonicalModule,
  isModule,
  type PlanningCycleType,
  type TaskStatusOption,
} from "./contextPicker/moduleUtils";
import { MODULE_OPTIONS, type ModuleValue } from "./contextPicker/moduleConfig";
import ExistingContextList from "./contextPicker/ExistingContextList";
import { useSessionContextExistingController } from "@/features/agent/controller/useSessionContextExistingController";
import { useSessionContextCreateController } from "@/features/agent/controller/useSessionContextCreateController";

interface SessionContextPickerProps {
  sessionId?: string | null;
  existingBoxes: SessionContextBox[];
  onAddBoxes: (
    boxIds: string[],
  ) => Promise<SessionContextSelectionResponse | undefined>;
  isUpdating?: boolean;
  showInlineTrigger?: boolean;
}

type PickerTab = "existing" | "create";

export interface SessionContextPickerRef {
  open: (tab?: PickerTab) => void;
}

const SessionContextPicker = forwardRef<
  SessionContextPickerRef,
  SessionContextPickerProps
>(
  (
    {
      sessionId,
      existingBoxes,
      onAddBoxes,
      isUpdating = false,
      showInlineTrigger = true,
    },
    ref,
  ) => {
    const { t } = useTranslation("common");
    const toast = useToast();

    // Get module labels with i18n
    const MODULE_LABEL_MAP = useMemo(() => {
      const base = MODULE_OPTIONS.reduce<Record<string, string>>(
        (acc, option) => {
          const translated = t(option.translationKey);
          acc[option.value] =
            translated === option.translationKey
              ? option.defaultLabel
              : (translated as string);
          return acc;
        },
        {},
      );
      const chatKey = "agent.context.modules.chat" as const;
      const chatLabel = t(chatKey);
      base.chat = chatLabel === chatKey ? "Chat" : (chatLabel as string);

      const unknownKey = "agent.context.modules.unknown" as const;
      const unknownLabel = t(unknownKey);
      base.unknown =
        unknownLabel === unknownKey ? "Unknown" : (unknownLabel as string);
      return base;
    }, [t]);

    const moduleSelectOptions = useMemo<EnumOption[]>(
      () =>
        MODULE_OPTIONS.map((option) => ({
          value: option.value,
          label: MODULE_LABEL_MAP[option.value],
        })),
      [MODULE_LABEL_MAP],
    );

    const planningCycleOptions = useMemo<EnumOption[]>(
      () => [
        {
          value: "day",
          label: t("agent.context.create.cycleOptions.day"),
        },
        {
          value: "week",
          label: t("agent.context.create.cycleOptions.week"),
        },
        {
          value: "month",
          label: t("agent.context.create.cycleOptions.month"),
        },
        {
          value: "year",
          label: t("agent.context.create.cycleOptions.year"),
        },
      ],
      [t],
    );

    const taskStatusOptions = useMemo<EnumOption[]>(
      () => [
        {
          value: "all",
          label: t("agent.context.create.statusOptions.all"),
        },
        {
          value: "active",
          label: t("agent.context.create.statusOptions.active"),
        },
        {
          value: "completed",
          label: t("agent.context.create.statusOptions.completed"),
        },
      ],
      [t],
    );

    // Modal visibility & tabs
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<PickerTab>("existing");

    // Existing context selection state
    const [feedback, setFeedback] = useState<string | null>(null);

    const notifySuccess = useCallback(
      (message: string) => {
        if (showInlineTrigger) {
          setFeedback(message);
        }
        toast.showSuccess(t("common.success"), message);
      },
      [showInlineTrigger, toast, t],
    );

    const {
      createModule,
      setCreateModule,
      createName,
      setCreateName,
      createKeyword,
      setCreateKeyword,
      createStartDate,
      setCreateStartDate,
      createEndDate,
      setCreateEndDate,
      createDimensionId,
      setCreateDimensionId,
      createNoteTagIds,
      createNotePersonIds,
      planningCycleType,
      setPlanningCycleType,
      planningStartDate,
      setPlanningStartDate,
      planningStatusOption,
      setPlanningStatusOption,
      selectedVisionIds,
      setSelectedVisionIds,
      visionStatusOption,
      setVisionStatusOption,
      moduleFormSections,
      previewState,
      previewLoading,
      previewError,
      createFeedback,
      createButtonDisabled,
      isCreating,
      dimensionMap,
      noteTags,
      handleCreateNoteTag,
      handleNoteTagChange,
      handleNotePersonChange,
      resetCreateForm,
      previewCreateData,
      createAndAdd,
    } = useSessionContextCreateController({
      sessionId,
      onAddBoxes,
      notifySuccess,
    });
    const {
      search,
      setSearch,
      previewBox,
      existingPreviewItems,
      pendingAddId,
      pendingDelete,
      listLoading,
      filteredBoxes,
      existingIds,
      deleteState,
      handleExistingPreview,
      handleAddExisting,
      handleDeleteBox,
      handleConfirmDelete,
      handleCancelDelete,
      resetExistingState,
    } = useSessionContextExistingController({
      isOpen,
      isExistingTabActive: activeTab === "existing",
      sessionId,
      existingBoxes,
      onAddBoxes,
      notifySuccess,
    });

    const getMetadataRecord = useCallback(
      (value: unknown): Record<string, unknown> | null => {
        if (!value || typeof value !== "object") return null;
        return value as Record<string, unknown>;
      },
      [],
    );

    const formatDateOnly = useCallback((value: unknown): string | null => {
      if (typeof value === "string" && value) {
        return formatDate(value);
      }
      if (value instanceof Date) {
        return formatDateInTimezone(value);
      }
      return null;
    }, []);

    const formatDateTimeDisplay = useCallback(
      (value: unknown): string | null => {
        if (typeof value === "string" && value) {
          return formatDateTimeUtil(value);
        }
        if (value instanceof Date) {
          return formatDateTimeUtil(value.toISOString());
        }
        return null;
      },
      [],
    );

    const formatDurationMinutes = useCallback(
      (value: unknown): string | null => {
        const minutes =
          typeof value === "number"
            ? value
            : typeof value === "string"
              ? Number(value)
              : Number.NaN;
        if (!Number.isFinite(minutes) || minutes <= 0) {
          return null;
        }
        const hours = Math.floor(minutes / 60);
        const remaining = Math.round(minutes % 60);
        const hourLabel = t("cardbox.labels.hour");
        const minuteLabel = t("cardbox.labels.minute");
        if (hours && remaining) {
          return `${hours}${hourLabel} ${remaining}${minuteLabel}`;
        }
        if (hours) {
          return `${hours}${hourLabel}`;
        }
        return `${remaining}${minuteLabel}`;
      },
      [t],
    );

    const summariseFiltersForDisplay = useCallback(
      (
        module: string,
        metadata: Record<string, unknown> | null,
      ): string | null => {
        if (!metadata) return null;
        const filters = getMetadataRecord(metadata["filters"]);
        if (!filters) return null;

        const parts: string[] = [];

        const append = (label: string, value: unknown) => {
          if (value === undefined || value === null || value === "") return;
          let text = "";
          if (Array.isArray(value)) {
            const items = value
              .map((item) =>
                typeof item === "string" ? item : JSON.stringify(item),
              )
              .filter(Boolean);
            if (!items.length) return;
            text = items.join(", ");
          } else if (typeof value === "string") {
            text = value;
          } else {
            text = String(value);
          }
          text = text.trim();
          if (text) {
            parts.push(
              `${label}：${text.length > 60 ? `${text.slice(0, 59)}…` : text}`,
            );
          }
        };

        if (isModule(module, "actual_event")) {
          const start = formatDateOnly(filters["start_date"]);
          const end = formatDateOnly(filters["end_date"]);
          if (start && end) {
            parts.push(
              start === end
                ? `${t("cardbox.filters.date")}: ${start}`
                : `${t("cardbox.filters.date")}: ${start} ~ ${end}`,
            );
          } else if (start) {
            parts.push(`${t("cardbox.filters.startDate")}: ${start}`);
          } else if (end) {
            parts.push(`${t("cardbox.filters.endDate")}: ${end}`);
          }
          if (
            Object.prototype.hasOwnProperty.call(filters, "dimension_id") &&
            filters["dimension_id"] === null
          ) {
            append(t("cardbox.filters.dimension"), t("common.noDimension"));
          } else {
            append(t("cardbox.filters.dimension"), filters["dimension_name"]);
          }
          append(
            t("cardbox.filters.keyword"),
            filters["keyword"] || filters["description_keyword"],
          );
        } else if (isModule(module, "notes")) {
          append(t("cardbox.filters.keyword"), filters["keyword"]);
          append(t("cardbox.filters.tag"), filters["tag_id"]);
          append(t("cardbox.filters.person"), filters["person_id"]);
        } else if (isModule(module, "planning_tasks")) {
          append(t("cardbox.filters.cycle"), filters["planning_cycle_type"]);
          const start = formatDateOnly(filters["planning_cycle_start_date"]);
          if (start) {
            parts.push(`${t("cardbox.filters.startDate")}: ${start}`);
          }
          append(t("cardbox.filters.status"), filters["status_in"]);
        } else if (isModule(module, "vision_progress")) {
          const visionIds = filters["vision_ids"];
          if (Array.isArray(visionIds) && visionIds.length > 0) {
            parts.push(
              `${t("cardbox.filters.visionCount")}: ${visionIds.length}`,
            );
          }
          append(t("cardbox.filters.taskStatus"), filters["task_status_in"]);
        } else {
          Object.entries(filters).forEach(([key, value]) => {
            if (key === "limit") return;
            append(key, value);
          });
        }

        if (!parts.length) return null;
        return parts.join("，");
      },
      [formatDateOnly, getMetadataRecord, t],
    );

    const filteredExistingPreviewItems = useMemo(() => {
      return existingPreviewItems.filter((item) => {
        const metadata = getMetadataRecord(item.metadata);
        return metadata?.["type"] !== "context_manifest";
      });
    }, [existingPreviewItems, getMetadataRecord]);

    const renderExistingTimelogItem = useCallback(
      (item: ContextBoxItem, index: number) => {
        const metadata = getMetadataRecord(item.metadata);
        const summary = getMetadataRecord(metadata?.["summary"]);

        if (!summary) {
          interface TimelogMetadataParticipant {
            id?: string | null;
            display_name?: string | null;
            name?: string | null;
          }

          interface TimelogMetadataTask {
            id?: string | null;
            content?: string | null;
            status?: string | null;
            vision_id?: string | null;
          }

          interface TimelogMetadataDimension {
            id?: string | null;
            name?: string | null;
          }

          interface TimelogMetadataEntry {
            event_id?: string;
            title?: string | null;
            start_time?: string | null;
            end_time?: string | null;
            duration_minutes?: number | null;
            tracking_method?: string | null;
            notes?: string | null;
            tags?: string[] | null;
            participants?: TimelogMetadataParticipant[] | null;
            participant_names?: string[] | null;
            task?: TimelogMetadataTask | null;
            dimension?: TimelogMetadataDimension | null;
            index?: number | null;
            local_day?: string | null;
            chunk_index?: number | null;
            chunks_total?: number | null;
          }

          const structuredEntries: TimelogMetadataEntry[] = Array.isArray(
            metadata?.["entries"],
          )
            ? (metadata?.["entries"] as unknown[]).reduce<
                TimelogMetadataEntry[]
              >((acc, entry) => {
                if (entry && typeof entry === "object") {
                  acc.push(entry as TimelogMetadataEntry);
                }
                return acc;
              }, [])
            : [];

          if (structuredEntries.length === 0) {
            return (
              <li
                key={item.card_id || index}
                className="space-y-2 rounded-md border border-base-300 bg-base-100 p-3"
              >
                <div className="text-sm text-base-content/70">
                  {t("cardbox.status.noContentInBox")}
                </div>
              </li>
            );
          }

          const dayLabel =
            typeof metadata?.["day"] === "string"
              ? (metadata?.["day"] as string)
              : null;
          const timezoneLabel =
            typeof metadata?.["timezone"] === "string"
              ? (metadata?.["timezone"] as string)
              : null;
          const chunkIndex = Number(metadata?.["chunk_index"] ?? NaN);
          const chunkTotal = Number(metadata?.["chunks_total"] ?? NaN);
          const rangeStart = formatDateTimeDisplay(
            metadata?.["earliest_start_time"] ??
              metadata?.["latest_start_time"],
          );
          const rangeEnd = formatDateTimeDisplay(
            metadata?.["latest_end_time"] ?? metadata?.["earliest_end_time"],
          );
          const entryCount = Number.isFinite(Number(metadata?.["entry_count"]))
            ? Number(metadata?.["entry_count"])
            : null;

          const cardTitle = dayLabel
            ? `${dayLabel}${timezoneLabel ? ` (${timezoneLabel})` : ""}`
            : t("cardbox.status.noTitleEvent");
          const chunkBadge =
            Number.isFinite(chunkIndex) &&
            Number.isFinite(chunkTotal) &&
            chunkTotal > 1
              ? ` [${chunkIndex}/${chunkTotal}]`
              : "";

          return (
            <li
              key={item.card_id || index}
              className="space-y-2 rounded-md border border-base-300 bg-base-100 p-3"
            >
              <div className="text-sm font-semibold text-base-content">
                {cardTitle}
                {chunkBadge}
              </div>
              {(rangeStart || rangeEnd) && (
                <div className="text-xs text-base-content/70">
                  {t("cardbox.labels.time")}: {rangeStart || "--"} →{" "}
                  {rangeEnd || "--"}
                </div>
              )}
              {typeof entryCount === "number" && (
                <div className="text-xs text-base-content/60">
                  {entryCount} {t("cardbox.status.matchingRecords")}
                </div>
              )}
              <ul className="space-y-2">
                {structuredEntries.map((entry, entryIdx) => {
                  const entryKey = entry.event_id || `${index}-${entryIdx}`;
                  const entryTitle =
                    entry.title?.trim() || t("cardbox.status.noTitleEvent");
                  const entryStart = formatDateTimeDisplay(entry.start_time);
                  const entryEnd = formatDateTimeDisplay(entry.end_time);
                  const participantNames = Array.isArray(
                    entry.participant_names,
                  )
                    ? entry.participant_names.filter(Boolean)
                    : Array.isArray(entry.participants)
                      ? entry.participants
                          .map(
                            (person) =>
                              person?.display_name || person?.name || "",
                          )
                          .filter(Boolean)
                      : [];
                  const tagsText = Array.isArray(entry.tags)
                    ? entry.tags.filter(Boolean).join(", ")
                    : "";
                  const taskContent = entry.task?.content;
                  const taskStatus = entry.task?.status;
                  const durationMinutes = Number.isFinite(
                    Number(entry.duration_minutes),
                  )
                    ? Number(entry.duration_minutes)
                    : null;
                  const dimensionName = entry.dimension?.name;
                  const displayIndex = Number.isFinite(Number(entry.index))
                    ? Number(entry.index)
                    : entryIdx + 1;

                  return (
                    <li
                      key={entryKey}
                      className="space-y-1 rounded border border-dashed border-base-300 bg-base-100 p-2"
                    >
                      <div className="text-xs font-medium text-base-content">
                        {displayIndex ? `${displayIndex}. ` : ""}
                        {entryTitle}
                      </div>
                      {(entryStart || entryEnd) && (
                        <div className="text-xs text-base-content/60">
                          {t("cardbox.labels.time")}: {entryStart || "--"} →{" "}
                          {entryEnd || t("cardbox.status.inProgress")}
                        </div>
                      )}
                      {typeof durationMinutes === "number" && (
                        <div className="text-xs text-base-content/60">
                          {t("cardbox.labels.duration")}: {durationMinutes}{" "}
                          {t("cardbox.status.minutes")}
                        </div>
                      )}
                      {dimensionName && (
                        <div className="text-xs text-base-content/60">
                          {t("cardbox.filters.dimension")}: {dimensionName}
                        </div>
                      )}
                      {entry.tracking_method && (
                        <div className="text-xs text-base-content/60">
                          {t("cardbox.labels.trackingMethod")}:{" "}
                          {entry.tracking_method}
                        </div>
                      )}
                      {participantNames.length > 0 && (
                        <div className="text-xs text-base-content/60">
                          {t("cardbox.labels.participants")}:{" "}
                          {participantNames.join(", ")}
                        </div>
                      )}
                      {taskContent && (
                        <div className="text-xs text-base-content/60">
                          {t("cardbox.labels.task")}: {taskContent}
                          {taskStatus
                            ? ` (${t("cardbox.filters.status")}: ${taskStatus})`
                            : ""}
                        </div>
                      )}
                      {entry.notes && (
                        <div className="whitespace-pre-wrap text-xs text-base-content/60">
                          {t("cardbox.labels.notes")}: {entry.notes}
                        </div>
                      )}
                      {tagsText && (
                        <div className="text-xs text-base-content/60">
                          {t("cardbox.labels.tags")}: {tagsText}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        }

        const snapshotRange = getMetadataRecord(metadata?.["snapshot_range"]);
        const query = getMetadataRecord(metadata?.["query"]);

        const rangeStartRaw = snapshotRange?.["start"];
        const rangeEndRaw = snapshotRange?.["end"];
        const rangeStart =
          formatDateTimeDisplay(rangeStartRaw) ?? formatDateOnly(rangeStartRaw);
        const rangeEnd =
          formatDateTimeDisplay(rangeEndRaw) ?? formatDateOnly(rangeEndRaw);
        const cardTitle =
          (rangeStart && rangeEnd
            ? `${rangeStart} → ${rangeEnd}`
            : rangeStart || rangeEnd) || t("cardbox.status.noTitleEvent");

        const totalRecords = Number(summary?.["total_records"] ?? NaN);
        const totalDuration = Number(
          summary?.["total_duration_minutes"] ?? NaN,
        );
        const durationLabel =
          Number.isFinite(totalDuration) && totalDuration > 0
            ? formatDurationMinutes(totalDuration)
            : null;

        const dimensionStatsRaw = Array.isArray(summary?.["dimension_stats"])
          ? (summary?.["dimension_stats"] as Array<Record<string, unknown>>)
          : [];
        const dimensionStats = dimensionStatsRaw.slice(0, 3);

        const queryChips: string[] = [];
        if (query) {
          const dimensionFilterLabel = t("cardbox.filters.dimension");
          const keywordLabel = t("cardbox.filters.keyword");
          const descriptionLabel = t("cardbox.filters.descriptionKeyword");
          const trackingLabel = t("cardbox.filters.trackingMethod");
          const limitLabel = t("cardbox.filters.limit");
          if (
            Object.prototype.hasOwnProperty.call(query, "dimension_id") &&
            query["dimension_id"] === null
          ) {
            queryChips.push(
              `${dimensionFilterLabel}: ${t("common.noDimension")}`,
            );
          } else if (
            typeof query["dimension_name"] === "string" &&
            query["dimension_name"]
          ) {
            queryChips.push(
              `${dimensionFilterLabel}: ${query["dimension_name"]}`,
            );
          }
          if (typeof query["keyword"] === "string" && query["keyword"]) {
            queryChips.push(`${keywordLabel}: ${query["keyword"]}`);
          }
          if (
            typeof query["description_keyword"] === "string" &&
            query["description_keyword"]
          ) {
            queryChips.push(
              `${descriptionLabel}: ${query["description_keyword"]}`,
            );
          }
          if (
            typeof query["tracking_method"] === "string" &&
            query["tracking_method"]
          ) {
            queryChips.push(`${trackingLabel}: ${query["tracking_method"]}`);
          }
          if (
            typeof query["limit"] === "number" &&
            Number.isFinite(query["limit"])
          ) {
            queryChips.push(`${limitLabel}: ${query["limit"]}`);
          }
        }

        const contentSnippets = (item.content || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 3);

        return (
          <li
            key={item.card_id || index}
            className="space-y-2 rounded-md border border-base-300 bg-base-100 p-3"
          >
            <div className="text-sm font-semibold text-base-content">
              {cardTitle}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/70">
              {Number.isFinite(totalRecords) && totalRecords >= 0 && (
                <span>
                  {t("cardbox.status.matchingRecords")}: {totalRecords}
                </span>
              )}
              {durationLabel && <span>{durationLabel}</span>}
            </div>
            {queryChips.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px] text-base-content/60">
                {queryChips.map((chip, chipIndex) => (
                  <span
                    key={`${chip}-${chipIndex}`}
                    className="rounded bg-base-200 px-2 py-[2px]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
            {dimensionStats.length > 0 && (
              <ul className="space-y-1 text-xs text-base-content/60">
                {dimensionStats.map((stat, statIndex) => {
                  const rawId =
                    typeof stat["dimension_id"] === "string" &&
                    stat["dimension_id"]
                      ? (stat["dimension_id"] as string)
                      : t("cardbox.status.unknownDimension");
                  const label =
                    rawId.length > 16 ? `${rawId.slice(0, 12)}…` : rawId;
                  const countValue = Number(stat["count"] ?? 0);
                  const dimDuration = formatDurationMinutes(
                    stat["duration_minutes"],
                  );
                  return (
                    <li key={`${label}-${statIndex}`}>
                      {label}: {countValue}{" "}
                      {t("cardbox.status.matchingRecords")}
                      {dimDuration ? ` · ${dimDuration}` : ""}
                    </li>
                  );
                })}
              </ul>
            )}
            {contentSnippets.length > 0 && (
              <div className="space-y-1 text-xs text-base-content/60">
                {contentSnippets.map((line, snippetIndex) => (
                  <div key={`${item.card_id}-${snippetIndex}`}>· {line}</div>
                ))}
              </div>
            )}
          </li>
        );
      },
      [
        formatDateOnly,
        formatDateTimeDisplay,
        formatDurationMinutes,
        getMetadataRecord,
        t,
      ],
    );

    const renderExistingFallbackItem = useCallback(
      (item: ContextBoxItem, index: number) => {
        const text = item.content?.trim();
        const looksLikeJson = text?.startsWith("{") && text?.endsWith("}");

        return (
          <li
            key={item.card_id || index}
            className="space-y-2 rounded-md border border-base-300 bg-base-100 p-3"
          >
            {text ? (
              looksLikeJson ? (
                <div className="text-xs text-base-content/70">
                  {t("cardbox.status.structuredDataPrompt")}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-xs text-base-content/80">
                  {text}
                </pre>
              )
            ) : (
              <div className="text-xs text-base-content/60">
                {t("cardbox.status.noContent")}
              </div>
            )}
          </li>
        );
      },
      [t],
    );

    const openModal = useCallback(
      (targetTab: PickerTab = "existing") => {
        if (!sessionId) {
          const message = t("agent.context.errorNoSession");
          toast.showError(message, message);
          return;
        }
        setActiveTab(targetTab);
        setIsOpen(true);
      },
      [sessionId, t, toast],
    );

    const handleOpen = () => {
      openModal("existing");
    };

    useImperativeHandle(
      ref,
      () => ({
        open: openModal,
      }),
      [openModal],
    );

    const handleClose = () => {
      setIsOpen(false);
      resetExistingState();
      setFeedback(null);
      resetCreateForm(true);
    };

    useEffect(() => {
      if (!showInlineTrigger) return;
      if (!feedback) return;
      const timer = window.setTimeout(() => setFeedback(null), 3000);
      return () => window.clearTimeout(timer);
    }, [feedback, showInlineTrigger]);

    const handlePreviewNewSubmit = async (event: React.FormEvent) => {
      event.preventDefault();
      await previewCreateData();
    };

    const handleCreateAndAdd = async () => {
      const created = await createAndAdd();
      if (!created) {
        return;
      }
      setIsOpen(false);
      setTimeout(() => {
        resetCreateForm();
        setActiveTab("existing");
      }, 0);
    };

    const renderTimelogPreview = (items: ActualEvent[]) => {
      if (items.length === 0) {
        return (
          <div className="text-xs text-base-content/60">
            {t("cardbox.status.noMatchingRecords")}
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {items.map((event) => {
            const persons = (event.persons ?? [])
              .map((person) => person.display_name || person.name || "")
              .filter(Boolean)
              .join(", ");
            const start = event.start_time
              ? formatDateTimeUtil(event.start_time)
              : "--";
            const end = event.end_time
              ? formatDateTimeUtil(event.end_time)
              : "进行中";
            const durationMinutes = event.end_time
              ? Math.max(
                  Math.round(
                    (new Date(event.end_time).getTime() -
                      new Date(event.start_time).getTime()) /
                      60000,
                  ),
                  0,
                )
              : null;
            const dimensionName = event.dimension_id
              ? dimensionMap.get(String(event.dimension_id)) || ""
              : "";
            return (
              <div
                key={event.id}
                className="border border-base-300 rounded-md p-3 space-y-1 bg-base-100"
              >
                <div className="text-sm font-semibold text-base-content">
                  {event.title?.trim() || t("cardbox.status.noTitleEvent")}
                </div>
                <div className="text-xs text-base-content/70">
                  {start} → {end}
                </div>
                {durationMinutes !== null && (
                  <div className="text-xs text-base-content/70">
                    {t("cardbox.labels.duration")}: {durationMinutes}{" "}
                    {t("cardbox.status.minutes")}
                  </div>
                )}
                {dimensionName && (
                  <div className="text-xs text-base-content/70">
                    {t("cardbox.filters.dimension")}: {dimensionName}
                  </div>
                )}
                {persons && (
                  <div className="text-xs text-base-content/70">
                    {t("cardbox.labels.participants")}: {persons}
                  </div>
                )}
                {event.task && (
                  <div className="text-xs text-base-content/70">
                    {t("cardbox.labels.task")}: {event.task.content} (
                    {t("cardbox.filters.status")}: {event.task.status})
                  </div>
                )}
                {event.notes && (
                  <div className="text-xs text-base-content/70 whitespace-pre-wrap">
                    {t("cardbox.labels.notes")}: {event.notes}
                  </div>
                )}
                {event.tags && event.tags.length > 0 && (
                  <div className="text-xs text-base-content/60">
                    {t("cardbox.labels.tags")}: {event.tags.join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const renderNotesPreview = (items: Note[]) => {
      if (items.length === 0) {
        return (
          <div className="text-xs text-base-content/60">
            {t("cardbox.status.noMatchingNotes")}
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {items.map((note) => {
            const persons = (note.persons ?? [])
              .map((person) => person.display_name || person.name || "")
              .filter(Boolean)
              .join(", ");
            const tags = (note.tags ?? [])
              .map((tag) => tag.name)
              .filter(Boolean)
              .join(", ");
            return (
              <div
                key={note.id}
                className="border border-base-300 rounded-md p-3 space-y-1 bg-base-100"
              >
                <div className="text-xs text-base-content/60">
                  {t("cardbox.labels.createdTime")}:
                  {note.created_at ? formatDateTimeUtil(note.created_at) : "--"}
                </div>
                <div className="text-sm text-base-content whitespace-pre-wrap">
                  {note.content || t("cardbox.labels.noContent")}
                </div>
                {persons && (
                  <div className="text-xs text-base-content/70">
                    {t("cardbox.labels.relatedPersons")}: {persons}
                  </div>
                )}
                {note.task && (
                  <div className="text-xs text-base-content/70">
                    {t("cardbox.labels.relatedTask")}: {note.task.content} (
                    {t("cardbox.filters.status")}: {note.task.status})
                  </div>
                )}
                {tags && (
                  <div className="text-xs text-base-content/60">
                    {t("cardbox.labels.tags")}: {tags}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const renderPlanningPreview = (tasks: Task[]) => {
      if (tasks.length === 0) {
        return (
          <div className="text-xs text-base-content/60">
            {t("cardbox.status.noMatchingTasks")}
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {tasks.map((task) => {
            const persons = (task.persons ?? [])
              .map((person) => person.display_name || person.name || "")
              .filter(Boolean)
              .join(", ");
            const cycleStart = task.planning_cycle_start_date
              ? formatDate(task.planning_cycle_start_date)
              : "--";
            return (
              <div
                key={task.id}
                className="border border-base-300 rounded-md p-3 space-y-2 bg-base-100"
              >
                <div className="text-sm font-semibold text-base-content">
                  {task.content || t("cardbox.contentPrefixes.unnamedTask")}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-base-content/70">
                  <span>
                    {t("cardbox.status.statusFilter")}: {task.status}
                  </span>
                  <span>
                    {t("cardbox.status.priorityFilter")}: {task.priority}
                  </span>
                  <span>
                    {t("cardbox.status.planningCycleFilter")}:{" "}
                    {task.planning_cycle_type || "--"}
                  </span>
                  <span>
                    {t("cardbox.status.startDateFormat")}: {cycleStart}
                  </span>
                  <span>
                    {t("cardbox.status.totalEffortMinutes")}:{" "}
                    {task.actual_effort_total ?? 0}{" "}
                    {t("cardbox.status.minutes")}
                  </span>
                </div>
                {persons && (
                  <div className="text-xs text-base-content/70">
                    {t("cardbox.labels.participants")}: {persons}
                  </div>
                )}
                {task.notes_count > 0 && (
                  <div className="text-xs text-base-content/70 whitespace-pre-wrap">
                    {t("cardbox.labels.notes")}: {task.notes_count}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const renderVisionPreview = (visions: VisionWithTasks[]) => {
      if (visions.length === 0) {
        return (
          <div className="text-xs text-base-content/60">
            {t("cardbox.status.noMatchingVisions")}
          </div>
        );
      }
      return (
        <div className="space-y-4">
          {visions.map((vision) => {
            const persons = (vision.persons ?? [])
              .map((person) => person.display_name || person.name || "")
              .filter(Boolean)
              .join(", ");
            return (
              <div
                key={vision.id}
                className="border border-base-300 rounded-md p-3 space-y-2 bg-base-100"
              >
                <div className="text-sm font-semibold text-base-content">
                  {vision.name}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-base-content/70">
                  <span>
                    {t("cardbox.status.statusFilter")}: {vision.status}
                  </span>
                  <span>
                    {t("cardbox.status.stageFilter")}: {vision.stage}
                  </span>
                  <span>
                    {t("cardbox.status.totalEffortMinutes")}:{" "}
                    {vision.total_actual_effort ?? 0}{" "}
                    {t("cardbox.status.minutes")}
                  </span>
                </div>
                {vision.description && (
                  <div className="text-xs text-base-content/70 whitespace-pre-wrap">
                    {t("cardbox.labels.description")}: {vision.description}
                  </div>
                )}
                {persons && (
                  <div className="text-xs text-base-content/70">
                    {t("cardbox.labels.coreParticipants")}: {persons}
                  </div>
                )}
                {vision.tasks && vision.tasks.length > 0 && (
                  <div className="text-xs text-base-content/70 space-y-1">
                    <div className="font-medium">
                      {t("cardbox.status.visionTaskList", {
                        count: vision.tasks.length,
                      })}
                    </div>
                    <ScrollArea className="max-h-64 pr-1">
                      <ul className="space-y-1">
                        {vision.tasks.map((task) => (
                          <li
                            key={task.id}
                            className="border border-dashed border-base-300 rounded px-2 py-1"
                          >
                            <div className="font-medium text-base-content">
                              {task.content ||
                                t("cardbox.contentPrefixes.unnamedTask")}
                            </div>
                            <div className="text-xs text-base-content/60">
                              {t("cardbox.status.statusPriority")}:{" "}
                              {task.status} · {task.priority ?? "--"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const renderPreviewContent = () => {
      if (previewError) {
        return <div className="text-xs text-error">{previewError}</div>;
      }
      if (!previewState) {
        return (
          <div className="text-xs text-base-content/60">
            {t("agent.context.previewInstructions")}
          </div>
        );
      }

      if (isModule(previewState.module, "actual_event")) {
        return renderTimelogPreview(previewState.items as ActualEvent[]);
      }
      if (isModule(previewState.module, "notes")) {
        return renderNotesPreview(previewState.items as Note[]);
      }
      if (isModule(previewState.module, "planning_tasks")) {
        return renderPlanningPreview(previewState.items as Task[]);
      }
      if (isModule(previewState.module, "vision_progress")) {
        return renderVisionPreview(previewState.items as VisionWithTasks[]);
      }
      return null;
    };

    return (
      <>
        {showInlineTrigger && (
          <div className="border-b border-base-300 bg-base-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-base-content/80">
                {t("agent.context.sectionTitle")}
              </div>
              <ActionButton
                label={t("agent.context.inlineTrigger")}
                size="xs"
                variant="outline"
                onClick={handleOpen}
                disabled={!sessionId || isUpdating}
              />
            </div>
            {feedback && (
              <div className="mt-2 text-xs text-success/80">{feedback}</div>
            )}
          </div>
        )}

        <ModalBase
          isOpen={isOpen}
          onClose={handleClose}
          size="2xl"
          overlayClosable={true}
          showCloseButton={true}
          bodyOverflow="hidden"
          bodyClassName="p-0"
          header={
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-base-content">
                  {t("agent.context.modalTitle")}
                </h2>
                <div className="flex gap-2 px-10">
                  <ActionButton
                    label={t("agent.context.tabExisting")}
                    color={activeTab === "existing" ? "primary" : "neutral"}
                    variant={activeTab === "existing" ? "solid" : "ghost"}
                    size="xs"
                    onClick={() => setActiveTab("existing")}
                  />
                  <ActionButton
                    label={t("agent.context.tabCreate")}
                    color={activeTab === "create" ? "primary" : "neutral"}
                    variant={activeTab === "create" ? "solid" : "ghost"}
                    size="xs"
                    onClick={() => setActiveTab("create")}
                  />
                </div>
              </div>
            </div>
          }
        >
          <div className="px-4 pb-4 pt-2 h-[min(80vh,48rem)] flex flex-col">
            <div className="flex-1 min-h-0">
              {activeTab === "existing" ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-0">
                  <ExistingContextList
                    t={t}
                    search={search}
                    onSearchChange={setSearch}
                    listLoading={listLoading}
                    filteredBoxes={filteredBoxes}
                    existingIds={existingIds}
                    pendingAddId={pendingAddId}
                    isUpdating={isUpdating}
                    deleteState={deleteState}
                    moduleLabelMap={MODULE_LABEL_MAP}
                    onPreview={handleExistingPreview}
                    onDelete={handleDeleteBox}
                    onAdd={handleAddExisting}
                  />

                  <div className="border border-dashed border-base-300 rounded-md p-3 space-y-3 h-full flex flex-col min-h-0">
                    <div className="flex items-center h-6">
                      <div className="text-xs font-medium text-base-content/80">
                        {t("agent.context.previewContent")}
                      </div>
                    </div>
                    <div className="min-h-[6rem] flex-shrink-0">
                      {previewBox ? (
                        <div className="space-y-2 text-xs text-base-content/70">
                          <div className="font-medium">
                            {previewBox.display_name}（
                            {MODULE_LABEL_MAP[
                              String(canonicalModule(previewBox.module ?? ""))
                            ] || previewBox.module}
                            ）
                          </div>
                          <div className="grid grid-cols-1 gap-1 text-base-content/60">
                            <div>
                              {t("cardbox.labels.cardCount")}:{" "}
                              {previewBox.card_count}
                            </div>
                            <div>
                              {t("cardbox.labels.lastUpdated")}:
                              {previewBox.updated_at
                                ? formatDateTimeUtil(previewBox.updated_at)
                                : "--"}
                            </div>
                            {(() => {
                              const filtersSummary = summariseFiltersForDisplay(
                                previewBox.module,
                                getMetadataRecord(previewBox.metadata),
                              );
                              return filtersSummary ? (
                                <div className="truncate">
                                  {t("cardbox.labels.filters")}:{" "}
                                  {filtersSummary}
                                </div>
                              ) : (
                                <div className="invisible">
                                  {t("cardbox.labels.filters")}:{" "}
                                  {t("common.placeholder")}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-base-content/60 flex items-center justify-center h-[4rem]">
                          {t("agent.context.selectContextBoxToPreview")}
                        </div>
                      )}
                    </div>
                    <ScrollArea className="space-y-2 pr-1 text-xs flex-1">
                      {filteredExistingPreviewItems.length > 0 ? (
                        <ul className="space-y-2">
                          {filteredExistingPreviewItems.map((item, index) =>
                            isModule(previewBox?.module ?? "", "actual_event")
                              ? renderExistingTimelogItem(item, index)
                              : renderExistingFallbackItem(item, index),
                          )}
                        </ul>
                      ) : previewBox ? (
                        <div className="text-xs text-base-content/60">
                          {t("cardbox.status.noContentInBox")}
                        </div>
                      ) : null}
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <form
                  className="flex flex-col h-full space-y-4"
                  onSubmit={handlePreviewNewSubmit}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                    <div className="flex flex-col min-h-0">
                      <ScrollArea className="space-y-3 pr-2 max-h-[calc(100vh-20rem)]">
                        <div>
                          <label className="label label-text">
                            {t("agent.context.create.module")}
                          </label>
                          <EnumSelect
                            value={createModule}
                            onChange={(value) => {
                              if (!value) return;
                              setCreateModule(value as ModuleValue);
                            }}
                            options={moduleSelectOptions}
                            showLabel={false}
                            size="md"
                            className="w-full"
                            placeholder={t("agent.context.create.module")}
                          />
                        </div>
                        <div>
                          <label className="label label-text">
                            {t("agent.context.create.contextName")}
                          </label>
                          <TextInput
                            type="text"
                            value={createName}
                            onChange={(event) =>
                              setCreateName(event.target.value)
                            }
                            placeholder={t(
                              "agent.context.create.contextNamePlaceholder",
                            )}
                          />
                        </div>

                        {moduleFormSections.dateRange && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label label-text">
                                {t("agent.context.create.startDate")}
                              </label>
                              <TextInput
                                type="date"
                                value={createStartDate}
                                onChange={(event) =>
                                  setCreateStartDate(event.target.value)
                                }
                                required
                              />
                            </div>
                            <div>
                              <label className="label label-text">
                                {t("agent.context.create.endDate")}
                              </label>
                              <TextInput
                                type="date"
                                value={createEndDate}
                                onChange={(event) =>
                                  setCreateEndDate(event.target.value)
                                }
                              />
                            </div>
                          </div>
                        )}

                        {moduleFormSections.dimension && (
                          <div>
                            <label className="label label-text">
                              {t("agent.context.create.dimension")}
                            </label>
                            <DimensionSelect
                              value={
                                createDimensionId === undefined
                                  ? undefined
                                  : createDimensionId
                              }
                              onChange={(value) => {
                                if (typeof value === "string") {
                                  setCreateDimensionId(value);
                                } else {
                                  setCreateDimensionId(value);
                                }
                              }}
                              showLabel={false}
                              placeholder="选择维度"
                              size="md"
                              showAllOption
                              showNoneOption
                              noneLabel={t("common.noDimension")}
                              clearBehavior="all"
                            />
                          </div>
                        )}

                        {moduleFormSections.keyword && (
                          <div>
                            <label className="label label-text">
                              {t("agent.context.create.keyword")}
                            </label>
                            <TextInput
                              type="text"
                              value={createKeyword}
                              onChange={(event) =>
                                setCreateKeyword(event.target.value)
                              }
                              placeholder={t(
                                "agent.context.create.keywordPlaceholder",
                              )}
                            />
                          </div>
                        )}

                        {(moduleFormSections.noteTags ||
                          moduleFormSections.notePersons) && (
                          <div className="space-y-3">
                            {moduleFormSections.noteTags && (
                              <div>
                                <label className="label label-text">
                                  {t("agent.context.create.relatedTags")}
                                </label>
                                <TagSelector
                                  availableTags={noteTags || []}
                                  selectedTagIds={createNoteTagIds}
                                  onTagsChange={handleNoteTagChange}
                                  onCreateTag={handleCreateNoteTag}
                                  showLabel={false}
                                  showNoTagOption
                                  size="md"
                                />
                              </div>
                            )}
                            {moduleFormSections.notePersons && (
                              <div>
                                <label className="label label-text">
                                  {t("agent.context.create.relatedPersons")}
                                </label>
                                <PersonSelector
                                  selectedPersonIds={createNotePersonIds}
                                  onSelectionChange={handleNotePersonChange}
                                  multiple={false}
                                  showLabel={false}
                                  size="md"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {moduleFormSections.planningCycle && (
                          <div className="space-y-3">
                            <div>
                              <label className="label label-text">
                                {t("agent.context.create.planningCycle")}
                              </label>
                              <EnumSelect
                                value={planningCycleType}
                                onChange={(value) => {
                                  if (!value) return;
                                  setPlanningCycleType(
                                    value as PlanningCycleType,
                                  );
                                }}
                                options={planningCycleOptions}
                                showLabel={false}
                                size="md"
                                className="w-full"
                                placeholder={t(
                                  "agent.context.create.planningCycle",
                                )}
                              />
                            </div>
                            <div>
                              <label className="label label-text">
                                {t("agent.context.create.startDate")}
                              </label>
                              <TextInput
                                type="date"
                                value={planningStartDate}
                                onChange={(event) =>
                                  setPlanningStartDate(event.target.value)
                                }
                                required
                              />
                            </div>
                            <div>
                              <label className="label label-text">
                                {t("agent.context.create.taskStatus")}
                              </label>
                              <EnumSelect
                                value={planningStatusOption}
                                onChange={(value) => {
                                  if (!value) return;
                                  setPlanningStatusOption(
                                    value as TaskStatusOption,
                                  );
                                }}
                                options={taskStatusOptions}
                                showLabel={false}
                                size="md"
                                className="w-full"
                                placeholder={t(
                                  "agent.context.create.taskStatus",
                                )}
                              />
                            </div>
                          </div>
                        )}

                        {moduleFormSections.visionSelector && (
                          <div className="space-y-3">
                            <div>
                              <label className="label label-text">
                                {t("agent.context.create.selectVision")}
                              </label>
                              <VisionSelector
                                value={selectedVisionIds[0] ?? null}
                                onChange={(value) =>
                                  setSelectedVisionIds(value ? [value] : [])
                                }
                                showLabel={false}
                                showStatus
                                allowUndefined
                                filterStatus={[]}
                                size="md"
                              />
                            </div>
                            {moduleFormSections.visionStatus && (
                              <div>
                                <label className="label label-text">
                                  {t("agent.context.create.taskStatus")}
                                </label>
                                <EnumSelect
                                  value={visionStatusOption}
                                  onChange={(value) => {
                                    if (!value) return;
                                    setVisionStatusOption(
                                      value as TaskStatusOption,
                                    );
                                  }}
                                  options={taskStatusOptions}
                                  showLabel={false}
                                  size="md"
                                  className="w-full"
                                  placeholder={t(
                                    "agent.context.create.taskStatus",
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        <ActionButtonGroup gap="sm" align="start">
                          <ActionButton
                            label={
                              previewLoading
                                ? t("agent.context.buttons.searching")
                                : t("agent.context.buttons.previewData")
                            }
                            type="submit"
                            size="sm"
                            color="primary"
                            variant="solid"
                            disabled={previewLoading}
                          />
                          <ActionButton
                            label={t("common.reset")}
                            size="sm"
                            variant="ghost"
                            onClick={() => resetCreateForm(false)}
                          />
                        </ActionButtonGroup>
                        {createFeedback && (
                          <div className="text-xs text-success/80">
                            {createFeedback}
                          </div>
                        )}
                      </ScrollArea>
                    </div>

                    <div className="border border-dashed border-base-300 rounded-md p-3 space-y-3 h-full flex flex-col overflow-hidden min-h-0">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-base-content/80">
                          {t("agent.context.previewResults")}
                        </div>
                        {previewState && (
                          <div className="text-xs text-base-content/60">
                            {t("agent.context.previewMatchCount", {
                              count: previewState.items.length,
                            })}
                          </div>
                        )}
                      </div>
                      <ScrollArea className="flex-1">
                        {renderPreviewContent()}
                      </ScrollArea>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-base-200 pt-3">
                    <div className="text-xs text-base-content/60">
                      {t("agent.context.createInstructions")}
                    </div>
                    <ActionButton
                      type="button"
                      label={
                        isCreating
                          ? t("agent.context.buttons.creating")
                          : t("agent.context.buttons.createAndAdd")
                      }
                      size="sm"
                      color="primary"
                      variant="solid"
                      onClick={handleCreateAndAdd}
                      disabled={createButtonDisabled}
                    />
                  </div>
                </form>
              )}
            </div>
          </div>
        </ModalBase>

        <ConfirmDialog
          isOpen={Boolean(pendingDelete)}
          title={t("agent.context.deleteTitle")}
          message={t("agent.context.deleteMessage", {
            name:
              pendingDelete?.display_name ||
              pendingDelete?.name ||
              t("common.none"),
          })}
          confirmText={t("agent.context.deleteConfirm")}
          cancelText={t("common.cancel")}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      </>
    );
  },
);

export default SessionContextPicker;
