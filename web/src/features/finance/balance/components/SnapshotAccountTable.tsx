import type { ReactNode } from "react";
import type { TFunction } from "i18next";

import ActionButton from "@/components/ActionButton";

export interface AccountTreeNode {
  id: string;
  name: string;
  type?: string | null;
  currency_code: string;
  children?: AccountTreeNode[];
}

interface ColumnConfig {
  key: string;
  header: string;
  className?: string;
}

interface RenderCellResult {
  key: string;
  content: ReactNode;
  className?: string;
}

interface SnapshotAccountTableProps<TNode extends AccountTreeNode> {
  columns: ColumnConfig[];
  accountTree: TNode[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  renderCells: (params: {
    node: TNode;
    depth: number;
    hasChildren: boolean;
    isExpanded: boolean;
  }) => RenderCellResult[];
  t: TFunction;
}

function SnapshotAccountTable<TNode extends AccountTreeNode>({
  columns,
  accountTree,
  expanded,
  onToggle,
  renderCells,
  t,
}: SnapshotAccountTableProps<TNode>) {
  const renderRows = (nodes: TNode[], depth: number): Array<ReactNode> => {
    return nodes.flatMap((node) => {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isExpanded = expanded.has(node.id);
      const extraCells = renderCells({
        node,
        depth,
        hasChildren,
        isExpanded,
      });

      const rows: ReactNode[] = [
        <tr
          key={node.id}
          className="border-t border-base-200 text-base-content/80"
        >
          <td
            className={["px-4 py-3 align-top", columns[0]?.className ?? ""]
              .filter(Boolean)
              .join(" ")}
          >
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
                  onClick={() => onToggle(node.id)}
                  ariaLabel={
                    isExpanded ? t("finance.collapse") : t("finance.expand")
                  }
                />
              ) : (
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center text-base-content/30">
                  •
                </span>
              )}
              <div className="min-w-0 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <p className="truncate font-semibold text-base-content">
                  {node.name}
                </p>
                <div className="inline-flex flex-wrap items-center gap-1 text-xs text-base-content/70 sm:flex-nowrap">
                  <span className="rounded-full bg-base-200 px-2 py-0.5">
                    {node.currency_code}
                  </span>
                </div>
              </div>
            </div>
          </td>
          {extraCells.map((cell, index) => (
            <td
              key={cell.key}
              className={[
                "px-4 py-3 align-top",
                columns[index + 1]?.className ?? "",
                cell.className ?? "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {cell.content}
            </td>
          ))}
        </tr>,
      ];

      if (hasChildren && isExpanded) {
        rows.push(...renderRows((node.children ?? []) as TNode[], depth + 1));
      }

      return rows;
    });
  };

  return (
    <table className="min-w-full text-sm">
      <thead className="bg-base-200/60 text-left text-xs uppercase text-base-content/60">
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              className={["px-4 py-2", column.className ?? ""]
                .filter(Boolean)
                .join(" ")}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{renderRows(accountTree, 0)}</tbody>
    </table>
  );
}

export default SnapshotAccountTable;
