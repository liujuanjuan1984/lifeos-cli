import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";

interface PaginatedSearchOptions<TItem, TParams, TError extends Error> {
  pageSize?: number;
  queryKey: (params: TParams) => QueryKey;
  queryFn: (params: TParams) => Promise<TItem[]>;
  enabledPredicate?: (params: TParams | null) => boolean;
  idleKey?: QueryKey;
  staleTime?: number;
  retry?: number;
  refetchOnWindowFocus?: boolean;
  signatureFn?: (params: TParams) => string;
  onSuccess?: (items: TItem[], params: TParams) => void;
  onEmpty?: (params: TParams) => void;
  onError?: (error: TError, params: TParams) => void;
}

export interface PaginatedSearchResult<TItem, TParams, TError extends Error> {
  allData: TItem[];
  data: TItem[];
  isLoading: boolean;
  isError: boolean;
  error: TError | null;
  refetch: () => void;
  search: (params: TParams) => void;
  clearSearch: () => void;
  searchParams: TParams | null;
  hasSearched: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
}

export function usePaginatedSearch<
  TItem,
  TParams,
  TError extends Error = Error,
>(
  options: PaginatedSearchOptions<TItem, TParams, TError>,
): PaginatedSearchResult<TItem, TParams, TError> {
  const {
    pageSize = 100,
    queryKey,
    queryFn,
    enabledPredicate,
    idleKey = ["paginated-search", "idle"],
    staleTime,
    retry,
    refetchOnWindowFocus,
    signatureFn,
    onSuccess,
    onEmpty,
    onError,
  } = options;

  const emptyRef = useRef<TItem[]>([]);
  const lastSignatureRef = useRef<string | null>(null);
  const [searchParams, setSearchParams] = useState<TParams | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const isEnabled =
    searchParams !== null &&
    (enabledPredicate ? enabledPredicate(searchParams) : true);

  const effectiveQueryKey = isEnabled
    ? queryKey(searchParams as TParams)
    : idleKey;

  const queryResult = useQuery<TItem[], TError>({
    queryKey: effectiveQueryKey,
    queryFn: () => queryFn(searchParams as TParams),
    enabled: isEnabled,
    staleTime,
    retry,
    refetchOnWindowFocus,
  });

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const search = useCallback(
    (params: TParams) => {
      setSearchParams(params);
      resetPagination();
    },
    [resetPagination],
  );

  const clearSearch = useCallback(() => {
    setSearchParams(null);
    resetPagination();
    lastSignatureRef.current = null;
  }, [resetPagination]);

  const dataStable = useMemo(() => {
    if (!isEnabled) return emptyRef.current;
    return queryResult.data ?? emptyRef.current;
  }, [isEnabled, queryResult.data]);

  const totalCount = dataStable.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  const paginatedData = useMemo(() => {
    if (dataStable === emptyRef.current) return emptyRef.current;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return dataStable.slice(startIndex, endIndex);
  }, [dataStable, currentPage, pageSize]);

  useEffect(() => {
    if (!searchParams || !isEnabled) return;
    if (queryResult.isLoading) return;

    const signature =
      signatureFn?.(searchParams) ?? JSON.stringify(searchParams);
    if (signature && lastSignatureRef.current === signature) {
      return;
    }

    if (queryResult.isError) {
      if (signature) {
        lastSignatureRef.current = signature;
      }
      if (onError && queryResult.error) {
        onError(queryResult.error, searchParams);
      }
      return;
    }

    if (queryResult.isSuccess) {
      if (signature) {
        lastSignatureRef.current = signature;
      }
      const items = queryResult.data ?? emptyRef.current;
      if (items.length > 0) {
        onSuccess?.(items, searchParams);
      } else {
        onEmpty?.(searchParams);
      }
    }
  }, [
    searchParams,
    isEnabled,
    queryResult.isLoading,
    queryResult.isError,
    queryResult.isSuccess,
    queryResult.data,
    queryResult.error,
    signatureFn,
    onSuccess,
    onEmpty,
    onError,
  ]);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [hasPreviousPage]);

  return {
    allData: dataStable === emptyRef.current ? emptyRef.current : dataStable,
    data: paginatedData,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: (queryResult.error ?? null) as TError | null,
    refetch: queryResult.refetch,
    search,
    clearSearch,
    searchParams,
    hasSearched: searchParams !== null,
    currentPage,
    totalPages,
    totalCount,
    hasNextPage,
    hasPreviousPage,
    goToPage,
    nextPage,
    previousPage,
  };
}
