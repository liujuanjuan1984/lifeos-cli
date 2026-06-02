import type { ReactNode } from "react";

import ActionButton from "@/components/ActionButton";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";

interface SnapshotToolbarOption<ID extends string> {
  value: ID;
  label: string;
  disabled?: boolean;
}

interface SnapshotToolbarProps<ID extends string> {
  leftSlot: ReactNode;
  rightSlot: ReactNode;
  options: SnapshotToolbarOption<ID>[];
  selectedId: ID | null;
  onSelect: (id: ID) => void;
  placeholder: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
  selectClassName?: string;
  previousAriaLabel: string;
  nextAriaLabel: string;
}

export function SnapshotToolbar<ID extends string>({
  leftSlot,
  rightSlot,
  options,
  selectedId,
  onSelect,
  placeholder,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  disabled = false,
  selectClassName = "w-auto min-w-[12rem] sm:min-w-[16rem] max-w-full",
  previousAriaLabel,
  nextAriaLabel,
}: SnapshotToolbarProps<ID>) {
  const optionsDisabled = disabled || !options.length;
  const normalizedOptions: EnumOption[] = options.map((option) => ({
    value: option.value as string,
    label: option.label,
    disabled: option.disabled,
  }));

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      <div className="flex flex-wrap items-center gap-2">{leftSlot}</div>

      <div className="flex flex-1 items-center justify-center gap-1 sm:gap-2 min-w-0 whitespace-nowrap">
        <ActionButton
          label=""
          iconName="chevron-left"
          iconOnly
          ariaLabel={previousAriaLabel}
          size="sm"
          variant="ghost"
          shape="circle"
          onClick={onPrevious}
          disabled={optionsDisabled || !hasPrevious}
        />

        <EnumSelect
          value={selectedId ?? undefined}
          onChange={(value) => {
            if (!value) return;
            onSelect(value as ID);
          }}
          options={normalizedOptions}
          placeholder={placeholder}
          showLabel={false}
          size="sm"
          className={selectClassName}
          autoWidth
          disabled={optionsDisabled}
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
          disabled={optionsDisabled || !hasNext}
        />
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {rightSlot}
      </div>
    </div>
  );
}
