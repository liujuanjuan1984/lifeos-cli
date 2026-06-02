import ActionButton from "@/components/ActionButton";
import { Icon } from "@/components/icons";
import type { IconName } from "@/components/icons/Icon";

interface NotesModeBannerProps {
  iconName?: IconName;
  title: string;
  description?: string;
  onExit: () => void;
  exitLabel: string;
}

export function NotesModeBanner({
  iconName = "warning",
  title,
  description,
  onExit,
  exitLabel,
}: NotesModeBannerProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 text-primary">
        <Icon name={iconName} className="mt-1" />
        <div>
          <p className="text-base font-semibold">{title}</p>
          {description && (
            <p className="text-sm text-base-content/70">{description}</p>
          )}
        </div>
      </div>
      <ActionButton
        label={exitLabel}
        iconName="arrow-left"
        color="neutral"
        variant="outline"
        onClick={onExit}
        className="w-full sm:w-auto"
      />
    </div>
  );
}
