import { useCallback, useEffect, useMemo, useState } from "react";
import { MODULES } from "@/config/modulesConfig";
import { useModuleConfig } from "@/hooks/useModuleConfig";
import { usePreferenceWithBootstrap } from "./usePreferenceWithBootstrap";
import { preferencesApi } from "@/services/api/preferences";

const VISIBLE_MODULES_KEY = "navigation.visible_modules";
const VISIBLE_MODULES_SYNC_KEY = "navigation.visible_modules.sync";

/**
 * Hook to manage visible modules in the navigation rail.
 * Value is a list of module keys.
 */
export function useVisibleModules() {
  const { modules } = useModuleConfig();

  const defaultVisible: string[] = useMemo(
    () => MODULES.filter((m) => m.showInNav).map((m) => m.key),
    [],
  );

  // local allowed keys set to guard bad values
  // Allowed keys are driven by backend meta; fallback to MODULES keys when meta missing.
  const [allowedKeys, setAllowedKeys] = useState<Set<string>>(
    () => new Set(MODULES.map((m) => m.key)),
  );

  const {
    value: visibleKeys,
    loading,
    saving,
    error,
    bootstrapped,
    saveValue,
    updateValue,
  } = usePreferenceWithBootstrap<string[]>({
    key: VISIBLE_MODULES_KEY,
    defaultValue: defaultVisible,
    module: "navigation",
    validator: (value) => {
      if (!Array.isArray(value)) return false;
      return value.every((k) => allowedKeys.has(k));
    },
  });

  // Update allowed keys when preference meta is available
  useEffect(() => {
    // This effect will be triggered when the preference is bootstrapped
    // We need to get the meta information to update allowed keys
    const updateAllowedKeys = async () => {
      try {
        const res =
          await preferencesApi.getWithMeta<string[]>(VISIBLE_MODULES_KEY);
        const metaAllowed = Array.isArray(res.meta?.allowed_values)
          ? (res.meta!.allowed_values as unknown[])
          : null;
        const localAllowed = new Set<string>(
          (metaAllowed
            ? metaAllowed.map((v) => String(v))
            : MODULES.map((m) => m.key)) as string[],
        );
        setAllowedKeys(localAllowed);
      } catch (_e) {
        // Fallback to default allowed keys
        setAllowedKeys(new Set(MODULES.map((m) => m.key)));
      }
    };

    if (bootstrapped) {
      updateAllowedKeys();
    }
  }, [bootstrapped]);

  const updateVisibleKeys = (keys: string[]) => {
    const sanitized = Array.from(
      new Set(keys.filter((k) => allowedKeys.has(k))),
    );
    updateValue(sanitized);
  };

  const broadcastVisibleModules = useCallback((keys: string[]) => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        VISIBLE_MODULES_SYNC_KEY,
        JSON.stringify({
          visibleKeys: keys,
          timestamp: Date.now(),
        }),
      );
    } catch {
      // ignore storage failures (e.g., private mode)
    }
  }, []);

  const saveVisibleKeys = async (keys: string[] = visibleKeys) => {
    const sanitized = Array.from(
      new Set(keys.filter((k) => allowedKeys.has(k))),
    );
    const success = await saveValue(sanitized);

    if (success) {
      broadcastVisibleModules(sanitized);
    }

    return success;
  };

  const resetToDefault = () => {
    updateValue(defaultVisible);
    broadcastVisibleModules(defaultVisible);
  };

  // Cross-instance sync: listen for storage events dispatched by other tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: StorageEvent) => {
      if (event.key !== VISIBLE_MODULES_SYNC_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as {
          visibleKeys?: string[];
        };
        if (Array.isArray(parsed.visibleKeys)) {
          const sanitized = Array.from(
            new Set(parsed.visibleKeys.filter((k) => allowedKeys.has(k))),
          );
          updateValue(sanitized);
        }
      } catch {
        // ignore malformed payloads
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [allowedKeys, updateValue, broadcastVisibleModules]);

  const allConfigurableModules = useMemo(() => {
    // Map allowed module keys to existing module configs for labels/icons
    const allowedSet = allowedKeys;
    return modules.filter((m) => allowedSet.has(m.key) && m.key !== "settings");
  }, [allowedKeys, modules]);

  return {
    visibleKeys,
    loading,
    saving,
    error,
    bootstrapped,
    updateVisibleKeys,
    saveVisibleKeys,
    resetToDefault,
    allConfigurableModules,
  };
}
