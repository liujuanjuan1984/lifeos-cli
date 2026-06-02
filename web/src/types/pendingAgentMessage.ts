type PendingMessageState = "pending" | "failed" | "sent";

export interface PendingAgentMessage {
  id: string;
  sessionId: string | null;
  content: string;
  createdAt: string;
  deliveryState: PendingMessageState;
  agentName?: string | null;
  errorMessage?: string | null;
}
