import { useQuery } from "@tanstack/react-query";
import { habitsApi } from "@/services/api/habits";
import { habitsKeys } from "@/services/api/queryKeys";

export function useHabitActionsInRange(
  params: {
    startDate: string;
    endDate: string;
    referenceDate?: string | null;
  },
  options?: { enabled?: boolean; staleTimeMs?: number },
) {
  return useQuery({
    queryKey: habitsKeys.actionsInRange(params),
    queryFn: async () => {
      const response = await habitsApi.getActionsInRange({
        ...params,
        size: 1000,
      });
      return response.items ?? [];
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTimeMs ?? 5 * 60 * 1000,
  });
}
