import React from "react";
import Container from "@/layouts/Container";

interface ToolbarContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "compact" | "minimal";
  responsive?: boolean;
  padding?: "sm" | "md" | "lg";
  layout?: "flex" | "three-column";
}

/**
 * ToolbarContainer - 通用工具条容器组件
 *
 * 提供统一的工具条视觉样式和响应式布局
 * 支持不同密度和布局需求
 *
 * @param children - 工具条内容
 * @param className - 额外的 CSS 类名
 * @param variant - 工具条变体：default(默认) | compact(紧凑) | minimal(极简)
 * @param responsive - 是否启用响应式布局，默认 true
 * @param padding - 内边距大小：sm | md | lg，默认 md
 * @param layout - 布局模式：flex(弹性布局) | three-column(三列布局)
 */
const ToolbarContainer: React.FC<ToolbarContainerProps> = ({
  children,
  className = "",
  variant = "default",
  responsive = true,
  padding = "md",
  layout = "flex",
}) => {
  // 基础容器样式 - 外层使用统一 Container 提供的卡片样式
  const baseClasses = "w-full";

  // 变体样式 - 现在基础样式已包含 shadow-md，变体只需调整其他属性
  const variantClasses = {
    default: "",
    compact: "",
    minimal: "",
  };

  // 内边距样式
  const paddingClasses = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  // 布局样式
  const getLayoutClasses = () => {
    if (layout === "three-column") {
      return responsive
        ? "flex flex-col lg:grid lg:grid-cols-3 gap-3 lg:items-center"
        : "grid grid-cols-3 gap-3 items-center";
    }

    // 默认 flex 布局
    return responsive
      ? "flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      : "flex items-center justify-between gap-3";
  };

  // 合并所有样式
  const containerClasses = [baseClasses, variantClasses[variant], className]
    .filter(Boolean)
    .join(" ");

  const contentClasses = getLayoutClasses();

  return (
    <Container
      className={containerClasses}
      overflow="visible"
      maxHeight="fit"
      padding="none"
    >
      <div className={`${paddingClasses[padding]} ${contentClasses} text-base`}>
        {children}
      </div>
    </Container>
  );
};

export default ToolbarContainer;
