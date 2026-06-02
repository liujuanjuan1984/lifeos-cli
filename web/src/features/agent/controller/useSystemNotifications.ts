import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  notificationsApi,
  notificationsKeys,
} from "@/services/api/notifications";
import { sessionKeys } from "@/services/api/session";
import type {
  MarkNotificationsReadRequest,
  SystemNotificationListResponse,
} from "@/types/notification";
import type { AgentSession } from "@/types/session";

interface UseSystemNotificationsOptions {
  sessionId?: string | null;
  enabled?: boolean;
  includeList?: boolean;
  listLimit?: number;
}

export const useSystemNotifications = (
  options: UseSystemNotificationsOptions = {},
) => {
  const {
    sessionId = null,
    enabled = true,
    includeList = false,
    listLimit = 100,
  } = options;
  const queryClient = useQueryClient();
  const resolvedSessionId = sessionId ?? null;
  const shouldLoadList =
    includeList && Boolean(resolvedSessionId) && enabled && listLimit > 0;

  type SessionScopedNotificationList = SystemNotificationListResponse & {
    sessionId: string | null;
  };

  const listQuery = useQuery<SessionScopedNotificationList>({
    queryKey: notificationsKeys.systemList(resolvedSessionId),
    queryFn: async () => {
      const list = await notificationsApi.listSystemNotifications(
        resolvedSessionId,
        { page: 1, size: listLimit },
      );
      return {
        ...list,
        sessionId: resolvedSessionId,
      };
    },
    enabled: shouldLoadList,
    placeholderData: (previous) =>
      previous?.sessionId === resolvedSessionId ? previous : undefined,
  });

  const updateSessionCaches = (
    targetSessionId: string | null,
    unreadCount: number,
  ) => {
    if (!targetSessionId) return;

    queryClient.setQueriesData(
      { queryKey: sessionKeys.lists() },
      (previous) => {
        if (!previous) return previous;
        if (
          typeof previous === "object" &&
          previous !== null &&
          "items" in previous &&
          Array.isArray((previous as { items: AgentSession[] }).items)
        ) {
          const current = previous as { items: AgentSession[] };
          return {
            ...current,
            items: current.items.map((session) =>
              session.id === targetSessionId
                ? {
                    ...session,
                    unreadCount,
                    unread_count: unreadCount,
                  }
                : session,
            ),
          };
        }
        return previous;
      },
    );

    queryClient.setQueryData<AgentSession | undefined>(
      sessionKeys.session(targetSessionId),
      (previous) =>
        previous
          ? {
              ...previous,
              unreadCount,
              unread_count: unreadCount,
            }
          : previous,
    );
  };

  const markNotificationsRead = useMutation({
    mutationFn: (payload: MarkNotificationsReadRequest) =>
      notificationsApi.markSystemNotificationsRead(payload),
    onSuccess: (data, variables) => {
      const targetSessionId = variables.sessionId ?? null;
      const readTimestamp = new Date().toISOString();

      if (targetSessionId) {
        queryClient.setQueryData<
          | (SystemNotificationListResponse & { sessionId?: string | null })
          | undefined
        >(notificationsKeys.systemList(targetSessionId), (previous) => {
          if (!previous) return previous;

          const shouldUpdateAll = Boolean(variables.markAll);
          const ids = new Set(variables.messageIds ?? []);

          const notifications = previous.items.map((item) => {
            if (!shouldUpdateAll && !ids.has(item.id)) {
              return item;
            }
            return {
              ...item,
              unread: false,
              readAt: item.readAt ?? readTimestamp,
            };
          });

          return {
            ...previous,
            items: notifications,
            meta: {
              ...previous.meta,
              unreadCount: data.unreadCount,
            },
            sessionId: targetSessionId,
          };
        });

        updateSessionCaches(targetSessionId, data.unreadCount);
      }
    },
  });

  return {
    systemNotifications: listQuery.data?.items ?? [],
    systemNotificationsQuery: listQuery,
    markNotificationsRead,
    isMarkingNotifications: markNotificationsRead.isPending,
  };
};
