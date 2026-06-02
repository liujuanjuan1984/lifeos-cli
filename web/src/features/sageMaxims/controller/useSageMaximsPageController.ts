import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import {
  sageMaximsApi,
  type SageMaxim,
  type SageMaximListResponse,
  type SageMaximSort,
} from "@/services/api/sageMaxims";
import type { UUID } from "@/types/primitive";
import { useToast } from "@/contexts/ToastContext";

const DEFAULT_PAGE_SIZE = 20;

function updateListWithMaxim(
  current: SageMaximListResponse | undefined,
  updated: SageMaxim,
): SageMaximListResponse | undefined {
  if (!current) return current;
  const items = current.items.map((item) =>
    item.id === updated.id ? updated : item,
  );
  return { ...current, items };
}

export function useSageMaximsPageController() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [content, setContent] = useState("");
  const [sort, setSort] = useState<SageMaximSort>("random");

  const queryKey = useMemo(() => ["sage-maxims", { sort }], [sort]);

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      sageMaximsApi.list({ sort, page: 1, size: DEFAULT_PAGE_SIZE }),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });

  const createMutation = useMutation({
    mutationFn: ({ content: maximContent }: { content: string }) =>
      sageMaximsApi.create({
        content: maximContent,
      }),
    onMutate: async ({ content: maximContent }) => {
      const previousContent = content;
      setContent("");

      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<
        SageMaximListResponse | undefined
      >(queryKey);

      if (!previous) {
        return { previous, previousContent };
      }

      const optimisticId = `optimistic-${Date.now()}` as UUID;
      const nowIso = new Date().toISOString();
      const optimisticMaxim: SageMaxim = {
        id: optimisticId,
        content: maximContent,
        language: previous.items[0]?.language ?? "zh-cn",
        like_count: 0,
        dislike_count: 0,
        created_at: nowIso,
        updated_at: nowIso,
        author:
          previous.items[0]?.author ??
          ({
            id: "optimistic-author" as UUID,
            name: "You",
          } as SageMaxim["author"]),
        viewer_reaction: null,
      };

      const nextItems = [optimisticMaxim, ...previous.items];
      if (nextItems.length > previous.pagination.size) {
        nextItems.length = previous.pagination.size;
      }

      queryClient.setQueryData<SageMaximListResponse>(queryKey, {
        ...previous,
        items: nextItems,
        pagination: {
          ...previous.pagination,
          total: previous.pagination.total + 1,
          pages: Math.max(
            1,
            Math.ceil(
              (previous.pagination.total + 1) / previous.pagination.size,
            ),
          ),
        },
      });

      return { previous, optimisticId, previousContent };
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (context?.previousContent !== undefined) {
        setContent(context.previousContent);
      }
      const message =
        error instanceof Error ? error.message : String(error ?? "Error");
      toast.showError(message);
    },
    onSuccess: (created, _variables, context) => {
      queryClient.setQueryData<SageMaximListResponse | undefined>(
        queryKey,
        (prev) => {
          if (!prev) return prev;
          const filteredItems = prev.items.filter(
            (item) => item.id !== context?.optimisticId,
          );
          const nextItems = [created, ...filteredItems];
          if (nextItems.length > prev.pagination.size) {
            nextItems.length = prev.pagination.size;
          }
          return {
            ...prev,
            items: nextItems,
          };
        },
      );
      toast.showSuccess(t("sageMaxims.submitSuccess"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "like" | "dislike" | null;
    }) => {
      if (action === null) {
        return sageMaximsApi.removeReaction(id as string);
      }
      return sageMaximsApi.react(id as string, action);
    },
    onMutate: async ({ id, action }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<
        SageMaximListResponse | undefined
      >(queryKey);
      if (!previous) return { previous };

      const items = previous.items.map((item) => {
        if (item.id !== id) return item;

        let likeCount = item.like_count;
        let dislikeCount = item.dislike_count;
        const previousReaction = item.viewer_reaction ?? null;

        if (previousReaction === "like") {
          likeCount = Math.max(0, likeCount - 1);
        } else if (previousReaction === "dislike") {
          dislikeCount = Math.max(0, dislikeCount - 1);
        }

        if (action === "like") {
          likeCount += 1;
        } else if (action === "dislike") {
          dislikeCount += 1;
        }

        return {
          ...item,
          like_count: likeCount,
          dislike_count: dislikeCount,
          viewer_reaction: action,
        };
      });

      queryClient.setQueryData<SageMaximListResponse>(queryKey, {
        ...previous,
        items,
      });

      return { previous };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<SageMaximListResponse | undefined>(
        queryKey,
        (prev) => updateListWithMaxim(prev, updated),
      );
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? "Failed to update reaction");
      toast.showError(`${t("sageMaxims.reactionError")}: ${message}`.trim());
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) {
      return;
    }
    createMutation.mutate({ content: content.trim() });
  };

  const handleReaction = (maxim: SageMaxim, action: "like" | "dislike") => {
    if (reactionMutation.isPending) return;
    const nextAction = maxim.viewer_reaction === action ? null : action;
    reactionMutation.mutate({ id: maxim.id, action: nextAction });
  };

  return {
    content,
    setContent,
    sort,
    setSort,
    listQuery,
    createMutation,
    reactionMutation,
    handleSubmit,
    handleReaction,
  };
}
