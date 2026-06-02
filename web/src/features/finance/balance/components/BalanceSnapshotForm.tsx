import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/contexts/ToastContext";
import { FinanceTreeSelector } from "@/components/finance/FinanceTreeSelector";
import type {
  BalanceSnapshotDetail,
  CreateSnapshotPayload,
  FinanceAccount,
} from "@/services/api/finance";
import type { UUID } from "@/types/primitive";
import SnapshotAccountTable from "./SnapshotAccountTable";
import {
  buildAccountTreeIndex,
  recalculateEntireTree,
  type AccountTreeIndex,
} from "@/features/finance/balance/utils/accountTree";
import {
  formatScaledDecimal,
  flattenTree,
  isNegativeDecimal,
  multiplyDecimalStrings,
  parseDecimalToScaled,
} from "@/features/finance/shared";
import { ExchangeRateInputGrid } from "@/features/finance/shared/components/ExchangeRateInputGrid";
import { TextArea, TextInput } from "@/components/forms";
import { utcToLocalDateTimeLocal } from "@/utils/datetime";

type AccountBalanceState = Record<string, string>;
type AccountNoteState = Record<string, string>;
type ExchangeRateState = Record<string, string>;

export const BALANCE_SNAPSHOT_FORM_ID = "finance-snapshot-form";

interface BalanceSnapshotFormProps {
  mode: "create" | "edit";
  primaryCurrency: string;
  treeId: UUID | null;
  treeName: string | null;
  treeOptions: Array<{ value: UUID; label: string }>;
  onChangeTree: (id: UUID) => void;
  treeSelectionDisabled: boolean;
  accountTree: FinanceAccount[];
  latestSnapshotDetail?: BalanceSnapshotDetail | null;
  editingSnapshotDetail?: BalanceSnapshotDetail | null;
  editingSnapshotId?: UUID | null;
  submitting: boolean;
  snapshotTimestamp: string | null;
  onChangeSnapshotTimestamp: (value: string | null) => void;
  onCreateSnapshot: (payload: CreateSnapshotPayload) => Promise<void> | void;
  onUpdateSnapshot: (
    id: UUID,
    payload: CreateSnapshotPayload,
  ) => Promise<void> | void;
  headerActions?: ReactNode;
}

