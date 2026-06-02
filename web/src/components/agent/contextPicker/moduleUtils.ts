import type { TFunction } from "i18next";
import type { QueryClient } from "@tanstack/react-query";
import { actualEventsApi, type ActualEvent } from "@/services/api/actualEvents";
import { notesApi, type Note } from "@/services/api/notes";
import { tasksApi, type Task } from "@/services/api/tasks";
import { visionsApi, type VisionWithTasks } from "@/services/api/visions";
import {
  actualEventsKeys,
  notesKeys,
  tasksKeys,
  visionsKeys,
} from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";
import type { ModuleValue } from "./moduleConfig";

const MODULE_ALIAS_MAP: Record<string, ModuleValue> = {
  timelog: "actual_event",
};

export const canonicalModule = (
  value: string | null | undefined,
): ModuleValue | string => {
  const normalised = (value ?? "").toLowerCase();
  return MODULE_ALIAS_MAP[normalised] ?? normalised;
};

export const isModule = (value: string, expected: ModuleValue): boolean => {
  return canonicalModule(value) === expected;
};

export type PlanningCycleType = "day" | "week" | "month" | "year";
export type TaskStatusOption = "all" | "active" | "completed";

const ACTIVE_STATUS_SET = ["todo", "in_progress", "paused"] as const;
const COMPLETED_STATUS_SET = ["done", "cancelled"] as const;

const PREVIEW_PAGE_SIZE = 200;
const TIMELOG_CONTEXT_LIMIT = 500;
const PLANNING_CONTEXT_LIMIT = 200;
const VISION_CONTEXT_LIMIT = 100;

const toLocalDayBoundaryIso = (
  dateStr: string,
  endOfDay: boolean,
): string | undefined => {
  if (!dateStr) return undefined;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return undefined;
  }
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return date.toISOString();
};

const mapStatusOptionToList = (
  option: TaskStatusOption,
): string[] | undefined => {
  switch (option) {
    case "active":
      return [...ACTIVE_STATUS_SET];
    case "completed":
      return [...COMPLETED_STATUS_SET];
    case "all":
    default:
      return undefined;
  }
};

interface BuildFiltersParams {
  module: ModuleValue;
  createStartDate?: string | null;
  createEndDate?: string | null;
  createKeyword?: string;
  createDimensionId?: string | null | undefined;
  dimensionMap: Map<string, string>;
  createNoteTagIds: UUID[];
  createNotePersonIds: UUID[];
  planningCycleType: PlanningCycleType;
  planningStartDate?: string | null;
  planningStatusOption: TaskStatusOption;
  selectedVisionIds: UUID[];
  visionStatusOption: TaskStatusOption;
}

export const buildModuleFilters = ({
  module,
  createStartDate,
  createEndDate,
  createKeyword,
  createDimensionId,
  dimensionMap,
  createNoteTagIds,
  createNotePersonIds,
  planningCycleType,
  planningStartDate,
  planningStatusOption,
  selectedVisionIds,
  visionStatusOption,
}: BuildFiltersParams): Record<string, unknown> => {
  const filters: Record<string, unknown> = {};

  if (isModule(module, "actual_event")) {
    if (createStartDate) {
      filters.start_date = toLocalDayBoundaryIso(createStartDate, false);
    }
    if (createEndDate) {
      filters.end_date = toLocalDayBoundaryIso(createEndDate, true);
    } else if (createStartDate) {
      filters.end_date = toLocalDayBoundaryIso(createStartDate, true);
    }
    if (createKeyword) {
      filters.keyword = createKeyword;
      filters.description_keyword = createKeyword;
    }
    if (createDimensionId === null) {
      filters.dimension_id = null;
    } else if (createDimensionId) {
      filters.dimension_id = createDimensionId;
      const dimensionName = dimensionMap.get(createDimensionId);
      if (dimensionName) {
        filters.dimension_name = dimensionName;
      }
    }
    filters.limit = TIMELOG_CONTEXT_LIMIT;
    return filters;
  }

  if (isModule(module, "notes")) {
    if (createKeyword) {
      filters.keyword = createKeyword;
    }
    if (createNoteTagIds.length > 0) {
      filters.tag_id = createNoteTagIds[0];
    }
    if (createNotePersonIds.length > 0) {
      filters.person_id = createNotePersonIds[0];
    }
    return filters;
  }

  if (isModule(module, "planning_tasks")) {
    filters.planning_cycle_type = planningCycleType;
    if (planningStartDate) {
      filters.planning_cycle_start_date = planningStartDate;
    }
    const statusList = mapStatusOptionToList(planningStatusOption);
    if (statusList && statusList.length > 0) {
      filters.status_in = statusList;
    }
    filters.size = PLANNING_CONTEXT_LIMIT;
    return filters;
  }

  if (isModule(module, "vision_progress")) {
    if (selectedVisionIds.length > 0) {
      filters.vision_ids = selectedVisionIds;
    }
    const statusList = mapStatusOptionToList(visionStatusOption);
    if (statusList && statusList.length > 0) {
      filters.task_status_in = statusList;
    }
    filters.limit = VISION_CONTEXT_LIMIT;
    return filters;
  }

  return filters;
};

