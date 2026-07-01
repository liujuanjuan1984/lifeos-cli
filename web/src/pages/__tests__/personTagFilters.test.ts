import { describe, expect, it } from "vitest";

import {
  formatPersonTagFilterLabel,
  getNextPersonTagFilterState,
  getPersonTagUsageCount,
} from "@/features/people/tagFilters";
import type { UUID } from "@/types/primitive";

const tagId = "11111111-1111-1111-1111-111111111111" as UUID;
const otherTagId = "22222222-2222-2222-2222-222222222222" as UUID;

describe("person tag filters", () => {
  it("selects a tag when no tag filter is active", () => {
    expect(
      getNextPersonTagFilterState(
        { filteredByTag: false, selectedTagId: null },
        tagId,
      ),
    ).toEqual({ filteredByTag: true, selectedTagId: tagId });
  });

  it("clears the filter when the active tag is clicked again", () => {
    expect(
      getNextPersonTagFilterState(
        { filteredByTag: true, selectedTagId: tagId },
        tagId,
      ),
    ).toEqual({ filteredByTag: false, selectedTagId: null });
  });

  it("switches directly to another tag", () => {
    expect(
      getNextPersonTagFilterState(
        { filteredByTag: true, selectedTagId: tagId },
        otherTagId,
      ),
    ).toEqual({ filteredByTag: true, selectedTagId: otherTagId });
  });

  it("formats tag labels with loaded person counts", () => {
    expect(formatPersonTagFilterLabel("Friends", 0)).toBe("Friends (0)");
    expect(formatPersonTagFilterLabel("Friends", 12)).toBe("Friends (12)");
  });

  it("keeps tag labels unchanged before counts are loaded", () => {
    expect(formatPersonTagFilterLabel("Friends", null)).toBe("Friends");
  });

  it("returns zero for tags missing from loaded usage counts", () => {
    const usageCounts = new Map<UUID, number>([[otherTagId, 3]]);

    expect(getPersonTagUsageCount(null, tagId)).toBeNull();
    expect(getPersonTagUsageCount(usageCounts, otherTagId)).toBe(3);
    expect(getPersonTagUsageCount(usageCounts, tagId)).toBe(0);
  });
});
