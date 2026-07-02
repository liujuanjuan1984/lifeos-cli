import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SnapshotDetail, SnapshotFormPanel } from "@/features/finance/SnapshotPanels";
import type {
  FinanceAsset,
  FinanceSnapshot,
  FinanceTree,
  FinanceTreeNode,
} from "@/services/api/finance";
import { renderWithProviders, setupTranslationMock } from "@test/utils";

const assets: FinanceAsset[] = [
  {
    id: "asset-usd",
    code: "USD",
    name: "US Dollar",
    decimal_places: 2,
    is_default: true,
  },
  {
    id: "asset-eth",
    code: "ETH",
    name: "Ethereum",
    decimal_places: 8,
    is_default: true,
  },
];

const node: FinanceTreeNode = {
  id: "node-wallet",
  parent_id: null,
  name: "Wallet",
  currency_code: "ETH",
  path: "Wallet",
  depth: 0,
  display_order: 1,
};

const tree: FinanceTree = {
  id: "tree-balance",
  name: "Balance",
  primary_currency: "USD",
  display_order: 1,
  is_default: true,
  nodes: [node],
};

const sourceSnapshot: FinanceSnapshot = {
  id: "snapshot-source",
  tree_id: tree.id,
  tree_name: tree.name,
  title: "June balance",
  snapshot_ts: "2026-06-30T20:00:00.000Z",
  period_start: null,
  period_end: null,
  primary_currency: "USD",
  rate_snapshot_id: "rate-june",
  note: "Source note",
  entries: [
    {
      id: "entry-wallet",
      node_id: node.id,
      node_name: node.name,
      amount: "1.00000000",
      currency_code: "ETH",
      amount_converted: "1573.8800",
      note: "Main wallet",
      is_auto_generated: false,
    },
  ],
  created_at: "2026-06-30T20:01:00.000Z",
};

describe("SnapshotFormPanel", () => {
  it("renders snapshot entry rows with hover state", () => {
    setupTranslationMock();

    renderWithProviders(
      <SnapshotFormPanel
        tree={tree}
        preset={{
          report: "balance",
          titleKey: "finance.balance.title",
          descriptionKey: "finance.balance.description",
          timeMode: "instant",
        }}
        assets={assets}
        onCreateAsset={vi.fn()}
        treeOptions={[tree]}
        selectedTreeId={tree.id}
        onSelectTree={vi.fn()}
        treeNodes={[{ ...node, children: [] }]}
        rateSnapshots={[]}
        submitting={false}
        mode="create"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const row = screen.getByText("Wallet").closest("tr");

    expect(row).toHaveClass("hover:bg-primary/10");
    expect(row).toHaveClass("focus-within:bg-primary/10");
  });

  it("prefills copied snapshots and submits create-ready entries", async () => {
    setupTranslationMock();
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <SnapshotFormPanel
        tree={tree}
        preset={{
          report: "balance",
          titleKey: "finance.balance.title",
          descriptionKey: "finance.balance.description",
          timeMode: "instant",
        }}
        assets={assets}
        onCreateAsset={vi.fn()}
        treeOptions={[tree]}
        selectedTreeId={tree.id}
        onSelectTree={vi.fn()}
        treeNodes={[{ ...node, children: [] }]}
        rateSnapshots={[]}
        submitting={false}
        mode="copy"
        initialSnapshot={sourceSnapshot}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("June balance")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("1.00000000")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "common.save" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "June balance",
        primary_currency: "USD",
        rate_snapshot_id: "rate-june",
        note: "Source note",
        entries: [
          {
            node_id: node.id,
            amount: "1",
            currency_code: "ETH",
            note: "Main wallet",
          },
        ],
      }),
    );
    expect(onSubmit.mock.calls[0]?.[0].snapshot_ts).toEqual(expect.any(String));
    expect(onSubmit.mock.calls[0]?.[0].snapshot_ts).not.toBe(sourceSnapshot.snapshot_ts);
  });
});

describe("SnapshotDetail", () => {
  it("renders detail tree rows with hover state", () => {
    setupTranslationMock();

    renderWithProviders(
      <SnapshotDetail
        snapshot={sourceSnapshot}
        assets={assets}
        treeNodes={[{ ...node, children: [] }]}
        rateSnapshots={[]}
      />,
    );

    const row = screen.getByText("Wallet").closest("tr");

    expect(row).toHaveClass("hover:bg-primary/10");
    expect(row).toHaveClass("focus-within:bg-primary/10");
  });
});
