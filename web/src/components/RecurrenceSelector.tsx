import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import EnumSelect from "./selects/EnumSelect";
import { Checkbox, TextInput } from "./forms";

interface CustomRecurrenceConfig {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  weekdays?: string[]; // For WEEKLY frequency
  monthDay?: number; // For MONTHLY frequency (day of month)
  monthWeekday?: { weekday: string; occurrence: number }; // For MONTHLY frequency (nth weekday)
  yearMonth?: number; // For YEARLY frequency
}

interface RecurrenceSelectorProps {
  value?: string; // Current RRULE string
  onChange: (rrule: string) => void;
  startDate?: Date; // Used for intelligent defaults
}

// Predefined recurrence presets
const RECURRENCE_PRESETS = [
  { preset: "none", rrule: "", description: "不重复" },
  { preset: "daily", rrule: "FREQ=DAILY", description: "每天" },
  { preset: "weekly", rrule: "FREQ=WEEKLY", description: "每周" },
  { preset: "monthly", rrule: "FREQ=MONTHLY", description: "每月" },
  { preset: "yearly", rrule: "FREQ=YEARLY", description: "每年" },
  {
    preset: "weekdays",
    rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    description: "每周工作日 (周一至周五)",
  },
];

// Weekday mappings
const WEEKDAYS = [
  { value: "MO", label: "周一" },
  { value: "TU", label: "周二" },
  { value: "WE", label: "周三" },
  { value: "TH", label: "周四" },
  { value: "FR", label: "周五" },
  { value: "SA", label: "周六" },
  { value: "SU", label: "周日" },
];

// Month mappings for yearly recurrence
const MONTHS = [
  { value: "1", label: "1月" },
  { value: "2", label: "2月" },
  { value: "3", label: "3月" },
  { value: "4", label: "4月" },
  { value: "5", label: "5月" },
  { value: "6", label: "6月" },
  { value: "7", label: "7月" },
  { value: "8", label: "8月" },
  { value: "9", label: "9月" },
  { value: "10", label: "10月" },
  { value: "11", label: "11月" },
  { value: "12", label: "12月" },
];

// Occurrence mappings for monthly recurrence
const OCCURRENCES = [
  { value: "1", label: "第一个" },
  { value: "2", label: "第二个" },
  { value: "3", label: "第三个" },
  { value: "4", label: "第四个" },
  { value: "-1", label: "最后一个" },
];

