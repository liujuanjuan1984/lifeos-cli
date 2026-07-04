import { useTranslation } from "react-i18next";
import type { KeyboardEvent, MutableRefObject, ReactNode } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDropdownSurface } from "./useDropdownSurface";
import { asSelectorString, type SelectorValue } from "./selectorTypes";
import { SELECT_LABEL_TEXT_CLASS } from "@/components/forms/styles";

export interface EntityOption {
  id: string;
  label: string;
  disabled?: boolean;
  description?: string;
  data?: unknown;
}

export type SelectSize = "sm" | "md" | "lg";

interface RenderOptionArgs {
  option: EntityOption;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  select: () => void;
  highlight: () => void;
}

export interface AsyncEntitySelectProps {
  value?: SelectorValue;
  onChange: (value: SelectorValue) => void;
  options: EntityOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: SelectSize;
  className?: string;
  allowUndefined?: boolean;
  fullWidth?: boolean;
  id?: string;
  idPrefix?: string;
  label?: string;
  showLabel?: boolean;
  "aria-describedby"?: string;
  usePortal?: boolean;
  dropdownClassName?: string;
  dropdownOffset?: number;
  dropdownMinWidth?: number;
  dropdownMaxWidth?: number;
  dropdownPreferredWidth?:
    | number
    | ((anchorRect: DOMRect) => number | null | undefined);
  dropdownZIndexClassName?: string;
  renderOption?: (args: RenderOptionArgs) => ReactNode;
  renderEmpty?: (query: string) => ReactNode;
  renderLoading?: () => ReactNode;
  isLoading?: boolean;
  hasMoreOptions?: boolean;
  isLoadingMore?: boolean;
  loadMoreLabel?: string;
  onLoadMore?: () => void;
  onSearchQueryChange?: (query: string) => void;
  onFocus?: () => void;
  onClick?: () => void;
}

const MENU_ITEM_HEIGHT = 40;
const MAX_DROPDOWN_HEIGHT = 264;
const MIN_AUTO_WIDTH = 176;