export function BalanceSnapshotForm({
  mode,
  primaryCurrency,
  treeId,
  treeName,
  treeOptions,
  onChangeTree,
  treeSelectionDisabled,
  accountTree,
  latestSnapshotDetail,
  editingSnapshotDetail,
  editingSnapshotId,
  submitting,
  snapshotTimestamp,
  onChangeSnapshotTimestamp,
  onCreateSnapshot,
  onUpdateSnapshot,
  headerActions,
}: BalanceSnapshotFormProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const flattenedAccounts = useMemo(
    () => flattenTree(accountTree ?? []),
    [accountTree],
  );

  const accountIndex = useMemo(
    () => buildAccountTreeIndex(accountTree ?? []),
    [accountTree],
  );

  const accountMap = useMemo(() => {
    const map = new Map<string, FinanceAccount>();
    flattenedAccounts.forEach((account) => map.set(account.id, account));
    return map;
  }, [flattenedAccounts]);

  const [balances, setBalances] = useState<AccountBalanceState>({});
  const [accountNotes, setAccountNotes] = useState<AccountNoteState>({});
  const [snapshotNote, setSnapshotNote] = useState("");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateState>({});

  const resetFormState = useCallback(() => {
    setBalances({});
    setAccountNotes({});
    setSnapshotNote("");
    setExchangeRates({});
  }, []);

  const applySnapshotDetailToForm = useCallback(
    (detail?: BalanceSnapshotDetail | null) => {
      if (!detail) {
        resetFormState();
        return;
      }

      const nextBalances: AccountBalanceState = {};
      const nextNotes: AccountNoteState = {};
      detail.accounts.forEach((account) => {
        if (account.note) {
          nextNotes[account.account_id] = account.note;
        }
        if (accountIndex.leafIds.has(account.account_id)) {
          nextBalances[account.account_id] = account.balance_raw ?? "";
        }
      });

      const nextRates: ExchangeRateState = {};
      detail.exchange_rates.forEach((rate) => {
        nextRates[rate.quote_currency] = rate.rate ?? "";
      });

      setBalances(nextBalances);
      setAccountNotes(nextNotes);
      setSnapshotNote(detail.note ?? "");
      setExchangeRates(nextRates);
    },
    [resetFormState, accountIndex],
  );

  useEffect(() => {
    if (mode === "edit") {
      applySnapshotDetailToForm(editingSnapshotDetail);
      return;
    }

    if (latestSnapshotDetail) {
      applySnapshotDetailToForm(latestSnapshotDetail);
    } else {
      resetFormState();
    }
  }, [
    mode,
    latestSnapshotDetail,
    editingSnapshotDetail,
    applySnapshotDetailToForm,
    resetFormState,
  ]);

  useEffect(() => {
    const requiredCurrencies = new Set<string>();
    flattenedAccounts.forEach((account) => {
      if (account.currency_code !== primaryCurrency) {
        requiredCurrencies.add(account.currency_code);
      }
    });

    setExchangeRates((prev) => {
      const next: ExchangeRateState = {};
      requiredCurrencies.forEach((code) => {
        next[code] = prev[code] ?? "";
      });
      return next;
    });
  }, [flattenedAccounts, primaryCurrency]);

  useEffect(() => {
    if (mode === "create" && !snapshotTimestamp) {
      onChangeSnapshotTimestamp(new Date().toISOString());
    }
  }, [mode, onChangeSnapshotTimestamp, snapshotTimestamp]);

  useEffect(() => {
    if (
      mode === "edit" &&
      editingSnapshotDetail?.snapshot_ts &&
      editingSnapshotDetail.snapshot_ts !== snapshotTimestamp
    ) {
      onChangeSnapshotTimestamp(editingSnapshotDetail.snapshot_ts);
    }
  }, [
    mode,
    editingSnapshotDetail?.snapshot_ts,
    onChangeSnapshotTimestamp,
    snapshotTimestamp,
  ]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!flattenedAccounts.length) {
      toast.showError(t("common.error"), t("finance.noAccounts"));
      return;
    }

    if (!snapshotTimestamp) {
      toast.showError(t("common.error"), t("finance.snapshotTimeRequired"));
      return;
    }

    const parsedSnapshot = new Date(snapshotTimestamp);
    if (Number.isNaN(parsedSnapshot.getTime())) {
      toast.showError(t("common.error"), t("finance.snapshotTimeRequired"));
      return;
    }

    if (parsedSnapshot.getTime() > Date.now()) {
      toast.showError(t("common.error"), t("finance.snapshotTimeFutureError"));
      return;
    }

    const invalidAccounts: string[] = [];
    const accountsPayload = flattenedAccounts
      .filter((account) => !account.children?.length)
      .map((account) => {
        const balance = balances[account.id];
        if (typeof balance !== "string" || balance.trim() === "") {
          return null;
        }
        const normalized = balance.trim();
        if (parseDecimalToScaled(normalized) === null) {
          invalidAccounts.push(account.name);
          return null;
        }
        return {
          id: account.id,
          balance: normalized,
          note: accountNotes[account.id]?.trim() || undefined,
        };
      })
      .filter(Boolean) as CreateSnapshotPayload["accounts"];

    if (invalidAccounts.length) {
      toast.showError(
        t("common.error"),
        t("finance.invalidAmountFormat", {
          names: invalidAccounts.join(", "),
        }),
      );
      return;
    }

    if (!accountsPayload.length) {
      toast.showInfo(t("finance.noBalanceEntered"), t("finance.snapshotHint"));
      return;
    }

    const missingRates = new Set<string>();
    accountsPayload.forEach((entry) => {
      const account = accountMap.get(entry.id);
      if (!account) return;
      if (account.currency_code !== primaryCurrency) {
        const rate = exchangeRates[account.currency_code];
        if (!rate || rate.trim() === "") {
          missingRates.add(account.currency_code);
        }
      }
    });

    if (missingRates.size) {
      toast.showError(
        t("common.error"),
        t("finance.missingRates", {
          currencies: Array.from(missingRates).join(", "),
        }),
      );
      return;
    }

    const exchangeRatesPayload = Object.entries(exchangeRates)
      .filter(([, value]) => value && value.trim() !== "")
      .map(([quote_currency, rate]) => ({ quote_currency, rate: rate.trim() }));

    const payload: CreateSnapshotPayload = {
      primary_currency: primaryCurrency,
      accounts: accountsPayload,
      exchange_rates: exchangeRatesPayload,
      note: snapshotNote.trim() || undefined,
      snapshot_ts: snapshotTimestamp,
    };

    if (mode === "edit" && editingSnapshotId) {
      onUpdateSnapshot(editingSnapshotId, payload);
      return;
    }

    onCreateSnapshot(payload);
  };

  const snapshotTitle =
    mode === "edit"
      ? t("finance.editSnapshotTitle")
      : t("finance.newSnapshotTitle");

  return (
    <section className="rounded-2xl border border-base-200 bg-base-100 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-base-200 bg-base-200/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-base-content">
            {snapshotTitle}
          </h2>
          <p className="text-xs text-base-content/60 sm:text-sm">
            {t("finance.snapshotInlineHint")}
          </p>
        </div>
        {headerActions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {headerActions}
          </div>
        ) : null}
      </div>

      <div className="px-4 py-4 sm:px-6">
        <div className="mb-4">
          {treeSelectionDisabled ? (
            <div className="rounded-lg border border-base-200 bg-base-200/40 px-4 py-2">
              <p className="text-xs text-base-content/60">
                {t("finance.accountTreeLabel")}
              </p>
              <p className="text-sm font-semibold text-base-content">
                {treeName || "—"}
              </p>
            </div>
          ) : (
            <FinanceTreeSelector
              label={t("finance.accountTreeLabel")}
              options={treeOptions}
              value={treeId}
              onChange={onChangeTree}
              disabled={submitting}
              showManage={false}
            />
          )}
        </div>
        <SnapshotForm
          formId={BALANCE_SNAPSHOT_FORM_ID}
          accountTree={accountTree}
          accountIndex={accountIndex}
          balances={balances}
          onChangeBalance={(id, value) =>
            setBalances((prev) => ({
              ...prev,
              [id]: value,
            }))
          }
          accountNotes={accountNotes}
          onChangeNote={(id, value) =>
            setAccountNotes((prev) => ({ ...prev, [id]: value }))
          }
          primaryCurrency={primaryCurrency}
          exchangeRates={exchangeRates}
          onChangeExchangeRate={(code, value) =>
            setExchangeRates((prev) => ({ ...prev, [code]: value }))
          }
          snapshotNote={snapshotNote}
          onChangeSnapshotNote={setSnapshotNote}
          snapshotTimestamp={snapshotTimestamp}
          onChangeSnapshotTimestamp={onChangeSnapshotTimestamp}
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  );
}

