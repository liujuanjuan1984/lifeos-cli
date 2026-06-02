import type { ListResponse } from "./pagination";

export interface SystemNotification {
  id: string;
  sessionId: string;
  title: string | null;
  body: string;
  severity: "info" | "warning" | "critical";
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  unread: boolean;
}

export interface SystemNotificationListMeta {
  unreadCount: number;
}

export type SystemNotificationListResponse = ListResponse<
  SystemNotification,
  SystemNotificationListMeta
>;

export interface SystemNotificationUnreadCountResponse {
  unreadCount: number;
}

export interface MarkNotificationsReadRequest {
  messageIds?: string[];
  markAll?: boolean;
  sessionId?: string | null;
}

export interface MarkNotificationsReadResponse {
  updated: number;
  unreadCount: number;
}
