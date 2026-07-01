import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { renderWithProviders, setupTranslationMock } from "@test/utils";

setupTranslationMock();

vi.mock("@/components/settings", () => ({
  SettingsLayout: () => <div data-testid="settings-layout" />,
}));

vi.mock("@/components/AreaManagerModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    value: "system",
    loading: false,
    saving: false,
    error: null,
    bootstrapped: true,
    saveValue: vi.fn(async () => true),
    updateValue: vi.fn(),
  }),
}));

vi.mock("@/hooks/queries/useVisibleModules", () => ({
  useVisibleModules: () => ({
    visibleKeys: [],
    allConfigurableModules: [],
    loading: false,
    saving: false,
    error: null,
    bootstrapped: true,
    saveVisibleKeys: vi.fn(async () => true),
    updateVisibleKeys: vi.fn(),
  }),
}));

vi.mock("@/hooks/queries/useDefaultInboxVision", () => ({
  useDefaultInboxVision: () => ({
    defaultInboxVision: null,
    availableVisions: [],
    loading: false,
    saving: false,
    error: null,
    bootstrapped: true,
    saveDefaultInboxVision: vi.fn(async () => true),
    updateDefaultInboxVision: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLanguage", () => ({
  useLanguage: () => ({
    currentLanguage: "en",
    languageOptions: [{ value: "en", label: "English" }],
    loading: false,
    error: null,
    bootstrapped: true,
    saveLanguage: vi.fn(async () => true),
    changeLanguage: vi.fn(async () => true),
  }),
}));

vi.mock("@/hooks/notes/useNoteCollapsePreference", () => ({
  NOTE_COLLAPSE_ALLOWED_LINES: [1, 3, 5],
  coerceNoteCollapseValue: (value: unknown) => value,
  useNoteCollapsePreference: () => ({
    value: 3,
    loading: false,
    saving: false,
    error: null,
    bootstrapped: true,
    saveValue: vi.fn(async () => true),
    updateValue: vi.fn(),
  }),
}));

vi.mock("@/hooks/queries/useVisions", () => ({
  useVisions: () => ({
    visions: [],
    loading: false,
    error: null,
    refresh: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/layouts/PageLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const calendarFirstDayUpdateMock = vi.fn();
const calendarFirstDaySaveMock = vi.fn(async () => true);

vi.mock("@/hooks/queries/usePreferenceWithBootstrap", () => ({
  usePreferenceWithBootstrap: vi.fn((opts: { key: string; defaultValue: unknown }) => {
    if (opts.key === "calendar.system") {
      return {
        value: "mayan_13_moon",
        loading: false,
        saving: false,
        error: null,
        bootstrapped: true,
        saveValue: vi.fn(async () => true),
        updateValue: vi.fn(),
      };
    }

    if (opts.key === "calendar.first_day_of_week") {
      return {
        value: 1,
        loading: false,
        saving: false,
        error: null,
        bootstrapped: true,
        saveValue: calendarFirstDaySaveMock,
        updateValue: calendarFirstDayUpdateMock,
      };
    }

    return {
      value: opts.defaultValue,
      loading: false,
      saving: false,
      error: null,
      bootstrapped: true,
      saveValue: vi.fn(async () => true),
      updateValue: vi.fn(),
    };
  }),
}));

import SettingsPage from "@/pages/SettingsPage";

describe("SettingsPage calendar preferences", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
    calendarFirstDayUpdateMock.mockClear();
    calendarFirstDaySaveMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("automatically persists the first day for the current Mayan year before July 26", () => {
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));

    renderWithProviders(<SettingsPage />);

    expect(calendarFirstDayUpdateMock).toHaveBeenCalledWith(6);
    expect(calendarFirstDaySaveMock).toHaveBeenCalledWith(6);
  });

  it("automatically persists the first day for the new Mayan year after July 26", () => {
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));

    renderWithProviders(<SettingsPage />);

    expect(calendarFirstDayUpdateMock).toHaveBeenCalledWith(7);
    expect(calendarFirstDaySaveMock).toHaveBeenCalledWith(7);
  });
});
