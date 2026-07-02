import React from "react";

import ActionButton from "@/components/ActionButton";

type TreeDisclosureShape = "square" | "circle";
type TreeLeafIndicator = "disabled-chevron" | "bullet" | "empty";
type TreeRowLayout = "card" | "table";
type TreeRowTone = "default" | "aggregate";

interface TreeDisclosureProps {
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle?: () => void;
  expandedLabel: string;
  collapsedLabel: string;
  noChildrenLabel?: string;
  shape?: TreeDisclosureShape;
  leafIndicator?: TreeLeafIndicator;
  className?: string;
}

type TreeRowSurfaceBaseProps = {
  layout?: TreeRowLayout;
  tone?: TreeRowTone;
  className?: string;
  children: React.ReactNode;
};

interface TreeNodeIndentProps {
  depth: number;
  maxDepth?: number;
  className?: string;
  children: React.ReactNode;
}

interface TreeNodeControlProps {
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  expandedLabel: string;
  collapsedLabel: string;
  noChildrenLabel?: string;
  onToggle?: () => void;
  maxDepth?: number;
  shape?: TreeDisclosureShape;
  leafIndicator?: TreeLeafIndicator;
  className?: string;
  disclosureClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

type TreeRowSurfaceProps =
  | (TreeRowSurfaceBaseProps &
      Omit<React.HTMLAttributes<HTMLDivElement>, keyof TreeRowSurfaceBaseProps> & {
        as?: "div";
      })
  | (TreeRowSurfaceBaseProps &
      Omit<React.HTMLAttributes<HTMLTableRowElement>, keyof TreeRowSurfaceBaseProps> & {
        as: "tr";
      });

const disclosureBaseClass =
  "inline-flex h-6 min-h-6 w-6 min-w-6 flex-shrink-0 items-center justify-center";

const leafIndicatorClass =
  "text-base-content/30 transition-colors group-hover/tree-row:text-primary/60";

function getRowSurfaceClassName(
  layout: TreeRowLayout,
  tone: TreeRowTone,
  className?: string,
) {
  const common =
    "group/tree-row transition-all duration-200 ease-in-out focus-within:bg-primary/10";
  const layoutClass =
    layout === "card"
      ? "flex items-center gap-2 rounded-md border border-base-300 bg-base-100 px-2 py-2 hover:border-primary/40 hover:bg-primary/10 hover:shadow-sm focus-within:border-primary/40"
      : "border-base-200 hover:bg-primary/10";
  const toneClass = layout === "table" && tone === "aggregate" ? "bg-base-200/60" : "";

  return [common, layoutClass, toneClass, className].filter(Boolean).join(" ");
}

export function TreeDisclosure({
  hasChildren,
  isExpanded,
  onToggle,
  expandedLabel,
  collapsedLabel,
  noChildrenLabel,
  shape = "square",
  leafIndicator = "disabled-chevron",
  className = "",
}: TreeDisclosureProps) {
  if (hasChildren) {
    return (
      <ActionButton
        label=""
        ariaLabel={isExpanded ? expandedLabel : collapsedLabel}
        ariaExpanded={isExpanded}
        iconName={isExpanded ? "chevron-down" : "chevron-right"}
        iconOnly
        shape={shape}
        size="xs"
        variant="ghost"
        className={[
          disclosureBaseClass,
          "p-0 hover:bg-primary/20 hover:text-primary",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onToggle}
      />
    );
  }

  if (leafIndicator === "disabled-chevron") {
    return (
      <ActionButton
        label=""
        ariaLabel={noChildrenLabel ?? collapsedLabel}
        iconName="chevron-right"
        iconOnly
        shape={shape}
        size="xs"
        variant="ghost"
        disabled
        className={[
          disclosureBaseClass,
          "cursor-default p-0 text-base-content/30",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

  return (
    <span
      className={[disclosureBaseClass, leafIndicatorClass, className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      {leafIndicator === "bullet" ? "•" : null}
    </span>
  );
}

export function TreeRowSurface({
  as = "div",
  layout = "card",
  tone = "default",
  className,
  children,
  ...rest
}: TreeRowSurfaceProps) {
  const resolvedClassName = getRowSurfaceClassName(layout, tone, className);

  if (as === "tr") {
    return (
      <tr
        className={resolvedClassName}
        {...(rest as React.HTMLAttributes<HTMLTableRowElement>)}
      >
        {children}
      </tr>
    );
  }

  return (
    <div
      className={resolvedClassName}
      {...(rest as React.HTMLAttributes<HTMLDivElement>)}
    >
      {children}
    </div>
  );
}

function TreeNodeIndent({
  depth,
  maxDepth = 6,
  className = "",
  children,
}: TreeNodeIndentProps) {
  const visibleDepth = Math.max(0, Math.min(depth, maxDepth));

  return (
    <div
      className={["flex min-h-[2.25rem] items-start gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      {Array.from({ length: visibleDepth }, (_, index) => (
        <span
          key={index}
          className="h-9 w-4 flex-shrink-0 border-l border-base-300"
          aria-hidden
        />
      ))}
      {children}
    </div>
  );
}

export function TreeNodeControl({
  depth,
  hasChildren,
  isExpanded,
  expandedLabel,
  collapsedLabel,
  noChildrenLabel,
  onToggle,
  maxDepth,
  shape = "square",
  leafIndicator = "disabled-chevron",
  className = "",
  disclosureClassName = "mt-1",
  contentClassName = "",
  children,
}: TreeNodeControlProps) {
  return (
    <TreeNodeIndent depth={depth} maxDepth={maxDepth} className={className}>
      <TreeDisclosure
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        expandedLabel={expandedLabel}
        collapsedLabel={collapsedLabel}
        noChildrenLabel={noChildrenLabel}
        shape={shape}
        leafIndicator={leafIndicator}
        className={disclosureClassName}
        onToggle={onToggle}
      />
      <div className={["min-w-0 flex-1", contentClassName].filter(Boolean).join(" ")}>
        {children}
      </div>
    </TreeNodeIndent>
  );
}
