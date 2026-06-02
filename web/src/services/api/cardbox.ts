import type {
  ContextBoxCreateRequest,
  ContextBoxCreateResponse,
  ContextBoxListResponse,
  ContextBoxPreviewResponse,
  SessionContextSelectionRequest,
  SessionContextSelectionResponse,
  SessionContextStateResponse,
} from "@/types/cardbox";
import { http } from "./client";
import { ENDPOINTS } from "./endpoints";

export const cardboxApi = {
  listContextBoxes: async () => {
    const res = await http.get<ContextBoxListResponse>(
      ENDPOINTS.CARDBOX.CONTEXT_LIST,
    );
    return res.items;
  },
  createContextBox: async (payload: ContextBoxCreateRequest) => {
    return await http.post<ContextBoxCreateResponse>(
      ENDPOINTS.CARDBOX.CONTEXT_CREATE,
      payload,
    );
  },
  deleteContextBox: async (boxId: string) => {
    await http.delete(ENDPOINTS.CARDBOX.CONTEXT_BY_ID(boxId));
  },
  previewContextBox: async (
    boxId: string,
    params: { page?: number; size?: number } = {},
  ) => {
    return await http.get<ContextBoxPreviewResponse>(
      ENDPOINTS.CARDBOX.CONTEXT_ITEMS_BY_ID(boxId),
      params,
    );
  },
  setSessionContext: async (payload: SessionContextSelectionRequest) => {
    return await http.post<SessionContextSelectionResponse>(
      ENDPOINTS.AGENTS.CONTEXT_SESSION,
      payload,
    );
  },
  getSessionContextState: async (sessionId: string) => {
    return await http.get<SessionContextStateResponse>(
      ENDPOINTS.AGENTS.CONTEXT_SESSION_STATE,
      { session_id: sessionId },
    );
  },
};

export const cardboxKeys = {
  all: ["cardbox"] as const,
  contextList: () => [...cardboxKeys.all, "contextList"] as const,
  preview: (boxId: string) => [...cardboxKeys.all, "preview", boxId] as const,
  sessionState: (sessionId?: string | null) =>
    [...cardboxKeys.all, "sessionState", sessionId] as const,
};
