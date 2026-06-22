// Centralized module configuration for display names and navigation

import type { IconName } from "@/components/icons";

type NavColor = "green" | "blue" | "orange" | "pink";

export type ModuleKey =
  | "visions"
  | "calendar"
  | "timelog"
  | "finance"
  | "planning"
  | "notes"
  | "persons"
  | "insights"
  | "focus"
  | "habits"
  | "settings";

interface ModuleConfig {
  key: ModuleKey;
  path: string;
  /** Navigation highlight color */
  navColor: NavColor;
  /** Whether to show this module in the top navigation */
  showInNav?: boolean;
  /** Icon used in navigation and settings */
  iconName: IconName;
}

export interface ModuleConfigWithI18n extends ModuleConfig {
  /** The human readable title used for page titles */
  displayName: string;
  /** Label used in the navigation bar */
  navLabel: string;
  /** Optional short description to be shown under the title on the page */
  description?: string;
}

export const MODULES: ModuleConfig[] = [
  {
    key: "visions",
    path: "/visions",
    navColor: "green",
    showInNav: true,
    iconName: "sun",
  },
  {
    key: "habits",
    path: "/habits",
    navColor: "green",
    showInNav: true,
    iconName: "repeat",
  },
  {
    key: "planning",
    path: "/planning",
    navColor: "blue",
    showInNav: true,
    iconName: "clipboard",
  },
  {
    key: "timelog",
    path: "/timelog",
    navColor: "orange",
    showInNav: true,
    iconName: "timer",
  },
  {
    key: "finance",
    path: "/finance",
    navColor: "green",
    showInNav: true,
    iconName: "banknotes",
  },
  {
    key: "insights",
    path: "/stats",
    navColor: "blue",
    showInNav: true,
    iconName: "chart",
  },
  {
    key: "calendar",
    path: "/schedule",
    navColor: "blue",
    showInNav: true,
    iconName: "calendar",
  },
  {
    key: "notes",
    path: "/notes",
    navColor: "blue",
    showInNav: true,
    iconName: "document-text",
  },
  {
    key: "persons",
    path: "/people",
    navColor: "pink",
    showInNav: true,
    iconName: "people",
  },
  {
    key: "settings",
    path: "/config",
    navColor: "blue",
    showInNav: true,
    iconName: "settings",
  },
];
