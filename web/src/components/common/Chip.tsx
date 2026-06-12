import React, { useCallback } from "react";

export type ChipTone =
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "info"
  | "warning"
  | "neutral";

type ChipSize = "sm" | "md" | "lg";

interface ChipProps {
  children: React.ReactNode;
  tone?: ChipTone;
  size?: ChipSize;
  className?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
}

const baseClassName =
  "inline-flex items-center gap-1 rounded-full border font-medium transition-colors";

const sizeClassMap: Record<ChipSize, string> = {
  sm: "px-2 py-0.5 text-sm rounded-md",
  md: "px-2.5 py-1 text-base rounded-md",
  lg: "px-3 py-1.5 text-base rounded-lg",
};

const toneClassMap: Record<
  ChipTone,
  { base: string; interactive: string; focus: string }
> = {
  primary: {
    base: "border-primary/30 bg-primary/10 text-primary",
    interactive: "hover:border-primary hover:bg-primary/20",
    focus: "focus-visible:ring-primary/30",
  },
  secondary: {
    base: "border-secondary/30 bg-secondary/10 text-secondary",
    interactive: "hover:border-secondary hover:bg-secondary/20",
    focus: "focus-visible:ring-secondary/30",
  },
  accent: {
    base: "border-accent/30 bg-accent/10 text-accent",
    interactive: "hover:border-accent hover:bg-accent/20",
    focus: "focus-visible:ring-accent/30",
  },
  success: {
    base: "border-success/30 bg-success/10 text-success",
    interactive: "hover:border-success hover:bg-success/20",
    focus: "focus-visible:ring-success/30",
  },
  info: {
    base: "border-info/30 bg-info/10 text-info",
    interactive: "hover:border-info hover:bg-info/20",
    focus: "focus-visible:ring-info/30",
  },
  warning: {
    base: "border-warning/30 bg-warning/10 text-warning",
    interactive: "hover:border-warning hover:bg-warning/20",
    focus: "focus-visible:ring-warning/30",
  },
  neutral: {
    base: "border-base-300 bg-base-200 text-base-content/70",
    interactive: "hover:bg-base-300",
    focus: "focus-visible:ring-base-300",
  },
};

export default function Chip({
  children,
  tone = "primary",
  size = "md",
  className = "",
  icon,
  onClick,
  onRemove,
}: ChipProps) {
  const isInteractive = Boolean(onClick);
  const toneClasses = toneClassMap[tone];

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (!onClick) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick();
      }
    },
    [onClick],
  );

  const content = (
    <>
      {icon ? <span className="inline-flex items-center">{icon}</span> : null}
      <span>{children}</span>
      {onRemove ? (
        <button
          type="button"
          className="ml-1 text-current transition-colors hover:text-error"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label="Remove"
        >
          ×
        </button>
      ) : null}
    </>
  );

  const classes = [
    baseClassName,
    sizeClassMap[size],
    toneClasses.base,
    isInteractive ? `${toneClasses.interactive} cursor-pointer` : "",
    isInteractive
      ? `focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${toneClasses.focus}`
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (isInteractive && !onRemove) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <span
      className={classes}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      {content}
    </span>
  );
}
