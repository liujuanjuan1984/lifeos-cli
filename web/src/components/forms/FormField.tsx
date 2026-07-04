import React from "react";
import {
  FORM_DESCRIPTION_CLASS,
  FORM_LABEL_SPACED_CLASS,
} from "./styles";

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  description?: string;
  error?: string;
  labelClassName?: string;
  contentClassName?: string;
  labelId?: string; // ID for the label element (for accessibility)
  useLabelElement?: boolean; // Whether to render label as <label> or <div>. Default: true
  children: React.ReactNode;
}

/**
 * FormField - 表单字段容器组件
 *
 * 统一封装表单控件的标签、说明、错误展示与布局
 */
const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  required = false,
  description,
  error,
  labelClassName = "",
  contentClassName = "",
  labelId,
  useLabelElement = true,
  children,
}) => {
  const containerClasses = error
    ? "space-y-2 border border-error rounded-lg p-2"
    : "space-y-2";

  const labelClasses = `${FORM_LABEL_SPACED_CLASS} ${labelClassName}`;

  return (
    <div className={containerClasses}>
      {label &&
        (useLabelElement ? (
          <label htmlFor={htmlFor} className={labelClasses} id={labelId}>
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </label>
        ) : (
          <div className={labelClasses} id={labelId}>
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </div>
        ))}

      {description && (
        <div className={FORM_DESCRIPTION_CLASS}>{description}</div>
      )}

      <div className={contentClassName}>{children}</div>

      {error && <div className="text-error text-sm mt-1">{error}</div>}
    </div>
  );
};

export default FormField;
