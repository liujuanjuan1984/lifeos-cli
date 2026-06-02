import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/utils/datetime";
import { normalizeTimezone, zonedDateTimeToUtc } from "@/utils/datetime";
import TextInput from "./TextInput";

interface DateTimeSelectorProps {
  /** Current ISO datetime string */
  value: string;
  /** Whether this is for an all-day event (date only) */
  isAllDay?: boolean;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Callback when datetime changes */
  onChange: (isoString: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** HTML id for the date input */
  dateId?: string;
  /** HTML id for the time input */
  timeId?: string;
  /** Custom quick time options */
  quickTimeOptions?: string[];
  /** Additional CSS classes */
  className?: string;
  /** Preferred timezone (falls back to browser if omitted) */
  timezone?: string;
}

const DEFAULT_QUICK_TIMES = [
  "00:00",
  "06:00",
  "08:00",
  "09:00",
  "12:00",
  "14:00",
  "17:00",
  "18:00",
  "20:00",
  "22:00",
];

export default function DateTimeSelector({
  value,
  isAllDay = false,
  disabled = false,
  onChange,
  placeholder = "",
  dateId,
  timeId,
  quickTimeOptions = DEFAULT_QUICK_TIMES,
  className = "",
  timezone,
}: DateTimeSelectorProps) {
  const { t } = useTranslation();

  // Get user's timezone
  const userTimezone = useMemo(() => normalizeTimezone(timezone), [timezone]);

  // Parse current value to date and time parts (timezone-aware)
  const { datePart, timePart } = useMemo(() => {
    if (!value) {
      return { datePart: "", timePart: "" };
    }

    const utcDate = new Date(value);

    if (isAllDay) {
      // For all-day events, use the UTC date directly
      return {
        datePart: utcDate.toISOString().split("T")[0],
        timePart: "",
      };
    }

    // For time-specific events, convert UTC to local timezone
    const localDate = new Date(value);

    return {
      datePart: localDate
        .toLocaleDateString("en-CA", {
          timeZone: userTimezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\//g, "-"), // Format as YYYY-MM-DD
      timePart: localDate.toLocaleTimeString("en-CA", {
        timeZone: userTimezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    };
  }, [value, isAllDay, userTimezone]);

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = e.target.value;
      if (!newDate) {
        onChange("");
        return;
      }

      // Parse the date parts
      const [year, month, day] = newDate.split("-").map(Number);

      if (isAllDay) {
        // For all-day events, create UTC start of day
        const utcDate = zonedDateTimeToUtc(
          year,
          month,
          day,
          0,
          0,
          0,
          0,
          userTimezone,
        );
        onChange(utcDate.toISOString());
      } else if (timePart) {
        // Combine new date with existing time
        const [hours, minutes] = timePart.split(":").map(Number);
        const utcDate = zonedDateTimeToUtc(
          year,
          month,
          day,
          hours,
          minutes,
          0,
          0,
          userTimezone,
        );
        onChange(utcDate.toISOString());
      } else {
        // If no time part yet, set to start of day
        const utcDate = zonedDateTimeToUtc(
          year,
          month,
          day,
          0,
          0,
          0,
          0,
          userTimezone,
        );
        onChange(utcDate.toISOString());
      }
    },
    [isAllDay, timePart, onChange, userTimezone],
  );

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTime = e.target.value;
      if (!newTime || !datePart) {
        return;
      }

      // Parse date parts and time parts
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = newTime.split(":").map(Number);

      // Convert local date/time to UTC
      const utcDate = zonedDateTimeToUtc(
        year,
        month,
        day,
        hours,
        minutes,
        0,
        0,
        userTimezone,
      );
      onChange(utcDate.toISOString());
    },
    [datePart, onChange, userTimezone],
  );

  const handleQuickTimeSelect = useCallback(
    (time: string) => {
      if (!datePart) {
        return;
      }

      // Parse date parts and time parts
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = time.split(":").map(Number);

      // Convert local date/time to UTC
      const utcDate = zonedDateTimeToUtc(
        year,
        month,
        day,
        hours,
        minutes,
        0,
        0,
        userTimezone,
      );
      onChange(utcDate.toISOString());
    },
    [datePart, onChange, userTimezone],
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Date input */}
      <div>
        <label
          htmlFor={dateId}
          className="block text-sm font-medium text-base-content mb-1"
        >
          {t("common.date")}
        </label>
        <TextInput
          id={dateId}
          type="date"
          value={datePart}
          onChange={handleDateChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      </div>

      {/* Time input (only for non-all-day events) */}
      {!isAllDay && (
        <div>
          <label
            htmlFor={timeId}
            className="block text-sm font-medium text-base-content mb-1"
          >
            {t("common.time")}
          </label>
          <div className="space-y-2">
            {/* Standard time input */}
            <TextInput
              id={timeId}
              type="time"
              value={timePart}
              onChange={handleTimeChange}
              disabled={disabled}
              step="300" // 5-minute intervals
            />

            {/* Quick time buttons */}
            <div className="flex flex-wrap gap-1">
              {quickTimeOptions.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => handleQuickTimeSelect(time)}
                  disabled={disabled}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    timePart === time
                      ? "bg-primary text-primary-content"
                      : "bg-base-200 hover:bg-base-300 text-base-content"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Display current selection in human-readable format */}
      {value && (
        <div className="text-xs text-base-content/60 mt-2">
          {t("common.selected")}: {formatDateTime(value)}
        </div>
      )}
    </div>
  );
}
