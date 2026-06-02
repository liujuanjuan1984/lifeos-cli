export * from "./accounts";
export * from "./balanceSnapshots";
export * from "./cashflow";
export * from "./trading";

import type { UUID } from "@/types/primitive";
import {
  createAccount,
  createAccountTree,
  deleteAccount,
  deleteAccountTree,
  getAccountTree,
  listAccountTrees,
  updateAccountTree,
  updateAccount,
  type FinanceAccountCreatePayload,
  type FinanceAccountUpdatePayload,
  type FinanceAccountTreeCreatePayload,
  type FinanceAccountTreeUpdatePayload,
  type FinanceAccountTreeItem,
} from "./accounts";
import {
  createBalanceSnapshot,
  deleteBalanceSnapshot,
  getBalanceSnapshotDetail,
  getLatestExchangeRates,
  listBalanceSnapshots,
  updateBalanceSnapshot,
  compareBalanceSnapshots,
  type CreateSnapshotPayload,
  type UpdateSnapshotPayload,
} from "./balanceSnapshots";
import {
  createCashflowSnapshot,
  updateCashflowSnapshot,
  deleteCashflowSnapshot,
  createCashflowSource,
  createCashflowTree,
  deleteCashflowSource,
  deleteCashflowTree,
  getCashflowSnapshotDetail,
  getCashflowSources,
  listCashflowSnapshots,
  listCashflowTrees,
  updateCashflowSource,
  updateCashflowTree,
  compareCashflowSnapshots,
  applyBillingCycles,
  listBillingMonths,
  getBillingCycleHistory,
  getBillingCycleHistoryBulk,
  upsertBillingCycleEntries,
  type CashflowSnapshotCreatePayload,
  type CashflowSnapshotUpdatePayload,
  type CashflowSourceTreeCreatePayload,
  type CashflowSourceTreeUpdatePayload,
  type CashflowSourceTreeItem,
  type BillingCycleHistoryResponse,
  type BillingCycleHistoryBulkResponse,
  type BillingMonthListResponse,
} from "./cashflow";
import { tradingApi } from "./trading";

export const financeApi = {
  getAccountTree,
  createAccount,
  updateAccount,
  deleteAccount,
  listAccountTrees,
  createAccountTree,
  updateAccountTree,
  deleteAccountTree,
  listSnapshots: listBalanceSnapshots,
  createSnapshot: createBalanceSnapshot,
  updateSnapshot: (id: UUID, payload: UpdateSnapshotPayload) =>
    updateBalanceSnapshot(id, payload),
  deleteSnapshot: deleteBalanceSnapshot,
  getSnapshotDetail: getBalanceSnapshotDetail,
  compareSnapshots: compareBalanceSnapshots,
  getLatestExchangeRates,
  getCashflowSources,
  createCashflowSource,
  updateCashflowSource,
  deleteCashflowSource,
  listCashflowTrees,
  createCashflowTree,
  updateCashflowTree,
  deleteCashflowTree,
  listCashflowSnapshots,
  createCashflowSnapshot,
  updateCashflowSnapshot,
  deleteCashflowSnapshot,
  getCashflowSnapshotDetail,
  compareCashflowSnapshots,
  applyBillingCycles,
  listBillingMonths,
  getBillingCycleHistory,
  getBillingCycleHistoryBulk,
  upsertBillingCycleEntries,
};

export const financeTradingApi = tradingApi;

export type { FinanceAccountCreatePayload, FinanceAccountUpdatePayload };
export type {
  FinanceAccountTreeCreatePayload,
  FinanceAccountTreeUpdatePayload,
  FinanceAccountTreeItem,
};
export type { CreateSnapshotPayload, UpdateSnapshotPayload };
export type { CashflowSnapshotCreatePayload, CashflowSnapshotUpdatePayload };
export type {
  CashflowSourceTreeCreatePayload,
  CashflowSourceTreeUpdatePayload,
  CashflowSourceTreeItem,
};
export type {
  BillingCycleHistoryResponse,
  BillingCycleHistoryBulkResponse,
  BillingMonthListResponse,
};
