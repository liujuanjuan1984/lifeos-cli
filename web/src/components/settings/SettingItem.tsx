import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import EnumSelect from "@/components/selects/EnumSelect";
import Checkbox from "@/components/forms/Checkbox";
import CheckboxGroup from "@/components/forms/CheckboxGroup";
import TextInput from "@/components/forms/TextInput";
import ErrorDisplay from "@/components/ErrorDisplay";
import type { SettingItemConfig } from "./types";
import type { PreferenceWithBootstrapReturn } from "@/hooks/queries/usePreferenceWithBootstrap";
import { useToast } from "@/contexts/ToastContext";

interface SettingItemProps {
  config: SettingItemConfig;
  preference: PreferenceWithBootstrapReturn<unknown>;
  disabled?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  config,
  preference,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { value, loading, saving, error, updateValue, saveValue } = preference;

  const commitValue = useCallback(
    async (nextValue: unknown) => {
      if (loading || saving || disabled) {
        return false;
      }

      if (Object.is(nextValue, value)) {
        return true;
      }

      const previousValue = value;
      updateValue(nextValue);

      try {
        const success = await saveValue(nextValue);
        if (success) {
          return true;
        }
      } catch (_err) {
        // handled below
      }

      updateValue(previousValue);
      toast.showError(t("settings.saveFailed"));
      return false;
    },
    [disabled, loading, saving, saveValue, t, toast, updateValue, value],
  );

  const isControlDisabled = loading || saving || disabled;

  const renderControl = () => {
    switch (config.type) {
      case "select":
        return (
          <EnumSelect
            id={config.key}
            label={config.label}
            options={config.options || []}
            placeholder={config.placeholder}
            aria-describedby={
              config.description ? `${getControlId()}-description` : undefined
            }
            disabled={isControlDisabled}
            onChange={(nextValue) => {
              void commitValue(nextValue);
            }}
            value={
              typeof value === "number"
                ? String(value)
                : (value as string | undefined)
            }
          />
        );

      case "number": {
        const numericValue =
          typeof value === "number" && Number.isFinite(value) ? value : null;

        const handleNumberChange = (
          event: React.ChangeEvent<HTMLInputElement>,
        ) => {
          const inputValue = event.target.value;
          if (inputValue === "") {
            return;
          }
          const parsed = Number(inputValue);
          if (Number.isNaN(parsed)) {
            return;
          }
          let normalized = Math.round(parsed);
          if (typeof config.min === "number" && normalized < config.min) {
            normalized = config.min;
          }
          if (typeof config.max === "number" && normalized > config.max) {
            normalized = config.max;
          }
          void commitValue(normalized);
        };

        return (
          <TextInput
            id={getControlId()}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={
              numericValue === null ? "" : String(Math.trunc(numericValue))
            }
            onChange={handleNumberChange}
            disabled={isControlDisabled}
            aria-describedby={
              config.description ? `${getControlId()}-description` : undefined
            }
          />
        );
      }

      case "checkbox":
        return (
          <Checkbox
            id={config.key}
            name={config.key}
            checked={Boolean(value)}
            disabled={isControlDisabled}
            onCheckedChange={(checked: boolean) => {
              void commitValue(checked);
            }}
            label={config.label}
            description={config.description}
            variant="primary"
            size="md"
            error={error || undefined}
          />
        );

      case "multiselect": {
        const selectedValues = Array.isArray(value) ? value : [];
        const options =
          config.options?.map((option: { value: string; label: string }) => ({
            value: option.value,
            label: option.label,
          })) || [];

        return (
          <CheckboxGroup
            name={config.key}
            value={selectedValues}
            options={options}
            onChange={(values: string[]) => {
              void commitValue(values);
            }}
            disabled={isControlDisabled}
            variant="primary"
            size="sm"
            direction="horizontal"
            columns={2}
            label={config.label}
            description={config.description}
            error={error || undefined}
          />
        );
      }

      case "custom":
        return config.render
          ? config.render({
              value,
              onChange: updateValue,
              onSave: async (newValue: unknown) => {
                return await saveValue(newValue);
              },
              onCommit: commitValue,
              saving,
              loading,
              error,
              disabled: isControlDisabled,
              id: getControlId(),
              "aria-labelledby": !config.hideLabel
                ? `${getControlId()}-label`
                : undefined,
              "aria-describedby":
                config.description && !config.hideDescription
                  ? `${getControlId()}-description`
                  : undefined,
            })
          : null;

      default:
        return null;
    }
  };

  const getControlId = () => {
    switch (config.type) {
      case "select":
        return `${config.key}-select`;
      case "number":
        return `${config.key}-input`;
      case "checkbox":
        return config.key;
      case "multiselect":
        return `${config.key}-multiselect`;
      case "custom":
        return `${config.key}-custom`;
      default:
        return config.key;
    }
  };

  return (
    <div className="space-y-2">
      {config.type !== "checkbox" &&
        config.type !== "multiselect" &&
        config.type !== "select" &&
        !config.hideLabel && (
          <div
            id={`${getControlId()}-label`}
            className="block text-base font-medium"
          >
            {config.label}
          </div>
        )}

      {renderControl()}

      {config.description &&
        config.type !== "multiselect" &&
        config.type !== "checkbox" &&
        !config.hideDescription && (
          <p
            id={`${getControlId()}-description`}
            className="text-sm text-base-content/70"
          >
            {config.description}
          </p>
        )}

      <ErrorDisplay error={error} className="mt-2" />
    </div>
  );
};

export default SettingItem;
