import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import PageLayout from "@/layouts/PageLayout";
import ActionButton from "@/components/ActionButton";
import SettingGroup from "./SettingGroup";
import type { SettingGroupConfig } from "./types";
import type { CardAction } from "@/layouts/Card";
import type { PreferenceWithBootstrapReturn } from "@/hooks/queries/usePreferenceWithBootstrap";

interface SettingsLayoutProps {
  groups: SettingGroupConfig[];
  preferences: Record<string, PreferenceWithBootstrapReturn<unknown>>;
  loading?: boolean;
  disabled?: boolean;
  customFooterActions?: Record<string, CardAction[]>;
}

const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  groups,
  preferences,
  loading = false,
  disabled = false,
  customFooterActions,
}) => {
  const { t } = useTranslation();
  const { setHeader } = usePageHeader();
  const [activeGroup, setActiveGroup] = useState(groups[0]?.id || "");

  React.useEffect(() => {
    return () => setHeader({ actions: undefined });
  }, [setHeader]);

  const activeGroupConfig = groups.find((g) => g.id === activeGroup);

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 ">
          {/* Sidebar Navigation */}
          <div className="flex-shrink-0 lg:basis-[30%] lg:max-w-xs">
            <div className="sticky top-4">
              <div className="p-4">
                <nav className="space-y-1">
                  {groups.map((group) => (
                    <ActionButton
                      key={group.id}
                      label={group.title}
                      icon={
                        group.icon ? (
                          <span className="text-lg">{group.icon}</span>
                        ) : undefined
                      }
                      onClick={() => setActiveGroup(group.id)}
                      color="primary"
                      variant={activeGroup === group.id ? "solid" : "ghost"}
                      size="md"
                      className="w-full justify-start text-left font-medium"
                    />
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 lg:basis-[70%]">
            {activeGroupConfig ? (
              <SettingGroup
                config={activeGroupConfig}
                preferences={preferences}
                loading={loading}
                disabled={disabled}
                customFooterActions={customFooterActions?.[activeGroup]}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-base-content/70">
                  {t("settings.noGroupSelected")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default SettingsLayout;
