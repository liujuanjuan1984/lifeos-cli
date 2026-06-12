import { useState, useCallback } from "react";

/**
 * Simple hook for managing modal state (loading and error)
 * This is the minimal implementation for stage 1 of progressive modal state management
 */
export function useModalState() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set loading state
  const setLoadingState = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);

  // Set error state
  const setErrorState = useCallback((errorMessage: string | null) => {
    setError(errorMessage);
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset all states
  const resetState = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  // Async wrapper for operations with automatic loading state management
  const withLoading = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      try {
        setLoading(true);
        setError(null);
        const result = await operation();
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "操作失败";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    // State
    loading,
    error,

    // State setters
    setLoading: setLoadingState,
    setError: setErrorState,
    clearError,
    resetState,

    // Utility
    withLoading,
  };
}
