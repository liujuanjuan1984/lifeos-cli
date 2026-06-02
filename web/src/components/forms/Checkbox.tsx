import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";

type NativeCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "type" | "children"
>;

interface CheckboxProps extends NativeCheckboxProps {
  /** 是否处于不确定状态（半选状态） */
  indeterminate?: boolean;
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
  /** 标签文本 */
  label?: string;
  /** 描述文本 */
  description?: string;
  /** 错误信息 */
  error?: string;
  /** 子元素（当需要自定义内容时使用） */
  children?: React.ReactNode;
  /** 变化回调（返回最新选中状态） */
  onCheckedChange?: (
    checked: boolean,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
}

interface CheckboxRef {
  /** 获取输入元素 */
  inputElement: HTMLInputElement | null;
  /** 设置焦点 */
  focus: () => void;
  /** 移除焦点 */
  blur: () => void;
  /** 选中 */
  select: () => void;
}

const Checkbox = forwardRef<CheckboxRef, CheckboxProps>(
  (
    {
      checked,
      indeterminate = false,
      disabled = false,
      size = "md",
      variant = "primary",
      label,
      description,
      error,
      required = false,
      className = "",
      onChange,
      onCheckedChange,
      children,
      readOnly = false,
      id,
      onClick,
      onKeyDown,
      onMouseDown,
      "aria-describedby": ariaDescribedBy,
      ...rest
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const generatedId = useId();
    const checkboxId = id ?? generatedId;
    const descriptionId = description ? `${checkboxId}-description` : undefined;
    const errorId = error ? `${checkboxId}-error` : undefined;

    useImperativeHandle(
      ref,
      () => ({
        inputElement: inputRef.current,
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        select: () => inputRef.current?.select(),
      }),
      [],
    );

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const getCheckboxClasses = () => {
      const baseClasses = "checkbox";
      const sizeClasses = {
        sm: "checkbox-sm",
        md: "",
        lg: "checkbox-lg",
      } as const;
      const variantClasses = {
        primary: "checkbox-primary",
        secondary: "checkbox-secondary",
        accent: "checkbox-accent",
        success: "checkbox-success",
        warning: "checkbox-warning",
        error: "checkbox-error",
        info: "checkbox-info",
      } as const;

      return [
        baseClasses,
        sizeClasses[size],
        variantClasses[variant],
        error ? "border-error" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ");
    };

    const containerClasses = [
      "flex items-start gap-3",
      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      error ? "border border-error rounded-lg p-2" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const describedBy =
      [ariaDescribedBy, descriptionId, errorId]
        .filter(Boolean)
        .join(" ")
        .trim()
        .replace(/\s+/g, " ") || undefined;
    const isControlled = checked !== undefined;
    const ariaChecked = indeterminate ? "mixed" : rest["aria-checked"];
    const resolvedChecked = readOnly
      ? isControlled
        ? checked
        : Boolean(rest.defaultChecked)
      : isControlled
        ? checked
        : undefined;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) {
        event.preventDefault();
        if (!isControlled && inputRef.current) {
          inputRef.current.checked = !event.target.checked;
        }
        return;
      }

      onChange?.(event);
      onCheckedChange?.(event.target.checked, event);
    };

    const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
      if (readOnly) {
        event.preventDefault();
      }

      onClick?.(event);
    };

    const handleMouseDown = (event: React.MouseEvent<HTMLInputElement>) => {
      if (readOnly) {
        event.preventDefault();
      }

      onMouseDown?.(event);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (readOnly && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
      }

      onKeyDown?.(event);
    };

    const content = () => {
      if (children) {
        return <div className="flex flex-col gap-1">{children}</div>;
      }

      if (!label) return null;

      return (
        <div className="flex flex-col gap-1">
          <span className="text-sm sm:text-base font-medium text-base-content">
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </span>
          {description && (
            <span
              id={descriptionId}
              className="text-xs sm:text-sm text-base-content/70"
            >
              {description}
            </span>
          )}
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={checkboxId} className={containerClasses}>
          <input
            {...rest}
            id={checkboxId}
            ref={inputRef}
            type="checkbox"
            className={getCheckboxClasses()}
            checked={resolvedChecked}
            disabled={disabled}
            readOnly={readOnly}
            aria-describedby={describedBy}
            aria-checked={ariaChecked}
            aria-invalid={error ? "true" : undefined}
            aria-required={required || undefined}
            onMouseDown={handleMouseDown}
            onKeyDown={handleKeyDown}
            onClick={handleClick}
            onChange={handleChange}
          />

          {content()}
        </label>

        {error && (
          <div id={errorId} className="text-error text-sm">
            {error}
          </div>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
