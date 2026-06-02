import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@/utils/core";

interface PersistentStateOptions<T> {
  key: string;
  defaultValue: T;
  expireInHours?: number; // 过期时间（小时），默认24小时
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

/**
 * Custom hook for managing persistent state with localStorage
 * Supports automatic expiration and custom serialization
 */
export function usePersistentState<T>({
  key,
  defaultValue,
  expireInHours = 24,
  serialize = JSON.stringify,
  deserialize = JSON.parse,
}: PersistentStateOptions<T>) {
  // Initialize state synchronously from localStorage to avoid hydration race
  const [state, setState] = useState<T>(() => {
    try {
      if (typeof window === "undefined") return defaultValue;
      const stored = window.localStorage.getItem(key);
      if (!stored) return defaultValue;

      const parsed = JSON.parse(stored);

      if (parsed.timestamp && expireInHours > 0) {
        const storedTime: number = parsed.timestamp;
        const expireTime = storedTime + expireInHours * 60 * 60 * 1000;
        if (Date.now() > expireTime) {
          window.localStorage.removeItem(key);
          return defaultValue;
        }
      }

      return deserialize(parsed.value as string);
    } catch (error) {
      logger.warn(
        `Failed to initialize persistent state for key "${key}":`,
        error,
      );
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(key);
      } catch (_) {
        // ignore secondary errors
      }
      return defaultValue;
    }
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Stabilize serialize and deserialize functions to prevent infinite loops
  const stableSerialize = useCallback(
    (value: T) => serialize(value),
    [serialize],
  );
  // Note: deserialize is used only during initial state creation above

  // Use ref to store the latest defaultValue
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;

  // Mark loaded after first render so callers can rely on a stable signal
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Update localStorage when state changes
  const updateState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setState((prevState) => {
        const nextState =
          typeof newState === "function"
            ? (newState as (prev: T) => T)(prevState)
            : newState;

        try {
          const dataToStore = {
            value: stableSerialize(nextState),
            timestamp: Date.now(),
          };
          localStorage.setItem(key, JSON.stringify(dataToStore));
        } catch (error) {
          logger.warn(
            `Failed to save persistent state for key "${key}":`,
            error,
          );
        }

        return nextState;
      });
    },
    [key, stableSerialize],
  );

  // Clear the stored state
  const clearState = useCallback(() => {
    localStorage.removeItem(key);
    setState(defaultValueRef.current);
  }, [key]);

  return {
    state,
    setState: updateState,
    isLoaded,
    clearState,
  };
}
