import type { QueryClient } from "@tanstack/react-query";

import { llmCredentialKeys } from "@/services/api/queryKeys";

export const invalidateLlmCredentialList = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: llmCredentialKeys.list(),
    exact: true,
  });
