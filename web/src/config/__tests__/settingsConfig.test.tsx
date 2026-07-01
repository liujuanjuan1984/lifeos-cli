import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSettingsConfig } from "@/config/settingsConfig";

vi.mock("@/hooks/queries/useVisibleModules", () => ({
  useVisibleModules: () => ({
    allConfigurableModules: [
      {
        key: "planning",
        navLabel: "Planning",
      },
    ],
  }),
}));

vi.mock("@/hooks/queries/useDefaultInboxVision", () => ({
  useDefaultInboxVision: () => ({
    availableVisions: [],
  }),
}));

vi.mock("@/hooks/useLanguage", () => ({
  useLanguage: () => ({
    languageOptions: [
      {
        value: "en",
        label: "English",
      },
    ],
  }),
}));

describe("useSettingsConfig", () => {
  it("exposes calendar system and first-day preferences", () => {
    const { result } = renderHook(() => useSettingsConfig());

    const calendarGroup = result.current.find((group) => group.id === "calendar");

    expect(calendarGroup).toBeDefined();
    expect(calendarGroup?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "calendarSystem",
          type: "select",
          options: expect.arrayContaining([
            expect.objectContaining({ value: "gregorian" }),
            expect.objectContaining({ value: "mayan_13_moon" }),
          ]),
        }),
        expect.objectContaining({
          key: "firstDayOfWeek",
          type: "select",
          options: expect.arrayContaining([
            expect.objectContaining({ value: "1" }),
            expect.objectContaining({ value: "7" }),
          ]),
        }),
      ]),
    );
  });
});
