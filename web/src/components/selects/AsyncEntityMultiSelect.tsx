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
import type { EntityOption, SelectSize } from "./AsyncEntitySelect";
import { SELECT_LABEL_TEXT_CLASS } from "@/components/forms/styles";

export type MultiSelectOption = EntityOption;

interface RenderOptionArgs {
  option: MultiSelectOption;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  select: () => void;
  highlight: () => void;
}

interface RenderTagArgs {
  option: MultiSelectOption;
  remove: () => void;
}

interface AsyncEntityMultiSelectProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: SelectSize;
  className?: string;
  label?: string;
  showLabel?: boolean;
  multiple?: boolean;
  usePortal?: boolean;
  dropdownClassName?: string;
  dropdownOffset?: number;
  dropdownZIndexClassName?: string;
  dropdownMaxHeight?: number;
  isLoading?: boolean;
  renderOption?: (args: RenderOptionArgs) => ReactNode;
  renderTag?: (args: RenderTagArgs) => ReactNode;
  renderEmpty?: (query: string) => ReactNode;
  renderLoading?: () => ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filterOptions?: (
    options: MultiSelectOption[],
    query: string,
  ) => MultiSelectOption[];
  showClearOption?: boolean;
  clearOptionLabel?: string;
  allowCreation?: boolean;
  onCreateOption?: (label: string) => Promise<MultiSelectOption | null>;
  createOptionLabel?: (label: string) => string;
  isCreatingOption?: boolean;
  inputAriaDescribedBy?: string;
  selectedContainerMaxHeight?: number;
  selectedPlacement?: "inline" | "below";
}

const MENU_ITEM_HEIGHT = 40;
const MAX_DROPDOWN_HEIGHT = 320;

const deriveInputSizeClass = (size: SelectSize | undefined) => {
  if (size === "sm") return "input-sm";
  if (size === "lg") return "input-lg";
  return "input-md";
};

const AsyncEntityMultiSelect = forwardRef<
  HTMLInputElement,
  AsyncEntityMultiSelectProps
