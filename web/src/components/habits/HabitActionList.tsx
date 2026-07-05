import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type HabitAction } from "@/services/api/habits";
import {
  HABIT_EDITABLE_DAYS,
  HABIT_ACTION_STATUS_OPTIONS,
  HABIT_ACTION_STATUS_CONFIG,
} from "@/utils/constants";
import ActionButton from "@/components/ActionButton";
import EnumSelect from "@/components/selects/EnumSelect";
import type { UUID } from "@/types/primitive";
import CreateNoteModal from "@/components/CreateNoteModal";
import TaskNotesModal from "@/components/TaskNotesModal";
import type { NoteHabitActionSummary } from "@/services/api/notes";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  formatDateInTimezone,
  formatDateKey,
  formatMonthKey,
  isSameDay,
  parseDateStringToLocalDate,
  startOfMonth,
  startOfLocalDay,
  startOfWeek,
  subDays,
  subMonths,
} from "@/utils/datetime";

interface HabitActionListProps {
  actions: HabitAction[];
  habitId: UUID;
  habitTitle: string;
  durationDays: number;
  startDate: string;
  centerDate: Date;
  onCenterDateChange: (date: Date) => void;
  onStatusUpdate: (
    habitId: UUID,
    action: HabitAction,
    newStatus: string,
  ) => void;
  onNotesChanged?: () => void;
}

