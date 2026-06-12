import React, { useId, useMemo, useRef, useState } from "react";

type RadioGroupValue = string;

export interface RadioGroupOption {
  value: RadioGroupValue;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

interface RadioGroupProps {
  options: RadioGroupOption[];
  value?: RadioGroupValue;
  defaultValue?: RadioGroupValue;
  onChange?: (value: RadioGroupValue) => void;
  name?: string;
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  direction?: "vertical" | "horizontal";
  variant?: "default" | "card";
  size?: "sm" | "md" | "lg";
  className?: string;
}

function findEnabledIndex(
  options: RadioGroupOption[],
  startIndex: number,
  step: 1 | -1,
) {
  if (options.length === 0) {
    return -1;
  }

  for (let offset = 1; offset <= options.length; offset += 1) {
    const nextIndex =
      (startIndex + offset * step + options.length) % options.length;
    if (!options[nextIndex]?.disabled) {
      return nextIndex;
    }
  }

  return startIndex;
}

export default function RadioGroup({
  options,
  value,
  defaultValue,
  onChange,
  name,
  label,
  description,
  error,
  disabled = false,
  direction = "vertical",
  variant = "default",
  size = "md",
  className = "",
}: RadioGroupProps) {
  const generatedId = useId();
  const groupName = name ?? `radio-group-${generatedId}`;
  const legendId = label ? `${groupName}-legend` : undefined;
  const descriptionId = description ? `${groupName}-description` : undefined;
  const errorId = error ? `${groupName}-error` : undefined;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const firstEnabledValue = useMemo(
    () => options.find((option) => !option.disabled)?.value,
    [options],
  );

  const [internalValue, setInternalValue] = useState<
    RadioGroupValue | undefined
  >(defaultValue ?? firstEnabledValue);

  const selectedValue = value ?? internalValue ?? firstEnabledValue;
  const isControlled = value !== undefined;

  const handleSelect = (nextValue: RadioGroupValue) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  };

  const radioSizeClass =
    size === "sm" ? "radio-sm" : size === "lg" ? "radio-lg" : "";
  const layoutClass =
    direction === "horizontal"
      ? "flex flex-wrap items-center gap-3"
      : "flex flex-col gap-2";

  return (
    <fieldset
      className={["space-y-2", className].filter(Boolean).join(" ")}
      aria-invalid={error ? "true" : "false"}
      aria-describedby={
        [descriptionId, errorId].filter(Boolean).join(" ") || undefined
      }
    >
      {label ? (
        <legend
          id={legendId}
          className="text-sm sm:text-base font-medium text-base-content"
        >
          {label}
        </legend>
      ) : null}
      {description ? (
        <div id={descriptionId} className="text-sm text-base-content/70">
          {description}
        </div>
      ) : null}

      <div className={layoutClass} aria-labelledby={legendId}>
        {options.map((option, index) => {
          const optionId = `${groupName}-${index}`;
          const isChecked = selectedValue === option.value;
          const isOptionDisabled = disabled || Boolean(option.disabled);

          const sharedInputProps = {
            id: optionId,
            name: groupName,
            type: "radio" as const,
            checked: isChecked,
            disabled: isOptionDisabled,
            onChange: () => handleSelect(option.value),
            onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
              let step: 1 | -1 | null = null;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                step = 1;
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                step = -1;
              }

              if (!step) {
                return;
              }

              event.preventDefault();
              const nextIndex = findEnabledIndex(options, index, step);
              const nextOption = options[nextIndex];
              if (!nextOption) {
                return;
              }
              handleSelect(nextOption.value);
              inputRefs.current[nextIndex]?.focus();
            },
            ref: (node: HTMLInputElement | null) => {
              inputRefs.current[index] = node;
            },
          };

          if (variant === "card") {
            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className={[
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  isOptionDisabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:bg-base-200/60",
                  isChecked
                    ? "border-primary bg-primary/5"
                    : "border-base-300 bg-base-100",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  {...sharedInputProps}
                  className={["radio mt-1", radioSizeClass]
                    .filter(Boolean)
                    .join(" ")}
                />
                <div className="space-y-1">
                  <div className="font-medium text-sm sm:text-base text-base-content">
                    {option.label}
                  </div>
                  {option.description ? (
                    <div className="text-xs sm:text-sm text-base-content/70">
                      {option.description}
                    </div>
                  ) : null}
                </div>
              </label>
            );
          }

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={[
                "inline-flex items-center gap-2",
                isOptionDisabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                {...sharedInputProps}
                className={["radio", radioSizeClass].filter(Boolean).join(" ")}
              />
              <span className="text-sm text-base-content">{option.label}</span>
            </label>
          );
        })}
      </div>

      {error ? (
        <div id={errorId} className="text-sm text-error">
          {error}
        </div>
      ) : null}
    </fieldset>
  );
}
