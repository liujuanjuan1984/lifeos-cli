import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ActionButton from "@/components/ActionButton";
import { FormField, TextArea, TextInput } from "@/components/forms";
import EnumSelect from "@/components/selects/EnumSelect";
import { useToast } from "@/contexts/ToastContext";
import type {
  FinanceAsset,
  FinanceRateSnapshot,
  FinanceSnapshot,
  FinanceSnapshotEntryCreate,
  FinanceTree,
} from "@/services/api/finance";
import type { UUID } from "@/types/primitive";

import {
  dateToEndIso,
  dateToStartIso,
  assetDecimalPlaces,
  flattenTree,
  formatAmountForAsset,
  formatMoney,
  formatNumberForAsset,
  isoToDateInput,
  isoToDateTimeLocal,
  localDateTimeToIso,
  nowDateTimeLocal,
  rateSnapshotLabel,
  todayDate,
  type PresetConfig,
  type SnapshotAmountState,
  type SnapshotNoteState,
  type TreeNodeWithChildren,
} from "./utils";

export function SnapshotFormPanel({
  tree,
  preset,
  assets,
  treeOptions,
  selectedTreeId,
  onSelectTree,
  treeNodes,
  rateSnapshots,
  requiredRateCurrencies,
  submitting,
  mode,
  initialSnapshot,
  onSubmit,
  onCancel,
}: {
  tree: FinanceTree;
  preset: PresetConfig;
  assets: FinanceAsset[];
  treeOptions: FinanceTree[];
  selectedTreeId: UUID | null;
  onSelectTree: (treeId: UUID) => void;
  treeNodes: TreeNodeWithChildren[];
  rateSnapshots: FinanceRateSnapshot[];
  requiredRateCurrencies: string[];
  submitting: boolean;
  mode: "create" | "edit";
  initialSnapshot?: FinanceSnapshot | null;
  onSubmit: (payload: {
    title?: string | null;
    snapshot_ts?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    primary_currency?: string | null;
    rate_snapshot_id?: UUID | null;
    note?: string | null;
    entries: FinanceSnapshotEntryCreate[];
  }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [snapshotTs, setSnapshotTs] = useState(nowDateTimeLocal());
  const [periodStart, setPeriodStart] = useState(todayDate().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(todayDate());
  const [title, setTitle] = useState("");
  const [amounts, setAmounts] = useState<SnapshotAmountState>({});
  const [notes, setNotes] = useState<SnapshotNoteState>({});
  const [snapshotNote, setSnapshotNote] = useState("");
  const [selectedRateSnapshotId, setSelectedRateSnapshotId] = useState<UUID | "">("");
  const leafNodes = useMemo(
    () => flattenTree(treeNodes).filter((node) => node.children.length === 0),
    [treeNodes],
  );
  const selectedRateSnapshot = useMemo(
    () => rateSnapshots.find((snapshot) => snapshot.id === selectedRateSnapshotId) ?? null,
    [rateSnapshots, selectedRateSnapshotId],
  );
  const conversionRates = useMemo(
    () => buildConversionRateMap(selectedRateSnapshot, tree.primary_currency),
    [selectedRateSnapshot, tree.primary_currency],
  );
  const aggregatedAmounts = useMemo(
    () =>
      buildAggregatedSnapshotAmounts(
        treeNodes,
        amounts,
        tree.primary_currency,
        conversionRates,
        assets,
      ),
    [amounts, assets, conversionRates, tree.primary_currency, treeNodes],
  );
  const nativeAggregatedAmounts = useMemo(
    () => buildNativeSnapshotAmounts(treeNodes, amounts, tree.primary_currency, assets),
    [amounts, assets, tree.primary_currency, treeNodes],
  );
  const nativeSummaryRows = useMemo(
    () => buildNativeCurrencySummaryRows(treeNodes, amounts, tree.primary_currency, assets),
    [amounts, assets, tree.primary_currency, treeNodes],
  );
  const missingRateCurrencies = requiredRateCurrencies.filter(
    (currency) => !conversionRates[currency],
  );
  const hasCompleteRateSnapshot =
    Boolean(selectedRateSnapshotId) && missingRateCurrencies.length === 0;

  useEffect(() => {
    if (mode !== "edit" || !initialSnapshot) {
      setSnapshotTs(nowDateTimeLocal());
      setPeriodStart(todayDate().slice(0, 8) + "01");
      setPeriodEnd(todayDate());
      setTitle("");
      setAmounts({});
      setNotes({});
      setSnapshotNote("");
      setSelectedRateSnapshotId("");
      return;
    }

    setSnapshotTs(isoToDateTimeLocal(initialSnapshot.snapshot_ts));
    setPeriodStart(isoToDateInput(initialSnapshot.period_start));
    setPeriodEnd(isoToDateInput(initialSnapshot.period_end));
    setTitle(initialSnapshot.title ?? "");
    setSnapshotNote(initialSnapshot.note ?? "");
    setSelectedRateSnapshotId(initialSnapshot.rate_snapshot_id ?? "");
    const nextAmounts: SnapshotAmountState = {};
    const nextNotes: SnapshotNoteState = {};
    (initialSnapshot.entries ?? [])
      .filter((entry) => !entry.is_auto_generated)
      .forEach((entry) => {
        nextAmounts[entry.node_id] = entry.amount;
        nextNotes[entry.node_id] = entry.note ?? "";
      });
    setAmounts(nextAmounts);
    setNotes(nextNotes);
  }, [initialSnapshot, mode]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const entries = leafNodes.reduce<FinanceSnapshotEntryCreate[]>((acc, node) => {
      const amount = amounts[node.id]?.trim();
      if (!amount) {
        return acc;
      }
      acc.push({
        node_id: node.id,
        amount: amount.replace(",", "."),
        currency_code: node.currency_code || tree.primary_currency,
        note: notes[node.id]?.trim() || null,
      });
      return acc;
    }, []);

    if (!entries.length) {
      toast.showWarning(t("finance.messages.noEntries"));
      return;
    }
    onSubmit({
      title: title.trim() || null,
      snapshot_ts: preset.timeMode === "instant" ? localDateTimeToIso(snapshotTs) : null,
      period_start: preset.timeMode === "period" ? dateToStartIso(periodStart) : null,
      period_end: preset.timeMode === "period" ? dateToEndIso(periodEnd) : null,
      primary_currency: tree.primary_currency,
      rate_snapshot_id: selectedRateSnapshotId || null,
      note: snapshotNote || null,
      entries,
    });
    if (mode === "create") {
      setTitle("");
      setAmounts({});
      setNotes({});
      setSnapshotNote("");
      setSelectedRateSnapshotId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base-content">
            {mode === "edit" ? t("finance.snapshot.editTitle") : t("finance.snapshot.formTitle")}
          </h3>
          <p className="text-sm text-base-content/60">{t(preset.amountLabelKey)}</p>
        </div>
        <ActionButton
          label={t("common.cancel")}
          onClick={onCancel}
          size="sm"
          variant="ghost"
          disabled={submitting}
        />
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label={t("finance.tree.selectTree")}>
          <select
            className="select select-bordered select-sm w-full"
            value={selectedTreeId ?? tree.id}
            onChange={(event) => {
              if (event.target.value) {
                onSelectTree(event.target.value as UUID);
              }
            }}
            disabled={mode === "edit" || submitting}
          >
            {treeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.is_default ? ` · ${t("finance.tree.default")}` : ""}
                {` · ${option.primary_currency}`}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label={t("finance.snapshot.title")}>
          <TextInput
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("finance.snapshot.titlePlaceholder")}
          />
        </FormField>

        {preset.timeMode === "instant" ? (
          <FormField label={t("finance.snapshot.snapshotTime")}>
            <TextInput
              type="datetime-local"
              value={snapshotTs}
              onChange={(event) => setSnapshotTs(event.target.value)}
            />
          </FormField>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label={t("finance.snapshot.periodStart")}>
              <TextInput
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            </FormField>
            <FormField label={t("finance.snapshot.periodEnd")}>
              <TextInput
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />
            </FormField>
          </div>
        )}

        <RateSnapshotSelectPanel
          primaryCurrency={tree.primary_currency}
          requiredCurrencies={requiredRateCurrencies}
          rateSnapshots={rateSnapshots}
          selectedRateSnapshotId={selectedRateSnapshotId}
          onSelectRateSnapshot={setSelectedRateSnapshotId}
        />

        <AssetSummaryPanel
          rows={nativeSummaryRows}
          primaryCurrency={tree.primary_currency}
          assets={assets}
          rateSnapshotLabelText={
            selectedRateSnapshot
              ? rateSnapshotLabel(selectedRateSnapshot)
              : t("finance.rates.noRateSnapshot")
          }
          rateInfoByCurrency={buildRateInfoFromConversionRates(
            conversionRates,
            tree.primary_currency,
          )}
          showConversions
        />

        <SnapshotEntryTreeTable
          treeNodes={treeNodes}
          amounts={amounts}
          notes={notes}
          aggregatedAmounts={hasCompleteRateSnapshot ? aggregatedAmounts : {}}
          nativeAggregatedAmounts={nativeAggregatedAmounts}
          primaryCurrency={tree.primary_currency}
          conversionRates={conversionRates}
          assets={assets}
          hasRateSnapshot={hasCompleteRateSnapshot}
          submitting={submitting}
          onChangeAmount={(nodeId, value) =>
            setAmounts((prev) => ({ ...prev, [nodeId]: value }))
          }
          onChangeNote={(nodeId, value) =>
            setNotes((prev) => ({ ...prev, [nodeId]: value }))
          }
        />

        <FormField label={t("finance.snapshot.snapshotNote")}>
          <TextArea
            value={snapshotNote}
            onChange={(event) => setSnapshotNote(event.target.value)}
            resize="y"
          />
        </FormField>

        <div className="flex justify-end">
          <ActionButton
            type="submit"
            label={submitting ? t("common.saving") : t("finance.snapshot.save")}
            color="primary"
            variant="solid"
            iconName="check"
            disabled={submitting || !leafNodes.length}
          />
        </div>
      </form>
    </div>
  );
}

function RateSnapshotSelectPanel({
  primaryCurrency,
  requiredCurrencies,
  rateSnapshots,
  selectedRateSnapshotId,
  onSelectRateSnapshot,
}: {
  primaryCurrency: string;
  requiredCurrencies: string[];
  rateSnapshots: FinanceRateSnapshot[];
  selectedRateSnapshotId: UUID | "";
  onSelectRateSnapshot: (rateSnapshotId: UUID | "") => void;
}) {
  const { t } = useTranslation();
  const options = [
    { value: "", label: t("finance.rates.noRateSnapshot") },
    ...rateSnapshots.map((snapshot) => ({
      value: snapshot.id,
      label: rateSnapshotLabel(snapshot),
    })),
  ];

  return (
    <div className="rounded-lg border border-base-200 bg-base-200/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-base-content">{t("finance.rates.title")}</h4>
          <p className="text-sm text-base-content/60">
            {requiredCurrencies.length
              ? t("finance.rates.required", {
                  currencies: requiredCurrencies.join(", "),
                  primaryCurrency,
                })
              : t("finance.rates.optional")}
          </p>
        </div>
        <EnumSelect
          value={selectedRateSnapshotId || undefined}
          onChange={(value) => onSelectRateSnapshot((value as UUID | undefined) ?? "")}
          options={options}
          placeholder={t("finance.rates.selectSnapshot")}
          showLabel={false}
          includeEmptyOption
          size="sm"
          className="min-w-[14rem]"
        />
      </div>
    </div>
  );
}

function SnapshotEntryTreeTable({
  treeNodes,
  amounts,
  notes,
  aggregatedAmounts,
  nativeAggregatedAmounts,
  primaryCurrency,
  conversionRates,
  assets,
  hasRateSnapshot,
  submitting,
  onChangeAmount,
  onChangeNote,
}: {
  treeNodes: TreeNodeWithChildren[];
  amounts: SnapshotAmountState;
  notes: SnapshotNoteState;
  aggregatedAmounts: Record<UUID, string>;
  nativeAggregatedAmounts: Record<UUID, string>;
  primaryCurrency: string;
  conversionRates: Record<string, number>;
  assets: FinanceAsset[];
  hasRateSnapshot: boolean;
  submitting: boolean;
  onChangeAmount: (nodeId: UUID, value: string) => void;
  onChangeNote: (nodeId: UUID, value: string) => void;
}) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<UUID>>(new Set());

  useEffect(() => {
    const initial = new Set<UUID>();
    includeFinanceNodeIds(treeNodes, initial);
    setExpandedIds(initial);
  }, [treeNodes]);

  const toggleNode = (nodeId: UUID) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const renderRows = (nodes: TreeNodeWithChildren[], depth: number): React.ReactNode[] =>
    nodes.flatMap((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedIds.has(node.id);
      const amount = amounts[node.id] ?? "";
      const nodeCurrency = node.currency_code || primaryCurrency;
      const aggregatedAmount = aggregatedAmounts[node.id] ?? "";
      const nativeAggregatedAmount = nativeAggregatedAmounts[node.id] ?? "";
      const convertedAmount = hasRateSnapshot
        ? hasChildren
          ? aggregatedAmount
          : convertSnapshotAmount(
              amount,
              nodeCurrency,
              primaryCurrency,
              conversionRates,
              assets,
            )
        : nativeAggregatedAmounts[node.id] ?? "";
      const amountNegative = isNegativeAmount(amount);
      const convertedNegative = isNegativeAmount(convertedAmount);
      const nativeAggregatedNegative = isNegativeAmount(nativeAggregatedAmount);

      const rows: React.ReactNode[] = [
        <tr key={node.id} className="border-base-200">
          <td className="align-top">
            <div
              className="flex items-start gap-3"
              style={{ paddingLeft: `${depth * 1.25}rem` }}
            >
              {hasChildren ? (
                <ActionButton
                  label=""
                  iconName={isExpanded ? "chevron-down" : "chevron-right"}
                  iconOnly
                  size="xs"
                  variant="ghost"
                  shape="circle"
                  className="mt-1 h-6 w-6 p-0"
                  ariaLabel={isExpanded ? t("common.collapse") : t("common.expand")}
                  ariaExpanded={isExpanded}
                  onClick={() => toggleNode(node.id)}
                />
              ) : (
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center text-base-content/30">
                  •
                </span>
              )}
              <div className="min-w-0 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <p className="truncate font-semibold text-base-content">{node.name}</p>
              </div>
            </div>
          </td>
          <td className="align-top text-center">
            <span className="inline-flex min-w-[3rem] justify-center rounded-full bg-base-200 px-2 py-0.5 text-xs font-medium text-base-content/80">
              {nodeCurrency.toUpperCase()}
            </span>
          </td>
          <td className="align-top">
            {hasChildren ? (
              <div
                className={[
                  "min-h-[2.25rem] rounded-md border border-dashed border-base-200 px-3 py-2 text-sm",
                  nativeAggregatedNegative ? "text-error" : "text-base-content/80",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {nativeAggregatedAmount || "-"}
              </div>
            ) : (
              <TextInput
                type="text"
                inputMode="decimal"
                pattern={amountInputPattern(assetDecimalPlaces(assets, nodeCurrency))}
                size="sm"
                className={amountNegative ? "text-error" : "text-base-content"}
                value={amount}
                onChange={(event) => onChangeAmount(node.id, event.target.value)}
                placeholder={t("finance.snapshot.balancePlaceholder")}
                disabled={submitting}
              />
            )}
          </td>
          <td className="align-top">
            {convertedAmount ? (
              <span
                className={[
                  "inline-flex min-h-[2.25rem] items-center rounded-md border border-dashed border-base-200 px-3 text-sm",
                  convertedNegative ? "text-error" : "text-base-content/80",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {hasRateSnapshot ? `${convertedAmount} ${primaryCurrency}` : convertedAmount}
              </span>
            ) : (
              <span className="inline-flex min-h-[2.25rem] items-center rounded-md border border-dashed border-base-200 px-3 text-sm text-base-content/40">
                -
              </span>
            )}
          </td>
          <td className="align-top">
            {hasChildren ? (
              <span className="inline-flex min-h-[2.25rem] items-center text-base-content/40">
                -
              </span>
            ) : (
              <TextInput
                type="text"
                size="sm"
                value={notes[node.id] ?? ""}
                onChange={(event) => onChangeNote(node.id, event.target.value)}
                placeholder={t("finance.snapshot.notePlaceholder")}
                disabled={submitting}
              />
            )}
          </td>
        </tr>,
      ];

      if (hasChildren && isExpanded) {
        rows.push(...renderRows(node.children, depth + 1));
      }

      return rows;
    });

  return (
    <div className="rounded-lg border border-base-200">
      <div className="border-b border-base-200 bg-base-200/40 px-4 py-2 text-sm font-semibold text-base-content">
        {t("finance.snapshot.tableTitle")}
      </div>
      {treeNodes.length ? (
        <div className="overflow-x-auto p-3 pb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-base-200/60 text-left text-xs uppercase text-base-content/60">
              <tr>
                <th className="w-[40%] min-w-[12rem] px-4 py-2">
                  {t("finance.snapshot.node")}
                </th>
                <th className="w-20 px-4 py-2 text-center">
                  {t("finance.snapshot.originalCurrency")}
                </th>
                <th className="min-w-[10rem] px-4 py-2">
                  {t("finance.snapshot.originalAmount")}
                </th>
                <th className="min-w-[10rem] px-4 py-2">
                  {t("finance.snapshot.convertedAmount", { currency: primaryCurrency })}
                </th>
                <th className="min-w-[10rem] px-4 py-2">
                  {t("finance.snapshot.note")}
                </th>
              </tr>
            </thead>
            <tbody>{renderRows(treeNodes, 0)}</tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-base-content/60">
          {t("finance.snapshot.noEntryNodes")}
        </div>
      )}
    </div>
  );
}

type AssetSummaryRow = {
  currency: string;
  amount: string;
  numericAmount: number;
};

type RateInfo = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  sourcePairs: string[];
  path: string[];
};

function AssetSummaryPanel({
  rows,
  primaryCurrency,
  assets,
  rateSnapshotLabelText,
  rateInfoByCurrency,
  showConversions,
}: {
  rows: AssetSummaryRow[];
  primaryCurrency: string;
  assets: FinanceAsset[];
  rateSnapshotLabelText: string;
  rateInfoByCurrency: Record<string, RateInfo>;
  showConversions: boolean;
}) {
  const { t } = useTranslation();
  const summaryRows = rows.length
    ? rows
    : [
        {
          currency: primaryCurrency.toUpperCase(),
          amount: formatNumberForAsset(0, primaryCurrency, assets),
          numericAmount: 0,
        },
      ];
  const convertedRows = summaryRows.map((row) => {
    const rateInfo =
      row.currency === primaryCurrency.toUpperCase()
        ? {
            baseCurrency: row.currency,
            quoteCurrency: primaryCurrency.toUpperCase(),
            rate: "1",
            sourcePairs: [],
            path: [row.currency],
          }
        : rateInfoByCurrency[row.currency];
    const rate = rateInfo ? Number(rateInfo.rate) : Number.NaN;
    const convertedValue =
      showConversions && Number.isFinite(rate) ? row.numericAmount * rate : null;
    return {
      ...row,
      rateInfo,
      convertedValue,
      convertedAmount:
        convertedValue === null
          ? ""
          : formatNumberForAsset(convertedValue, primaryCurrency, assets),
    };
  });
  const canShowTotal = convertedRows.every((row) => row.convertedValue !== null);
  const totalValue = canShowTotal
    ? convertedRows.reduce((sum, row) => sum + (row.convertedValue ?? 0), 0)
    : null;

  return (
    <div className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-200 px-3 py-2">
        <h4 className="font-semibold text-base-content">{t("finance.metrics.assetSummary")}</h4>
        <span className="text-right text-sm text-base-content/70">
          {t("finance.rates.tabTitle")}
          <span className="ml-2 text-base-content">{rateSnapshotLabelText}</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead className="bg-base-200/50 text-xs uppercase text-base-content/60">
            <tr>
              <th>{t("finance.snapshot.currency")}</th>
              <th className="text-right">{t("finance.snapshot.amount")}</th>
              <th className="text-right">{t("finance.rates.rate")}</th>
              <th className="text-right">
                {t("finance.metrics.convertTo", { currency: primaryCurrency })}
              </th>
            </tr>
          </thead>
          <tbody>
            {convertedRows.map((row) => (
              <tr key={row.currency}>
                <td className="font-medium">{row.currency}</td>
                <td className="text-right tabular-nums">{row.amount}</td>
                <td className="text-right tabular-nums">
                  {row.rateInfo ? (
                    <span title={rateInfoTooltip(row.rateInfo)}>
                      {formatRateDisplay(row.rateInfo.rate)}
                    </span>
                  ) : (
                    <span className="text-base-content/40">-</span>
                  )}
                </td>
                <td className="text-right tabular-nums">
                  {row.convertedAmount ? (
                    `${row.convertedAmount} ${primaryCurrency}`
                  ) : (
                    <span className="text-base-content/40">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-base-200 px-3 py-2">
        <span className="text-sm font-medium text-base-content/70">
          {t("finance.metrics.totalValue")}
        </span>
        <span className="font-semibold tabular-nums text-base-content">
          {totalValue === null
            ? "-"
            : `${formatNumberForAsset(totalValue, primaryCurrency, assets)} ${primaryCurrency}`}
        </span>
      </div>
    </div>
  );
}

export function SnapshotDetail({
  snapshot,
  assets,
  treeNodes,
}: {
  snapshot: FinanceSnapshot;
  assets: FinanceAsset[];
  treeNodes: TreeNodeWithChildren[];
}) {
  const { t } = useTranslation();
  const usesConvertedAggregation = getSummaryAggregationMode(snapshot.summary) === "converted";
  const displayTree = useMemo(
    () =>
      buildSnapshotDisplayTree(
        treeNodes,
        snapshot.entries ?? [],
        usesConvertedAggregation,
        snapshot.primary_currency,
        assets,
      ),
    [assets, snapshot.entries, snapshot.primary_currency, treeNodes, usesConvertedAggregation],
  );
  const amountsByCurrency = useMemo(
    () =>
      buildSummaryRowsFromAmountsByCurrency(
        getSummaryAmountsByCurrency(snapshot.summary),
        snapshot.primary_currency,
        assets,
      ),
    [assets, snapshot.primary_currency, snapshot.summary],
  );
  const rateInfoByCurrency = useMemo(
    () => getExchangeRateInfoByCurrency(snapshot.exchange_rates),
    [snapshot.exchange_rates],
  );

  const [expandedIds, setExpandedIds] = useState<Set<UUID>>(new Set());

  useEffect(() => {
    const expandableIds = new Set<UUID>();
    collectExpandableSnapshotNodeIds(displayTree, expandableIds);
    setExpandedIds(expandableIds);
  }, [displayTree]);

  const toggleNode = (nodeId: UUID) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const visibleNodes = useMemo(
    () => flattenVisibleSnapshotNodes(displayTree, expandedIds),
    [displayTree, expandedIds],
  );
  const snapshotNote = snapshot.note?.trim() ?? "";

  return (
    <div className="space-y-4">
      <AssetSummaryPanel
        rows={amountsByCurrency}
        primaryCurrency={snapshot.primary_currency}
        assets={assets}
        rateSnapshotLabelText={
          snapshot.rate_snapshot_id
            ? snapshot.rate_snapshot_id
            : t("finance.rates.noRateSnapshot")
        }
        rateInfoByCurrency={rateInfoByCurrency}
        showConversions
      />

      <div className="rounded-lg border border-dashed border-base-200 p-3 text-sm text-base-content/70">
        <p className="font-medium text-base-content">{t("finance.snapshot.snapshotNote")}</p>
        <p className="mt-1 whitespace-pre-wrap">{snapshotNote || t("common.none")}</p>
      </div>

      <div className="overflow-x-auto border border-base-300 rounded-lg">
        <table className="table table-sm">
          <thead className="bg-base-200/60 text-xs uppercase text-base-content/60">
            <tr>
              <th className="w-[40%] min-w-[12rem] px-4 py-2">
                {t("finance.snapshot.node")}
              </th>
              <th className="w-20 px-4 py-2 text-center">
                {t("finance.snapshot.originalCurrency")}
              </th>
              <th className="min-w-[10rem] px-4 py-2">
                {t("finance.snapshot.originalAmount")}
              </th>
              <th className="min-w-[10rem] px-4 py-2">
                {t("finance.snapshot.convertedAmount", { currency: snapshot.primary_currency })}
              </th>
              <th className="min-w-[12rem]">{t("finance.snapshot.note")}</th>
            </tr>
          </thead>
          <tbody className="align-top text-sm text-base-content/80">
            {visibleNodes.map((node) => {
              const hasChildren = node.children.length > 0;
              const isExpanded = expandedIds.has(node.id);
              const originalAmount = parseDisplayAmount(node.amount);
              const convertedAmount = parseDisplayAmount(node.amountConverted);
              const originalAmountClass =
                originalAmount > 0
                  ? "text-success"
                  : originalAmount < 0
                    ? "text-error"
                    : "text-base-content";
              const convertedAmountClass =
                convertedAmount > 0
                  ? "text-success"
                  : convertedAmount < 0
                    ? "text-error"
                    : "text-base-content";

              return (
                <tr key={node.id} className="border-base-200">
                  <td className="align-top">
                    <div
                      className="flex items-start gap-2"
                      style={{ paddingLeft: `${Math.min(node.depth, 6) * 1.5}rem` }}
                    >
                      {hasChildren ? (
                        <ActionButton
                          label=""
                          iconName={isExpanded ? "chevron-down" : "chevron-right"}
                          iconOnly
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          ariaLabel={isExpanded ? t("common.collapse") : t("common.expand")}
                          ariaExpanded={isExpanded}
                          onClick={() => toggleNode(node.id)}
                        />
                      ) : (
                        <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center text-base-content/30">
                          •
                        </span>
                      )}
                      <div className="min-w-0 space-y-1">
                        <span className="font-medium text-base-content">{node.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="align-top text-center text-base-content/70">
                    <span className="inline-flex min-w-[3rem] justify-center rounded-full bg-base-200 px-2 py-0.5 text-xs font-medium text-base-content/80">
                      {(node.currencyCode || snapshot.primary_currency).toUpperCase()}
                    </span>
                  </td>
                  <td className="align-top">
                    <span className={`tabular-nums ${originalAmountClass}`}>
                      {node.amount || "-"}
                    </span>
                  </td>
                  <td className="align-top">
                    {usesConvertedAggregation ? (
                      <span className={`tabular-nums ${convertedAmountClass}`}>
                        {formatMoney(node.amountConverted, snapshot.primary_currency, assets)}
                      </span>
                    ) : (
                      <span className="text-base-content/40">-</span>
                    )}
                  </td>
                  <td className="align-top">
                    {node.note ? (
                      <span className="block min-h-[2.25rem] text-sm text-base-content/80">
                        {node.note}
                      </span>
                    ) : (
                      <span className="text-base-content/40">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!visibleNodes.length ? (
              <tr>
                <td colSpan={5} className="text-center text-base-content/60 py-6">
                  {t("finance.history.noSelection")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SnapshotEntry = NonNullable<FinanceSnapshot["entries"]>[number];

type SnapshotDisplayNode = {
  id: UUID;
  name: string;
  depth: number;
  amount: string;
  amountConverted: string;
  currencyCode: string;
  note: string | null;
  isAutoGenerated: boolean;
  children: SnapshotDisplayNode[];
};

function buildSnapshotDisplayTree(
  treeNodes: TreeNodeWithChildren[],
  entries: SnapshotEntry[],
  useConvertedRollups: boolean,
  primaryCurrency: string,
  assets: FinanceAsset[],
): SnapshotDisplayNode[] {
  const entryByNodeId = new Map<UUID, SnapshotEntry>();
  entries.forEach((entry) => {
    entryByNodeId.set(entry.node_id, entry);
  });
  const usedNodeIds = new Set<UUID>();

  const buildNodes = (nodes: TreeNodeWithChildren[], depth: number): SnapshotDisplayNode[] =>
    nodes
      .map((node) => {
        const children = buildNodes(node.children, depth + 1);
        const entry = entryByNodeId.get(node.id);
        if (entry) {
          usedNodeIds.add(node.id);
        }
        if (!entry && !children.length) {
          return null;
        }
        const amountConverted =
          entry?.amount_converted ??
          (useConvertedRollups ? sumSnapshotNodeAmounts(children, primaryCurrency, assets) : "");
        const currencyCode = entry?.currency_code ?? node.currency_code ?? primaryCurrency;
        return {
          id: node.id,
          name: node.name,
          depth,
          amount: entry?.amount ?? formatAmountForAsset(amountConverted, currencyCode, assets),
          amountConverted,
          currencyCode,
          note: entry?.note ?? null,
          isAutoGenerated: entry?.is_auto_generated ?? false,
          children,
        } satisfies SnapshotDisplayNode;
      })
      .filter(Boolean) as SnapshotDisplayNode[];

  const roots = buildNodes(treeNodes, 0);
  const orphanEntries = entries
    .filter((entry) => !usedNodeIds.has(entry.node_id))
    .map(
      (entry) =>
        ({
          id: entry.node_id,
          name: entry.node_name ?? entry.node_id,
          depth: 0,
          amount: entry.amount,
          amountConverted: entry.amount_converted,
          currencyCode: entry.currency_code,
          note: entry.note ?? null,
          isAutoGenerated: entry.is_auto_generated,
          children: [],
        }) satisfies SnapshotDisplayNode,
    );
  return roots.concat(orphanEntries);
}

function getSummaryAmountsByCurrency(
  summary?: Record<string, unknown> | null,
): Record<string, { net_amount: string }> {
  const rawAmounts = summary?.amounts_by_currency;
  if (!rawAmounts || typeof rawAmounts !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(rawAmounts as Record<string, Record<string, unknown>>).map(
      ([currency, totals]) => [
        currency,
        {
          net_amount: String(totals.net_amount ?? "0"),
        },
      ],
    ),
  );
}

function buildSummaryRowsFromAmountsByCurrency(
  amountsByCurrency: Record<string, { net_amount: string }>,
  fallbackCurrency: string,
  assets: FinanceAsset[],
): AssetSummaryRow[] {
  const rows = Object.entries(amountsByCurrency).map(([currency, totals]) => {
    const normalizedCurrency = currency.toUpperCase();
    const numericAmount = parseDisplayAmount(totals.net_amount);
    return {
      currency: normalizedCurrency,
      amount: formatAmountForAsset(totals.net_amount, normalizedCurrency, assets),
      numericAmount: Number.isFinite(numericAmount) ? numericAmount : 0,
    };
  });
  if (rows.length) {
    return rows.sort((left, right) => left.currency.localeCompare(right.currency));
  }
  return [
    {
      currency: fallbackCurrency.toUpperCase(),
      amount: formatNumberForAsset(0, fallbackCurrency, assets),
      numericAmount: 0,
    },
  ];
}

function buildNativeCurrencySummaryRows(
  nodes: TreeNodeWithChildren[],
  amounts: SnapshotAmountState,
  primaryCurrency: string,
  assets: FinanceAsset[],
): AssetSummaryRow[] {
  const totals = new Map<string, number>();
  const visit = (node: TreeNodeWithChildren) => {
    if (!node.children.length) {
      const amount = amounts[node.id]?.trim() ?? "";
      if (!amount) {
        return;
      }
      const parsed = parseDisplayAmount(amount);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const currency = (node.currency_code || primaryCurrency).toUpperCase();
      totals.set(currency, (totals.get(currency) ?? 0) + parsed);
      return;
    }
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, value]) => ({
      currency,
      amount: formatNumberForAsset(value, currency, assets),
      numericAmount: value,
    }));
}

function getSummaryAggregationMode(summary?: Record<string, unknown> | null): string {
  const mode = summary?.aggregation_mode;
  return typeof mode === "string" ? mode : "native_by_currency";
}

function buildRateInfoFromConversionRates(
  conversionRates: Record<string, number>,
  primaryCurrency: string,
): Record<string, RateInfo> {
  const primary = primaryCurrency.toUpperCase();
  return Object.fromEntries(
    Object.entries(conversionRates)
      .filter(([, rate]) => Number.isFinite(rate) && rate > 0)
      .map(([currency, rate]) => {
        const normalizedCurrency = currency.toUpperCase();
        return [
          normalizedCurrency,
          {
            baseCurrency: normalizedCurrency,
            quoteCurrency: primary,
            rate: String(rate),
            sourcePairs: [],
            path: normalizedCurrency === primary ? [primary] : [normalizedCurrency, primary],
          } satisfies RateInfo,
        ];
      }),
  );
}

function getExchangeRateInfoByCurrency(
  exchangeRates?: Record<string, unknown> | null,
): Record<string, RateInfo> {
  const rates = exchangeRates?.rates;
  if (!rates || typeof rates !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(rates as Record<string, Record<string, unknown>>).map(
      ([currency, value]) => [
        currency.toUpperCase(),
        {
          baseCurrency: String(value.base_currency ?? currency).toUpperCase(),
          quoteCurrency: String(value.quote_currency ?? "").toUpperCase(),
          rate: String(value.rate ?? ""),
          sourcePairs: Array.isArray(value.source_pairs)
            ? value.source_pairs.map((pair) => String(pair))
            : [],
          path: Array.isArray(value.path) ? value.path.map((item) => String(item)) : [],
        } satisfies RateInfo,
      ],
    ),
  );
}

function rateInfoTooltip(rateInfo: RateInfo): string {
  const primaryLine = `1 ${rateInfo.baseCurrency} = ${formatRateDisplay(rateInfo.rate)} ${
    rateInfo.quoteCurrency
  }`;
  const sourceLines = rateInfo.sourcePairs.map((pair) => pair.replace("/", " = "));
  const pathLine = rateInfo.path.length ? rateInfo.path.join(" -> ") : "";
  return [primaryLine, ...sourceLines, pathLine].filter(Boolean).join("\n");
}

function formatRateDisplay(rate: string): string {
  if (!rate.includes(".")) {
    return rate;
  }
  return rate.replace(/0+$/, "").replace(/\.$/, "");
}

function includeFinanceNodeIds(nodes: TreeNodeWithChildren[], target: Set<UUID>) {
  nodes.forEach((node) => {
    target.add(node.id);
    if (node.children.length) {
      includeFinanceNodeIds(node.children, target);
    }
  });
}

function buildAggregatedSnapshotAmounts(
  nodes: TreeNodeWithChildren[],
  amounts: SnapshotAmountState,
  primaryCurrency: string,
  conversionRates: Record<string, number>,
  assets: FinanceAsset[],
): Record<UUID, string> {
  const result: Record<UUID, string> = {};

  const visit = (node: TreeNodeWithChildren): string => {
    if (!node.children.length) {
      const convertedAmount = convertSnapshotAmount(
        amounts[node.id] ?? "",
        node.currency_code || primaryCurrency,
        primaryCurrency,
        conversionRates,
        assets,
      );
      if (convertedAmount) {
        result[node.id] = convertedAmount;
      }
      return convertedAmount;
    }

    const total = sumAmountStrings(node.children.map(visit), primaryCurrency, assets);
    if (total) {
      result[node.id] = total;
    }
    return total;
  };

  nodes.forEach(visit);
  return result;
}

function buildNativeSnapshotAmounts(
  nodes: TreeNodeWithChildren[],
  amounts: SnapshotAmountState,
  primaryCurrency: string,
  assets: FinanceAsset[],
): Record<UUID, string> {
  const result: Record<UUID, string> = {};

  const visit = (node: TreeNodeWithChildren): Map<string, number> => {
    if (!node.children.length) {
      const amount = amounts[node.id]?.trim() ?? "";
      const parsed = Number(amount);
      if (!amount || !Number.isFinite(parsed)) {
        return new Map();
      }
      const currency = (node.currency_code || primaryCurrency).toUpperCase();
      result[node.id] = `${formatAmountForAsset(amount, currency, assets)} ${currency}`;
      return new Map([[currency, parsed]]);
    }

    const totals = new Map<string, number>();
    node.children.forEach((child) => {
      visit(child).forEach((value, currency) => {
        totals.set(currency, (totals.get(currency) ?? 0) + value);
      });
    });
    if (totals.size) {
      result[node.id] = Array.from(totals.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([currency, value]) => `${formatNumberForAsset(value, currency, assets)} ${currency}`)
        .join(", ");
    }
    return totals;
  };

  nodes.forEach(visit);
  return result;
}

function buildConversionRateMap(
  rateSnapshot: FinanceRateSnapshot | null,
  primaryCurrency: string,
): Record<string, number> {
  const normalizedPrimary = primaryCurrency.toUpperCase();
  const result: Record<string, number> = { [normalizedPrimary]: 1 };
  (rateSnapshot?.entries ?? []).forEach((entry) => {
    const baseCurrency = entry.base_currency.toUpperCase();
    const quoteCurrency = entry.quote_currency.toUpperCase();
    const rate = Number(entry.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return;
    }
    if (quoteCurrency === normalizedPrimary) {
      result[baseCurrency] = rate;
    }
    if (baseCurrency === normalizedPrimary) {
      result[quoteCurrency] = 1 / rate;
    }
  });
  return result;
}

function convertSnapshotAmount(
  amount: string,
  currencyCode: string,
  primaryCurrency: string,
  conversionRates: Record<string, number>,
  assets: FinanceAsset[],
): string {
  const trimmed = amount.trim();
  if (!trimmed) {
    return "";
  }
  const parsed = parseDisplayAmount(trimmed);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  const currency = currencyCode.toUpperCase();
  const primary = primaryCurrency.toUpperCase();
  const rate = currency === primary ? 1 : conversionRates[currency];
  if (!Number.isFinite(rate)) {
    return "";
  }
  return formatNumberForAsset(parsed * rate, primary, assets);
}

function sumAmountStrings(
  values: string[],
  currencyCode?: string,
  assets: FinanceAsset[] = [],
): string {
  let hasValue = false;
  const total = values.reduce((acc, value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return acc;
    }
    const parsed = parseDisplayAmount(trimmed);
    if (!Number.isFinite(parsed)) {
      return acc;
    }
    hasValue = true;
    return acc + parsed;
  }, 0);
  if (!hasValue) {
    return "";
  }
  return currencyCode ? formatNumberForAsset(total, currencyCode, assets) : total.toString();
}

function sumSnapshotNodeAmounts(
  nodes: SnapshotDisplayNode[],
  primaryCurrency: string,
  assets: FinanceAsset[],
): string {
  return sumAmountStrings(
    nodes.map((node) => node.amountConverted),
    primaryCurrency,
    assets,
  );
}

function isNegativeAmount(value: string | null | undefined): boolean {
  const numeric = parseDisplayAmount(value ?? "");
  return Number.isFinite(numeric) && numeric < 0;
}

function parseDisplayAmount(value: string): number {
  return Number(value.replace(",", "."));
}

function amountInputPattern(decimalPlaces: number): string {
  if (decimalPlaces <= 0) {
    return "-?[0-9]*";
  }
  return `-?[0-9]*[.,]?[0-9]{0,${decimalPlaces}}`;
}

function collectExpandableSnapshotNodeIds(
  nodes: SnapshotDisplayNode[],
  target: Set<UUID>,
) {
  nodes.forEach((node) => {
    if (node.children.length) {
      target.add(node.id);
      collectExpandableSnapshotNodeIds(node.children, target);
    }
  });
}

function flattenVisibleSnapshotNodes(
  nodes: SnapshotDisplayNode[],
  expandedIds: Set<UUID>,
): SnapshotDisplayNode[] {
  const result: SnapshotDisplayNode[] = [];
  const walk = (items: SnapshotDisplayNode[]) => {
    items.forEach((node) => {
      result.push(node);
      if (node.children.length && expandedIds.has(node.id)) {
        walk(node.children);
      }
    });
  };
  walk(nodes);
  return result;
}
