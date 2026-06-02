import { describe, expect, it } from "vitest";

import type { FinanceAccount } from "@/services/api/finance";
import {
  buildAccountTreeIndex,
  recalculateEntireTree,
} from "@/features/finance/balance/utils/accountTree";

const createAccount = (
  overrides: Partial<FinanceAccount> & { id: string },
): FinanceAccount => {
  return {
    id: overrides.id,
    tree_id: overrides.tree_id ?? "tree-id",
    parent_id: overrides.parent_id ?? null,
    name: overrides.name ?? "Account",
    path: overrides.path ?? overrides.id,
    depth: overrides.depth ?? 0,
    type: overrides.type ?? "asset",
    nature: overrides.nature ?? null,
    currency_code: overrides.currency_code ?? "USD",
    interest_rate: overrides.interest_rate ?? null,
    sort_order: overrides.sort_order ?? null,
    metadata: overrides.metadata ?? null,
    latest_snapshot_id: overrides.latest_snapshot_id ?? null,
    latest_balance_raw: overrides.latest_balance_raw ?? null,
    latest_balance_converted: overrides.latest_balance_converted ?? null,
    children: overrides.children ?? [],
  };
};

describe("accountTree utils", () => {
  it("builds an index of nodes, parents, children, and leaves", () => {
    const leafA = createAccount({ id: "leaf-a", parent_id: "root", depth: 1 });
    const leafB = createAccount({ id: "leaf-b", parent_id: "root", depth: 1 });
    const root = createAccount({
      id: "root",
      depth: 0,
      children: [leafA, leafB],
    });

    const index = buildAccountTreeIndex([root]);

    expect(index.nodeMap.size).toBe(3);
    expect(index.parentMap.get("root")).toBeNull();
    expect(index.parentMap.get("leaf-a")).toBe("root");
    expect(index.childrenMap.get("root")).toEqual(["leaf-a", "leaf-b"]);
    expect(index.leafIds.has("leaf-a")).toBe(true);
    expect(index.leafIds.has("leaf-b")).toBe(true);
    expect(index.rootIds).toEqual(["root"]);
  });

  it("recalculates balances by summing child values", () => {
    const leafA = createAccount({ id: "leaf-a", parent_id: "root", depth: 1 });
    const leafB = createAccount({ id: "leaf-b", parent_id: "root", depth: 1 });
    const root = createAccount({
      id: "root",
      depth: 0,
      children: [leafA, leafB],
    });
    const index = buildAccountTreeIndex([root]);

    const next = recalculateEntireTree({ "leaf-a": "1", "leaf-b": "2" }, index);

    expect(next.root).toBe("3");
  });

  it("drops parent balances when no child values exist", () => {
    const child = createAccount({ id: "child", parent_id: "root", depth: 1 });
    const root = createAccount({ id: "root", children: [child] });
    const index = buildAccountTreeIndex([root]);

    const next = recalculateEntireTree({}, index);

    expect(next.root).toBeUndefined();
  });
});
