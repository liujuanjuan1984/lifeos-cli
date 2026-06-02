import React, { type ReactNode } from "react";
import Container from "@/layouts/Container";
import { ExpandButton } from "./ActionButton";

interface ExpandableCardProps {
  /** 是否展开 */
  isExpanded: boolean;
  /** 切换展开状态的回调 */
  onToggleExpansion: () => void;
  /** 标题内容 */
  title: ReactNode;
  /** 副标题内容（可选） */
  subtitle?: ReactNode;
  /** 副标题对齐方式 */
  subtitleAlign?: "start" | "center" | "end" | "between";
  /** 展开后的内容 */
  children: ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 是否禁用展开功能 */
  disabled?: boolean;
  /**
   * 质感等级 - 渐进式质感增强系统
   * - subtle: 基础质感，轻微增强（适用于密集布局）
   * - moderate: 中等质感，标准卡片（默认）
   * - elevated: 高级质感，焦点卡片（重要内容、悬浮状态）
   */
  elevation?: "subtle" | "moderate" | "elevated";
  /**
   * 磨砂玻璃效果 (Glassmorphism)
   * - false: 不使用玻璃效果（默认）
   * - true: 使用玻璃效果，会覆盖 elevation 设置
   * - "light": 轻量玻璃效果
   * - "strong": 强化玻璃效果
   */
  glass?: boolean | "light" | "strong";
}

/**
 * ExpandableCard - 可展开的卡片容器组件
 *
 * 提供统一的展开式容器布局，支持：
 * - 标题和副标题
 * - 右侧操作按钮
 * - 可展开的内容区域
 *
 * 使用场景：
 * - 规划页面的周期分组
 * - 愿景页面的愿景卡片
 * - 任何需要展开/收起的内容容器
 */
const ExpandableCard: React.FC<ExpandableCardProps> = ({
  isExpanded,
  onToggleExpansion,
  title,
  subtitle,
  subtitleAlign = "end",
  children,
  className = "",
  disabled = false,
  elevation = "moderate",
  glass = false,
}) => {
  // 获取玻璃效果类
  const getGlassClass = (glassType: boolean | "light" | "strong") => {
    if (!glassType) return null;

    if (glassType === true) {
      // 默认玻璃效果，结合当前 elevation
      return `glass-${elevation}`;
    }

    if (glassType === "light") {
      return "glass-light";
    }

    if (glassType === "strong") {
      return "glass-strong";
    }

    return null;
  };

  // 构建容器类名（用于 glass 或额外样式）
  const glassClass = getGlassClass(glass);
  const containerClasses = [
    "w-full",
    "h-fit",
    "min-w-0",
    "overflow-hidden",
    glassClass || "",
    glass ? "bg-transparent shadow-none border-0" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const headerClasses = "p-3 sm:p-4 lg:p-6 cursor-pointer";
  const contentClasses = "w-full overflow-hidden";

  return (
    <Container
      className={containerClasses}
      overflow="hidden"
      maxHeight="fit"
      padding="none"
    >
      {/* 标题区域 */}
      <div
        className={headerClasses}
        onClick={disabled ? undefined : onToggleExpansion}
      >
        <div className="w-full flex items-start gap-2 sm:gap-3 min-w-0">
          {/* 展开/收起按钮 */}
          <ExpandButton
            isExpanded={isExpanded}
            onClick={onToggleExpansion}
            className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-1 hidden sm:block"
            disabled={disabled}
          />

          {/* 内容区域 - 自适应布局 */}
          <div className="min-w-0 flex-1">
            {/* 标题区域（内容容器） */}
            <div className="min-w-0">{title}</div>

            {/* 副标题区域（操作容器） */}
            {subtitle && (
              <div
                className={`mt-2 sm:mt-3 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-${subtitleAlign}`}
              >
                {subtitle}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 展开内容区域：隐藏时完全不渲染，避免占位 */}
      {isExpanded ? <div className={contentClasses}>{children}</div> : null}
    </Container>
  );
};

export default ExpandableCard;
