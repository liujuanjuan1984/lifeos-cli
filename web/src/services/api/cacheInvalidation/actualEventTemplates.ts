import type { QueryClient } from "@tanstack/react-query";

import { actualEventTemplatesKeys } from "@/services/api/queryKeys";

export const invalidateActualEventTemplateLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: actualEventTemplatesKeys.lists(),
  });