export default function RecurrenceSelector({
  value = "",
  onChange,
  startDate,
}: RecurrenceSelectorProps) {
  const { t } = useTranslation();
  const [selectedPreset, setSelectedPreset] = useState("none");
  const [showCustom, setShowCustom] = useState(false);
  const [customConfig, setCustomConfig] = useState<CustomRecurrenceConfig>({
    frequency: "WEEKLY",
    interval: 1,
    weekdays: [],
  });

  // Initialize component state based on current RRULE value
  useEffect(() => {
    if (value) {
      const matchingPreset = RECURRENCE_PRESETS.find(
        (preset) => preset.rrule === value,
      );
      if (matchingPreset) {
        setSelectedPreset(matchingPreset.preset);
        setShowCustom(false);
      } else {
        setSelectedPreset("custom");
        setShowCustom(true);
        // Parse existing RRULE to populate custom config
        parseRRuleToCustomConfig(value);
      }
    } else {
      setSelectedPreset("none");
      setShowCustom(false);
    }
  }, [value]);

  // Parse RRULE string to custom configuration (basic implementation)
  const parseRRuleToCustomConfig = (rrule: string) => {
    // This is a simplified parser - in production you might want a more robust solution
    const parts = rrule.split(";");
    const config: Partial<CustomRecurrenceConfig> = { interval: 1 };

    parts.forEach((part) => {
      const [key, val] = part.split("=");
      switch (key) {
        case "FREQ":
          config.frequency = val as CustomRecurrenceConfig["frequency"];
          break;
        case "INTERVAL":
          config.interval = parseInt(val);
          break;
        case "BYDAY":
          config.weekdays = val.split(",");
          break;
        // Add more parsing as needed
      }
    });

    setCustomConfig(config as CustomRecurrenceConfig);
  };

  // Generate intelligent default description based on start date
  const getIntelligentDescription = (preset: string): string => {
    if (!startDate)
      return (
        RECURRENCE_PRESETS.find((p) => p.preset === preset)?.description || ""
      );

    const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const monthNames = [
      "1月",
      "2月",
      "3月",
      "4月",
      "5月",
      "6月",
      "7月",
      "8月",
      "9月",
      "10月",
      "11月",
      "12月",
    ];

    switch (preset) {
      case "weekly":
        return `每周${dayNames[startDate.getDay()]}`;
      case "monthly":
        return `每月${startDate.getDate()}日`;
      case "yearly":
        return `每年${monthNames[startDate.getMonth()]}${startDate.getDate()}日`;
      default:
        return (
          RECURRENCE_PRESETS.find((p) => p.preset === preset)?.description || ""
        );
    }
  };

  // Handle preset selection
  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);

    if (preset === "custom") {
      setShowCustom(true);
      return;
    }

    setShowCustom(false);
    const presetConfig = RECURRENCE_PRESETS.find((p) => p.preset === preset);
    if (presetConfig) {
      onChange(presetConfig.rrule);
    }
  };

  // Generate RRULE from custom configuration
  const generateCustomRRule = (config: CustomRecurrenceConfig): string => {
    let rrule = `FREQ=${config.frequency}`;

    if (config.interval && config.interval > 1) {
      rrule += `;INTERVAL=${config.interval}`;
    }

    if (
      config.frequency === "WEEKLY" &&
      config.weekdays &&
      config.weekdays.length > 0
    ) {
      rrule += `;BYDAY=${config.weekdays.join(",")}`;
    }

    if (config.frequency === "MONTHLY") {
      if (config.monthDay) {
        rrule += `;BYMONTHDAY=${config.monthDay}`;
      } else if (config.monthWeekday) {
        rrule += `;BYDAY=${config.monthWeekday.occurrence > 0 ? config.monthWeekday.occurrence : ""}${config.monthWeekday.weekday}`;
      }
    }

    if (config.frequency === "YEARLY" && config.yearMonth) {
      rrule += `;BYMONTH=${config.yearMonth}`;
    }

    return rrule;
  };

  // Generate description from custom configuration
  const generateCustomDescription = (
    config: CustomRecurrenceConfig,
  ): string => {
    const intervalText = config.interval > 1 ? `每${config.interval}` : "每";

    switch (config.frequency) {
      case "DAILY":
        return `${intervalText}天`;
      case "WEEKLY":
        if (config.weekdays && config.weekdays.length > 0) {
          const weekdayLabels = config.weekdays
            .map((wd) => WEEKDAYS.find((w) => w.value === wd)?.label)
            .join("、");
          return `${intervalText}周的${weekdayLabels}`;
        }
        return `${intervalText}周`;
      case "MONTHLY":
        if (config.monthDay) {
          return `${intervalText}月${config.monthDay}日`;
        } else if (config.monthWeekday) {
          const weekdayLabel = WEEKDAYS.find(
            (w) => w.value === config.monthWeekday!.weekday,
          )?.label;
          const occurrenceLabel = OCCURRENCES.find(
            (o) => o.value === String(config.monthWeekday!.occurrence),
          )?.label;
          return `${intervalText}月${occurrenceLabel}${weekdayLabel}`;
        }
        return `${intervalText}月`;
      case "YEARLY":
        return `${intervalText}年`;
      default:
        return "自定义重复";
    }
  };

  // Handle custom configuration changes
  const handleCustomConfigChange = (
    updates: Partial<CustomRecurrenceConfig>,
  ) => {
    const newConfig = { ...customConfig, ...updates };
    setCustomConfig(newConfig);

    const rrule = generateCustomRRule(newConfig);
    onChange(rrule);
  };

  return (
    <div className="space-y-4">
      {/* Preset Selection */}
      <div>
        <EnumSelect
          id="recurrence-preset-select"
          label={t("target.frequency")}
          value={selectedPreset}
          onChange={(v) => handlePresetChange(String(v))}
          options={[
            ...RECURRENCE_PRESETS.map((p) => ({
              value: p.preset,
              label: getIntelligentDescription(p.preset),
            })),
            { value: "custom", label: "自定义..." },
          ]}
        />
      </div>

      {/* Custom Configuration */}
      {showCustom && (
        <div className="border-t pt-4 space-y-4">
          <h4 className="text-base font-medium text-base-content/70">
            自定义重复规则
          </h4>

          {/* Frequency Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <EnumSelect
                id="frequency-select"
                label={t("target.frequency")}
                value={customConfig.frequency}
                onChange={(v) =>
                  handleCustomConfigChange({
                    frequency: String(v) as CustomRecurrenceConfig["frequency"],
                  })
                }
                options={[
                  { value: "DAILY", label: "每天" },
                  { value: "WEEKLY", label: "每周" },
                  { value: "MONTHLY", label: "每月" },
                  { value: "YEARLY", label: "每年" },
                ]}
              />
            </div>

            <div>
              <label
                htmlFor="interval"
                className="block text-sm font-medium text-base-content mb-1"
              >
                {t("target.interval")}
              </label>
              <TextInput
                id="interval"
                name="interval"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(customConfig.interval)}
                onChange={(e) =>
                  handleCustomConfigChange({
                    interval: parseInt(e.target.value, 10) || 1,
                  })
                }
                size="sm"
              />
            </div>
          </div>

          {/* Weekly Configuration */}
          {customConfig.frequency === "WEEKLY" && (
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">
                选择星期
              </label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((weekday) => (
                  <Checkbox
                    key={weekday.value}
                    id={`weekly-type-${weekday.value}`}
                    name="weeklyType"
                    checked={
                      customConfig.weekdays?.includes(weekday.value) || false
                    }
                    onCheckedChange={(checked) => {
                      const weekdays = customConfig.weekdays || [];
                      if (checked) {
                        handleCustomConfigChange({
                          weekdays: [...weekdays, weekday.value],
                        });
                        return;
                      }

                      handleCustomConfigChange({
                        weekdays: weekdays.filter((wd) => wd !== weekday.value),
                      });
                    }}
                    size="sm"
                    label={weekday.label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Monthly Configuration */}
          {customConfig.frequency === "MONTHLY" && (
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">
                重复方式
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    id="monthlyType-date"
                    type="radio"
                    name="monthlyType"
                    checked={!!customConfig.monthDay}
                    onChange={() => {
                      const day = startDate ? startDate.getDate() : 1;
                      handleCustomConfigChange({
                        monthDay: day,
                        monthWeekday: undefined,
                      });
                    }}
                    className="mr-2"
                  />
                  <span className="text-base">按日期：每月</span>
                  <TextInput
                    id="monthDay"
                    name="monthDay"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={String(
                      customConfig.monthDay ||
                        (startDate ? startDate.getDate() : 1),
                    )}
                    onChange={(e) =>
                      handleCustomConfigChange({
                        monthDay: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    size="sm"
                    className="mx-1 w-16"
                    disabled={!customConfig.monthDay}
                  />
                  <span className="text-base">日</span>
                </label>

                <label className="flex items-center">
                  <input
                    id="monthlyType-weekday"
                    type="radio"
                    name="monthlyType"
                    checked={!!customConfig.monthWeekday}
                    onChange={() => {
                      handleCustomConfigChange({
                        monthDay: undefined,
                        monthWeekday: { weekday: "MO", occurrence: 1 },
                      });
                    }}
                    className="mr-2"
                  />
                  <span className="text-base">按星期：每月</span>
                  <div className="mx-1 min-w-[110px]">
                    <EnumSelect
                      id="monthly-occurrence"
                      value={
                        customConfig.monthWeekday?.occurrence
                          ? String(customConfig.monthWeekday.occurrence)
                          : "1"
                      }
                      onChange={(v) =>
                        handleCustomConfigChange({
                          monthWeekday: {
                            ...customConfig.monthWeekday!,
                            occurrence:
                              typeof v === "number"
                                ? v
                                : parseInt(String(v)) || 1,
                          },
                        })
                      }
                      options={OCCURRENCES.map((occ) => ({
                        value: String(occ.value),
                        label: occ.label,
                      }))}
                    />
                  </div>
                  <div className="mx-1 min-w-[110px]">
                    <EnumSelect
                      id="monthly-weekday"
                      value={customConfig.monthWeekday?.weekday || "MO"}
                      onChange={(v) =>
                        handleCustomConfigChange({
                          monthWeekday: {
                            ...customConfig.monthWeekday!,
                            weekday: String(v),
                          },
                        })
                      }
                      options={WEEKDAYS.map((wd) => ({
                        value: wd.value,
                        label: wd.label,
                      }))}
                    />
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Yearly Configuration */}
          {customConfig.frequency === "YEARLY" && (
            <div>
              <EnumSelect
                id="yearly-month"
                label={t("target.month")}
                value={String(
                  customConfig.yearMonth ||
                    (startDate ? startDate.getMonth() + 1 : 1),
                )}
                onChange={(v) =>
                  handleCustomConfigChange({
                    yearMonth:
                      typeof v === "number" ? v : parseInt(String(v)) || 1,
                  })
                }
                options={MONTHS.map((m) => ({
                  value: m.value,
                  label: m.label,
                }))}
              />
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {selectedPreset !== "none" && selectedPreset !== "custom" && (
        <div className="text-sm bg-base-200 p-2 rounded">
          预览：{getIntelligentDescription(selectedPreset)}
        </div>
      )}

      {showCustom && (
        <div className="text-sm bg-base-200 p-2 rounded">
          预览：{generateCustomDescription(customConfig)}
        </div>
      )}
    </div>
  );
}
