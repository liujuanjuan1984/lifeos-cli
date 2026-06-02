import type { QueryClient } from "@tanstack/react-query";

import { cardboxKeys } from "@/services/api/cardbox";

export const invalidateCardboxContextList = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: cardboxKeys.contextList(),
    exact: true,
  });

export const invalidateCardboxSessionState = (
  queryClient: QueryClient,
  sessionId?: string | null,
) =>
  queryClient.invalidateQueries({
    queryKey: cardboxKeys.sessionState(sessionId),
    exact: true,
  });
