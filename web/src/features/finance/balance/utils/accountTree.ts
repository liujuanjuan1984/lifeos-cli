import type { FinanceAccount } from "@/services/api/finance";
import { sumDecimalStrings } from "@/features/finance/shared";

export interface AccountTreeIndex {
  nodeMap: Map<string, FinanceAccount>;
  parentMap: Map<string, string | null>;
  childrenMap: Map<string, string[]>;
  leafIds: Set<string>;
  rootIds: string[];
}

export function buildAccountTreeIndex(
  accounts: FinanceAccount[],
): AccountTreeIndex {
  const nodeMap = new Map<string, FinanceAccount>();
  const parentMap = new Map<string, string | null>();
  const childrenMap = new Map<string, string[]>();
  const leafIds = new Set<string>();
  const rootIds: string[] = [];

  const visit = (node: FinanceAccount, parentId: string | null) => {
    nodeMap.set(node.id, node);
    parentMap.set(node.id, parentId);
    if (parentId) {
      const siblings = childrenMap.get(parentId);
      if (siblings) {
        siblings.push(node.id);
      } else {
        childrenMap.set(parentId, [node.id]);
      }
    } else {
      rootIds.push(node.id);
    }

    if (node.children?.length) {
      node.children.forEach((child: FinanceAccount) => visit(child, node.id));
    } else {
      leafIds.add(node.id);
    }
  };

  accounts.forEach((account) => visit(account, null));

  return {
    nodeMap,
    parentMap,
    childrenMap,
    leafIds,
    rootIds,
  };
}

export function recalculateEntireTree(
  balances: Record<string, string>,
  index: AccountTreeIndex,
): Record<string, string> {
  const next = { ...balances };

  const revisit = (id: string) => {
    const childIds = index.childrenMap.get(id);
    if (!childIds || !childIds.length) {
      return next[id];
    }

    childIds.forEach(revisit);
    const { sum, hasValue } = sumDecimalStrings(
      childIds.map((childId) => next[childId]),
    );
    if (hasValue) {
      next[id] = sum;
    } else {
      delete next[id];
    }
    return next[id];
  };

  index.rootIds.forEach(revisit);

  return next;
}
