import React, { forwardRef } from "react";

type TextAreaResize = "none" | "both" | "horizontal" | "vertical" | "y";

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** 控件尺寸，对应 DaisyUI 类 */
  size?: "sm" | "md" | "lg";
  /** resize 行为封装成语义化枚举 */
  resize?: TextAreaResize;
};

/**
 * TextArea - 标准化文本域组件
 *
 * 预置 DaisyUI 样式，统一文本域外观和行为
 */
const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    { className = "", size = "md", resize = "none", rows = 3, ...rest },
    ref,
  ) => {
    const sizeClasses = {
      sm: "h-16 text-xs",
      md: "h-20 sm:h-24 lg:h-28 text-sm sm:text-base",
      lg: "h-32 text-base sm:text-lg",
    } as const;

    const resizeClasses: Record<TextAreaResize, string> = {
      none: "resize-none",
      both: "resize",
      horizontal: "resize-x",
      vertical: "resize-y",
      y: "resize-y",
    };

    const baseClasses = `textarea textarea-bordered w-full ${sizeClasses[size]} ${resizeClasses[resize]}`;
    const finalClasses = `${baseClasses} ${className}`.trim();

    return (
      <textarea ref={ref} rows={rows} className={finalClasses} {...rest} />
    );
  },
);

TextArea.displayName = "TextArea";
export default TextArea;
