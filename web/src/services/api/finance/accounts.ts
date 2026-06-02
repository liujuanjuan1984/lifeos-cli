import { http } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { UUID } from "@/types/primitive";

export interface FinanceAccountNode {
  id: UUID;
  tree_id: UUID;
  parent_id: UUID | null;
  name: string;
  path: string;
  depth: number;
  type: "asset" | "liability" | "equity" | "other";
  nature: string | null;
  currency_code: string;
  interest_rate: string | null;
  sort_order: number | null;
  metadata: Record<string, unknown> | null;
  latest_snapshot_id: UUID | null;
  latest_balance_raw: string | null;
  latest_balance_converted: string | null;
  children: FinanceAccountNode[];
}

export interface FinanceAccountTreeResponse {
  tree_id: UUID;
  accounts: FinanceAccountNode[];
  latest_snapshot_id: UUID | null;
  latest_snapshot_ts: string | null;
  primary_currency: string;
}

export interface FinanceAccountCreatePayload {
  name: string;
  parent_id?: UUID | null;
  tree_id?: UUID | null;
  type?: "asset" | "liability" | "equity" | "other";
  nature?: string | null;
  currency_code: string;
  interest_rate?: string;
  metadata?: Record<string, unknown> | null;
  sort_order?: number | null;
}

export interface FinanceAccountUpdatePayload {
  name?: string;
  parent_id?: UUID | null;
  type?: "asset" | "liability" | "equity" | "other";
  nature?: string | null;
  currency_code?: string;
  interest_rate?: string;
  metadata?: Record<string, unknown> | null;
  sort_order?: number | null;
}

export const getAccountTree = (params?: { tree_id?: UUID | null }) =>
  http.get<FinanceAccountTreeResponse>(
    ENDPOINTS.FINANCE.ACCOUNTS.TREE,
    params
      ? {
          ...params,
          tree_id: params.tree_id ?? undefined,
        }
      : undefined,
  );

export interface FinanceAccountTreeItem {
  id: UUID;
  name: string;
  is_default: boolean;
  display_order: number | null;
}

export interface FinanceAccountTreeCreatePayload {
  name: string;
  is_default?: boolean;
  display_order?: number | null;
}

export interface FinanceAccountTreeUpdatePayload {
  name?: string;
  is_default?: boolean;
  display_order?: number | null;
}

export const listAccountTrees = () =>
  http.get<FinanceAccountTreeItem[]>(ENDPOINTS.FINANCE.ACCOUNTS.TREES);

export const createAccountTree = (payload: FinanceAccountTreeCreatePayload) =>
  http.post<FinanceAccountTreeItem>(ENDPOINTS.FINANCE.ACCOUNTS.TREES, payload);

export const updateAccountTree = (
  id: UUID,
  payload: FinanceAccountTreeUpdatePayload,
) =>
  http.patch<FinanceAccountTreeItem>(
    ENDPOINTS.FINANCE.ACCOUNTS.TREE_BY_ID(id),
    payload,
  );

export const deleteAccountTree = (id: UUID) =>
  http.delete<void>(ENDPOINTS.FINANCE.ACCOUNTS.TREE_BY_ID(id));

export const createAccount = (payload: FinanceAccountCreatePayload) =>
  http.post<FinanceAccountNode>(ENDPOINTS.FINANCE.ACCOUNTS.BASE, payload);

export const updateAccount = (id: UUID, payload: FinanceAccountUpdatePayload) =>
  http.patch<FinanceAccountNode>(ENDPOINTS.FINANCE.ACCOUNTS.BY_ID(id), payload);

export const deleteAccount = (id: UUID) =>
  http.delete<void>(ENDPOINTS.FINANCE.ACCOUNTS.BY_ID(id));

export type FinanceAccount = FinanceAccountNode;
