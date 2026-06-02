import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { useModuleConfig } from "@/hooks/useModuleConfig";

const DEFAULT_PAGE_TITLE = "LifeOS";

function setDocumentTitle(title?: string) {
  if (typeof document === "undefined") return;
  document.title = title ?? DEFAULT_PAGE_TITLE;
}

function formatModuleTitle(title?: string, description?: string) {
  const parts = [title?.trim(), description?.trim()].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : DEFAULT_PAGE_TITLE;
}

/**
 * AutoPageHeader
 * Derives page header from current route path using module config.
 * Place it near the top of the main content area inside AppShell.
 */
export function AutoPageHeader() {
  const { setHeader, clearHeader } = usePageHeader();
  const location = useLocation();
  const { getModuleByPath } = useModuleConfig();

  useEffect(() => {
    const module = getModuleByPath(location.pathname);
    if (module) {
      setHeader({
        title: module.displayName,
        subtitle: module.description,
      });
      setDocumentTitle(
        formatModuleTitle(module.displayName, module.description),
      );
    } else {
      clearHeader();
      setDocumentTitle();
    }

    return () => {
      clearHeader();
      setDocumentTitle();
    };
  }, [location.pathname, getModuleByPath, setHeader, clearHeader]);

  return null;
}
