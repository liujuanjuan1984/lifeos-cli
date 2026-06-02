import type { QueryClient } from "@tanstack/react-query";

import { invitationsKeys } from "@/services/api/queryKeys";

export const invalidateInvitationMineLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: invitationsKeys.mineLists(),
  });
