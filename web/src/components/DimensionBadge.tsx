import React from "react";
import type { UUID } from "@/types/primitive";

interface DimensionBadgeProps {
  /** When provided, used to look up name/color if `name`/`color` not directly given */
  dimensionId?: UUID;
  /** Dimension lookup map: id -> { name, color } (stable reference is recommended) */
  dimensionMap?: Map<UUID, { name: string; color: string }>;
  /** Direct name override; takes precedence over map */
  name?: string;
  /** Direct color override; takes precedence over map */
  color?: string;
  /** Show the name text; set false to render dot only */
  showLabel?: boolean;
  /** Backward-compat: when true, show unknown label text; prefer `showLabel` */
  showUnknownText?: boolean;
  className?: string;
  /** Control dot size: sm (2), md (3), lg (4) */
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}

const DimensionBadgeComponent: React.FC<DimensionBadgeProps> = ({
  dimensionId,
  dimensionMap,
  name,
  color,
  showLabel,
  showUnknownText = true,
  className,
  size = "md",
  ariaLabel,
}) => {
  const dotClass =
    size === "lg" ? "w-4 h-4" : size === "sm" ? "w-2 h-2" : "w-3 h-3";

  const isUnknownId = typeof dimensionId === "string" && dimensionId === "-1";

  const resolvedColor =
    color ??
    (typeof dimensionId === "string"
      ? (dimensionMap?.get(dimensionId)?.color ??
        (isUnknownId ? "#9CA3AF" : "#6B7280"))
      : "#6B7280");

  const resolvedName =
    name ??
    (typeof dimensionId === "string"
      ? (dimensionMap?.get(dimensionId)?.name ??
        (isUnknownId ? "未知" : showUnknownText ? "未知维度" : ""))
      : "");

  const shouldShowLabel =
    typeof showLabel === "boolean" ? showLabel : showUnknownText;

  return (
    <div
      className={["flex items-center flex-shrink-0", className || ""]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={`${dotClass} rounded-full mr-2 inline-block flex-shrink-0`}
        style={{ backgroundColor: resolvedColor }}
        aria-label={ariaLabel || resolvedName || "dimension"}
      />
      {shouldShowLabel ? (
        <span className="text-base text-base-content truncate max-w-[120px]">
          {resolvedName}
        </span>
      ) : null}
    </div>
  );
};

const DimensionBadge = React.memo(
  DimensionBadgeComponent,
  (prev, next) =>
    prev.dimensionId === next.dimensionId &&
    prev.dimensionMap === next.dimensionMap &&
    prev.name === next.name &&
    prev.color === next.color &&
    prev.showLabel === next.showLabel &&
    prev.showUnknownText === next.showUnknownText &&
    prev.className === next.className &&
    prev.size === next.size &&
    prev.ariaLabel === next.ariaLabel,
);

export default DimensionBadge;
