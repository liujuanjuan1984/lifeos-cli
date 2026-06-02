import { useCallback, useEffect, useState } from "react";
import type { RateLimitInfo } from "@/types/rateLimit";
import { usePersistentState } from "@/hooks/usePersistentState";
import { getUser, onAuthChange } from "@/services/auth";

const STORAGE_KEY = "agent_rate_limit_state";
const MAX_TIMEOUT_MS = 2147483647; // ~24 days - cap setTimeout values

type RateLimitCacheState = {
  userId: string | null;
  info: RateLimitInfo | null;
};

const DEFAULT_CACHE_STATE: RateLimitCacheState = {
  userId: null,
  info: null,
};

const resolveCurrentUserId = () => {
  try {
    return getUser()?.id ?? null;
  } catch {
    return null;
  }
};

export function useAgentRateLimit() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    resolveCurrentUserId(),
  );

  useEffect(() => {
    return onAuthChange(() => {
      setCurrentUserId(resolveCurrentUserId());
    });
  }, []);

  const { state, setState, clearState } =
    usePersistentState<RateLimitCacheState>({
      key: STORAGE_KEY,
      defaultValue: DEFAULT_CACHE_STATE,
      expireInHours: 48,
      serialize: (value) => JSON.stringify(value),
      deserialize: (value) => {
        try {
          const parsed = JSON.parse(value) as RateLimitCacheState;
          if (
            parsed &&
            typeof parsed === "object" &&
            "userId" in parsed &&
            "info" in parsed
          ) {
            return parsed;
          }
        } catch {
          // ignore parse errors and fall through to default
        }
        return DEFAULT_CACHE_STATE;
      },
    });

  useEffect(() => {
    const storedUserId = state.userId;
    if (storedUserId === null && currentUserId !== null) {
      clearState();
      return;
    }
    if (storedUserId && storedUserId !== currentUserId) {
      clearState();
    }
  }, [state.userId, currentUserId, clearState]);

  const rateLimitInfo =
    state.userId === null
      ? currentUserId === null
        ? state.info
        : null
      : state.userId === currentUserId
        ? state.info
        : null;

  useEffect(() => {
    if (!rateLimitInfo?.resetAt) return;
    const resetTime = Date.parse(rateLimitInfo.resetAt);
    if (Number.isNaN(resetTime)) {
      clearState();
      return;
    }

    const remaining = resetTime - Date.now();
    if (remaining <= 0) {
      clearState();
      return;
    }

    if (typeof window === "undefined") return;
    const timeout = Math.min(remaining, MAX_TIMEOUT_MS);
    const id = window.setTimeout(() => {
      clearState();
    }, timeout);

    return () => window.clearTimeout(id);
  }, [rateLimitInfo?.resetAt, clearState]);

  const setRateLimitInfo = useCallback(
    (info: RateLimitInfo | null) => {
      if (!info) {
        clearState();
        return;
      }

      setState({
        userId: currentUserId,
        info: {
          ...info,
          capturedAt: info.capturedAt ?? new Date().toISOString(),
        },
      });
    },
    [setState, clearState, currentUserId],
  );

  const clearRateLimitInfo = useCallback(() => {
    clearState();
  }, [clearState]);

  return {
    rateLimitInfo,
    setRateLimitInfo,
    clearRateLimitInfo,
  };
}