>(({ multiple = true, ...props }, forwardedRef) => {
  const {
    selectedIds,
    onSelectionChange,
    options,
    placeholder,
    disabled = false,
    size = "sm",
    className = "",
    label,
    showLabel = false,
    usePortal = true,
    dropdownClassName,
    dropdownOffset = 4,
    dropdownZIndexClassName,
    dropdownMaxHeight,
    isLoading = false,
    renderOption,
    renderTag,
    renderEmpty,
    renderLoading,
    searchValue,
    onSearchChange,
    filterOptions,
    showClearOption = false,
    clearOptionLabel,
    allowCreation = false,
    onCreateOption,
    createOptionLabel,
    isCreatingOption,
    inputAriaDescribedBy,
    selectedContainerMaxHeight,
    selectedPlacement = "inline",
  } = props;

  const { t } = useTranslation();
  const autoId = useId();
  const inputId = `async-entity-multi-${autoId}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const isSearchControlled = typeof searchValue === "string";
  const [internalQuery, setInternalQuery] = useState("");
  const query = isSearchControlled ? (searchValue ?? "") : internalQuery;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [internalCreating, setInternalCreating] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedOptions = useMemo(() => {
    if (!multiple && selectedIds.length === 0) return [];
    const map = new Map(options.map((opt) => [opt.id, opt] as const));
    return selectedIds
      .map((id) => map.get(id) ?? { id, label: id })
      .filter(Boolean) as MultiSelectOption[];
  }, [multiple, options, selectedIds]);

  const effectivePlaceholder = placeholder ?? t("common.please_select");

  const effectiveFilter = useCallback(
    (items: MultiSelectOption[], q: string) => {
      if (filterOptions) return filterOptions(items, q);
      const normalized = q.trim().toLowerCase();
      if (!normalized) return items;
      return items.filter((item) =>
        item.label.toLowerCase().includes(normalized),
      );
    },
    [filterOptions],
  );

  const filteredOptions = useMemo(() => {
    const base = effectiveFilter(options, query);
    if (!multiple) {
      return base;
    }
    return base.filter((option) => !selectedSet.has(option.id));
  }, [effectiveFilter, multiple, options, query, selectedSet]);

  const dropdown = useDropdownSurface({
    anchorRef: containerRef,
    isOpen,
    onRequestClose: () => {
      setIsOpen(false);
      if (!isSearchControlled) setInternalQuery("");
    },
    usePortal,
    offset: dropdownOffset,
    positionConfig: {
      menuItemHeight: MENU_ITEM_HEIGHT,
      maxVisibleItems: Math.ceil(
        (dropdownMaxHeight ?? MAX_DROPDOWN_HEIGHT) / MENU_ITEM_HEIGHT,
      ),
      maxHeight: dropdownMaxHeight ?? MAX_DROPDOWN_HEIGHT,
    },
  });

  const {
    renderSurface,
    menuRef,
    getSurfaceStyle,
    dataTheme,
    recomputePosition,
  } = dropdown;

  const creating = isCreatingOption ?? internalCreating;

  useEffect(() => {
    if (isOpen) {
      recomputePosition();
    }
  }, [recomputePosition, filteredOptions.length, isOpen, creating, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    if (highlightedIndex < filteredOptions.length) return;
    if (filteredOptions.length === 0) {
      setHighlightedIndex(0);
      return;
    }
    setHighlightedIndex(filteredOptions.length - 1);
  }, [filteredOptions, highlightedIndex, isOpen]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    if (!isSearchControlled) setInternalQuery("");
  }, [isSearchControlled]);

  const handleSearchUpdate = useCallback(
    (value: string) => {
      if (!isSearchControlled) {
        setInternalQuery(value);
      }
      onSearchChange?.(value);
    },
    [isSearchControlled, onSearchChange],
  );

  const handleSelect = useCallback(
    (id: string) => {
      if (multiple) {
        if (!selectedSet.has(id)) {
          onSelectionChange([...selectedIds, id]);
        }
        handleSearchUpdate("");
        setHighlightedIndex(0);
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        onSelectionChange([id]);
        handleSearchUpdate("");
        setHighlightedIndex(0);
        closeDropdown();
      }
    },
    [
      closeDropdown,
      handleSearchUpdate,
      multiple,
      onSelectionChange,
      selectedIds,
      selectedSet,
    ],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const next = selectedIds.filter((existing) => existing !== id);
      onSelectionChange(next);
      if (!multiple && next.length === 0) {
        handleSearchUpdate("");
      }
    },
    [handleSearchUpdate, multiple, onSelectionChange, selectedIds],
  );

  const handleClear = useCallback(() => {
    onSelectionChange([]);
    handleSearchUpdate("");
  }, [handleSearchUpdate, onSelectionChange]);

  const handleCreate = useCallback(async () => {
    if (!allowCreation || !onCreateOption) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    if (isCreatingOption === undefined) {
      setInternalCreating(true);
    }
    try {
      const created = await onCreateOption(trimmed);
      if (created) {
        handleSelect(created.id);
      }
      handleSearchUpdate("");
    } finally {
      if (isCreatingOption === undefined) {
        setInternalCreating(false);
      }
    }
  }, [
    allowCreation,
    handleSearchUpdate,
    handleSelect,
    isCreatingOption,
    onCreateOption,
    query,
  ]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "Backspace" && multiple && query === "") {
      if (selectedIds.length > 0) {
        event.preventDefault();
        handleRemove(selectedIds[selectedIds.length - 1]);
      }
      return;
    }

    if (!isOpen && (event.key === "ArrowDown" || event.key === "Enter")) {
      event.preventDefault();
      openDropdown();
      return;
    }

    if (!isOpen) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          Math.min(prev + 1, Math.max(filteredOptions.length - 1, 0)),
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (allowCreation && filteredOptions.length === 0 && query.trim()) {
          void handleCreate();
          break;
        }
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].id);
        }
        break;
      case "Escape":
        event.preventDefault();
        closeDropdown();
        break;
      default:
        break;
    }
  };

  const sizeClass = deriveInputSizeClass(size);
  const showSelectedInline = multiple && selectedPlacement === "inline";
  const showSelectedBelow =
    multiple && selectedPlacement === "below" && selectedOptions.length > 0;

  const containerClassName = [
    "relative",
    "form-control",
    className,
    multiple ? "" : "w-full",
  ]
    .filter(Boolean)
    .join(" ");

  const inputWrapperClasses = [
    "input",
    "input-bordered",
    sizeClass,
    "flex",
    showSelectedInline ? "flex-wrap" : "",
    selectedContainerMaxHeight ? "items-start" : "items-center",
    "gap-2",
    multiple ? "min-h-[2.5rem]" : "",
    disabled ? "opacity-60 cursor-not-allowed" : "cursor-text",
  ]
    .filter(Boolean)
    .join(" ");
  const inputWrapperStyle = selectedContainerMaxHeight
    ? {
        maxHeight: selectedContainerMaxHeight,
        overflowY: "auto" as const,
      }
    : undefined;

  const dropdownClasses = [
    dropdownZIndexClassName ?? "z-modal-nested",
    "bg-base-100",
    "border border-base-300",
    "rounded-md",
    "shadow-lg",
    "overflow-y-auto",
    usePortal ? "" : "mt-1",
    dropdownClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const emptyContent: ReactNode = renderEmpty?.(query) ?? (
    <div className="p-3 text-center text-base-content/60">
      {query ? t("common.no_match") : t("common.no_data")}
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

  const createContent: ReactNode = (
    <button
      type="button"
      className="w-full px-3 py-2 text-left text-base transition-colors hover:bg-base-200"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => void handleCreate()}
      disabled={creating}
    >
      {creating ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="loading loading-spinner loading-xs"
            aria-hidden="true"
          ></span>
          {t("common.creating")}
        </span>
      ) : (
        (createOptionLabel?.(query.trim()) ??
        t("common.create_with_name", { name: query.trim() }))
      )}
    </button>
  );

  const dropdownContent = renderSurface(
    <div
      ref={(node) => {
        menuRef.current = node;
      }}
      role="listbox"
      className={dropdownClasses}
      style={getSurfaceStyle()}
      data-theme={dataTheme}
    >
      {showClearOption && selectedIds.length > 0 && (
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-base hover:bg-base-200 transition-colors"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleClear}
        >
          {clearOptionLabel ?? t("common.clear_selection")}
        </button>
      )}
      {isLoading ? (
        loadingContent
      ) : filteredOptions.length === 0 ? (
        allowCreation && query.trim() ? (
          createContent
        ) : (
          emptyContent
        )
      ) : (
        <div className="py-1">
          {filteredOptions.map((option, index) => {
            const isSelected = selectedSet.has(option.id);
            const isActive = index === highlightedIndex;
            const select = () => handleSelect(option.id);
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
              >
                <span className="block truncate">{option.label}</span>
                {option.description && (
                  <span className="block text-sm text-base-content/70">
                    {option.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>,
  );

  const inputValue = multiple
    ? query
    : isOpen
      ? query
      : (selectedOptions[0]?.label ?? "");
  const renderSelectedOption = (option: MultiSelectOption) => {
    const remove = () => handleRemove(option.id);
    if (renderTag) {
      return <div key={option.id}>{renderTag({ option, remove })}</div>;
    }
    return (
      <span
        key={option.id}
        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-sm rounded border border-primary/30"
      >
        <span className="truncate max-w-[8rem]">{option.label}</span>
        {!disabled && (
          <button
            type="button"
            className="text-primary hover:text-primary/70"
            onClick={(event) => {
              event.stopPropagation();
              remove();
            }}
          >
            ×
          </button>
        )}
      </span>
    );
  };

  return (
    <div ref={containerRef} className={containerClassName}>
      {showLabel && label && (
        <label htmlFor={inputId} className="label">
          <span className={SELECT_LABEL_TEXT_CLASS}>{label}</span>
        </label>
      )}

      <div
        className={inputWrapperClasses}
        style={inputWrapperStyle}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
          openDropdown();
        }}
      >
        {showSelectedInline && selectedOptions.map(renderSelectedOption)}

        <input
          ref={mergeInputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-describedby={inputAriaDescribedBy}
          aria-disabled={disabled}
          disabled={disabled}
          className="flex-1 min-w-[6rem] border-none bg-transparent outline-none focus:outline-none"
          placeholder={
            selectedOptions.length === 0 || selectedPlacement === "below"
              ? effectivePlaceholder
              : ""
          }
          value={inputValue}
          onFocus={() => {
            if (!disabled) {
              openDropdown();
            }
          }}
          onChange={(event) => {
            handleSearchUpdate(event.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
        />
      </div>

      {showSelectedBelow && (
        <div
          className="mt-2 flex flex-wrap gap-2"
          style={
            selectedContainerMaxHeight
              ? {
                  maxHeight: selectedContainerMaxHeight,
                  overflowY: "auto" as const,
                }
              : undefined
          }
        >
          {selectedOptions.map(renderSelectedOption)}
        </div>
      )}

      {dropdownContent}
    </div>
  );
});

AsyncEntityMultiSelect.displayName = "AsyncEntityMultiSelect";

export default AsyncEntityMultiSelect;
