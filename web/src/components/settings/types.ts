import React from "react";

type SettingItemType =
  | "select"
  | "checkbox"
  | "multiselect"
  | "number"
  | "custom";

export interface SettingItemConfig {
  key: string;
  type: SettingItemType;
  label: string;
  description?: string;
  placeholder?: string;
  /**
   * When true, SettingItem will not render the outer label text. Useful when
   * the custom renderer provides its own heading.
   */
  hideLabel?: boolean;
  /**
   * When true, SettingItem will not render the outer description text.
   */
  hideDescription?: boolean;
  options?: Array<{ value: string; label: string }>;
  render?: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    onSave: (value: unknown) => Promise<boolean>;
    onCommit: (value: unknown) => Promise<boolean>;
    saving: boolean;
    loading: boolean;
    error: string | null;
    disabled: boolean;
    id: string;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
  }) => React.ReactNode;
  dependencies?: string[]; // 依赖的其他设置项
  min?: number;
  max?: number;
  step?: number;
}

export interface SettingGroupConfig {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  items: SettingItemConfig[];
}
