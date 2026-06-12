import { useCallback, useState } from "react";

export type QueryMode = "single" | "advanced" | "import";

interface QueryModeState {
  queryMode: QueryMode;
  isSingleMode: boolean;
  isAdvancedMode: boolean;
  isImportMode: boolean;
  setQueryMode: (mode: QueryMode) => void;
  setSingleMode: () => void;
  setAdvancedMode: () => void;
  setImportMode: () => void;
  toggleQueryMode: () => void;
}

export function useQueryMode(
  initialMode: QueryMode = "single",
): QueryModeState {
  const [queryMode, setQueryModeInternal] = useState<QueryMode>(initialMode);

  const setQueryMode = useCallback((mode: QueryMode) => {
    setQueryModeInternal(mode);
  }, []);

  const setSingleMode = useCallback(() => {
    setQueryModeInternal("single");
  }, []);

  const setAdvancedMode = useCallback(() => {
    setQueryModeInternal("advanced");
  }, []);

  const setImportMode = useCallback(() => {
    setQueryModeInternal("import");
  }, []);

  const toggleQueryMode = useCallback(() => {
    setQueryModeInternal((prev) => (prev === "single" ? "advanced" : "single"));
  }, []);

  return {
    queryMode,
    isSingleMode: queryMode === "single",
    isAdvancedMode: queryMode === "advanced",
    isImportMode: queryMode === "import",
    setQueryMode,
    setSingleMode,
    setAdvancedMode,
    setImportMode,
    toggleQueryMode,
  };
}
