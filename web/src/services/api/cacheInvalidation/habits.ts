import type { QueryClient } from "@tanstack/react-query";

import { habitsKeys } from "@/services/api/queryKeys";
import {
  isHabitsActionsByDateQuery,
  isHabitsActionsQuery,
  isHabitsListQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";
import type { Habit } from "@/services/api/habits";
import type { UUID } from "@/types/primitive";

export const invalidateHabitsLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isHabitsListQuery(query as QueryLike),
  });

export const invalidateHabitStats = (queryClient: QueryClient, id: UUID) =>
  queryClient.invalidateQueries({
    queryKey: habitsKeys.stats(id),
  });

export const invalidateHabitActions = (queryClient: QueryClient, id: UUID) =>
  queryClient.invalidateQueries({
    predicate: (query) => {
      if (!isHabitsActionsQuery(query as QueryLike)) {
        return false;
      }
      const key = (query as QueryLike).queryKey;
      return (
        Array.isArray(key) &&
        key.length >= 3 &&
        key[0] === "habits" &&
        key[1] === "detail" &&
        key[2] === id
      );
    },
  });

export const invalidateHabitActionsByDate = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isHabitsActionsByDateQuery(query as QueryLike),
  });

export const setHabitDetailCache = (queryClient: QueryClient, habit: Habit) => {
  queryClient.setQueryData(habitsKeys.detail(habit.id), habit);
};

export const removeHabitDetailCache = (queryClient: QueryClient, id: UUID) => {
  queryClient.removeQueries({
    queryKey: habitsKeys.detail(id),
    exact: true,
  });
};
