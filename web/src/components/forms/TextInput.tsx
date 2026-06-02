import React, { forwardRef } from "react";

type TextInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  /** 控件尺寸，对应 DaisyUI 类 */
  size?: "sm" | "md" | "lg";
};

/**
 * TextInput - 标准化输入框组件
 *
 * 预置 DaisyUI 样式，统一输入框外观和行为
 */
const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className = "", size = "md", type = "text", ...rest }, ref) => {
    const sizeClasses = {
      sm: "h-8 text-xs",
      md: "h-10 sm:h-12 text-sm sm:text-base",
      lg: "h-14 text-base sm:text-lg",
    } as const;

    const baseClasses = `input input-bordered w-full ${sizeClasses[size]}`;
    const finalClasses = `${baseClasses} ${className}`.trim();

    return <input ref={ref} type={type} className={finalClasses} {...rest} />;
  },
);

TextInput.displayName = "TextInput";
export default TextInput;
