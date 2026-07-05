import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncEntityMultiSelect, {
  type MultiSelectOption,
} from "./AsyncEntityMultiSelect";
import { CreateNewButton } from "@/components/ActionButton";
import { InputGroup } from "@/components/forms";
import type { Tag } from "@/services/api/tags";
import type { UUID } from "@/types/primitive";
import { logger } from "@/utils/core";

interface TagSelectorProps {
  availableTags: Tag[];
  selectedTagIds: UUID[];
  onTagsChange: (tagIds: UUID[]) => void;
  onCreateTag: (tagName: string) => Promise<Tag>;
  lockedTagIds?: UUID[];
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  usePortal?: boolean;
  dropdownClassName?: string;
  dropdownZIndexClassName?: string;
  idPrefix?: string;
  label?: string;
  showLabel?: boolean;
  showNoTagOption?: boolean;
  className?: string;
  selectedPlacement?: "inline" | "below";
  showCreateButton?: boolean;
}

const sanitizeIds = (ids: UUID[]): UUID[] =>
  ids.filter((id) => id && id.trim() && id !== "");

const TagSelector: React.FC<TagSelectorProps> = ({
  availableTags,
  selectedTagIds,
  onTagsChange,
  onCreateTag,
  lockedTagIds,
  disabled = false,
  size = "sm",
  usePortal = true,
  dropdownClassName,
  dropdownZIndexClassName,
  label,
  showLabel = true,
  showNoTagOption = true,
  className = "",
  selectedPlacement = "inline",
  showCreateButton = false,
}) => {
  const { t } = useTranslation();
  const [createdTags, setCreatedTags] = useState<Tag[]>([]);
  const [inputValue, setInputValue] = useState("");

  const sanitizedLocked = useMemo(
    () => sanitizeIds(lockedTagIds ?? []),
    [lockedTagIds],
  );

  const lockedIdSet = useMemo(
    () => new Set<UUID>(sanitizedLocked),
    [sanitizedLocked],
  );

  const sanitizedSelected = useMemo(() => {
    const normalized = sanitizeIds(selectedTagIds);
    if (!sanitizedLocked.length) {
      return normalized;
    }
    const merged = new Set<UUID>([...sanitizedLocked, ...normalized]);
    return Array.from(merged);
  }, [selectedTagIds, sanitizedLocked]);

  const allTags = useMemo(() => {
    const map = new Map<UUID, Tag>();
    availableTags.forEach((tag) => map.set(tag.id, tag));
    createdTags.forEach((tag) => map.set(tag.id, tag));
    sanitizedSelected.forEach((id) => {
      if (!map.has(id)) {
        const fallback = availableTags.find((tag) => tag.id === id);
        if (fallback) map.set(id, fallback);
      }
    });
    return Array.from(map.values());
  }, [availableTags, createdTags, sanitizedSelected]);

  const options: MultiSelectOption[] = useMemo(
    () =>
      allTags.map((tag) => ({
        id: tag.id,
        label: tag.name,
        data: tag,
      })),
    [allTags],
  );

  const handleSelectionChange = useCallback(
    (ids: string[]) => {
      const normalized = sanitizeIds(ids as UUID[]);
      if (!sanitizedLocked.length) {
        onTagsChange(normalized);
        return;
      }
      const merged = new Set<UUID>([...sanitizedLocked, ...normalized]);
      onTagsChange(Array.from(merged));
    },
    [onTagsChange, sanitizedLocked],
  );

  const handleCreateOption = useCallback(
    async (tagName: string): Promise<MultiSelectOption | null> => {
      try {
        const created = await onCreateTag(tagName);
        setCreatedTags((prev) => {
          if (prev.some((tag) => tag.id === created.id)) {
            return prev;
          }
          return [...prev, created];
        });
        return { id: created.id, label: created.name, data: created };
      } catch (error) {
        logger.error("Failed to create tag:", error);
        return null;
      }
    },
    [onCreateTag],
  );

  const handleCreateButtonClick = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const existing = options.find(
      (option) => option.label.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      handleSelectionChange([...sanitizedSelected, existing.id as UUID]);
      setInputValue("");
      return;
    }
    const created = await handleCreateOption(trimmed);
    if (created) {
      handleSelectionChange([...sanitizedSelected, created.id as UUID]);
      setInputValue("");
    }
  }, [
    handleCreateOption,
    handleSelectionChange,
    inputValue,
    options,
    sanitizedSelected,
  ]);

  const renderTag = useCallback(
    ({ option, remove }: { option: MultiSelectOption; remove: () => void }) => {
      const name = option.label;
      const isLocked = lockedIdSet.has(option.id as UUID);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/15 text-secondary text-sm rounded-md border border-secondary/30">
          <span className="truncate max-w-[8rem]">{name}</span>
          {!disabled && !isLocked && (
            <button
              type="button"
              className="text-secondary hover:text-secondary/80"
              onClick={(event) => {
                event.stopPropagation();
                remove();
              }}
            >
              ×
            </button>
          )}
        </span>
      );
    },
    [disabled, lockedIdSet],
  );

  const renderOption = useCallback(
    ({
      option,
      select,
      highlight,
    }: {
      option: MultiSelectOption;
      select: () => void;
      highlight: () => void;
    }) => (
      <button
        key={option.id}
        type="button"
        onMouseEnter={highlight}
        onMouseDown={(event) => event.preventDefault()}
        onClick={select}
        className="w-full px-3 py-2 text-left text-base transition-colors hover:bg-base-200"
      >
        {option.label}
      </button>
    ),
    [],
  );

  const filterOptions = useCallback(
    (items: MultiSelectOption[], query: string) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return items;
      return items.filter((option) =>
        option.label.toLowerCase().includes(normalized),
      );
    },
    [],
  );

  const selector = (
    <AsyncEntityMultiSelect
      selectedIds={sanitizedSelected}
      onSelectionChange={handleSelectionChange}
      options={options}
      placeholder={t("common.please_select")}
      size={size}
      multiple
      disabled={disabled}
      usePortal={usePortal}
      isLoading={false}
      renderTag={renderTag}
      renderOption={renderOption}
      filterOptions={filterOptions}
      searchValue={inputValue}
      onSearchChange={setInputValue}
      allowCreation
      onCreateOption={handleCreateOption}
      dropdownClassName={dropdownClassName}
      dropdownZIndexClassName={dropdownZIndexClassName}
      showClearOption={showNoTagOption}
      clearOptionLabel={t("common.none")}
      className={showCreateButton ? "" : className}
      label={showLabel ? (label ?? t("target.tags.label")) : undefined}
      showLabel={showLabel}
      selectedPlacement={selectedPlacement}
    />
  );

  if (!showCreateButton) {
    return selector;
  }

  return (
    <div className={className}>
      <InputGroup align="end" wrap={false}>
        <div className="min-w-0 flex-1">{selector}</div>
        <CreateNewButton
          onClick={() => void handleCreateButtonClick()}
          disabled={disabled || !inputValue.trim()}
          mode="subtle"
          showLabel={false}
          ariaLabel={t("common.add")}
        />
      </InputGroup>
    </div>
  );
};

export default TagSelector;
