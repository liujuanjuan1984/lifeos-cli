import React, { forwardRef, useId, useImperativeHandle, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Checkbox from "./Checkbox";
import { FORM_DESCRIPTION_CLASS, FORM_LABEL_CLASS } from "./styles";

interface CheckboxOption {
  /** 选项值 */
  value: string;
  /** 选项标签 */
  label: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 描述文本 */
  description?: string;
  /** 自定义属性 */
  [key: string]: unknown;
}

type NativeFieldsetProps = Omit<
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  "onChange" | "children"
>;

interface CheckboxGroupProps extends NativeFieldsetProps {
  /** 当前选中的值数组 */
  value?: string[];
  /** 选项列表 */
  options: CheckboxOption[];
  /** 变化回调 */
  onChange?: (checkedValues: string[]) => void;
  /** 是否禁用整个组 */
  disabled?: boolean;
  /** 尺寸大小 */
  size?: "sm" | "md" | "lg";
  /** 样式变体 */
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "success"
    | "warning"
    | "error"
    | "info";
  /** 布局方向 */
  direction?: "vertical" | "horizontal";
  /** 列数（仅对 horizontal 布局有效） */
  columns?: 1 | 2 | 3 | 4;
  /** 组标签 */
  label?: string;
  /** 组描述 */
  description?: string;
  /** 错误信息 */
  error?: string;
  /** 是否必填 */
  required?: boolean;
  /** 自定义 className */
  className?: string;
  /** 是否显示全选功能 */
  showSelectAll?: boolean;
  /** 全选按钮文本（如果不提供将使用 i18n） */
  selectAllText?: string;
  /** 清空选择文本（如果不提供将使用 i18n） */
  clearAllText?: string;
  /** ID 前缀 */
  idPrefix?: string;
  /** 名称 */
  name?: string;
  /** 是否只读 */
  readOnly?: boolean;
}

interface CheckboxGroupRef {
  /** 获取所有选中值 */
  getCheckedValues: () => string[];
  /** 设置选中值 */
  setCheckedValues: (values: string[]) => void;
  /** 全选 */
  selectAll: () => void;
  /** 清空选择 */
  clearAll: () => void;
  /** 获取选中的选项 */
  getCheckedOptions: () => CheckboxOption[];
}

const CheckboxGroup = forwardRef<CheckboxGroupRef, CheckboxGroupProps>(
  (
    {
      value = [],
      options,
      onChange,
      disabled = false,
      size = "md",
      variant = "primary",
      direction = "vertical",
      columns = 1,
      label,
      description,
      error,
      required = false,
      className = "",
      showSelectAll = false,
      selectAllText,
      clearAllText,
      idPrefix,
      name,
      readOnly = false,
      "aria-describedby": ariaDescribedBy,
      ...rest
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const autoGroupId = useId();
    const effectiveIdPrefix = idPrefix ?? `checkbox-group-${autoGroupId}`;
    const legendId = label ? `${effectiveIdPrefix}-legend` : undefined;
    const descriptionId = description
      ? `${effectiveIdPrefix}-description`
      : undefined;
    const errorId = error ? `${effectiveIdPrefix}-error` : undefined;
    const selectableOptions = useMemo(
      () => options.filter((option) => !option.disabled),
      [options],
    );
    const selectableOptionValues = useMemo(
      () => new Set(selectableOptions.map((option) => option.value)),
      [selectableOptions],
    );

    useImperativeHandle(
      ref,
      () => ({
        getCheckedValues: () => value,
        setCheckedValues: (values: string[]) => {
          onChange?.(values);
        },
        selectAll: () => {
          const preservedValues = value.filter(
            (selectedValue) => !selectableOptionValues.has(selectedValue),
          );
          const allValues = [
            ...preservedValues,
            ...selectableOptions.map((option) => option.value),
          ];
          onChange?.(allValues);
        },
        clearAll: () => {
          const preservedValues = value.filter(
            (selectedValue) => !selectableOptionValues.has(selectedValue),
          );
          onChange?.(preservedValues);
        },
        getCheckedOptions: () => {
          return options.filter((option) => value.includes(option.value));
        },
      }),
      [value, options, onChange, selectableOptions, selectableOptionValues],
    );

    const handleCheckboxChange = (optionValue: string, checked: boolean) => {
      if (readOnly) return;

      let newValues: string[];
      if (checked) {
        newValues = [...value, optionValue];
      } else {
        newValues = value.filter((v) => v !== optionValue);
      }
      onChange?.(newValues);
    };

    const handleSelectAll = () => {
      if (readOnly) return;
      const preservedValues = value.filter(
        (selectedValue) => !selectableOptionValues.has(selectedValue),
      );
      const allValues = [
        ...preservedValues,
        ...selectableOptions.map((option) => option.value),
      ];
      onChange?.(allValues);
    };

    const handleClearAll = () => {
      if (readOnly) return;
      const preservedValues = value.filter(
        (selectedValue) => !selectableOptionValues.has(selectedValue),
      );
      onChange?.(preservedValues);
    };

    const isAllSelected =
      selectableOptions.length > 0 &&
      selectableOptions.every((option) => value.includes(option.value));

    const selectedSelectableCount = selectableOptions.filter((option) =>
      value.includes(option.value),
    ).length;
    const isIndeterminate =
      selectedSelectableCount > 0 &&
      selectedSelectableCount < selectableOptions.length;

    const getLayoutClasses = () => {
      if (direction === "horizontal") {
        const columnClasses = {
          1: "grid grid-cols-1 gap-3",
          2: "grid grid-cols-1 sm:grid-cols-2 gap-3",
          3: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3",
          4: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3",
        } as const;
        return columnClasses[columns];
      }

      return "flex flex-col space-y-3";
    };

    const renderOption = (option: CheckboxOption) => {
      const isChecked = value.includes(option.value);
      const isOptionDisabled = disabled || option.disabled;

      return (
        <div
          key={option.value}
          className={direction === "vertical" ? "flex items-start" : ""}
        >
          <Checkbox
            id={`${effectiveIdPrefix}-${option.value}`}
            name={name || effectiveIdPrefix}
            value={option.value}
            checked={isChecked}
            disabled={isOptionDisabled}
            readOnly={readOnly}
            size={size}
            variant={variant}
            onCheckedChange={(checked) =>
              handleCheckboxChange(option.value, checked)
            }
            label={option.label}
            description={option.description as string | undefined}
          />
        </div>
      );
    };

    const renderSelectAllControls = () => {
      if (!showSelectAll || readOnly) return null;

      const resolvedSelectAllText =
        selectAllText ?? t("checkboxGroup.selectAll");
      const resolvedClearAllText = clearAllText ?? t("checkboxGroup.clearAll");

      return (
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-base-200">
          <Checkbox
            checked={isAllSelected}
            indeterminate={isIndeterminate}
            size={size}
            variant={variant}
            disabled={disabled}
            onCheckedChange={(checked) => {
              if (checked) {
                handleSelectAll();
              } else {
                handleClearAll();
              }
            }}
            label={isAllSelected ? resolvedClearAllText : resolvedSelectAllText}
          />
        </div>
      );
    };

    const describedBy =
      [ariaDescribedBy, descriptionId, errorId]
        .filter(Boolean)
        .join(" ")
        .trim()
        .replace(/\s+/g, " ") || undefined;

    const fieldsetClasses = ["space-y-2", className].filter(Boolean).join(" ");

    return (
      <fieldset
        className={fieldsetClasses}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : undefined}
        {...rest}
      >
        {label && (
          <legend
            id={legendId}
            className={FORM_LABEL_CLASS}
          >
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </legend>
        )}

        {description && (
          <p id={descriptionId} className={FORM_DESCRIPTION_CLASS}>
            {description}
          </p>
        )}

        {renderSelectAllControls()}

        <div className={getLayoutClasses()}>
          {options.map((option) => renderOption(option))}
        </div>

        {error && (
          <div id={errorId} className="text-error text-sm" role="alert">
            {error}
          </div>
        )}
      </fieldset>
    );
  },
);

CheckboxGroup.displayName = "CheckboxGroup";

export default CheckboxGroup;
