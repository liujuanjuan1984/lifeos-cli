import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { ListResponse } from "@/types/pagination";

export interface LlmCredentialDto {
  id: string;
  provider: string;
  display_name?: string | null;
  api_base?: string | null;
  model_override?: string | null;
  token_last4?: string | null;
  is_default: boolean;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LlmCredentialListMeta {
  provider?: string | null;
}

export type LlmCredentialListResponse = ListResponse<
  LlmCredentialDto,
  LlmCredentialListMeta
>;

export interface LlmCredentialPayload {
  provider: string;
  display_name?: string | null;
  api_key: string;
  api_base?: string | null;
  model_override?: string | null;
  make_default?: boolean;
}

export interface LlmCredentialTestRequest {
  provider: string;
  api_key: string;
  api_base?: string | null;
  model_override?: string | null;
}

export interface LlmCredentialTestResponse {
  success: boolean;
  message: string;
}

export interface LlmCredentialUpdatePayload {
  provider?: string;
  display_name?: string | null;
  api_key?: string | null;
  api_base?: string | null;
  model_override?: string | null;
  make_default?: boolean;
}

export const llmCredentialApi = {
  async list(params?: {
    page?: number;
    size?: number;
  }): Promise<LlmCredentialListResponse> {
    return await http.get<LlmCredentialListResponse>(
      ENDPOINTS.LLM_CREDENTIALS.BASE,
      {
        page: params?.page,
        size: params?.size,
      },
    );
  },
  async create(payload: LlmCredentialPayload): Promise<LlmCredentialDto> {
    return await http.post<LlmCredentialDto>(
      ENDPOINTS.LLM_CREDENTIALS.BASE,
      payload,
    );
  },
  async update(
    id: string,
    payload: LlmCredentialUpdatePayload,
  ): Promise<LlmCredentialDto> {
    return await http.put<LlmCredentialDto>(
      ENDPOINTS.LLM_CREDENTIALS.BY_ID(id),
      payload,
    );
  },
  async test(
    payload: LlmCredentialTestRequest,
  ): Promise<LlmCredentialTestResponse> {
    return await http.post<LlmCredentialTestResponse>(
      ENDPOINTS.LLM_CREDENTIALS.TEST,
      payload,
    );
  },
  async setDefault(id: string): Promise<LlmCredentialDto> {
    return await http.post<LlmCredentialDto>(
      ENDPOINTS.LLM_CREDENTIALS.DEFAULT(id),
      {},
    );
  },
  async remove(id: string): Promise<void> {
    await http.delete<void>(ENDPOINTS.LLM_CREDENTIALS.BY_ID(id));
  },
};

export type { LlmCredentialDto as LlmCredential };
