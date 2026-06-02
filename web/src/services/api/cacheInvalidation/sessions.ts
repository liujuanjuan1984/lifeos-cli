import type { QueryClient } from "@tanstack/react-query";

import { agentMessageKeys } from "@/services/api/agentMessage";
import { sessionKeys } from "@/services/api/session";

export const invalidateSessionLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: sessionKeys.lists(),
  });

export const invalidateSessionDetail = (
  queryClient: QueryClient,
  sessionId: string,
) =>
  queryClient.invalidateQueries({
    queryKey: sessionKeys.session(sessionId),
    exact: true,
  });

export const invalidateSessionHistory = (
  queryClient: QueryClient,
  sessionId: string | null,
) =>
  queryClient.invalidateQueries({
    queryKey: agentMessageKeys.sessionHistory(sessionId),
    exact: true,
  });
