import React from "react";
import { useTranslation } from "react-i18next";
import Badge, {
  type BadgeTone,
  type BadgeVariant,
} from "@/components/common/Badge";

interface StatusBadgeProps {
  status: string;
  type: "vision" | "task" | "habit";
  className?: string;
}

/**
 * StatusBadge - Reusable component for displaying status badges
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type,
  className = "",
}) => {
  const { t } = useTranslation();

  const getStatusConfig = (): {
    text: string;
    tone: BadgeTone;
    variant?: BadgeVariant;
  } => {
    if (type === "vision") {
      const visionStatusConfig = {
        active: {
          text: t("status.active"),
          tone: "success" as BadgeTone,
        },
        completed: {
          text: t("status.completed"),
          tone: "info" as BadgeTone,
        },
        archived: {
          text: t("status.archived"),
          tone: "neutral" as BadgeTone,
        },
        fruit: {
          text: t("status.fruit"),
          tone: "warning" as BadgeTone,
        },
      } as const;
      return (
        visionStatusConfig[status as keyof typeof visionStatusConfig] ||
        visionStatusConfig.active
      );
    } else if (type === "habit") {
      const habitStatusConfig = {
        active: { text: t("status.active"), tone: "success" as BadgeTone },
        completed: { text: t("status.completed"), tone: "info" as BadgeTone },
        paused: { text: t("status.paused"), tone: "warning" as BadgeTone },
        expired: { text: t("status.expired"), tone: "neutral" as BadgeTone },
      } as const;
      return (
        habitStatusConfig[status as keyof typeof habitStatusConfig] ||
        habitStatusConfig.active
      );
    } else {
      const taskStatusConfig = {
        todo: {
          text: t("status.todo"),
          tone: "ghost" as BadgeTone,
          variant: "solid" as BadgeVariant,
        },
        in_progress: {
          text: t("status.inProgress"),
          tone: "error" as BadgeTone,
        },
        done: { text: t("status.done"), tone: "success" as BadgeTone },
        cancelled: {
          text: t("status.cancelled"),
          tone: "neutral" as BadgeTone,
        },
        paused: {
          text: t("status.paused"),
          tone: "warning" as BadgeTone,
        },
      } as const;
      return (
        taskStatusConfig[status as keyof typeof taskStatusConfig] ||
        taskStatusConfig.todo
      );
    }
  };

  const config = getStatusConfig();

  return (
    <Badge
      size="sm"
      tone={config.tone}
      variant={config.variant ?? "solid"}
      className={`text-xs sm:text-sm ${className}`}
    >
      {config.text}
    </Badge>
  );
};

export default StatusBadge;
