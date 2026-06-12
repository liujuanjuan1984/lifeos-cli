import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Habit } from "@/services/api/habits";
import type { UUID } from "@/types/primitive";
import { useToast } from "@/contexts/ToastContext";
import { useHabits } from "@/hooks/queries/useHabits";

interface UseHabitManagerOptions {
  statusFilter?: string;
}

export const useHabitManager = (options: UseHabitManagerOptions = {}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const habitsState = useHabits({ statusFilter: options.statusFilter });
  const [expandedHabits, setExpandedHabits] = useState<Set<UUID>>(new Set());
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);

  const toggleHabitExpansion = useCallback((habitId: UUID) => {
    setExpandedHabits((prev) => {
      const next = new Set(prev);
      if (next.has(habitId)) {
        next.delete(habitId);
      } else {
        next.add(habitId);
      }
      return next;
    });
  }, []);

  const requestDeleteHabit = useCallback((habit: Habit) => {
    setDeletingHabit(habit);
  }, []);

  const cancelDeleteHabit = useCallback(() => {
    setDeletingHabit(null);
  }, []);

  const confirmDeleteHabit = useCallback(() => {
    if (!deletingHabit) return;
    const habitToDelete = deletingHabit;
    setDeletingHabit(null);

    habitsState.deleteHabitMutation.mutate(
      { id: habitToDelete.id },
      {
        onSuccess: () => {
          setExpandedHabits((prev) => {
            if (!prev.has(habitToDelete.id)) return prev;
            const next = new Set(prev);
            next.delete(habitToDelete.id);
            return next;
          });
          toast.showSuccess(
            t("habits.messages.deleteSuccess"),
            t("habits.messages.deleteSuccessMessage", {
              name: habitToDelete.title,
            }),
          );
        },
        onError: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : t("habits.errors.deleteFailed");
          toast.showError(t("habits.errors.deleteFailed"), message);
        },
      },
    );
  }, [deletingHabit, habitsState.deleteHabitMutation, t, toast]);

  return {
    ...habitsState,
    expandedHabits,
    toggleHabitExpansion,
    deletingHabit,
    requestDeleteHabit,
    confirmDeleteHabit,
    cancelDeleteHabit,
  };
};
