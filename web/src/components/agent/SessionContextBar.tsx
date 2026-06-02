import type { SessionContextBox } from "@/types/cardbox";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useTranslation } from "react-i18next";

interface SessionContextBarProps {
  boxes: SessionContextBox[];
  isLoading?: boolean;
}

const SessionContextBar: React.FC<SessionContextBarProps> = ({
  boxes,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-base-content/70">
        <LoadingSpinner size="sm" />
        <span>{t("agent.context.loadingContext")}</span>
      </div>
    );
  }

  if (boxes.length === 0) {
    return (
      <div className="text-xs text-base-content/60">
        {t("agent.context.noContextBoxes")}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {boxes.map((item) => (
        <div
          key={item.box.box_id}
          className="badge badge-outline gap-2 items-center px-3 py-2 text-xs"
        >
          <span className="font-medium text-base-content">
            {item.box.display_name || item.box.name}
          </span>
          <span className="text-2xs uppercase text-base-content/60">
            {item.box.module}
          </span>
        </div>
      ))}
    </div>
  );
};

export default SessionContextBar;
