import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "@/contexts/ToastContext";
import { financeApi } from "@/services/api/finance";
import { invalidateFinanceAssets } from "@/services/api/cacheInvalidation/finance";
import { financeKeys } from "@/services/api/queryKeys";

export function useFinanceAssetSource() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const assetsQuery = useQuery({
    queryKey: financeKeys.assets(),
    queryFn: () => financeApi.listAssets(),
    staleTime: 60_000,
  });

  const createAssetMutation = useMutation({
    mutationFn: (code: string) => financeApi.createAsset({ code }),
    onSuccess: async () => {
      await invalidateFinanceAssets(queryClient);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  return {
    assets: assetsQuery.data?.items ?? [],
    createAsset: (code: string) => createAssetMutation.mutateAsync(code),
  };
}
