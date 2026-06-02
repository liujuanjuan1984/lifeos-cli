import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import ScrollArea from "@/layouts/ScrollArea";

type BaseTreeNode<TNode> = {
  id: string;
  children?: TNode[];
};

type InitialExpanded<TNode> =
  | "all"
  | Set<string>
  | ((nodes: TNode[]) => Set<string>);

type FinanceTreeRenderProps<TNode> = {
  node: TNode;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  toggle: () => void;
};

interface FinanceTreeProps<TNode extends BaseTreeNode<TNode>> {
  nodes: TNode[];
  emptyState: ReactNode;
  renderNode: (props: FinanceTreeRenderProps<TNode>) => ReactNode;
  scrollAreaClassName?: string;
  listClassName?: string;
  listItemClassName?: string;
  childrenClassName?: string;
  initialExpanded?: InitialExpanded<TNode>;
  resetExpandedOnNodesChange?: boolean;
  getNodeId?: (node: TNode) => string;
  getChildren?: (node: TNode) => TNode[] | undefined;
}

const DEFAULT_SCROLL_AREA_CLASS =
  "max-h-[45vh] sm:max-h-[60vh] pr-1 scrollbar-hover-grow";
const DEFAULT_LIST_CLASS = "space-y-2 pb-1";
const DEFAULT_LIST_ITEM_CLASS = "space-y-2";

export function FinanceTree<TNode extends BaseTreeNode<TNode>>({
  nodes,
  emptyState,
  renderNode,
  scrollAreaClassName = DEFAULT_SCROLL_AREA_CLASS,
  listClassName = DEFAULT_LIST_CLASS,
  listItemClassName = DEFAULT_LIST_ITEM_CLASS,
  childrenClassName = "border-l border-base-200 pl-4",
  initialExpanded = "all",
  resetExpandedOnNodesChange = false,
  getNodeId,
  getChildren,
}: FinanceTreeProps<TNode>) {
  const resolveNodeId = useMemo(
    () => getNodeId ?? ((node: TNode) => node.id),
    [getNodeId],
  );
  const resolveChildren = useMemo(
    () => getChildren ?? ((node: TNode) => node.children ?? []),
    [getChildren],
  );

  const initialExpandedSet = useMemo(() => {
    if (typeof initialExpanded === "function") {
      return initialExpanded(nodes);
    }

    if (initialExpanded !== "all") {
      return new Set(initialExpanded);
    }

    const set = new Set<string>();
    const walk = (items: TNode[]) => {
      items.forEach((item) => {
        set.add(resolveNodeId(item));
        const children = resolveChildren(item) ?? [];
        if (children.length) {
          walk(children);
        }
      });
    };
    walk(nodes);
    return set;
  }, [initialExpanded, nodes, resolveChildren, resolveNodeId]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialExpandedSet),
  );

  useEffect(() => {
    if (!resetExpandedOnNodesChange) {
      return;
    }
    setExpanded(new Set(initialExpandedSet));
  }, [initialExpandedSet, resetExpandedOnNodesChange]);

  const toggleNode = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!nodes.length) {
    return <>{emptyState}</>;
  }

  const renderTreeNode = (node: TNode, depth: number) => {
    const id = resolveNodeId(node);
    const children = resolveChildren(node) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(id);

    return (
      <li key={id} className={listItemClassName}>
        {renderNode({
          node,
          depth,
          isExpanded,
          hasChildren,
          toggle: () => toggleNode(id),
        })}
        {hasChildren && isExpanded ? (
          <ul className={childrenClassName}>
            {children.map((child) => renderTreeNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <ScrollArea className={scrollAreaClassName}>
      <ul className={listClassName}>
        {nodes.map((node) => renderTreeNode(node, 0))}
      </ul>
    </ScrollArea>
  );
}
