import type { QueryClient } from "@tanstack/react-query";

import { timelogTemplatesKeys } from "@/services/api/queryKeys";

export const invalidateTimelogTemplateLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: timelogTemplatesKeys.lists(),
  });
