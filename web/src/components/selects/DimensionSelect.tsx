import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import AsyncEntitySelect, {
  type AsyncEntitySelectProps,
  type EntityOption,
} from "./AsyncEntitySelect";
import { useDimensions } from "@/hooks/queries/useDimensions";
import type { UUID } from "@/types/primitive";
import { SelectorSpecialValue, type SelectorValue } from "./selectorTypes";

interface DimensionSelectProps
  extends Omit<AsyncEntitySelectProps, "options" | "onChange" | "value"> {
  value?: UUID | null;
  /**
   * Emits selected dimension id, or undefined for "All", or null for "None".
   */
  onChange: (value: UUID | undefined | null) => void;
  /**
   * Main control id. When provided, it will be used as the exact id
   * for the focusable input and for label htmlFor. No suffixes will be appended.
   */
  id?: string;
  /**
   * Whether to show an explicit "All" option as the first item.
   * When selected, it maps to undefined for the parent.
   */
  showAllOption?: boolean;
  /** Custom label for the "All" option. Defaults to i18n common.all */
  allLabel?: string;
  /**
   * Whether to show an explicit "None" option as an item.
   * When selected, it maps to null for the parent.
   */
  showNoneOption?: boolean;
  /** Custom label for the "None" option. Defaults to i18n common.none */
  noneLabel?: string;
  /**
   * How to treat clear action (e.g. clicking clear icon on the select)
   * - "all": emit undefined (default, for filtering scenarios)
   * - "none": emit null (for editing optional fields)
   * - "preserve": ignore clear (keep current value)
   */
  clearBehavior?: "all" | "none" | "preserve";
}

/**
 * DimensionSelect
 * Single-select for life dimensions, backed by shared cache via useDimensions().
 */
const DimensionSelect = React.forwardRef<
  HTMLInputElement,
  DimensionSelectProps
>(
  (
    {
      value,
      onChange,
      placeholder,
      label,
      showLabel = true,
      disabled,
      size = "sm",
      className,
      idPrefix,
      id,
      showAllOption = false,
      allLabel,
      showNoneOption = false,
      noneLabel,
      clearBehavior = "all",
      ...otherProps
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const effectiveLabel = label ?? t("target.dimension");
    const { dimensions } = useDimensions();

    const options: EntityOption[] = useMemo(
      () =>
        (dimensions || []).map((d) => ({
          id: String(d.id),
          label: d.name,
        })),
      [dimensions],
    );

    const optionsWithSpecial: EntityOption[] = useMemo(() => {
      const special: EntityOption[] = [];
      if (showAllOption) {
        special.push({
          id: SelectorSpecialValue.All,
          label: allLabel ?? t("common.all"),
        });
      }
      if (showNoneOption) {
        special.push({
          id: SelectorSpecialValue.None,
          label: noneLabel ?? t("common.none"),
        });
      }
      return special.length > 0 ? [...special, ...options] : options;
    }, [showAllOption, allLabel, showNoneOption, noneLabel, options, t]);

    const effectivePlaceholder = placeholder ?? t("common.please_select");

    const resolvedValue =
      value === null && showNoneOption
        ? SelectorSpecialValue.None
        : (value ?? undefined);

    return (
      <AsyncEntitySelect
        ref={ref}
        value={resolvedValue}
        onChange={(selected: SelectorValue) => {
          if (selected === undefined) {
            if (clearBehavior === "preserve") {
              return;
            }
            if (clearBehavior === "none") {
              onChange(null);
              return;
            }
            onChange(undefined);
            return;
          }

          // Explicit special options
          if (showAllOption && selected === SelectorSpecialValue.All) {
            onChange(undefined);
            return;
          }
          if (showNoneOption && selected === SelectorSpecialValue.None) {
            onChange(null);
            return;
          }

          if (selected === null) {
            onChange(null);
            return;
          }

          onChange(selected as UUID);
        }}
        options={optionsWithSpecial}
        placeholder={effectivePlaceholder}
        label={effectiveLabel}
        showLabel={showLabel}
        disabled={disabled}
        size={size}
        className={className}
        id={id}
        allowUndefined={true}
        idPrefix={idPrefix}
        {...otherProps}
      />
    );
  },
);

export default DimensionSelect;
