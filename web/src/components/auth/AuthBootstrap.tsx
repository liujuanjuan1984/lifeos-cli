import { useEffect, useSyncExternalStore } from "react";

import { getAuthState, onAuthChange, setAuthHydrated } from "@/services/auth";
import {
  ApiError,
  AuthRecoverableError,
  computeProactiveRefreshLeadMs,
  ensureFreshAccessToken,
  handleAuthExpiredOnce,
  hasExceededAuthRecoveryLimits,
  refreshAccessTokenOnStartup,
} from "@/services/api/client";
import { logger } from "@/utils/core";
import {
  clearAuthBootstrapRetryPending,
  hasAuthBootstrapStarted,
  hasAuthBootstrapRetryPending,
  markAuthBootstrapStarted,
  markAuthBootstrapRetryPending,
} from "@/components/auth/authBootstrapState";

const RECOVERY_RETRY_DELAY_MS = 5_000;

function shouldRetryBootstrapRefresh(error: unknown): boolean {
  return !(error instanceof ApiError && error.status === 403);
}

export default function AuthBootstrap() {
  const authState = useSyncExternalStore(
    onAuthChange,
    getAuthState,
    getAuthState,
  );
  const {
    token,
    hydrated,
    authStatus,
    accessTokenExpiresAtMs,
    accessTokenTtlSeconds,
  } = authState;

  useEffect(() => {
    if (token) {
      clearAuthBootstrapRetryPending();
    }
  }, [token]);

  useEffect(() => {
    if (hydrated) {
      markAuthBootstrapStarted();
      return;
    }
    if (hasAuthBootstrapStarted()) {
      return;
    }
    markAuthBootstrapStarted();

    let cancelled = false;

    void refreshAccessTokenOnStartup()
      .then(() => {
        clearAuthBootstrapRetryPending();
      })
      .catch((error) => {
        if (shouldRetryBootstrapRefresh(error)) {
          markAuthBootstrapRetryPending();
        } else {
          clearAuthBootstrapRetryPending();
        }
        logger.error("Auth bootstrap failed:", error);
      })
      .finally(() => {
        if (!cancelled) {
          setAuthHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const handleLifecycleRefreshError = (error: unknown) => {
      if (error instanceof AuthRecoverableError) {
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        logger.warn(
          "Auth refresh was denied by the backend security boundary",
          {
            message: error.message,
          },
        );
        return;
      }
      logger.error("Auth lifecycle refresh failed:", error);
    };

    const ensureTokenFresh = () => {
      if (!getAuthState().token) {
        if (!hasAuthBootstrapRetryPending()) {
          return;
        }

        void refreshAccessTokenOnStartup()
          .then(() => {
            clearAuthBootstrapRetryPending();
          })
          .catch((error) => {
            if (shouldRetryBootstrapRefresh(error)) {
              markAuthBootstrapRetryPending();
            } else {
              clearAuthBootstrapRetryPending();
            }
            handleLifecycleRefreshError(error);
          });
        return;
      }

      void ensureFreshAccessToken().catch((error) => {
        if (error instanceof AuthRecoverableError) {
          return;
        }
        handleLifecycleRefreshError(error);
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ensureTokenFresh();
      }
    };

    const onOnline = () => {
      ensureTokenFresh();
    };

    const onFocus = () => {
      ensureTokenFresh();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
      window.addEventListener("focus", onFocus);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("focus", onFocus);
      }
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !token || !accessTokenExpiresAtMs) {
      return;
    }

    if (authStatus === "recovering" && hasExceededAuthRecoveryLimits()) {
      handleAuthExpiredOnce();
      return;
    }

    const scheduleDelayMs =
      authStatus === "recovering"
        ? RECOVERY_RETRY_DELAY_MS
        : Math.max(
            0,
            accessTokenExpiresAtMs -
              computeProactiveRefreshLeadMs(accessTokenTtlSeconds) -
              Date.now(),
          );

    const timer = window.setTimeout(() => {
      void ensureFreshAccessToken().catch((error) => {
        if (error instanceof AuthRecoverableError) {
          return;
        }
        logger.error("Scheduled auth refresh failed:", error);
      });
    }, scheduleDelayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    accessTokenExpiresAtMs,
    accessTokenTtlSeconds,
    authStatus,
    hydrated,
    token,
  ]);

  return null;
}
