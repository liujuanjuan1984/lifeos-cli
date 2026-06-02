import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type {
  MarkNotificationsReadRequest,
  MarkNotificationsReadResponse,
  SystemNotification,
  SystemNotificationListResponse,
  SystemNotificationUnreadCountResponse,
} from "@/types/notification";
import type { ListResponse } from "@/types/pagination";

type NotificationApiItem = {
  id: string;
  session_id: string;
  title: string | null;
  body: string;
  severity: "info" | "warning" | "critical";
  metadata: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  unread: boolean;
};

type NotificationListMetaApi = {
  unread_count: number;
};

type ListResponseApi = ListResponse<
  NotificationApiItem,
  NotificationListMetaApi
>;

type CountResponseApi = {
  unread_count: number;
};

type MarkReadResponseApi = {
  updated: number;
  unread_count: number;
};

const mapNotification = (
  item: ListResponseApi["items"][number],
): SystemNotification => ({
  id: item.id,
  sessionId: item.session_id,
  title: item.title,
  body: item.body,
  severity: item.severity,
  metadata: item.metadata ?? {},
  createdAt: item.created_at,
  readAt: item.read_at,
  unread: Boolean(item.unread),
});

const mapListResponse = (
  payload: ListResponseApi,
): SystemNotificationListResponse => ({
  items: payload.items.map(mapNotification),
  pagination: payload.pagination,
  meta: {
    unreadCount: payload.meta.unread_count,
  },
});

const mapCountResponse = (
  payload: CountResponseApi,
): SystemNotificationUnreadCountResponse => ({
  unreadCount: payload.unread_count,
});

const mapMarkReadResponse = (
  payload: MarkReadResponseApi,
): MarkNotificationsReadResponse => ({
  updated: payload.updated,
  unreadCount: payload.unread_count,
});

export const notificationsApi = {
  listSystemNotifications: async (
    sessionId?: string | null,
    params?: { page?: number; size?: number },
  ): Promise<SystemNotificationListResponse> => {
    const response = await http.get<ListResponseApi>(
      ENDPOINTS.NOTIFICATIONS.SYSTEM,
      {
        session_id: sessionId ?? undefined,
        page: params?.page,
        size: params?.size,
      },
    );
    return mapListResponse(response);
  },
  getSystemUnreadCount: async (
    sessionId?: string | null,
  ): Promise<SystemNotificationUnreadCountResponse> => {
    const response = await http.get<CountResponseApi>(
      ENDPOINTS.NOTIFICATIONS.SYSTEM_UNREAD_COUNT,
      {
        session_id: sessionId ?? undefined,
      },
    );
    return mapCountResponse(response);
  },
  markSystemNotificationsRead: async (
    payload: MarkNotificationsReadRequest,
  ): Promise<MarkNotificationsReadResponse> => {
    const response = await http.post<MarkReadResponseApi>(
      ENDPOINTS.NOTIFICATIONS.SYSTEM_MARK_READ,
      {
        message_ids: payload.messageIds,
        mark_all: payload.markAll ?? false,
        session_id: payload.sessionId ?? undefined,
      },
    );
    return mapMarkReadResponse(response);
  },
};

export const notificationsKeys = {
  all: ["notifications"] as const,
  system: () => [...notificationsKeys.all, "system"] as const,
  systemList: (sessionId: string | null | undefined) =>
    [...notificationsKeys.system(), "list", sessionId ?? "default"] as const,
  systemUnreadCount: (sessionId: string | null | undefined) =>
    [
      ...notificationsKeys.system(),
      "unread-count",
      sessionId ?? "default",
    ] as const,
};
