import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ActionButton, { CreateNewButton } from "@/components/ActionButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import ErrorDisplay from "@/components/ErrorDisplay";
import { AccountTree } from "@/components/finance/AccountTree";
import FinanceAccountFormModal from "@/components/finance/FinanceAccountFormModal";
import { FinanceTreeSelector } from "@/components/finance/FinanceTreeSelector";
import LoadingSpinner from "@/components/LoadingSpinner";
import ModalBase from "@/layouts/ModalBase";
import type {
  FinanceAccount,
  FinanceAccountCreatePayload,
  FinanceAccountUpdatePayload,
} from "@/services/api/finance";
import type { UUID } from "@/types/primitive";
import { flattenTree } from "@/features/finance/shared";
import { useAccountTimeline } from "@/features/finance/balance/hooks/useAccountTimeline";

type AccountFormState =
  | { mode: "create"; parentId?: UUID | null }
  | { mode: "edit"; accountId: UUID };

const TIMELINE_FETCH_BATCH_SIZE = 5;

interface AccountManagerModalProps {
  open: boolean;
  onClose: () => void;
  accounts: FinanceAccount[];
  primaryCurrency: string;
  loading: boolean;
  error?: string | null;
  treeId: UUID | null;
  treeOptions: Array<{ value: UUID; label: string }>;
  onChangeTree: (id: UUID) => void;
  onManageTree: () => void;
  onCreateAccount: (payload: FinanceAccountCreatePayload) => Promise<void>;
  onUpdateAccount: (
    id: UUID,
    payload: FinanceAccountUpdatePayload,
  ) => Promise<void>;
  onDeleteAccount: (id: UUID) => Promise<void>;
  createPending: boolean;
  updatePending: boolean;
  deletePending: boolean;
}

