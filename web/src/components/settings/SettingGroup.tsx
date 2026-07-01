import React from "react";
import Card, { type CardAction } from "@/layouts/Card";
import SettingItem from "./SettingItem";
import type { SettingGroupConfig } from "./types";
import type { PreferenceWithBootstrapReturn } from "@/hooks/queries/usePreferenceWithBootstrap";

interface SettingGroupProps {
  config: SettingGroupConfig;
  preferences: Record<string, PreferenceWithBootstrapReturn<unknown>>;
  loading?: boolean;
  disabled?: boolean;
  customFooterActions?: CardAction[];
}

const SettingGroup: React.FC<SettingGroupProps> = ({
  config,
  preferences,
  loading = false,
  disabled = false,
  customFooterActions,
}) => {
  // Get preferences for this group
  const groupPreferences = config.items
    .map((item) => {
      const preferenceKey = `${config.id}.${item.key}`;
      return preferences[preferenceKey];
    })
    .filter(Boolean);

  const hasErrors = groupPreferences.some((pref) => pref?.error);
  const isSaving = groupPreferences.some((pref) => pref?.saving);
  const isLoading = groupPreferences.some((pref) => pref?.loading);

  const footerActions: CardAction[] = [...(customFooterActions || [])];

  return (
    <Card
      title={config.title}
      description={config.description}
      error={hasErrors ? "部分设置保存失败" : undefined}
      footerActions={footerActions.length > 0 ? footerActions : undefined}
      loading={isLoading || loading}
      disabled={isSaving || disabled}
    >
      <div className="space-y-4">
        {config.items.map((itemConfig) => {
          const preferenceKey = `${config.id}.${itemConfig.key}`;
          const preference = preferences[preferenceKey];

          if (!preference) return null;

          return (
            <SettingItem
              key={itemConfig.key}
              config={itemConfig}
              preference={preference}
              disabled={disabled || itemConfig.disabled}
            />
          );
        })}
      </div>
    </Card>
  );
};

export default SettingGroup;
