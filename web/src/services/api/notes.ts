import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { PersonSummary } from "./types/common";
import { tagsApi, type Tag } from "./tags";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

export interface Note {
  id: UUID;
  content: string;
  created_at: string;
  updated_at: string;
  people?: PersonSummary[];
  tags?: Tag[];
  task?: TaskSummary | null;
  tasks?: TaskSummary[];
  timelogs?: NoteTimelogSummary[];
  ingest_job?: NoteIngestJobSummary | null;
}

interface NoteVisionSummary {
  id: UUID;
  name: string;
  status?: string | null;
  area_id?: UUID | null;
}

interface TaskParentSummary {
  id: UUID;
  content: string;
  status?: string | null;
}

export interface TaskSummary {
  id: UUID;
  content: string;
  status: string;
  vision_id: UUID;
  parent_task_id?: UUID | null;
  priority?: number | null;
  estimated_effort?: number | null;
  notes_count?: number;
  actual_effort_total?: number | null;
  actual_effort_self?: number | null;
  planning_cycle_type?: string | null;
  planning_cycle_start_date?: string | null;
  created_at?: string;
  updated_at?: string;
  vision_summary?: NoteVisionSummary | null;
  parent_summary?: TaskParentSummary | null;
}

export interface NoteTimelogSummary {
  id: UUID;
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  area_id?: UUID | null;
  area_summary?: NoteTimelogAreaSummary | null;
  task_summary?: NoteTimelogTaskSummary | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface NoteIngestJobSummary {
  id: UUID;
  status: string;
  retry_count: number;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

interface NoteTimelogAreaSummary {
  id: UUID;
  name?: string | null;
  color?: string | null;
}

interface NoteTimelogTaskSummary {
  id: UUID;
  content: string;
  status?: string | null;
  vision_id?: UUID | null;
  vision_summary?: NoteVisionSummary | null;
}

export interface NoteSummary {
  id: UUID;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NoteCreate {
  content: string;
  person_ids?: UUID[];
  tag_ids?: UUID[];
  task_id?: UUID | null;
  timelog_ids?: UUID[];
}

export interface NoteUpdate {
  content?: string;
  person_ids?: UUID[];
  tag_ids?: UUID[];
  task_id?: UUID | null;
  timelog_ids?: UUID[];
}

// New interfaces for statistics and filtering
export interface NoteStats {
  total_notes: number;
  tag_stats: Array<{
    id: UUID;
    name: string;
    usage_count: number;
  }>;
  person_stats: Array<{
    id: UUID;
    name: string;
    display_name: string;
    usage_count: number;
  }>;
}

interface NotePersonStatsResponse {
  person_stats: NoteStats["person_stats"];
  total_persons: number;
}

export type NoteTagFilterMode = "any" | "all" | "none";
export type NotePersonFilterMode = "any" | "all" | "none";
export type NoteTaskFilterMode = "any" | "none" | "specific" | "has";

export interface NoteAdvancedSearchPayload {
  start_date?: string | null;
  end_date?: string | null;
  tag_ids?: UUID[] | null;
  tag_mode: NoteTagFilterMode;
  person_ids?: UUID[] | null;
  person_mode: NotePersonFilterMode;
  task_filter: NoteTaskFilterMode;
  task_id?: UUID | null;
  keyword?: string | null;
  sort_order?: "asc" | "desc";
}

interface NoteBatchTagUpdatePayload {
  mode: "add" | "replace";
  tag_ids: UUID[];
}

interface NoteBatchPersonUpdatePayload {
  mode: "add" | "replace";
  person_ids: UUID[];
}

interface NoteBatchTaskUpdatePayload {
  mode: "replace" | "clear";
  task_id?: UUID | null;
}

interface NoteBatchContentUpdatePayload {
  find_text: string;
  replace_text: string;
  case_sensitive?: boolean;
}

export interface NoteBatchUpdatePayload {
  note_ids: UUID[];
  operation: "tags" | "people" | "task" | "content";
  tags?: NoteBatchTagUpdatePayload;
  people?: NoteBatchPersonUpdatePayload;
  task?: NoteBatchTaskUpdatePayload;
  content?: NoteBatchContentUpdatePayload;
}

export interface NoteBatchUpdateResult {
  updated_count: number;
  failed_ids: UUID[];
  errors: string[];
}

export interface NoteBatchDeletePayload {
  note_ids: UUID[];
}

export interface NoteBatchDeleteResult {
  deleted_count: number;
  failed_ids: UUID[];
  errors: string[];
}

interface NoteBulkCreateItemPayload {
  content: string;
}

export interface NoteBulkCreateRequestPayload {
  notes: NoteBulkCreateItemPayload[];
  person_ids?: UUID[];
  tag_ids?: UUID[];
  task_id?: UUID | null;
  timelog_ids?: UUID[];
}

interface NoteBulkCreateFailedItem {
  index: number;
  content_preview: string;
  error: string;
}

interface NoteBulkCreateResponsePayload {
  created_notes: Note[];
  failed_items: NoteBulkCreateFailedItem[];
  created_count: number;
  failed_count: number;
}

interface NoteListMeta {
  tag_id?: UUID | null;
  person_id?: UUID | null;
  task_id?: UUID | null;
  timelog_id?: UUID | null;
  keyword?: string | null;
  untagged?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
  tag_ids?: UUID[] | null;
  tag_mode?: "any" | "all" | "none" | null;
  person_ids?: UUID[] | null;
  person_mode?: "any" | "all" | "none" | null;
  task_filter?: "any" | "none" | "specific" | "has" | null;
  sort_order?: "asc" | "desc" | null;
}

export type NoteListResponse = ListResponse<Note, NoteListMeta>;

export const notesApi = {
  create: (noteData: NoteCreate) =>
    http.post<Note>(ENDPOINTS.NOTES.BASE, noteData),

  fetchAll: () => http.get<NoteListResponse>(ENDPOINTS.NOTES.BASE),

  fetchPaged: (
    params: {
      page?: number;
      size?: number;
      tag_id?: UUID;
      person_id?: UUID;
      task_id?: UUID;
      timelog_id?: UUID;
      keyword?: string;
      untagged?: boolean;
    },
    options?: { signal?: AbortSignal },
  ) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.size) searchParams.append("size", params.size.toString());
    if (params.tag_id) searchParams.append("tag_id", params.tag_id.toString());
    if (params.person_id)
      searchParams.append("person_id", params.person_id.toString());
    if (params.keyword) searchParams.append("keyword", params.keyword);
    if (params.task_id)
      searchParams.append("task_id", params.task_id.toString());
    if (params.timelog_id)
      searchParams.append("timelog_id", params.timelog_id.toString());
    if (params.untagged) searchParams.append("untagged", "true");

    const queryString = searchParams.toString();
    const url = `${ENDPOINTS.NOTES.BASE}${queryString ? `?${queryString}` : ""}`;

    return http.get<NoteListResponse>(url, undefined, {
      signal: options?.signal,
    });
  },

  // New method to get statistics (aggregated from split endpoints)
  getStats: async (): Promise<NoteStats> => {
    const [notes, tagUsage, personUsage] = await Promise.all([
      notesApi.fetchPaged({ page: 1, size: 1 }),
      tagsApi.getStatsBatch("note"),
      http.get<NotePersonStatsResponse>(ENDPOINTS.NOTES.STATS_PERSONS),
    ]);
    return {
      total_notes: notes.pagination.total,
      tag_stats: tagUsage.tag_stats.map((tagStat) => ({
        id: tagStat.id,
        name: tagStat.name ?? "",
        usage_count: tagStat.usage_count,
      })),
      person_stats: personUsage.person_stats,
    };
  },

  update: (noteId: UUID, noteData: NoteUpdate) =>
    http.patch<Note>(ENDPOINTS.NOTES.BY_ID(noteId), noteData),

  delete: async (noteId: UUID): Promise<void> => {
    try {
      await http.delete<void>(ENDPOINTS.NOTES.BY_ID(noteId));
    } catch (err) {
      // Preserve enhanced error semantics similar to old api.ts implementation
      const anyErr = err as unknown as { status?: number; message?: string };
      if (anyErr && typeof anyErr === "object" && "status" in anyErr) {
        const status = anyErr.status ?? 0;
        const message =
          status === 404
            ? "Note not found (may have been already deleted)"
            : (anyErr.message ?? "Request failed");
        const e: Error & { status?: number } = new Error(message);
        e.status = status;
        throw err as Error;
      }
      throw err as Error;
    }
  },

  // Tag management methods
  addTag: (noteId: UUID, tagId: UUID) =>
    http.post<Note>(ENDPOINTS.NOTES.TAG_BY_ID(noteId, tagId)),

  removeTag: (noteId: UUID, tagId: UUID) =>
    http.delete<Note>(ENDPOINTS.NOTES.TAG_BY_ID(noteId, tagId)),

  advancedSearch: (payload: NoteAdvancedSearchPayload) =>
    notesApi.fetchPaged({
      page: 1,
      size: 500,
      keyword: payload.keyword ?? undefined,
    }),

  batchUpdate: (payload: NoteBatchUpdatePayload) =>
    Promise.resolve({
      updated_count: 0,
      failed_ids: payload.note_ids,
      errors: ["Batch note update is not supported by LifeOS Web UI yet."],
    } satisfies NoteBatchUpdateResult),

  batchDelete: (payload: NoteBatchDeletePayload) =>
    Promise.allSettled(payload.note_ids.map((noteId) => notesApi.delete(noteId))).then(
      (results) => {
        const failedIds = payload.note_ids.filter(
          (_, index) => results[index].status === "rejected",
        );
        return {
          deleted_count: payload.note_ids.length - failedIds.length,
          failed_ids: failedIds,
          errors: [],
        } satisfies NoteBatchDeleteResult;
      },
    ),

  batchCreate: (payload: NoteBulkCreateRequestPayload) =>
    Promise.allSettled(
      payload.notes.map((note) => notesApi.create({ content: note.content })),
    ).then((results) => {
      const createdNotes = results
        .filter((result): result is PromiseFulfilledResult<Note> => result.status === "fulfilled")
        .map((result) => result.value);
      const failedItems = results.flatMap((result, index) =>
        result.status === "rejected"
          ? [
              {
                index,
                content_preview: payload.notes[index].content.slice(0, 80),
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
              },
            ]
          : [],
      );
      return {
        created_notes: createdNotes,
        failed_items: failedItems,
        created_count: createdNotes.length,
        failed_count: failedItems.length,
      } satisfies NoteBulkCreateResponsePayload;
    }),
  getIngestJob: (jobId: UUID) =>
    http.get<NoteIngestJobSummary>(ENDPOINTS.NOTES.INGEST_JOB(jobId)),
};