export function AccountManagerModal({
  open,
  onClose,
  accounts,
  primaryCurrency,
  loading,
  error,
  treeId,
  treeOptions,
  onChangeTree,
  onManageTree,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  createPending,
  updatePending,
  deletePending,
}: AccountManagerModalProps) {
  const { t } = useTranslation();
  const [accountFormState, setAccountFormState] =
    useState<AccountFormState | null>(null);
  const [accountPendingDelete, setAccountPendingDelete] =
    useState<FinanceAccount | null>(null);
  const [timelineAccount, setTimelineAccount] = useState<{
    id: UUID;
    name: string;
  } | null>(null);
  const {
    entries: timelineEntries,
    loading: timelineLoading,
    error: timelineError,
    loadTimeline,
    resetTimeline,
  } = useAccountTimeline({
    batchSize: TIMELINE_FETCH_BATCH_SIZE,
    resolveErrorMessage: (err) =>
      err instanceof Error
        ? err.message
        : t("finance.accountTimelineLoadFailed"),
  });

  useEffect(() => {
    if (!open) {
      setAccountFormState(null);
      setAccountPendingDelete(null);
      setTimelineAccount(null);
      resetTimeline();
    }
  }, [open, resetTimeline]);

  const flattenedAccounts = useMemo(
    () => flattenTree(accounts ?? []),
    [accounts],
  );

  const accountMap = useMemo(() => {
    const map = new Map<string, FinanceAccount>();
    flattenedAccounts.forEach((account) => map.set(account.id, account));
    return map;
  }, [flattenedAccounts]);

  const excludedParentIds = useMemo(() => {
    if (accountFormState?.mode !== "edit") {
      return new Set<string>();
    }

    const targetId = accountFormState.accountId;
    const ids = new Set<string>([targetId]);

    const collectDescendants = (node: FinanceAccount) => {
      node.children?.forEach((child) => {
        ids.add(child.id);
        collectDescendants(child);
      });
    };

    const traverse = (nodes: FinanceAccount[]) => {
      nodes.forEach((node) => {
        if (node.id === targetId) {
          collectDescendants(node);
        } else if (node.children?.length) {
          traverse(node.children);
        }
      });
    };

    traverse(accounts ?? []);
    return ids;
  }, [accountFormState, accounts]);

  const parentAccountOptions = useMemo(() => {
    const buildAncestryNames = (account: FinanceAccount): string[] => {
      const names: string[] = [];
      let current: FinanceAccount | undefined = account;
      const visited = new Set<string>();

      while (current && !visited.has(current.id)) {
        names.push(current.name);
        visited.add(current.id);

        if (!current.parent_id) {
          break;
        }

        current = accountMap.get(current.parent_id);
      }

      return names.reverse();
    };

    return flattenedAccounts
      .filter((account) => !excludedParentIds.has(account.id))
      .map((account) => {
        const ancestry = buildAncestryNames(account);
        const currencyLabel = account.currency_code
          ? account.currency_code.toUpperCase()
          : null;

        const primaryLabel = ancestry.length
          ? ancestry.join(" / ")
          : account.name;

        const parts = [primaryLabel, currencyLabel].filter(Boolean);

        return {
          id: account.id,
          label: parts.join(" · "),
        };
      });
  }, [flattenedAccounts, excludedParentIds, accountMap]);

  const accountFormInitialValues = useMemo(() => {
    if (!accountFormState) {
      return null;
    }

    if (accountFormState.mode === "create") {
      if (accountFormState.parentId) {
        const parentAccount = accountMap.get(accountFormState.parentId);
        return {
          parent_id: accountFormState.parentId,
          currency_code: parentAccount?.currency_code ?? primaryCurrency,
        };
      }
      return {
        currency_code: primaryCurrency,
      };
    }

    const account = accountMap.get(accountFormState.accountId);
    if (!account) {
      return null;
    }

    return {
      name: account.name,
      parent_id: account.parent_id,
      currency_code: account.currency_code,
      interest_rate: account.interest_rate ?? undefined,
    };
  }, [accountFormState, accountMap, primaryCurrency]);

  const isAccountFormSubmitting =
    accountFormState?.mode === "edit" ? updatePending : createPending;

  const actionsDisabled = createPending || updatePending || deletePending;
  const handleViewTimeline = (account: FinanceAccount) => {
    setTimelineAccount({ id: account.id as UUID, name: account.name });
    void loadTimeline({ accountId: account.id as UUID, treeId });
  };

  const handleCloseTimeline = () => {
    setTimelineAccount(null);
    resetTimeline();
  };

  const handleCloseAccountForm = () => {
    if (isAccountFormSubmitting) {
      return;
    }
    setAccountFormState(null);
  };

  const handleAccountFormSubmit = async (
    payload: FinanceAccountCreatePayload,
  ) => {
    if (!accountFormState) {
      return;
    }

    if (accountFormState.mode === "edit") {
      const updatePayload: FinanceAccountUpdatePayload = {
        name: payload.name,
        parent_id: payload.parent_id,
        nature: payload.nature,
        currency_code: payload.currency_code,
        interest_rate: payload.interest_rate,
        metadata: payload.metadata,
        sort_order: payload.sort_order,
      };
      await onUpdateAccount(accountFormState.accountId, updatePayload);
      return;
    }

    await onCreateAccount(payload);
  };

  const handleConfirmDeleteAccount = () => {
    if (!accountPendingDelete || deletePending) {
      return;
    }
    const accountId = accountPendingDelete.id as UUID;
    setAccountPendingDelete(null);
    void onDeleteAccount(accountId);
  };

  return (
    <>
      <ModalBase
        isOpen={open}
        onClose={onClose}
        title={t("finance.accountTreeTitle")}
        size="xl"
      >
        {loading ? (
          <div className="py-10">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <ErrorDisplay error={error} />
        ) : (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-200 bg-base-200/40 px-4 py-2">
              <FinanceTreeSelector
                label={t("finance.accountTreeLabel")}
                options={treeOptions}
                value={treeId}
                onChange={onChangeTree}
                disabled={actionsDisabled}
                showManage={false}
              />
              <ActionButton
                label={t("finance.manageTrees")}
                onClick={onManageTree}
                size="sm"
                variant="outline"
                disabled={actionsDisabled}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-base-content/70">
                {t("finance.accountTreeHint")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <CreateNewButton
                  label={t("finance.createAccountButton")}
                  onClick={() => setAccountFormState({ mode: "create" })}
                  size="sm"
                  loading={createPending}
                  disabled={actionsDisabled}
                />
              </div>
            </div>
            <AccountTree
              accounts={accounts ?? []}
              onCreateChild={(account) =>
                setAccountFormState({ mode: "create", parentId: account.id })
              }
              onEdit={(account) =>
                setAccountFormState({ mode: "edit", accountId: account.id })
              }
              onDelete={(account) => {
                setAccountFormState(null);
                setAccountPendingDelete(account);
              }}
              onViewTimeline={handleViewTimeline}
              actionsDisabled={actionsDisabled}
            />
          </div>
        )}
      </ModalBase>

      <ModalBase
        isOpen={Boolean(timelineAccount)}
        onClose={handleCloseTimeline}
        title={
          timelineAccount
            ? t("finance.accountTimelineTitle", {
                name: timelineAccount.name,
              })
            : t("finance.accountTimelineTitleFallback")
        }
        size="lg"
      >
        {timelineLoading ? (
          <div className="py-10">
            <LoadingSpinner />
          </div>
        ) : timelineError ? (
          <ErrorDisplay error={timelineError} />
        ) : timelineEntries.length ? (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-base-200">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-base-200/70 text-xs uppercase text-base-content/70">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">
                    {t("finance.accountTimelineColumnTimestamp")}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {t("finance.accountTimelineColumnConverted")}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {t("finance.accountTimelineColumnRaw")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200">
                {timelineEntries.map((entry) => (
                  <tr key={entry.snapshotId} className="bg-base-100">
                    <td className="px-4 py-2 text-base-content/80">
                      {entry.displayTimestamp}
                    </td>
                    <td className="px-4 py-2 font-medium text-base-content">
                      {entry.convertedAmount} {entry.convertedCurrency}
                    </td>
                    <td className="px-4 py-2 text-base-content/80">
                      {entry.rawAmount} {entry.rawCurrency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-sm text-base-content/70">
            {t("finance.accountTimelineEmpty")}
          </p>
        )}
      </ModalBase>

      <FinanceAccountFormModal
        open={Boolean(accountFormState)}
        onClose={handleCloseAccountForm}
        onSubmit={handleAccountFormSubmit}
        submitting={isAccountFormSubmitting}
        parentOptions={parentAccountOptions}
        defaultCurrency={primaryCurrency}
        mode={accountFormState?.mode ?? "create"}
        initialValues={accountFormInitialValues}
      />

      <ConfirmDialog
        isOpen={Boolean(accountPendingDelete)}
        onConfirm={handleConfirmDeleteAccount}
        onCancel={() => {
          if (deletePending) {
            return;
          }
          setAccountPendingDelete(null);
        }}
        title={t("finance.deleteAccountTitle")}
        message={t("finance.deleteAccountWarning", {
          name: accountPendingDelete?.name ?? "",
        })}
        confirmText={t("finance.deleteAccountConfirm")}
        cancelText={t("common.cancel")}
      />
    </>
  );
}
