import React from "react";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  /** 内容溢出处理策略 */
  overflow?: "hidden" | "auto" | "visible" | "scroll";
  /** 最大高度策略 */
  maxHeight?: "none" | "full" | "screen" | "fit";
  /** 响应式内边距 */
  padding?: "none" | "sm" | "md" | "lg" | "responsive";
  /** 是否启用最小宽度约束 */
  minWidth?: boolean;
  /** 是否启用最大宽度约束 */
  maxWidth?: boolean;
  /** Flex布局相关属性 */
  flex?: "1" | "none" | "auto" | "initial";
  /** 最小高度约束 */
  minHeight?: "0" | "auto" | "full" | "screen" | "fit";
  /** 是否启用flex布局 */
  isFlex?: boolean;
  /** Flex方向 */
  flexDirection?: "row" | "col" | "row-reverse" | "col-reverse";
  /** 边框风格 */
  borderVariant?: "default" | "subtle" | "none";
  /** 阴影强度 */
  shadow?: "none" | "sm" | "md" | "lg";
}

/**
 * Enhanced Container - unified border, shadow and radius with flexible configuration.
 *
 * Features:
 * - Flexible overflow handling
 * - Responsive padding options
 * - Configurable height constraints
 * - Better mobile support
 * - Flex layout support for modern layouts
 */
function Container({
  children,
  className = "",
  overflow = "visible",
  maxHeight = "full",
  padding = "responsive",
  minWidth = true,
  maxWidth = true,
  flex = "none",
  minHeight = "auto",
  isFlex = false,
  flexDirection = "col",
  borderVariant = "default",
  shadow = "md",
}: ContainerProps) {
  const baseClasses = [
    "bg-base-100 rounded-lg w-full",
    minWidth ? "min-w-0" : "",
    maxWidth ? "max-w-full" : "",
    maxHeight === "full"
      ? "max-h-full"
      : maxHeight === "screen"
        ? "max-h-screen"
        : maxHeight === "fit"
          ? "max-h-fit"
          : "",
    minHeight === "0"
      ? "min-h-0"
      : minHeight === "auto"
        ? "min-h-auto"
        : minHeight === "full"
          ? "min-h-full"
          : minHeight === "screen"
            ? "min-h-screen"
            : minHeight === "fit"
              ? "min-h-fit"
              : "",
    overflow === "hidden"
      ? "overflow-hidden"
      : overflow === "auto"
        ? "overflow-auto"
        : overflow === "scroll"
          ? "overflow-scroll"
          : "overflow-visible",
    isFlex ? "flex" : "",
    isFlex ? `flex-${flexDirection}` : "",
    flex === "1"
      ? "flex-1"
      : flex === "none"
        ? "flex-none"
        : flex === "auto"
          ? "flex-auto"
          : flex === "initial"
            ? "flex-initial"
            : "",
    padding === "none"
      ? ""
      : padding === "sm"
        ? "p-2"
        : padding === "md"
          ? "p-4"
          : padding === "lg"
            ? "p-6"
            : "p-2 md:p-4 lg:p-6", // responsive
    borderVariant === "none"
      ? ""
      : borderVariant === "subtle"
        ? "border border-base-200"
        : "border border-base-300",
    shadow === "none"
      ? "shadow-none"
      : shadow === "sm"
        ? "shadow-sm"
        : shadow === "lg"
          ? "shadow-lg"
          : "shadow-md",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={baseClasses}>{children}</div>;
}

export default Container;