export function HabitActionList({
  actions,
  habitId,
  habitTitle,
  durationDays,
  startDate,
  centerDate,
  onCenterDateChange,
  onStatusUpdate,
  onNotesChanged,
}: HabitActionListProps) {
  const { t } = useTranslation();
  const [creatingNoteForAction, setCreatingNoteForAction] =
    useState<HabitAction | null>(null);
  const [viewingNotesForAction, setViewingNotesForAction] =
    useState<HabitAction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date(centerDate),
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date(centerDate)); // 当前选中的日期

  useEffect(() => {
    setSelectedMonth(new Date(centerDate));
    setSelectedDate(new Date(centerDate));
  }, [centerDate]);

  const updateCenterDate = (date: Date) => {
    onCenterDateChange(new Date(date));
  };

  // Get today's date
  const today = new Date();

  const habitStartDate = parseDateStringToLocalDate(startDate);

  const isFuture = (date: string) => {
    const today = startOfLocalDay(new Date());
    const actionDate = startOfLocalDay(parseDateStringToLocalDate(date));
    return actionDate > today;
  };

  const canModify = (action: HabitAction) => {
    if (isFuture(action.action_date)) {
      return false;
    }

    const daysSinceAction = Math.floor(
      (startOfLocalDay(new Date()).getTime() -
        startOfLocalDay(
          parseDateStringToLocalDate(action.action_date),
        ).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return daysSinceAction <= HABIT_EDITABLE_DAYS;
  };

  const handleStatusChange = (action: HabitAction, newStatus: string) => {
    if (!canModify(action)) {
      return;
    }
    onStatusUpdate(habitId, action, newStatus);
  };

  const buildHabitActionSummary = (
    action: HabitAction,
  ): NoteHabitActionSummary => ({
    id: action.id,
    habit_id: action.habit_id,
    habit_title: habitTitle,
    action_date: action.action_date,
    status: action.status,
  });

  // Get 5 days centered around selected date
  const getDisplayDays = (centerDate: Date) => {
    const displayDays = [];

    // Calculate habit end date based on duration
    const habitEndDate = addDays(habitStartDate, durationDays - 1);

    // Always show 5 days, with centerDate in the middle (position 2, 0-indexed)
    for (let i = -2; i <= 2; i++) {
      const date = addDays(centerDate, i);

      // Only include dates within the habit duration range
      if (date >= habitStartDate && date <= habitEndDate) {
        displayDays.push(date);
      }
    }

    // If we don't have 5 days, try to fill from available range
    while (displayDays.length < 5 && displayDays.length < durationDays) {
      const firstDate = displayDays[0];
      const lastDate = displayDays[displayDays.length - 1];

      // Try to add days before the first date
      if (firstDate > habitStartDate) {
        const beforeDate = subDays(firstDate, 1);
        if (beforeDate >= habitStartDate) {
          displayDays.unshift(beforeDate);
          continue;
        }
      }

      // Try to add days after the last date
      if (lastDate < habitEndDate) {
        const afterDate = addDays(lastDate, 1);
        if (afterDate <= habitEndDate) {
          displayDays.push(afterDate);
          continue;
        }
      }

      // If we can't add more days, break
      break;
    }

    return displayDays;
  };

  const displayDays = getDisplayDays(selectedDate);

  // Get actions for recent days
  const getActionForDate = (date: Date) => {
    const dateStr = formatDateKey(date);
    return actions.find((action) => action.action_date === dateStr);
  };

  // Generate calendar days for selected month
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const getActionForCalendarDate = (date: Date) => {
    const dateStr = formatDateKey(date);
    return actions.find((action) => action.action_date === dateStr);
  };

  const changeMonth = (direction: "prev" | "next") => {
    const newMonth =
      direction === "prev"
        ? subMonths(selectedMonth, 1)
        : addMonths(selectedMonth, 1);
    setSelectedMonth(newMonth);
    setSelectedDate(newMonth);
    updateCenterDate(newMonth);
  };

  // Handle date selection from calendar
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Update selected month to show the selected date's month
    setSelectedMonth(date);
    updateCenterDate(date);
  };

  // Navigate to previous/next 5-day period
  const navigatePeriod = (direction: "prev" | "next") => {
    const newDate =
      direction === "prev"
        ? subDays(selectedDate, 5)
        : addDays(selectedDate, 5);

    // Ensure the new date is within habit duration range
    const habitEndDate = addDays(habitStartDate, durationDays - 1);
    if (newDate >= habitStartDate && newDate <= habitEndDate) {
      setSelectedDate(newDate);
      updateCenterDate(newDate);
    }
  };

  return (
    <div className="space-y-6">
      {/* Lower Section - Calendar and Recent List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Monthly Calendar View */}
        <div className="bg-base-100 p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold font-semibold text-base-content">
              {t("habits.actionList.monthView")}
            </h3>
            <div className="flex gap-2">
              <ActionButton
                label={t("habits.actionList.previousMonth")}
                iconName="chevron-left"
                variant="ghost"
                color="neutral"
                onClick={() => changeMonth("prev")}
                ariaLabel={t("habits.actionList.previousMonth")}
                iconOnly
              />
              <span className="px-3 py-2 font-medium">
                {formatMonthKey(selectedMonth)}
              </span>
              <ActionButton
                label={t("habits.actionList.nextMonth")}
                iconName="chevron-right"
                variant="ghost"
                color="neutral"
                onClick={() => changeMonth("next")}
                ariaLabel={t("habits.actionList.nextMonth")}
                iconOnly
              />
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-sm">
            {[
              t("habits.actionList.weekdays.sunday"),
              t("habits.actionList.weekdays.monday"),
              t("habits.actionList.weekdays.tuesday"),
              t("habits.actionList.weekdays.wednesday"),
              t("habits.actionList.weekdays.thursday"),
              t("habits.actionList.weekdays.friday"),
              t("habits.actionList.weekdays.saturday"),
            ].map((day) => (
              <div
                key={day}
                className="p-2 text-center font-medium text-base-content/70"
              >
                {day}
              </div>
            ))}

            {calendarDays.map((day, index) => {
              const action = getActionForCalendarDate(day);
              const isCurrentMonth =
                day.getMonth() === selectedMonth.getMonth();

              // Determine calendar cell status
              let cellStatus = "";
              let cellBgColor = "";
              let cellBorderColor = "";
              let statusText = "";

              if (action) {
                // Has action record - use unified status configuration
                const statusConfig =
                  HABIT_ACTION_STATUS_CONFIG[
                    action.status as keyof typeof HABIT_ACTION_STATUS_CONFIG
                  ] || HABIT_ACTION_STATUS_CONFIG.pending;
                cellStatus = statusConfig.cellStatus;
                cellBgColor = statusConfig.bgColor;
                cellBorderColor = statusConfig.borderColor;
                statusText = statusConfig.label;
              } else {
                // No action record - normal calendar display
                cellStatus = "no-action";
                cellBgColor = "bg-transparent";
                cellBorderColor = "border-base-300";
                statusText = "";
              }

              const isSelectedDate = isSameDay(day, selectedDate);
              const isClickable =
                isCurrentMonth &&
                day >= habitStartDate &&
                day <= addDays(habitStartDate, durationDays - 1);

              return (
                <div
                  key={index}
                  className={`p-2 text-center border rounded transition-colors ${
                    !isCurrentMonth
                      ? "text-base-content/30"
                      : "text-base-content"
                  } ${cellBgColor} ${cellBorderColor} ${
                    isClickable
                      ? "cursor-pointer hover-card"
                      : "cursor-not-allowed"
                  } ${
                    isSelectedDate ? "ring-2 ring-primary ring-offset-1" : ""
                  }`}
                  title={`${formatDateInTimezone(day)} - ${cellStatus}`}
                  onClick={() => isClickable && handleDateSelect(day)}
                >
                  <div className="text-base font-medium">{day.getDate()}</div>
                  {statusText && (
                    <div className="text-sm mt-1 opacity-80">{statusText}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side - 5 Days View */}
        <div className="bg-base-100 p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold font-semibold text-base-content">
              {t("habits.actionList.fiveDayView")}
            </h3>
            <div className="flex gap-2">
              <ActionButton
                label={t("habits.actionList.previousFiveDays")}
                iconName="chevron-left"
                variant="ghost"
                color="neutral"
                onClick={() => navigatePeriod("prev")}
                ariaLabel={t("habits.actionList.previousFiveDays")}
                iconOnly
              />
              <span className="px-3 py-2 font-medium">
                {formatDateInTimezone(selectedDate)}
              </span>
              <ActionButton
                label={t("habits.actionList.nextFiveDays")}
                iconName="chevron-right"
                variant="ghost"
                color="neutral"
                onClick={() => navigatePeriod("next")}
                ariaLabel={t("habits.actionList.nextFiveDays")}
                iconOnly
              />
            </div>
          </div>
          <div className="space-y-2">
            {displayDays.map((date) => {
              const action = getActionForDate(date);
              const isTodayDate = isSameDay(date, today);
              const isSelectedDate = isSameDay(date, selectedDate);
              const isPastDate = date < today;
              const canModifyAction = action
                ? canModify(action)
                : isTodayDate || isPastDate;
              const hasNotes = Boolean(action?.notes?.trim());

              return (
                <div
                  key={formatDateKey(date)}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors hover:bg-primary/10 focus-within:bg-primary/10 ${
                    isSelectedDate
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : isTodayDate
                        ? "border-primary/40 bg-primary/10"
                        : isPastDate
                          ? "border-base-300"
                          : "border-base-300 bg-base-200"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-base min-w-[80px]">
                      <span className="font-medium text-base-content">
                        {(() => {
                          // Calculate day number using a more reliable method
                          const calculateDayNumber = (
                            currentDate: Date,
                            startDate: Date,
                          ) => {
                            // Normalize both dates to start of day to avoid timezone issues
                            const current = new Date(
                              currentDate.getFullYear(),
                              currentDate.getMonth(),
                              currentDate.getDate(),
                            );
                            const start = new Date(
                              startDate.getFullYear(),
                              startDate.getMonth(),
                              startDate.getDate(),
                            );

                            const timeDiff =
                              current.getTime() - start.getTime();
                            const dayDiff = Math.floor(
                              timeDiff / (1000 * 60 * 60 * 24),
                            );

                            return Math.max(1, dayDiff + 1);
                          };

                          const dayNumber = calculateDayNumber(
                            date,
                            habitStartDate,
                          );
                          return dayNumber;
                        })()}
                        /{durationDays}
                      </span>
                      <span className="text-sm text-base-content/70 ml-2">
                        {formatDateInTimezone(date)}
                        {isTodayDate && ` (${t("planning.presets.today")})`}
                      </span>
                    </div>

                    {action ? (
                      <>
                        {action.notes && (
                          <div className="text-base text-base-content/80 max-w-xs truncate">
                            {action.notes}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-base text-base-content/50">
                        {t("habits.actionList.notRecorded")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {action && (
                      <>
                        {canModifyAction && (
                          <ActionButton
                            label={t("notes.actions.addNote")}
                            iconName="document-plus"
                            color="primary"
                            onClick={() => setCreatingNoteForAction(action)}
                            iconOnly
                            ariaLabel={t("notes.actions.addNote")}
                          />
                        )}
                        {hasNotes && (
                          <ActionButton
                            label={t("notes.actions.viewNotes")}
                            iconName="book-open"
                            color="primary"
                            onClick={() => setViewingNotesForAction(action)}
                            iconOnly
                            ariaLabel={t("notes.actions.viewNotes")}
                          />
                        )}
                        {canModifyAction && (
                          <EnumSelect
                            id={`status-select-${action.id}`}
                            value={action.status}
                            onChange={(value) => {
                              if (value) {
                                handleStatusChange(action, value as string);
                              }
                            }}
                            options={HABIT_ACTION_STATUS_OPTIONS}
                          />
                        )}
                      </>
                    )}

                    {!canModifyAction && !action && (
                      <div className="text-sm text-base-content/60">
                        {date > today ? t("habits.actionList.notStarted") : ""}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {creatingNoteForAction && (
        <CreateNoteModal
          isOpen={!!creatingNoteForAction}
          onClose={() => setCreatingNoteForAction(null)}
          preSelectedHabitActionId={creatingNoteForAction.id}
          preSelectedHabitAction={buildHabitActionSummary(creatingNoteForAction)}
          onNoteCreated={() => {
            setCreatingNoteForAction(null);
            onNotesChanged?.();
          }}
        />
      )}

      {viewingNotesForAction && (
        <TaskNotesModal
          isOpen={!!viewingNotesForAction}
          onClose={() => setViewingNotesForAction(null)}
          entityType="habit_action"
          habitAction={buildHabitActionSummary(viewingNotesForAction)}
          onNotesChanged={onNotesChanged}
        />
      )}
    </div>
  );
}
