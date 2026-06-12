import { useQuery } from "@tanstack/react-query";
import { habitsApi } from "@/services/api/habits";
import { habitsKeys } from "@/services/api/queryKeys";

export function useHabitActionsByDate(
  date: string,
  options?: { enabled?: boolean; staleTimeMs?: number },
) {
  return useQuery({
    queryKey: habitsKeys.actionsByDate(date),
    queryFn: async () => {
      const response = await habitsApi.getActionsByDate(date);
      return response.items ?? [];
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTimeMs ?? 5 * 60 * 1000,
  });
}
