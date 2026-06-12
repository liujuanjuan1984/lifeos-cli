import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { preferencesApi } from "@/services/api/preferences";
import { preferencesKeys, dimensionsKeys } from "@/services/api/queryKeys";
import { logger } from "@/utils/core";
import { setPreferredTimezone } from "@/utils/datetime";

type PreferenceCacheEntry<T> = {
  value: T;
  meta?: {
    allowed_values?: unknown[];
    default_value?: T;
    description?: string;
    module?: string;
  };
};

interface PreferenceWithBootstrapOptions<T> {
  key: string;
  defaultValue: T;
  module?: string;
  validator?: (value: T) => boolean;
}

export interface PreferenceWithBootstrapReturn<T> {
  value: T;
  loading: boolean;
  saving: boolean;
  error: string | null;
  bootstrapped: boolean;
  saveValue: (value: T) => Promise<boolean>;
  updateValue: (value: T) => void;
}

/**
 * 简化后的偏好设置 Hook：依赖 TanStack Query 的初始数据能力，
 * 避免手动维护冗余的 bootstrapped/isDirty 状态。
 */
export function usePreferenceWithBootstrap<T>({
  key,
  defaultValue,
  module = "general",
  validator,
}: PreferenceWithBootstrapOptions<T>): PreferenceWithBootstrapReturn<T> {
  const queryClient = useQueryClient();
  const shouldFetchPreferences = true;

  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;

  const [value, setValue] = useState<T>(defaultValueRef.current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(!shouldFetchPreferences);
  const [hasLocalOverride, setHasLocalOverride] = useState(false);

  // 当切换到新的偏好键时，重置本地状态
  useEffect(() => {
    setValue(defaultValueRef.current);
    setHasLocalOverride(false);
    setError(null);
    setBootstrapped(!shouldFetchPreferences);
  }, [key, shouldFetchPreferences]);

  const preferenceQuery = useQuery<PreferenceCacheEntry<T>>({
    queryKey: preferencesKeys.detail(key),
    queryFn: async () => {
      try {
        const res = await preferencesApi.getWithMeta<T>(key);
        let backendValue =
          res.value ?? res.meta?.default_value ?? defaultValueRef.current;

        // 与旧实现保持一致：对布尔值做必要的类型转换
        if (
          typeof defaultValueRef.current === "boolean" &&
          typeof backendValue !== "boolean"
        ) {
          if (typeof backendValue === "number") {
            backendValue = Boolean(backendValue) as T;
          } else if (typeof backendValue === "string") {
            backendValue = (backendValue === "true") as T;
          }
        }

        const nextValue = (backendValue as T) ?? defaultValueRef.current;

        if (validator && !validator(nextValue)) {
          logger.warn(`Invalid value for preference ${key}:`, nextValue);
          return { value: defaultValueRef.current, meta: res.meta };
        }

        return { value: nextValue, meta: res.meta };
      } catch (err) {
        const status =
          typeof err === "object" && err !== null && "status" in err
            ? (err as { status?: number }).status
            : undefined;
        if (status === 404) {
          return { value: defaultValueRef.current, meta: undefined };
        }
        throw err;
      }
    },
    enabled: shouldFetchPreferences,
    staleTime: 60 * 60 * 1000,
    placeholderData: () => ({
      value: defaultValueRef.current,
      meta: undefined,
    }),
  });

  useEffect(() => {
    if (preferenceQuery.isSuccess) {
      const remoteValue = preferenceQuery.data.value;
      setBootstrapped(true);
      setError(null);

      if (!hasLocalOverride) {
        setValue(remoteValue);
        setHasLocalOverride(false);
      }
      if (key === "system.timezone") {
        setPreferredTimezone(String(remoteValue ?? ""));
      }
    }
  }, [preferenceQuery.isSuccess, preferenceQuery.data, hasLocalOverride, key]);

  useEffect(() => {
    if (preferenceQuery.isError) {
      const message =
        preferenceQuery.error instanceof Error
          ? preferenceQuery.error.message
          : "Failed to load preference";
      logger.error(
        `[usePreferenceWithBootstrap] Error loading ${key}:`,
        preferenceQuery.error,
      );
      setError(message);
      setBootstrapped(true);
      if (!hasLocalOverride) {
        setValue(defaultValueRef.current);
      }
    }
  }, [preferenceQuery.isError, preferenceQuery.error, key, hasLocalOverride]);

  // 当用户未登录时不触发请求，直接视为初始化完成
  useEffect(() => {
    if (!shouldFetchPreferences) {
      setBootstrapped(true);
      if (!hasLocalOverride) {
        setValue(defaultValueRef.current);
      }
    }
  }, [shouldFetchPreferences, hasLocalOverride]);

  const loading =
    shouldFetchPreferences &&
    preferenceQuery.isLoading &&
    !preferenceQuery.isSuccess &&
    !preferenceQuery.isError;

  const saveMutation = useMutation({
    mutationFn: async (nextValue: T) => {
      await preferencesApi.set<T>(key, nextValue, module);
      return nextValue;
    },
    onSuccess: (nextValue) => {
      setHasLocalOverride(false);
      setValue(nextValue);
      setError(null);
      if (key === "system.timezone") {
        setPreferredTimezone(String(nextValue ?? ""));
      }
      queryClient.setQueryData<PreferenceCacheEntry<T>>(
        preferencesKeys.detail(key),
        (previous) => ({
          value: nextValue,
          meta: previous?.meta,
        }),
      );
      queryClient.invalidateQueries({
        queryKey: preferencesKeys.detail(key),
      });

      if (key === "dashboard.dimension_order") {
        queryClient.setQueryData(dimensionsKeys.order(), nextValue);
        queryClient.invalidateQueries({
          queryKey: dimensionsKeys.order(),
        });
      }
    },
    onError: (mutationError: unknown) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Save failed, please try again later";
      setError(message);
    },
  });

  const saveValue = async (nextValue: T): Promise<boolean> => {
    if (validator && !validator(nextValue)) {
      setError("Invalid value");
      return false;
    }

    setSaving(true);
    setError(null);
    try {
      await saveMutation.mutateAsync(nextValue);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateValue = (nextValue: T) => {
    setHasLocalOverride(true);
    setValue(nextValue);
    setError(null);
    if (key === "system.timezone") {
      setPreferredTimezone(String(nextValue ?? ""));
    }
  };

  return {
    value,
    loading,
    saving,
    error,
    bootstrapped,
    saveValue,
    updateValue,
  };
}
