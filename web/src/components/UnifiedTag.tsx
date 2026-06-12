import React from "react";
import Chip, { type ChipTone } from "@/components/common/Chip";

type TagType =
  | "nickname"
  | "location"
  | "relationship"
  | "anniversary"
  | "status";

interface UnifiedTagProps {
  type: TagType;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  onRemove?: () => void;
}

/**
 * UnifiedTag - 统一的标签组件
 *
 * 提供一致的标签样式，通过不同颜色和样式区分不同类型的信息：
 * - nickname: 昵称标签 (紫色)
 * - location: 地址标签 (绿色)
 * - relationship: 关系标签 (蓝色)
 * - anniversary: 纪念日标签 (粉色)
 * - status: 状态标签 (灰色)
 */
const UnifiedTag: React.FC<UnifiedTagProps> = ({
  type,
  children,
  size = "md",
  className = "",
  onClick,
  onRemove,
}) => {
  const toneMap: Record<TagType, ChipTone> = {
    nickname: "secondary",
    location: "success",
    relationship: "primary",
    anniversary: "accent",
    status: "neutral",
  };

  return (
    <Chip
      tone={toneMap[type]}
      size={size}
      className={className}
      onClick={onClick}
      onRemove={onRemove}
    >
      {children}
    </Chip>
  );
};

export default UnifiedTag;
