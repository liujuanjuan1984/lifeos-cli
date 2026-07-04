import React from "react";
import { useTranslation } from "react-i18next";
import AsyncEntitySelect, {
  type AsyncEntitySelectProps,
  type EntityOption,
} from "./AsyncEntitySelect";
import type { SelectorValue } from "./selectorTypes";

interface EnumOption {
  value: string; // UI normalized value as string
  label: string;
  disabled?: boolean;
}

interface EnumSelectProps
  extends Omit<AsyncEntitySelectProps, "options" | "onChange" | "value"> {
  value?: SelectorValue;
  onChange: (value: SelectorValue) => void;
  options: EnumOption[];
  idPrefix?: string; // prefix for generating unique IDs
  label?: string; // optional label for the select field
  showLabel?: boolean; // whether to show the label
  /** Main control id. Used verbatim for input and label htmlFor. */
  id?: string;
  /** Whether to include empty-value option. Default: false (filter out). */
  includeEmptyOption?: boolean;
  /** Whether to auto-adjust width based on content. Default: false. */
  autoWidth?: boolean;
  "aria-describedby"?: string; // ID of element that describes this select
  dropdownZIndexClassName?: string;
}

/**
 * EnumSelect
 * Thin wrapper for selecting from a fixed list of values with consistent UI.
 */
const EnumSelect: React.FC<EnumSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  size = "sm",
  className = "text-sm w-full",
  idPrefix = "enum-select",
  label,
  showLabel = true,
  id,
  includeEmptyOption = false,
  autoWidth = false,
  usePortal = true,
  "aria-describedby": ariaDescribedBy,
  dropdownZIndexClassName,
}) => {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder ?? t("common.please_select");
  const sanitized = includeEmptyOption
    ? options
    : options.filter(
        (o) => !(o.value === "" || o.value === null || o.value === undefined),
      );

  const entityOptions: EntityOption[] = sanitized.map((o) => ({
    id: String(o.value),
    label: o.label,
    disabled: o.disabled,
  }));

  return (
    <AsyncEntitySelect
      value={value}
      onChange={onChange}
      options={entityOptions}
      placeholder={effectivePlaceholder}
      disabled={disabled}
      size={size}
      className={className}
      fullWidth={!autoWidth}
      id={id}
      idPrefix={idPrefix}
      label={label}
      showLabel={showLabel}
      usePortal={usePortal}
      aria-describedby={ariaDescribedBy}
      dropdownZIndexClassName={dropdownZIndexClassName}
    />
  );
};

export default EnumSelect;
