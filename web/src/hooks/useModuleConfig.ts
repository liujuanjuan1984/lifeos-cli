import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  MODULES,
  type ModuleConfigWithI18n,
  type ModuleKey,
} from "@/config/modulesConfig";

/**
 * Hook to get internationalized module configurations
 * Returns module configs with translated displayName, navLabel, and description
 */
export function useModuleConfig() {
  const { t } = useTranslation();

  // Get all modules with i18n
  const modulesWithI18n: ModuleConfigWithI18n[] = useMemo(() => {
    return MODULES.map((module) => ({
      ...module,
      displayName: t(`modules.${module.key}.displayName`),
      navLabel: t(`modules.${module.key}.navLabel`),
      description: t(`modules.${module.key}.description`),
    }));
  }, [t]);

  // Get modules that should be shown in navigation
  const navModules: ModuleConfigWithI18n[] = useMemo(() => {
    return modulesWithI18n.filter((module) => module.showInNav);
  }, [modulesWithI18n]);

  // Get module by key with i18n
  const getModuleByKey = useCallback(
    (key: ModuleKey): ModuleConfigWithI18n | undefined => {
      return modulesWithI18n.find((module) => module.key === key);
    },
    [modulesWithI18n],
  );

  // Get module by path with i18n
  const getModuleByPath = useCallback(
    (path: string): ModuleConfigWithI18n | undefined => {
      return modulesWithI18n.find((module) => module.path === path);
    },
    [modulesWithI18n],
  );

  // Create lookup maps with i18n
  const keyToModuleWithI18n: Record<ModuleKey, ModuleConfigWithI18n> =
    useMemo(() => {
      return modulesWithI18n.reduce(
        (acc, module) => {
          acc[module.key] = module;
          return acc;
        },
        {} as Record<ModuleKey, ModuleConfigWithI18n>,
      );
    }, [modulesWithI18n]);

  const pathToModuleWithI18n: Record<string, ModuleConfigWithI18n> =
    useMemo(() => {
      return modulesWithI18n.reduce(
        (acc, module) => {
          acc[module.path] = module;
          return acc;
        },
        {} as Record<string, ModuleConfigWithI18n>,
      );
    }, [modulesWithI18n]);

  return {
    modules: modulesWithI18n,
    navModules,
    getModuleByKey,
    getModuleByPath,
    keyToModule: keyToModuleWithI18n,
    pathToModule: pathToModuleWithI18n,
  };
}
