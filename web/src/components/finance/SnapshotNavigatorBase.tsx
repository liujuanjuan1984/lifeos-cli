import type { ReactNode } from "react";

import ActionButton from "@/components/ActionButton";

interface SnapshotNavigatorBaseProps {
  title: string;
  positionLabel?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  showNavigationControls?: boolean;
  previousAriaLabel: string;
  nextAriaLabel: string;
  rightSlot?: ReactNode;
  rightSlotClassName?: string;
}

function SnapshotNavigatorBase({
  title,
  positionLabel,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  showNavigationControls = true,
  previousAriaLabel,
  nextAriaLabel,
  rightSlot,
  rightSlotClassName = "text-right text-sm text-base-content/70",
}: SnapshotNavigatorBaseProps) {
  const shouldShowNav = showNavigationControls;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-grow flex-wrap items-center gap-3">
        {shouldShowNav ? (
          <div className="flex items-center gap-2">
            <ActionButton
              label=""
              iconName="chevron-left"
              iconOnly
              ariaLabel={previousAriaLabel}
              size="sm"
              variant="ghost"
              shape="circle"
              onClick={onPrevious}
              disabled={!hasPrevious}
            />
            <ActionButton
              label=""
              iconName="chevron-right"
              iconOnly
              ariaLabel={nextAriaLabel}
              size="sm"
              variant="ghost"
              shape="circle"
              onClick={onNext}
              disabled={!hasNext}
            />
          </div>
        ) : null}
        <div>
          {shouldShowNav && positionLabel ? (
            <p className="text-xs uppercase tracking-wide text-base-content/60">
              {positionLabel}
            </p>
          ) : null}
          <p className="text-lg font-semibold text-base-content">{title}</p>
        </div>
      </div>
      {rightSlot ? <div className={rightSlotClassName}>{rightSlot}</div> : null}
    </header>
  );
}

export default SnapshotNavigatorBase;
