import type { UUID } from "@/types/primitive";

export interface PersonTagFilterState {
  filteredByTag: boolean;
  selectedTagId: UUID | null;
}

export function getNextPersonTagFilterState(
  current: PersonTagFilterState,
  tagId: UUID,
): PersonTagFilterState {
  if (current.filteredByTag && current.selectedTagId === tagId) {
    return {
      filteredByTag: false,
      selectedTagId: null,
    };
  }

  return {
    filteredByTag: true,
    selectedTagId: tagId,
  };
}

export function formatPersonTagFilterLabel(
  tagName: string,
  usageCount: number | null,
): string {
  return usageCount === null ? tagName : `${tagName} (${usageCount})`;
}

export function getPersonTagUsageCount(
  usageCounts: ReadonlyMap<UUID, number> | null,
  tagId: UUID,
): number | null {
  return usageCounts === null ? null : (usageCounts.get(tagId) ?? 0);
}
