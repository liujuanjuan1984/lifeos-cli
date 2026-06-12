import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { visionsApi } from "@/services/api/visions";
import { visionsKeys } from "@/services/api/queryKeys";
import { usePreferenceWithBootstrap } from "./usePreferenceWithBootstrap";
import type { UUID } from "@/types/primitive";

const DEFAULT_INBOX_VISION_KEY = "todos.default_inbox_vision";

/**
 * Hook to get and manage user's default inbox vision preference
 * @returns Object with defaultInboxVision value, available visions, loading state, and save function
 */
export function useDefaultInboxVision() {
  // 1. 获取可用愿景列表
  const page = 1;
  const size = 100;
  const {
    data: availableVisionsRaw,
    isLoading: isLoadingVisions,
    error: visionsError,
  } = useQuery({
    queryKey: visionsKeys.list({ status: "active", page, size }),
    queryFn: () => visionsApi.getAll("active", page, size),
    select: (data) =>
      (data.items ?? []).map((v) => ({ id: v.id, name: v.name })),
  });
  const availableVisions = useMemo(
    () => availableVisionsRaw ?? [],
    [availableVisionsRaw],
  );

  // 2. 使用 usePreferenceWithBootstrap 管理偏好设置
  const {
    value: defaultInboxVision,
    loading: preferenceLoading,
    saving,
    error: preferenceError,
    bootstrapped,
    saveValue,
    updateValue,
  } = usePreferenceWithBootstrap<UUID | null>({
    key: DEFAULT_INBOX_VISION_KEY,
    defaultValue: null,
    module: "todos",
    validator: (value) => {
      if (value === null) return true;
      return (
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        )
      );
    },
  });

  // 3. 保存默认收件箱愿景
  const saveDefaultInboxVision = async (visionId: UUID | null) => {
    return await saveValue(visionId);
  };

  // 4. 更新默认收件箱愿景本地状态
  const updateDefaultInboxVision = (visionId: UUID | null) => {
    updateValue(visionId);
  };

  // 5. 重置为默认
  const resetToDefault = () => {
    updateValue(null);
  };

  const loading = isLoadingVisions || preferenceLoading;
  const error = visionsError?.message || preferenceError || null;

  return {
    defaultInboxVision,
    availableVisions,
    loading,
    saving,
    error,
    bootstrapped,
    saveDefaultInboxVision,
    updateDefaultInboxVision,
    resetToDefault,
  };
}
