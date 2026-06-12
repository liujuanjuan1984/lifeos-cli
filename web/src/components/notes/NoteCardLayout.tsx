import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useId,
} from "react";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/utils/datetime";
import type { UUID } from "@/types/primitive";
import {
  NOTE_COLLAPSE_ALLOWED_LINES,
  defaultNoteCollapseLines,
  isValidNoteCollapseValue,
} from "@/hooks/notes/useNoteCollapsePreference";
import ActionButton from "@/components/ActionButton";
import { Icon } from "@/components/icons";

type AssociationType = "person" | "tag" | "task" | "timelog";

export interface NoteCardAssociation {
  id: UUID | string;
  type: AssociationType;
  label: string;
  icon: React.ReactNode;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  onMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void;
  onMouseMove?: (event: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave?: () => void;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  onBlur?: () => void;
  ariaDescribedBy?: string;
}

interface NoteCardLayoutProps {
  content: string;
  contentNode?: React.ReactNode;
  associations?: NoteCardAssociation[];
  createdAt: string;
  actions?: React.ReactNode;
  actionsVisibility?: "always" | "hover";
  className?: string;
  contentClassName?: string;
  collapsible?: boolean;
  collapsedContentClassName?: string;
  minCollapsedLines?: number;
  maxCollapsedCharacters?: number;
}

const associationBaseClass =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

const associationPalette = {
  person: {
    base: "bg-success/10 text-success border-success/20 hover:bg-success/20 hover:border-success/30",
    active:
      "bg-success text-success-content border-success shadow-sm hover:bg-success",
    focus: "focus-visible:ring-success/40",
  },
  tag: {
    base: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:border-primary/30",
    active:
      "bg-primary text-primary-content border-primary shadow-sm hover:bg-primary",
    focus: "focus-visible:ring-primary/40",
  },
  task: {
    base: "bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20 hover:border-secondary/30",
    active:
      "bg-secondary text-secondary-content border-secondary shadow-sm hover:bg-secondary",
    focus: "focus-visible:ring-secondary/40",
  },
  timelog: {
    base: "bg-info/10 text-info border-info/20 hover:bg-info/20 hover:border-info/30",
    active: "bg-info text-info-content border-info shadow-sm hover:bg-info",
    focus: "focus-visible:ring-info/40",
  },
} as const;

const defaultContentClassName =
  "prose-base prose-p:my-2 prose-p:whitespace-pre-wrap prose-ul:my-2 prose-ol:my-2 prose-li:my-1";

const LazyMarkdownRenderer = lazy(
  () => import("@/components/common/MarkdownRenderer"),
);

const MARKDOWN_HEURISTICS =
  /(^|\s)([*_~]{1,2}).+([*_~]{1,2})|`{1,3}[^`]+`{1,3}|(^|\s)#{1,6}\s|\[[^\]]+]\([^)]+\)|!\[[^\]]*]\([^)]+\)|^\s{0,3}[-*+]\s|^\s{0,3}\d+\.\s/m;

function containsMarkdownSyntax(value: string): boolean {
  if (!value) return false;
  return MARKDOWN_HEURISTICS.test(value);
}

const actionsVisibilityClassMap = {
  always: "opacity-100",
  hover:
    "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200",
} as const;

export default function NoteCardLayout({
  content,
  contentNode,
  associations = [],
  createdAt,
  actions,
  actionsVisibility = "hover",
  className = "",
  contentClassName,
  collapsible = true,
  collapsedContentClassName,
  minCollapsedLines,
  maxCollapsedCharacters,
}: NoteCardLayoutProps) {
  const containerClassName = ["group", className].filter(Boolean).join(" ");
  const actionsClassName = actions
    ? actionsVisibilityClassMap[actionsVisibility]
    : "";
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  const resolvedMinLines = useMemo(() => {
    if (isValidNoteCollapseValue(minCollapsedLines ?? 0)) {
      return minCollapsedLines as number;
    }
    return defaultNoteCollapseLines;
  }, [minCollapsedLines]);

  const charactersThreshold = useMemo(() => {
    if (
      typeof maxCollapsedCharacters === "number" &&
      maxCollapsedCharacters > 0
    ) {
      return maxCollapsedCharacters;
    }
    return Math.max(resolvedMinLines * 120, 480);
  }, [maxCollapsedCharacters, resolvedMinLines]);

  const lineCount = useMemo(() => {
    if (!content) return 0;
    return content.split(/\r?\n/).length;
  }, [content]);

  const trimmedLength = useMemo(() => content.trim().length, [content]);

  const heuristicsSuggestLong = useMemo(() => {
    if (!content) return false;
    if (lineCount > resolvedMinLines) return true;
    if (trimmedLength > charactersThreshold) return true;
    return false;
  }, [
    charactersThreshold,
    content,
    lineCount,
    resolvedMinLines,
    trimmedLength,
  ]);

  useEffect(() => {
    setIsExpanded(false);
  }, [content]);

  const shouldShowToggle = collapsible && heuristicsSuggestLong;
  const shouldClamp = shouldShowToggle && !isExpanded;

  const allowedCollapsedLines = useMemo(() => {
    if (
      NOTE_COLLAPSE_ALLOWED_LINES.includes(
        resolvedMinLines as (typeof NOTE_COLLAPSE_ALLOWED_LINES)[number],
      )
    ) {
      return resolvedMinLines;
    }
    return defaultNoteCollapseLines;
  }, [resolvedMinLines]);

  const collapsedInnerClassName = useMemo(() => {
    const classes = ["note-card-collapsed-inner"];
    if (shouldClamp && collapsedContentClassName) {
      classes.push(collapsedContentClassName);
    }
    return classes.join(" ");
  }, [collapsedContentClassName, shouldClamp]);

  const collapsedWrapperClassName = useMemo(() => {
    if (!collapsible) return "";
    return "note-card-collapsed overflow-hidden";
  }, [collapsible]);

  const contentWrapperClassName = useMemo(
    () =>
      [
        "cursor-text p-1 rounded -m-1 select-text",
        shouldClamp ? collapsedWrapperClassName : "",
      ]
        .filter(Boolean)
        .join(" "),
    [collapsedWrapperClassName, shouldClamp],
  );

  type CollapsedStyle = React.CSSProperties & {
    "--note-collapsed-lines"?: number;
  };

  const collapsedInnerStyle = useMemo<CollapsedStyle | undefined>(() => {
    if (!shouldClamp) {
      return undefined;
    }

    return {
      overflow: "hidden",
      "--note-collapsed-lines": allowedCollapsedLines,
    };
  }, [allowedCollapsedLines, shouldClamp]);

  const baseContentClassName = useMemo(
    () => contentClassName ?? defaultContentClassName,
    [contentClassName],
  );

  const shouldRenderMarkdown = useMemo(() => {
    if (contentNode) {
      return false;
    }
    return containsMarkdownSyntax(content);
  }, [content, contentNode]);

  const plainTextContent = useMemo(
    () => (
      <div className={baseContentClassName} data-testid="note-plain-content">
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    ),
    [baseContentClassName, content],
  );

  return (
    <div className={containerClassName}>
      <div className="mb-2">
        <div
          id={contentId}
          className={contentWrapperClassName}
          data-collapsed={shouldClamp ? "true" : "false"}
        >
          <div
            className={shouldClamp ? collapsedInnerClassName : ""}
            style={collapsedInnerStyle}
          >
            {contentNode ??
              (shouldRenderMarkdown ? (
                <Suspense fallback={plainTextContent}>
                  <LazyMarkdownRenderer
                    content={content}
                    className={baseContentClassName}
                  />
                </Suspense>
              ) : (
                plainTextContent
              ))}
          </div>
        </div>

        {shouldShowToggle && (
          <div className="mt-3 space-y-1">
            <ActionButton
              type="button"
              label={isExpanded ? t("common.collapse") : t("common.expand")}
              icon={
                <Icon
                  name="chevron-down"
                  className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              }
              size="sm"
              color="primary"
              variant="ghost"
              onClick={() => setIsExpanded((prev) => !prev)}
              ariaExpanded={isExpanded}
              ariaLabel={isExpanded ? t("common.collapse") : t("common.expand")}
              className="hover:bg-primary/10"
            />
            {!isExpanded && (
              <p className="text-xs text-base-content/60">
                {t("notes.collapseDisplayHint", {
                  count: resolvedMinLines,
                })}
              </p>
            )}
          </div>
        )}

        {associations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {associations.map((assoc) => {
              const { type } = assoc;
              const palette = associationPalette[type];
              const hasClick = !assoc.disabled && !!assoc.onClick;
              const hasTooltipHandlers = Boolean(
                assoc.onMouseEnter ||
                  assoc.onMouseMove ||
                  assoc.onMouseLeave ||
                  assoc.onFocus ||
                  assoc.onBlur,
              );
              const isInteractive = hasClick || hasTooltipHandlers;
              const interactionClasses = isInteractive
                ? ""
                : "pointer-events-none opacity-60";
              const focusClass = isInteractive ? palette.focus : "";
              const className = [
                associationBaseClass,
                palette[assoc.active ? "active" : "base"],
                focusClass,
                interactionClasses,
              ]
                .filter(Boolean)
                .join(" ");

              const sharedProps = {
                className,
                title: assoc.title,
              } as const;

              const elementKey = `${type}-${assoc.id}`;

              if (isInteractive) {
                return (
                  <button
                    key={elementKey}
                    type="button"
                    {...sharedProps}
                    onClick={(event) => {
                      event.stopPropagation();
                      assoc.onClick?.(event);
                    }}
                    onMouseEnter={assoc.onMouseEnter}
                    onMouseMove={assoc.onMouseMove}
                    onMouseLeave={assoc.onMouseLeave}
                    onFocus={(event) => {
                      assoc.onFocus?.(event);
                    }}
                    onBlur={() => {
                      assoc.onBlur?.();
                    }}
                    aria-describedby={assoc.ariaDescribedBy}
                  >
                    <span className="flex-shrink-0" aria-hidden>
                      {assoc.icon}
                    </span>
                    <span className="truncate max-w-[10rem]">
                      {assoc.label}
                    </span>
                  </button>
                );
              }

              return (
                <span key={elementKey} {...sharedProps}>
                  <span className="flex-shrink-0" aria-hidden>
                    {assoc.icon}
                  </span>
                  <span className="truncate max-w-[10rem]">{assoc.label}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-1 pb-0 border-t border-base-200 -mx-3 -mb-3 px-3">
        <time className="text-sm text-base-content/60" dateTime={createdAt}>
          {formatDateTime(createdAt)}
        </time>

        {actions ? (
          <div className={`flex items-center gap-1 ${actionsClassName}`}>
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
