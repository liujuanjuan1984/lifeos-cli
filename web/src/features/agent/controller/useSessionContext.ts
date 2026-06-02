import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cardboxApi, cardboxKeys } from "@/services/api/cardbox";
import { invalidateCardboxContextList } from "@/services/api/cacheInvalidation/cardbox";
import type {
  SessionContextSelectionResponse,
  SessionContextStateResponse,
} from "@/types/cardbox";

interface UseSessionContextResult {
  sessionContext: SessionContextStateResponse | null;
  isLoading: boolean;
  isUpdating: boolean;
  refresh: () => Promise<SessionContextStateResponse | undefined>;
  setSessionBoxes: (
    boxIds: string[],
  ) => Promise<SessionContextSelectionResponse | undefined>;
  addSessionBoxes: (
    boxIds: string[],
  ) => Promise<SessionContextSelectionResponse | undefined>;
}

export const useSessionContext = (
  sessionId?: string | null,
): UseSessionContextResult => {
  const resolvedSessionId = sessionId ?? undefined;
  const queryClient = useQueryClient();
  const queryKey = cardboxKeys.sessionState(resolvedSessionId);

  const { data, isLoading, refetch } = useQuery<SessionContextStateResponse>({
    queryKey,
    queryFn: () => cardboxApi.getSessionContextState(resolvedSessionId ?? ""),
    enabled: Boolean(resolvedSessionId),
  });

  const canonicaliseModule = useCallback(
    (module: string | null | undefined) => {
      if (!module) return "";
      return module === "timelog" ? "actual_event" : module;
    },
    [],
  );

  const sessionContext = useMemo(() => {
    if (!data) {
      return null;
    }
    return {
      ...data,
      boxes: data.boxes.map((entry) => ({
        ...entry,
        box: {
          ...entry.box,
          module: canonicaliseModule(entry.box.module),
        },
      })),
    } as SessionContextStateResponse;
  }, [canonicaliseModule, data]);

  const mutation = useMutation({
    mutationFn: cardboxApi.setSessionContext,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, {
        session_id: response.session_id,
        boxes: response.boxes,
      });
      invalidateCardboxContextList(queryClient);
    },
  });

  const setSessionBoxes = useCallback(
    async (boxIds: string[]) => {
      if (!resolvedSessionId) {
        return undefined;
      }
      const response = await mutation.mutateAsync({
        session_id: resolvedSessionId,
        box_ids: boxIds,
      });
      return response;
    },
    [mutation, resolvedSessionId],
  );

  const addSessionBoxes = useCallback(
    async (boxIds: string[]) => {
      if (!resolvedSessionId) {
        return undefined;
      }
      const existingIds = (sessionContext?.boxes ?? []).map(
        (item) => item.box.box_id,
      );
      const seen = new Set<string>();
      const next: string[] = [];
      for (const id of existingIds) {
        if (!seen.has(id)) {
          seen.add(id);
          next.push(id);
        }
      }
      for (const id of boxIds) {
        if (!seen.has(id)) {
          seen.add(id);
          next.push(id);
        }
      }
      return await setSessionBoxes(next);
    },
    [sessionContext?.boxes, setSessionBoxes, resolvedSessionId],
  );

  const refresh = useCallback(async () => {
    if (!resolvedSessionId) {
      return undefined;
    }
    const result = await refetch();
    if (!result.data) {
      return undefined;
    }
    return {
      ...result.data,
      boxes: result.data.boxes.map((entry) => ({
        ...entry,
        box: {
          ...entry.box,
          module: canonicaliseModule(entry.box.module),
        },
      })),
    } as SessionContextStateResponse;
  }, [canonicaliseModule, refetch, resolvedSessionId]);

  return {
    sessionContext,
    isLoading,
    isUpdating: mutation.isPending,
    refresh,
    setSessionBoxes,
    addSessionBoxes,
  };
};
