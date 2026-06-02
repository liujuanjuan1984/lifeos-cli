import React from "react";

interface InputGroupProps {
  align?: "start" | "center" | "end";
  wrap?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * InputGroup - 输入框组合容器组件
 *
 * 用于拼接输入框与按钮/图标，维持统一内边距与响应布局
 */
const InputGroup: React.FC<InputGroupProps> = ({
  align = "start",
  wrap = true,
  className = "",
  children,
}) => {
  const alignmentClasses = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
  };

  const baseClasses = `flex flex-col sm:flex-row gap-2 ${alignmentClasses[align]}`;
  const flexClasses = wrap ? "" : "flex-nowrap";
  const finalClasses = `${baseClasses} ${flexClasses} ${className}`;

  return <div className={finalClasses}>{children}</div>;
};

export default InputGroup;
