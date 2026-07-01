import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SettingGroupConfig } from "@/components/settings/types";
import { useVisibleModules } from "@/hooks/queries/useVisibleModules";
import { useDefaultInboxVision } from "@/hooks/queries/useDefaultInboxVision";
import { useLanguage } from "@/hooks/useLanguage";
import AreaSorter from "@/components/AreaSorter";
import { getAvailableTimezones } from "@/utils/datetime";
import { NOTE_COLLAPSE_ALLOWED_LINES } from "@/hooks/notes/useNoteCollapsePreference";
import VisionExperienceRatesTable from "@/components/settings/VisionExperienceRatesTable";
import VisionExperienceDefaultPreference from "@/components/settings/VisionExperienceDefaultPreference";
import { Icon, type IconName } from "@/components/icons";
import type { UUID } from "@/types/primitive";

const createIcon = (name: IconName) => () => (
  <Icon name={name} size={18} aria-hidden />
);

const AppearanceIcon = createIcon("sparkles");

const NavigationIcon = createIcon("map");

const CalendarIcon = createIcon("calendar");

const DataIcon = createIcon("chart");

const LanguageIcon = createIcon("language");

const NotesIcon = createIcon("document-text");

const VisionIcon = createIcon("eye");

export const useSettingsConfig = (): SettingGroupConfig[] => {
  const { t } = useTranslation();
  const visibleModulesSettings = useVisibleModules();
  const defaultInboxVisionSettings = useDefaultInboxVision();
  const languageSettings = useLanguage();
  const timezoneOptions = useMemo(
    () => getAvailableTimezones().map((tz) => ({ value: tz, label: tz })),
    [],
  );

  return [
    {
      id: "appearance",
      title: t("settings.appearance.title"),
      description: t("settings.appearance.description"),
      icon: <AppearanceIcon />,
      items: [
        {
          key: "theme",
          type: "select",
          label: t("settings.appearance.theme.label"),
          description: t("settings.appearance.theme.description"),
          placeholder: t("settings.appearance.theme.placeholder"),
          options: [
            { value: "system", label: t("theme.system") },
            { value: "fresh", label: t("theme.fresh") },
            { value: "cupcake", label: t("theme.cupcake") },
            { value: "bumblebee", label: t("theme.bumblebee") },
            { value: "emerald", label: t("theme.emerald") },
            { value: "corporate", label: t("theme.corporate") },
            { value: "synthwave", label: t("theme.synthwave") },
            { value: "retro", label: t("theme.retro") },
            { value: "cyberpunk", label: t("theme.cyberpunk") },
            { value: "valentine", label: t("theme.valentine") },
            { value: "halloween", label: t("theme.halloween") },
            { value: "garden", label: t("theme.garden") },
            { value: "forest", label: t("theme.forest") },
            { value: "aqua", label: t("theme.aqua") },
            { value: "lofi", label: t("theme.lofi") },
            { value: "pastel", label: t("theme.pastel") },
            { value: "fantasy", label: t("theme.fantasy") },
            { value: "wireframe", label: t("theme.wireframe") },
            { value: "luxury", label: t("theme.luxury") },
            { value: "dracula", label: t("theme.dracula") },
            { value: "cmyk", label: t("theme.cmyk") },
            { value: "autumn", label: t("theme.autumn") },
            { value: "business", label: t("theme.business") },
            { value: "acid", label: t("theme.acid") },
            { value: "lemonade", label: t("theme.lemonade") },
            { value: "night", label: t("theme.night") },
            { value: "coffee", label: t("theme.coffee") },
            { value: "winter", label: t("theme.winter") },
          ],
        },
      ],
    },
    {
      id: "navigation",
      title: t("settings.navigation.title"),
      description: t("settings.navigation.description"),
      icon: <NavigationIcon />,
      items: [
        {
          key: "visibleModules",
          type: "multiselect",
          label: t("settings.navigation.visibleModules.label"),
          description: t("settings.navigation.visibleModules.description"),
          options: visibleModulesSettings.allConfigurableModules.map(
            (module) => ({
              value: module.key,
              label: module.navLabel,
            }),
          ),
        },
      ],
    },
    {
      id: "calendar",
      title: t("settings.calendar.title"),
      description: t("settings.calendar.description"),
      icon: <CalendarIcon />,
      items: [
        {
          key: "calendarSystem",
          type: "select",
          label: t("settings.calendar.system.label"),
          description: t("settings.calendar.system.description"),
          options: [
            { value: "gregorian", label: t("calendarSystems.gregorian") },
            {
              value: "mayan_13_moon",
              label: t("calendarSystems.mayan_13_moon"),
            },
          ],
        },
        {
          key: "firstDayOfWeek",
          type: "select",
          label: t("settings.calendar.firstDay.label"),
          description: t("settings.calendar.firstDay.description"),
          options: [
            { value: "1", label: t("weekdays.monday") },
            { value: "2", label: t("weekdays.tuesday") },
            { value: "3", label: t("weekdays.wednesday") },
            { value: "4", label: t("weekdays.thursday") },
            { value: "5", label: t("weekdays.friday") },
            { value: "6", label: t("weekdays.saturday") },
            { value: "7", label: t("weekdays.sunday") },
          ],
        },
      ],
    },
    {
      id: "visions",
      title: t("settings.visions.title"),
      description: t("settings.visions.description"),
      icon: <VisionIcon />,
      items: [
        {
          key: "experienceRatePerHour",
          type: "custom",
          label: t("settings.visions.experienceRate.label"),
          description: t("settings.visions.experienceRate.description"),
          render: (props) => <VisionExperienceDefaultPreference {...props} />,
        },
        {
          key: "experienceRateOverrides",
          type: "custom",
          label: t("settings.visions.experienceTable.label"),
          description: t("settings.visions.experienceTable.description"),
          render: (props) => <VisionExperienceRatesTable {...props} />,
        },
      ],
    },
    {
      id: "notes",
      title: t("settings.notes.title"),
      description: t("settings.notes.description"),
      icon: <NotesIcon />,
      items: [
        {
          key: "minCollapsedLines",
          type: "select",
          label: t("settings.notes.minCollapsedLines.label"),
          description: t("settings.notes.minCollapsedLines.description"),
          options: NOTE_COLLAPSE_ALLOWED_LINES.map((lines) => ({
            value: String(lines),
            label: t("notes.collapseDisplayHint", { count: lines }),
          })),
        },
      ],
    },
    {
      id: "data",
      title: t("settings.data.title"),
      description: t("settings.data.description"),
      icon: <DataIcon />,
      items: [
        {
          key: "areaOrder",
          type: "custom",
          label: t("settings.areaOrder.title"),
          description: t("settings.areaOrder.description"),
          render: ({ value, onCommit, loading, saving, disabled, id }) => {
            const currentOrder = Array.isArray(value) ? (value as UUID[]) : [];
            const handleOrderChange = (nextOrder: UUID[]) => {
              void onCommit(nextOrder);
            };
            return (
              <div id={id} role="group" aria-labelledby={`${id}-label`}>
                <AreaSorter
                  id={`${id}-sorter`}
                  areaOrder={currentOrder}
                  onOrderChange={handleOrderChange}
                  loading={loading}
                  disabled={disabled || saving}
                />
              </div>
            );
          },
        },
        {
          key: "defaultInboxVision",
          type: "select",
          label: t("settings.defaultInboxVision.label"),
          description: t("settings.defaultInboxVision.description"),
          options: [
            {
              value: "",
              label: t("settings.defaultInboxVision.noDefault"),
            },
            ...defaultInboxVisionSettings.availableVisions.map((vision) => ({
              value: String(vision.id),
              label: vision.name,
            })),
          ],
        },
      ],
    },
    {
      id: "language",
      title: t("settings.language.title"),
      description: t("settings.language.description"),
      icon: <LanguageIcon />,
      items: [
        {
          key: "timezone",
          type: "select",
          label: t("settings.language.timezone.label"),
          description: t("settings.language.timezone.description"),
          options: timezoneOptions,
        },
        {
          key: "language",
          type: "select",
          label: t("settings.language.label"),
          description: t("settings.language.description"),
          placeholder: t("settings.language.placeholder"),
          options: languageSettings.languageOptions.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        },
      ],
    },
  ];
};