interface FetchPreviewParams {
  module: ModuleValue;
  filters: Record<string, unknown>;
  queryClient: QueryClient;
  t: TFunction;
}

export const fetchModulePreview = async ({
  module,
  filters,
  queryClient,
  t,
}: FetchPreviewParams): Promise<
  ActualEvent[] | Note[] | Task[] | VisionWithTasks[]
> => {
  if (isModule(module, "actual_event")) {
    const start = filters.start_date as string | undefined;
    if (!start) {
      throw new Error(t("agent.context.errors.selectStartDate"));
    }
    const payload = {
      start_date: start,
      end_date: (filters.end_date as string | undefined) ?? undefined,
      ...(Object.prototype.hasOwnProperty.call(filters, "dimension_id") && {
        dimension_id: filters.dimension_id as string | null,
      }),
      dimension_name: filters.dimension_name as string | undefined,
      description_keyword:
        (filters.description_keyword as string | undefined) ??
        (filters.keyword as string | undefined),
      task_id: filters.task_id as string | undefined,
    };
    return await queryClient.fetchQuery({
      queryKey: actualEventsKeys.advancedSearch(payload),
      queryFn: async () => {
        const response = await actualEventsApi.advancedSearch(payload);
        return response.items;
      },
      staleTime: 60 * 1000,
    });
  }

  if (isModule(module, "notes")) {
    const keyword = (filters.keyword as string | undefined) ?? undefined;
    const tagId = filters.tag_id as UUID | undefined;
    const personId = filters.person_id as UUID | undefined;
    const out: Note[] = [];
    const pageSize = Math.min(PREVIEW_PAGE_SIZE, 100);
    let page = 1;

    while (out.length < PREVIEW_PAGE_SIZE) {
      const response = await queryClient.fetchQuery({
        queryKey: notesKeys.list({
          page,
          size: pageSize,
          keyword,
          tag_id: tagId,
          person_id: personId,
        }),
        queryFn: () =>
          notesApi.fetchPaged({
            page,
            size: pageSize,
            keyword,
            tag_id: tagId,
            person_id: personId,
          }),
        staleTime: 30 * 1000,
      });
      out.push(...(response.items ?? []));
      if ((response.items ?? []).length < pageSize) {
        break;
      }
      page += 1;
    }

    return out.slice(0, PREVIEW_PAGE_SIZE);
  }

  if (isModule(module, "planning_tasks")) {
    const statusList = (filters.status_in as string[] | undefined) ?? [];
    const response = await queryClient.fetchQuery({
      queryKey: tasksKeys.list({
        planning_cycle_type: filters.planning_cycle_type as string | undefined,
        planning_cycle_start_date: filters.planning_cycle_start_date as
          | string
          | undefined,
        status_in: statusList,
        fields: "basic",
        size: PLANNING_CONTEXT_LIMIT,
      }),
      queryFn: () =>
        tasksApi.getAll(undefined, undefined, {
          planning_cycle_type: filters.planning_cycle_type as
            | string
            | undefined,
          planning_cycle_start_date: filters.planning_cycle_start_date as
            | string
            | undefined,
          status_in: statusList,
          fields: "basic",
          size: PLANNING_CONTEXT_LIMIT,
        }),
      staleTime: 60 * 1000,
    });
    return response.items ?? [];
  }

  if (isModule(module, "vision_progress")) {
    const visionIds = (filters.vision_ids as UUID[] | undefined) ?? [];
    if (!visionIds.length) {
      throw new Error(t("agent.context.errors.selectVision"));
    }
    const statusList = (filters.task_status_in as string[] | undefined) ?? [];
    const results: VisionWithTasks[] = [];

    for (const visionId of visionIds) {
      const vision = await queryClient.fetchQuery({
        queryKey: visionsKeys.withTasks(visionId),
        queryFn: () => visionsApi.getWithTasks(visionId),
        staleTime: 60 * 1000,
      });
      const filteredTasks = !statusList.length
        ? vision.tasks
        : (vision.tasks || []).filter((task) =>
            statusList.includes(task.status ?? ""),
          );
      results.push({ ...vision, tasks: filteredTasks });
    }

    return results;
  }

  return [];
};
