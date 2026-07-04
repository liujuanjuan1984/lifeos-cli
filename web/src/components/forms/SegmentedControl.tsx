import React, { useId, useMemo, useRef, useState } from "react";

type SegmentedValue = string;

export interface SegmentedControlOption {
  value: SegmentedValue;
  label: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value?: SegmentedValue;
  defaultValue?: SegmentedValue;
  onChange?: (value: SegmentedValue) => void;
  name?: string;
  label?: string;
  disabled?: boolean;
  size?: "xs" | "sm" | "md";
  inactiveVariant?: "ghost" | "outline";
  className?: string;
}

function findEnabledIndex(
  options: SegmentedControlOption[],
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

const sizeClassMap = {
  xs: "btn-xs text-[0.7rem] sm:text-xs",
  sm: "btn-sm text-xs sm:text-sm",
  md: "text-sm sm:text-base",
} as const;

export default function SegmentedControl({
  options,
  value,
  defaultValue,
  onChange,
  name,
  label,
  disabled = false,
  size = "sm",
  inactiveVariant = "ghost",
  className = "",
}: SegmentedControlProps) {
  const generatedId = useId();
  const groupName = name ?? `segmented-control-${generatedId}`;
  const legendId = label ? `${groupName}-legend` : undefined;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const firstEnabledValue = useMemo(
    () => options.find((option) => !option.disabled)?.value,
    [options],
  );

  const [internalValue, setInternalValue] = useState<
    SegmentedValue | undefined
  >(defaultValue ?? firstEnabledValue);

  const isControlled = value !== undefined;
  const selectedValue = value ?? internalValue ?? firstEnabledValue;

  const handleSelect = (nextValue: SegmentedValue) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  };

  return (
    <fieldset className={["space-y-2", className].filter(Boolean).join(" ")}>
      {label ? (
        <legend
          id={legendId}
          className="text-sm font-medium text-base-content"
        >
          {label}
        </legend>
      ) : null}

      <div className="join flex-wrap" aria-labelledby={legendId}>
        {options.map((option, index) => {
          const optionId = `${groupName}-${index}`;
          const isChecked = selectedValue === option.value;
          const isOptionDisabled = disabled || Boolean(option.disabled);
          const inactiveToneClass =
            inactiveVariant === "outline"
              ? "btn-neutral btn-outline"
              : "btn-neutral btn-ghost";

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={[
                "join-item btn whitespace-nowrap font-normal focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-1",
                sizeClassMap[size],
                isChecked ? "btn-primary" : inactiveToneClass,
                isOptionDisabled ? "pointer-events-none opacity-60" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                ref={(node) => {
                  inputRefs.current[index] = node;
                }}
                id={optionId}
                type="radio"
                name={groupName}
                value={option.value}
                checked={isChecked}
                disabled={isOptionDisabled}
                className="sr-only"
                aria-label={
                  typeof option.label === "string"
                    ? (option.ariaLabel ?? option.label)
                    : option.ariaLabel
                }
                onChange={() => handleSelect(option.value)}
                onKeyDown={(event) => {
                  let step: 1 | -1 | null = null;
                  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    step = 1;
                  } else if (
                    event.key === "ArrowLeft" ||
                    event.key === "ArrowUp"
                  ) {
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
                }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