const AsyncEntitySelect = forwardRef<HTMLInputElement, AsyncEntitySelectProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder,
      disabled = false,
      size = "sm",
      className = "",
      allowUndefined = false,
      fullWidth = true,
      id,
      idPrefix = "async-entity",
      label,
      showLabel = false,
      "aria-describedby": ariaDescribedBy,
      usePortal = true,
      dropdownClassName,
      dropdownOffset = 4,
      dropdownMinWidth,
      dropdownMaxWidth,
      dropdownPreferredWidth,
      dropdownZIndexClassName,
      renderOption,
      renderEmpty,
      renderLoading,
      isLoading = false,
      hasMoreOptions = false,
      isLoadingMore = false,
      loadMoreLabel,
      onLoadMore,
      onSearchQueryChange,
      onFocus,
      onClick,
    },
    forwardedRef,
  ) => {
    const { t } = useTranslation();
    const autoId = useId();
    const inputId = id ?? `${idPrefix}-${autoId}`;
    const effectivePlaceholder = placeholder ?? t("common.please_select");

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const shouldOpenOnFocusRef = useRef(false);
    const mergeInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as MutableRefObject<HTMLInputElement | null>).current =
            node;
        }
      },
      [forwardedRef],
    );

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [contentWidth, setContentWidth] = useState<number | null>(null);
    const [isInHeaderContext, setIsInHeaderContext] = useState(false);
    const shouldMeasureAutoWidth =
      !fullWidth && dropdownPreferredWidth === undefined;

    const normalizedValue = asSelectorString(value);
    const previousValueRef = useRef(normalizedValue);

    const selectedOption = useMemo(() => {
      if (!normalizedValue) return undefined;
      return options.find((option) => option.id === normalizedValue);
    }, [options, normalizedValue]);

    const filteredOptions = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return options;
      return options.filter((option) => option.label.toLowerCase().includes(q));
    }, [options, query]);

    const measurementText = useMemo(() => {
      if (fullWidth) return "";
      const longestLabel = options.reduce(
        (longest, option) => {
          return option.label.length > longest.length ? option.label : longest;
        },
        selectedOption?.label ?? effectivePlaceholder ?? "",
      );
      return longestLabel;
    }, [effectivePlaceholder, fullWidth, options, selectedOption?.label]);

    useEffect(() => {
      if (!shouldMeasureAutoWidth) {
        setContentWidth(null);
        return;
      }
      if (typeof document === "undefined") return;

      const text = measurementText || "";
      if (!text) {
        setContentWidth(null);
        return;
      }

      const tempElement = document.createElement("span");
      tempElement.style.visibility = "hidden";
      tempElement.style.position = "absolute";
      tempElement.style.whiteSpace = "nowrap";
      tempElement.style.fontSize =
        size === "sm" ? "0.875rem" : size === "lg" ? "1.125rem" : "1rem";
      tempElement.style.fontFamily = "inherit";
      tempElement.textContent = text;
      document.body.appendChild(tempElement);
      const measuredWidth = tempElement.getBoundingClientRect().width;
      document.body.removeChild(tempElement);
      setContentWidth(Math.ceil(measuredWidth + 48));
    }, [shouldMeasureAutoWidth, measurementText, size]);

    const closeDropdown = useCallback(() => {
      setIsOpen(false);
      setQuery("");
      onSearchQueryChange?.("");
    }, [onSearchQueryChange]);

    const dropdown = useDropdownSurface({
      anchorRef: containerRef,
      isOpen,
      onRequestClose: closeDropdown,
      usePortal,
      offset: dropdownOffset,
      positionConfig: {
        menuItemHeight: MENU_ITEM_HEIGHT,
        maxVisibleItems: Math.ceil(MAX_DROPDOWN_HEIGHT / MENU_ITEM_HEIGHT),
        maxHeight: MAX_DROPDOWN_HEIGHT,
      },
      minWidth:
        dropdownMinWidth ??
        (shouldMeasureAutoWidth ? MIN_AUTO_WIDTH : undefined),
      maxWidth: dropdownMaxWidth,
      getPreferredWidth: dropdownPreferredWidth
        ? typeof dropdownPreferredWidth === "function"
          ? dropdownPreferredWidth
          : () => dropdownPreferredWidth
        : shouldMeasureAutoWidth
          ? (rect) => {
              if (contentWidth) {
                return Math.max(rect.width, contentWidth);
              }
              return rect.width;
            }
          : undefined,
    });

    useEffect(() => {
      if (previousValueRef.current !== normalizedValue) {
        previousValueRef.current = normalizedValue;
        if (isOpen) {
          setIsOpen(false);
        }
        if (query) {
          setQuery("");
          onSearchQueryChange?.("");
        }
      }
    }, [isOpen, normalizedValue, onSearchQueryChange, query]);
    const {
      renderSurface,
      menuRef,
      getSurfaceStyle,
      dataTheme,
      recomputePosition,
    } = dropdown;

    useEffect(() => {
      if (isOpen) {
        recomputePosition();
      }
    }, [recomputePosition, filteredOptions.length, isOpen, isLoading]);

    useEffect(() => {
      if (!isOpen) return;
      const index = filteredOptions.findIndex(
        (option) => option.id === normalizedValue,
      );
      setHighlightedIndex(index >= 0 ? index : 0);
    }, [filteredOptions, isOpen, normalizedValue]);

    useEffect(() => {
      if (!isOpen) return;
      if (highlightedIndex < filteredOptions.length) return;
      if (filteredOptions.length === 0) {
        setHighlightedIndex(0);
        return;
      }
      setHighlightedIndex(filteredOptions.length - 1);
    }, [filteredOptions, highlightedIndex, isOpen]);

    useEffect(() => {
      if (!isOpen) return;
      const activeOption = filteredOptions[highlightedIndex];
      if (!activeOption) return;
      if (!menuRef.current) return;
      const elementId = `${inputId}-menu-option-${activeOption.id}`;
      const activeElement = document.getElementById(elementId);
      if (!(activeElement instanceof HTMLElement)) return;
      const menuNode = menuRef.current;
      const { offsetTop, offsetHeight } = activeElement;
      const { scrollTop, clientHeight } = menuNode;
      if (offsetTop < scrollTop) {
        menuNode.scrollTop = offsetTop;
      } else if (offsetTop + offsetHeight > scrollTop + clientHeight) {
        menuNode.scrollTop = offsetTop + offsetHeight - clientHeight;
      }
    }, [menuRef, filteredOptions, highlightedIndex, inputId, isOpen]);

    const openDropdown = useCallback(() => {
      if (disabled) return;
      setIsOpen(true);
    }, [disabled]);

    const markUserInitiatedFocus = useCallback(() => {
      if (disabled) return;
      shouldOpenOnFocusRef.current = true;
    }, [disabled]);

    const handleFocus = useCallback(() => {
      if (disabled) return;
      onFocus?.();
      if (shouldOpenOnFocusRef.current) {
        shouldOpenOnFocusRef.current = false;
        openDropdown();
      }
    }, [disabled, openDropdown, onFocus]);

    const handleBlur = useCallback(() => {
      shouldOpenOnFocusRef.current = false;
    }, []);

    const handleOptionPick = useCallback(
      (optionId: string) => {
        closeDropdown();
        requestAnimationFrame(() => {
          inputRef.current?.blur();
        });
        if (optionId === "" && allowUndefined) {
          onChange(undefined);
        } else {
          onChange(optionId);
        }
      },
      [allowUndefined, closeDropdown, onChange],
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (!isOpen && (event.key === "ArrowDown" || event.key === "Enter")) {
        event.preventDefault();
        openDropdown();
        return;
      }

      if (!isOpen) return;

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          setHighlightedIndex((prev) =>
            Math.min(prev + 1, Math.max(filteredOptions.length - 1, 0)),
          );
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        }
        case "Enter": {
          event.preventDefault();
          const option = filteredOptions[highlightedIndex];
          if (option && !option.disabled) {
            handleOptionPick(option.id);
          }
          break;
        }
        case "Escape": {
          event.preventDefault();
          closeDropdown();
          break;
        }
        default:
          break;
      }
    };

    const displayValue = isOpen ? query : (selectedOption?.label ?? "");

    const inputSizeClass =
      size === "sm" ? "input-sm" : size === "lg" ? "input-lg" : "input-md";

    const containerClassName = [
      "relative",
      "form-control",
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const inputClassName = [
      "input",
      "input-bordered",
      inputSizeClass,
      fullWidth ? "w-full" : "",
      disabled ? "cursor-not-allowed" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const dropdownBaseZClass =
      dropdownZIndexClassName ??
      (isInHeaderContext ? "z-sidebar" : "z-modal-nested");

    const dropdownClassNames = [
      dropdownBaseZClass,
      "bg-base-100",
      "border border-base-300",
      "rounded-md",
      "shadow-lg",
      "overflow-y-auto",
      usePortal ? "" : "mt-1",
      fullWidth ? "w-full" : "",
      dropdownClassName,
    ]
      .filter(Boolean)
      .join(" ");

    useEffect(() => {
      if (dropdownZIndexClassName) {
        if (isInHeaderContext) {
          setIsInHeaderContext(false);
        }
        return;
      }

      const node = containerRef.current;
      if (!node) {
        if (isInHeaderContext) {
          setIsInHeaderContext(false);
        }
        return;
      }

      const headerNode = node.closest("header");
      const detectedInHeader =
        headerNode instanceof HTMLElement &&
        headerNode.classList.contains("z-header");
      if (detectedInHeader !== isInHeaderContext) {
        setIsInHeaderContext(detectedInHeader);
      }
    }, [dropdownZIndexClassName, isInHeaderContext]);

    const emptyContent: ReactNode = renderEmpty?.(query) ?? (
      <div className="p-3 text-center text-base-content/60">
        {t("common.no_options")}
      </div>
    );

    const loadingContent: ReactNode = renderLoading?.() ?? (
      <div className="p-3 text-center text-base-content/60">
        <span
          className="loading loading-spinner loading-xs text-primary mr-2"
          aria-hidden="true"
        ></span>
        {t("common.loading")}
      </div>
    );

    const menuId = `${inputId}-menu`;
    const highlightedOption = filteredOptions[highlightedIndex];
    const activeDescendant =
      isOpen && highlightedOption
        ? `${menuId}-option-${highlightedOption.id}`
        : undefined;

    const dropdownContent = renderSurface(
      <div
        ref={(node) => {
          menuRef.current = node;
        }}
        id={menuId}
        role="listbox"
        className={dropdownClassNames}
        style={getSurfaceStyle()}
        data-theme={dataTheme}
      >
        {isLoading ? (
          loadingContent
        ) : filteredOptions.length === 0 ? (
          emptyContent
        ) : (
          <div className="py-1">
            {filteredOptions.map((option, index) => {
              const isSelected = option.id === normalizedValue;
              const isActive = index === highlightedIndex;
              const select = () => handleOptionPick(option.id);
              const highlight = () => setHighlightedIndex(index);
              if (renderOption) {
                return (
                  <div
                    key={option.id}
                    onMouseEnter={highlight}
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    {renderOption({
                      option,
                      index,
                      isActive,
                      isSelected,
                      select,
                      highlight,
                    })}
                  </div>
                );
              }

              const optionClasses = [
                "w-full",
                "px-3",
                "py-2",
                "text-left",
                "text-base",
                "transition-colors",
                "focus:outline-none",
                option.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : isSelected
                    ? "bg-primary text-primary-content cursor-pointer"
                    : isActive
                      ? "bg-base-200 cursor-pointer"
                      : "cursor-pointer hover:bg-base-200",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={option.id}
                  id={`${menuId}-option-${option.id}`}
                  type="button"
                  role="button"
                  className={optionClasses}
                  disabled={option.disabled}
                  onMouseEnter={highlight}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (!option.disabled) {
                      select();
                    }
                  }}
                  aria-selected={isSelected}
                >
                  <span className="block whitespace-normal break-words">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="block text-sm text-base-content/70">
                      {option.description}
                    </span>
                  )}
                </button>
              );
            })}
            {hasMoreOptions && (
              <button
                type="button"
                className="w-full px-3 py-2 text-center text-base text-primary hover:bg-base-200 disabled:opacity-60"
                disabled={isLoadingMore}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!isLoadingMore) {
                    onLoadMore?.();
                  }
                }}
              >
                {isLoadingMore
                  ? t("common.loading")
                  : (loadMoreLabel ?? t("common.loadMore"))}
              </button>
            )}
          </div>
        )}
      </div>,
    );

    return (
      <div ref={containerRef} className={containerClassName}>
        {showLabel && label && (
          <label htmlFor={inputId} className="label">
            <span className={SELECT_LABEL_TEXT_CLASS}>{label}</span>
          </label>
        )}

        <input
          ref={mergeInputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
          aria-activedescendant={activeDescendant}
          aria-describedby={ariaDescribedBy}
          className={inputClassName}
          placeholder={effectivePlaceholder}
          disabled={disabled}
          value={displayValue}
          onPointerDown={markUserInitiatedFocus}
          onMouseDown={markUserInitiatedFocus}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={() => {
            onClick?.();
            openDropdown();
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            onSearchQueryChange?.(nextQuery);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />

        {dropdownContent}
      </div>
    );
  },
);

AsyncEntitySelect.displayName = "AsyncEntitySelect";

export default AsyncEntitySelect;