interface SnapshotFormProps {
  formId: string;
  accountTree: FinanceAccount[];
  accountIndex: AccountTreeIndex;
  balances: AccountBalanceState;
  onChangeBalance: (id: string, value: string) => void;
  accountNotes: AccountNoteState;
  onChangeNote: (id: string, value: string) => void;
  primaryCurrency: string;
  exchangeRates: ExchangeRateState;
  onChangeExchangeRate: (code: string, value: string) => void;
  snapshotNote: string;
  onChangeSnapshotNote: (value: string) => void;
  snapshotTimestamp: string | null;
  onChangeSnapshotTimestamp: (value: string | null) => void;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function SnapshotForm({
  formId,
  accountTree,
  accountIndex,
  balances,
  onChangeBalance,
  accountNotes,
  onChangeNote,
  primaryCurrency,
  exchangeRates,
  onChangeExchangeRate,
  snapshotNote,
  onChangeSnapshotNote,
  snapshotTimestamp,
  onChangeSnapshotTimestamp,
  submitting,
  onSubmit,
}: SnapshotFormProps) {
  const { t } = useTranslation();
  const nonPrimaryCurrencies = Object.keys(exchangeRates);
  const snapshotTimestampLocal = snapshotTimestamp
    ? utcToLocalDateTimeLocal(snapshotTimestamp)
    : "";
  const currentLocalMax = utcToLocalDateTimeLocal(new Date().toISOString());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    includeAccountIds(accountTree, initial);
    return initial;
  });

  useEffect(() => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      includeAccountIds(accountTree, next);
      return next;
    });
  }, [accountTree]);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasAccounts = accountTree.length > 0;
  const columns = useMemo(
    () => [
      {
        key: "account",
        header: t("finance.tableAccount"),
        className: "w-[40%] min-w-[12rem]",
      },
      {
        key: "currency",
        header: t("finance.tableOriginalCurrency"),
        className: "w-20 text-center",
      },
      {
        key: "amount",
        header: t("finance.tableOriginalAmount"),
        className: "min-w-[10rem]",
      },
      {
        key: "converted",
        header: t("finance.tableConvertedAmount", {
          currency: primaryCurrency,
        }),
        className: "min-w-[10rem]",
      },
      {
        key: "note",
        header: t("finance.tableNote"),
        className: "min-w-[10rem]",
      },
    ],
    [primaryCurrency, t],
  );

  const rawLeafBalances = useMemo(() => {
    const result: Record<string, string> = {};
    accountIndex.leafIds.forEach((id) => {
      const rawValue = balances[id];
      if (typeof rawValue !== "string") {
        return;
      }
      const normalized = rawValue.trim();
      if (!normalized) {
        return;
      }
      const scaled = parseDecimalToScaled(normalized);
      if (scaled === null) {
        return;
      }
      result[id] = formatScaledDecimal(scaled);
    });
    return result;
  }, [accountIndex, balances]);

  const convertedLeafBalances = useMemo(() => {
    const result: Record<string, string> = {};
    accountIndex.leafIds.forEach((id) => {
      const rawValue = balances[id];
      if (typeof rawValue !== "string") {
        return;
      }
      const normalized = rawValue.trim();
      if (!normalized) {
        return;
      }

      const account = accountIndex.nodeMap.get(id);
      if (!account) {
        return;
      }

      if (account.currency_code === primaryCurrency) {
        const scaled = parseDecimalToScaled(normalized);
        if (scaled === null) {
          return;
        }
        result[id] = formatScaledDecimal(scaled);
        return;
      }

      const rate = exchangeRates[account.currency_code];
      const converted = multiplyDecimalStrings(normalized, rate);
      if (converted) {
        result[id] = converted;
      }
    });
    return result;
  }, [accountIndex, balances, exchangeRates, primaryCurrency]);

  const rawAggregatedBalances = useMemo(
    () => recalculateEntireTree(rawLeafBalances, accountIndex),
    [rawLeafBalances, accountIndex],
  );

  const convertedBalances = useMemo(
    () => recalculateEntireTree(convertedLeafBalances, accountIndex),
    [convertedLeafBalances, accountIndex],
  );

  const renderCells = useCallback(
    ({
      node,
      hasChildren,
    }: {
      node: FinanceAccount;
      depth: number;
      hasChildren: boolean;
      isExpanded: boolean;
    }) => {
      const isLeaf = !hasChildren;
      const balanceValue = balances[node.id] ?? "";
      const noteValue = accountNotes[node.id] ?? "";
      const convertedValue = convertedBalances[node.id] ?? "";
      const convertedNegative = isNegativeDecimal(convertedValue);
      const rawAggregated = rawAggregatedBalances[node.id];

      const currencyContent = (
        <span className="inline-flex min-w-[3rem] justify-center rounded-full bg-base-200 px-2 py-0.5 text-xs font-medium text-base-content/80">
          {node.currency_code?.toUpperCase() ?? "—"}
        </span>
      );

      const amountContent = isLeaf ? (
        <TextInput
          type="text"
          inputMode="decimal"
          pattern="-?[0-9]*[.,]?[0-9]*"
          size="sm"
          className={[
            isNegativeDecimal(balanceValue)
              ? "text-error"
              : "text-base-content",
          ]
            .filter(Boolean)
            .join(" ")}
          value={balanceValue}
          onChange={(event) => onChangeBalance(node.id, event.target.value)}
          placeholder={t("finance.balancePlaceholder")}
          disabled={submitting}
        />
      ) : (
        <div
          className={[
            "min-h-[2.25rem] rounded-md border border-dashed border-base-200 px-3 py-2 text-sm",
            isNegativeDecimal(rawAggregated)
              ? "text-error"
              : "text-base-content/80",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {rawAggregated
            ? rawAggregated
            : t("finance.autoAggregatedPlaceholder")}
        </div>
      );

      const convertedContent = convertedValue ? (
        <span
          className={[
            "inline-flex min-h-[2.25rem] items-center rounded-md border border-dashed border-base-200 px-3 text-sm",
            convertedNegative ? "text-error" : "text-base-content/80",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {convertedValue} {primaryCurrency}
        </span>
      ) : (
        <span className="inline-flex min-h-[2.25rem] items-center rounded-md border border-dashed border-base-200 px-3 text-sm text-base-content/40">
          —
        </span>
      );

      const noteContent = (
        <TextInput
          type="text"
          size="sm"
          value={noteValue}
          onChange={(event) => onChangeNote(node.id, event.target.value)}
          placeholder={t("finance.notePlaceholder")}
          disabled={submitting}
        />
      );

      return [
        {
          key: `${node.id}-currency`,
          content: currencyContent,
          className: "text-center",
        },
        {
          key: `${node.id}-amount`,
          content: amountContent,
        },
        {
          key: `${node.id}-converted`,
          content: convertedContent,
        },
        {
          key: `${node.id}-note`,
          content: noteContent,
        },
      ];
    },
    [
      accountNotes,
      balances,
      rawAggregatedBalances,
      convertedBalances,
      onChangeBalance,
      onChangeNote,
      primaryCurrency,
      submitting,
      t,
    ],
  );

  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-lg border border-base-200">
        <div className="border-b border-base-200 bg-base-200/40 px-4 py-2 text-sm font-semibold text-base-content">
          {t("finance.newSnapshotTableTitle")}
        </div>
        {hasAccounts ? (
          <div className="p-3 pb-4">
            <SnapshotAccountTable
              columns={columns}
              accountTree={accountTree}
              expanded={expandedNodes}
              onToggle={toggleNode}
              renderCells={renderCells}
              t={t}
            />
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-base-content/60">
            {t("finance.noAccounts")}
          </div>
        )}
      </div>

      <ExchangeRateInputGrid
        primaryCurrency={primaryCurrency}
        currencies={nonPrimaryCurrencies}
        rates={exchangeRates}
        onChange={onChangeExchangeRate}
        disabled={submitting}
      />

      <div>
        <label
          className="text-sm font-medium text-base-content"
          htmlFor="snapshot-timestamp"
        >
          {t("finance.snapshotTimeLabel")}
        </label>
        <TextInput
          id="snapshot-timestamp"
          type="datetime-local"
          size="sm"
          className="mt-1 sm:max-w-xs"
          value={snapshotTimestampLocal}
          max={currentLocalMax}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) {
              onChangeSnapshotTimestamp(null);
              return;
            }
            const nextIso = new Date(value).toISOString();
            onChangeSnapshotTimestamp(nextIso);
          }}
          disabled={submitting}
          required
        />
        <p className="mt-1 text-xs text-base-content/60 sm:text-sm">
          {t("finance.snapshotTimeHelper")}
        </p>
      </div>

      <div>
        <label
          className="text-sm font-medium text-base-content"
          htmlFor="snapshot-note"
        >
          {t("finance.snapshotNoteLabel")}
        </label>
        <TextArea
          id="snapshot-note"
          className="mt-1"
          value={snapshotNote}
          onChange={(event) => onChangeSnapshotNote(event.target.value)}
          placeholder={t("finance.snapshotNotePlaceholder")}
          rows={3}
          disabled={submitting}
        />
      </div>
    </form>
  );
}

function includeAccountIds(nodes: FinanceAccount[], target: Set<string>): void {
  nodes.forEach((node) => {
    target.add(node.id);
    if (node.children?.length) {
      includeAccountIds(node.children, target);
    }
  });
}
