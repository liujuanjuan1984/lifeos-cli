import type { QueryClient } from "@tanstack/react-query";

import { tasksKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";
import {
  invalidateVisionHierarchy,
  invalidateAllVisionHierarchies,
} from "./visions";

export const invalidateVisionsHierarchy = (
  queryClient: QueryClient,
  visionId: UUID | null,
) => {
  if (!visionId) {
    return invalidateAllVisionHierarchies(queryClient);
  }
  return invalidateVisionHierarchy(queryClient, visionId);
};

export const removeTaskDetailCache = (
  queryClient: QueryClient,
  taskId: UUID,
) => {
  queryClient.removeQueries({
    queryKey: tasksKeys.detail(taskId),
    exact: true,
  });
};
