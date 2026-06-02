import { useTranslation } from "react-i18next";

import ActionButton from "@/components/ActionButton";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import type { UUID } from "@/types/primitive";

interface FinanceTreeSelectorProps {
  label: string;
  options: Array<{ value: UUID; label: string }>;
  value: UUID | null;
  onChange: (id: UUID) => void;
  onManage?: () => void;
  disabled?: boolean;
  showManage?: boolean;
}

export function FinanceTreeSelector({
  label,
  options,
  value,
  onChange,
  onManage,
  disabled = false,
  showManage = true,
}: FinanceTreeSelectorProps) {
  const { t } = useTranslation();
  const normalizedOptions: EnumOption[] = options.map((option) => ({
    value: option.value,
    label: option.label,
  }));
  const selectionDisabled = disabled || normalizedOptions.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-base-content/70 whitespace-nowrap">
        {label}
      </span>
      <EnumSelect
        value={value ?? undefined}
        onChange={(nextValue) => {
          if (!nextValue) return;
          onChange(nextValue as UUID);
        }}
        options={normalizedOptions}
        placeholder={t("finance.selectTree")}
        showLabel={false}
        size="sm"
        className="w-auto min-w-[10rem] sm:min-w-[12rem] max-w-full"
        autoWidth
        disabled={selectionDisabled}
      />
      {showManage && onManage ? (
        <ActionButton
          label={t("finance.manageTrees")}
          onClick={onManage}
          size="sm"
          variant="outline"
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}
