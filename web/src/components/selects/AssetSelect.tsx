import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncEntityMultiSelect, { type MultiSelectOption } from "./AsyncEntityMultiSelect";
import type { FinanceAsset } from "@/services/api/finance";
import { logger } from "@/utils/core";

interface AssetSelectProps {
  assets: FinanceAsset[];
  value: string;
  onChange: (assetCode: string) => void;
  onCreateAsset: (code: string) => Promise<FinanceAsset>;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  showLabel?: boolean;
  usePortal?: boolean;
  dropdownClassName?: string;
  dropdownZIndexClassName?: string;
  placeholder?: string;
}

const normalizeAssetCode = (code: string) => code.trim().toUpperCase();

export default function AssetSelect({
  assets,
  value,
  onChange,
  onCreateAsset,
  disabled = false,
  size = "sm",
  className = "",
  label,
  showLabel = false,
  usePortal = true,
  dropdownClassName,
  dropdownZIndexClassName,
  placeholder,
}: AssetSelectProps) {
  const { t } = useTranslation();
  const [createdAssets, setCreatedAssets] = useState<FinanceAsset[]>([]);
  const normalizedValue = normalizeAssetCode(value);

  const allAssets = useMemo(() => {
    const map = new Map<string, FinanceAsset>();
    assets.forEach((asset) => map.set(asset.code, asset));
    createdAssets.forEach((asset) => map.set(asset.code, asset));
    if (normalizedValue && !map.has(normalizedValue)) {
      map.set(normalizedValue, {
        id: normalizedValue,
        code: normalizedValue,
        name: null,
        decimal_places: 2,
        is_default: false,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [assets, createdAssets, normalizedValue]);

  const options = useMemo<MultiSelectOption[]>(
    () =>
      allAssets.map((asset) => ({
        id: asset.code,
        label: asset.code,
        description: asset.name ?? undefined,
        data: asset,
      })),
    [allAssets],
  );

  const handleSelectionChange = useCallback(
    (ids: string[]) => {
      onChange(normalizeAssetCode(ids[0] ?? ""));
    },
    [onChange],
  );

  const handleCreateOption = useCallback(
    async (labelValue: string): Promise<MultiSelectOption | null> => {
      const code = normalizeAssetCode(labelValue);
      if (!code) return null;
      try {
        const created = await onCreateAsset(code);
        setCreatedAssets((current) => {
          if (current.some((asset) => asset.code === created.code)) {
            return current;
          }
          return [...current, created];
        });
        return {
          id: created.code,
          label: created.code,
          description: created.name ?? undefined,
          data: created,
        };
      } catch (error) {
        logger.error("Failed to create finance asset:", error);
        return null;
      }
    },
    [onCreateAsset],
  );

  const filterOptions = useCallback((items: MultiSelectOption[], query: string) => {
    const normalized = normalizeAssetCode(query);
    if (!normalized) return items;
    return items.filter((option) => {
      const asset = option.data as FinanceAsset | undefined;
      return (
        option.label.toUpperCase().includes(normalized) ||
        (asset?.name ?? "").toUpperCase().includes(normalized)
      );
    });
  }, []);

  return (
    <AsyncEntityMultiSelect
      selectedIds={normalizedValue ? [normalizedValue] : []}
      onSelectionChange={handleSelectionChange}
      options={options}
      placeholder={placeholder ?? t("finance.assets.selectAsset")}
      disabled={disabled}
      size={size}
      multiple={false}
      usePortal={usePortal}
      isLoading={false}
      filterOptions={filterOptions}
      allowCreation
      onCreateOption={handleCreateOption}
      createOptionLabel={(name) => t("finance.assets.createAsset", { code: normalizeAssetCode(name) })}
      dropdownClassName={dropdownClassName}
      dropdownZIndexClassName={dropdownZIndexClassName}
      className={className}
      label={label}
      showLabel={showLabel}
    />
  );
}
