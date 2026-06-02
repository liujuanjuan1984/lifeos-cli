import { useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { notesApi } from "@/services/api/notes";
import type { NoteUpdate, NoteCreate } from "@/services/api/notes";
import { notesKeys } from "@/services/api/queryKeys";
import {
  invalidateNotesLists,
  invalidateNotesAdvancedSearch,
  invalidateNotesStats,
} from "@/services/api/cacheInvalidation/notes";
import { useToast } from "@/contexts/ToastContext";
import type { UUID } from "@/types/primitive";
export function useNotes(
  filters: {
    tag_id?: UUID;
    person_id?: UUID;
    task_id?: UUID;
    actual_event_id?: UUID;
    keyword?: string;
    untagged?: boolean;
  } = {},
) {
  const queryClient = useQueryClient();
  const toast = useToast();

  // 1. 使用 useInfiniteQuery 获取笔记列表 (分页逻辑)
  const {
    data,
    error,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: notesKeys.list(filters),
    queryFn: ({ pageParam = 1, signal }) =>
      notesApi.fetchPaged(
        { ...filters, page: pageParam as number, size: 20 },
        { signal },
      ),
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.pagination.page;
      return currentPage < lastPage.pagination.pages
        ? currentPage + 1
        : undefined;
    },
    initialPageParam: 1,
    // 保留上一份数据，避免筛选切换时 data 瞬空导致页面闪屏
    placeholderData: (previousData) => previousData,
  });

  const pages = data?.pages;
  const notes = useMemo(() => {
    if (!pages) {
      return [];
    }
    return pages.flatMap((page) => page.items ?? []);
  }, [pages]);

  // 2. 使用 useQuery 获取统计数据
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: notesKeys.stats(),
    queryFn: notesApi.getStats,
  });

  // 3. 使用 useMutation 进行创建操作
  const createNoteMutation = useMutation({
    mutationFn: (noteData: NoteCreate) => notesApi.create(noteData),
    onSuccess: async (createdNote) => {
      toast.showSuccess("笔记创建成功！");
      queryClient.setQueryData(notesKeys.detail(createdNote.id), createdNote);
      await Promise.all([
        invalidateNotesLists(queryClient),
        invalidateNotesStats(queryClient),
        invalidateNotesAdvancedSearch(queryClient),
      ]);
    },
    onError: (err: Error) => {
      toast.showError("笔记创建失败", err.message);
    },
  });

  // 4. 使用 useMutation 进行更新操作
  const updateNoteMutation = useMutation({
    mutationFn: (variables: { noteId: UUID; data: NoteUpdate }) =>
      notesApi.update(variables.noteId, variables.data),
    onSuccess: async (updatedNote) => {
      toast.showSuccess("笔记更新成功！");
      queryClient.setQueryData(notesKeys.detail(updatedNote.id), updatedNote);
      await Promise.all([
        invalidateNotesLists(queryClient),
        invalidateNotesStats(queryClient),
        invalidateNotesAdvancedSearch(queryClient),
      ]);
    },
    onError: (err: Error) => {
      toast.showError("笔记更新失败", err.message);
    },
  });

  // 5. 使用 useMutation 进行删除操作
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: UUID) => notesApi.delete(noteId),
    onSuccess: async (_, noteId) => {
      toast.showSuccess("笔记删除成功！");
      queryClient.removeQueries({
        queryKey: notesKeys.detail(noteId),
        exact: true,
      });
      await Promise.all([
        invalidateNotesLists(queryClient),
        invalidateNotesStats(queryClient),
        invalidateNotesAdvancedSearch(queryClient),
      ]);
    },
    onError: (err: Error) => {
      toast.showError("笔记删除失败", err.message);
    },
  });

  return {
    notes,
    stats,
    isLoading: isFetching && !isFetchingNextPage,
    isLoadingStats,
    error,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    loadMoreNotes: fetchNextPage,
    createNote: createNoteMutation.mutate,
    updateNote: updateNoteMutation.mutate,
    deleteNote: deleteNoteMutation.mutate,
  };
}
