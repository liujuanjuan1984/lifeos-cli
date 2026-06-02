import type { UUID } from "@/types/primitive";
import { isUuid } from "@/utils/core";

export type AuthUser = {
  id: UUID;
  email: string;
  name: string;
  is_superuser?: boolean;
  timezone?: string | null;
};

export type AuthStatus =
  | "authenticated"
  | "refreshing"
  | "recovering"
  | "expired";

export type AuthState = {
  token: string | null;
  user: AuthUser | null;
  accessTokenExpiresAtMs: number | null;
  accessTokenTtlSeconds: number | null;
  authStatus: AuthStatus;
  recoveryStartedAtMs: number | null;
  recoveryRetryCount: number;
  authVersion: number;
  hydrated: boolean;
};

let currentToken: string | null = null;
let currentUser: AuthUser | null = null;
let accessTokenExpiresAtMs: number | null = null;
let accessTokenTtlSeconds: number | null = null;
let authStatus: AuthStatus = "expired";
let recoveryStartedAtMs: number | null = null;
let recoveryRetryCount = 0;
let authVersion = 0;
let hydrated = false;
let authStateSnapshot: AuthState;

function normalizeExpiresInSeconds(
  value: number | null | undefined,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value > 0 ? value : null;
}

function toExpiresAtMs(expiresInSeconds: number | null): number | null {
  if (expiresInSeconds === null) {
    return null;
  }

  return Date.now() + expiresInSeconds * 1000;
}

function syncAuthStateSnapshot() {
  authStateSnapshot = {
    token: currentToken,
    user: currentUser,
    accessTokenExpiresAtMs,
    accessTokenTtlSeconds,
    authStatus,
    recoveryStartedAtMs,
    recoveryRetryCount,
    authVersion,
    hydrated,
  };
}

syncAuthStateSnapshot();

export function decodeJwtSub(token: string): UUID | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const json = atob(payloadB64);
    const payload = JSON.parse(json) as { sub?: string };
    const sub = payload?.sub;
    if (!sub) return null;
    return isUuid(sub) ? (sub as UUID) : null;
  } catch {
    return null;
  }
}

export function initializeAuthOnStartup() {
  // Hard cut: if stored user is invalid (non-UUID id), clear auth
  try {
    const user = getUser();
    if (user && !isUuid(user.id)) {
      clearAuth();
      return;
    }
    const token = getToken();
    if (token && user) {
      const sub = decodeJwtSub(token);
      if (!sub || sub !== user.id) {
        clearAuth();
      }
    }
  } catch {
    // noop
  }
}

let listeners: Array<() => void> = [];

export const __resetAuthListenersForTests = () => {
  listeners = [];
};

export const __resetAuthStateForTests = () => {
  currentToken = null;
  currentUser = null;
  accessTokenExpiresAtMs = null;
  accessTokenTtlSeconds = null;
  authStatus = "expired";
  recoveryStartedAtMs = null;
  recoveryRetryCount = 0;
  authVersion = 0;
  hydrated = false;
  syncAuthStateSnapshot();
};

export function getToken(): string | null {
  return currentToken;
}

export function setToken(
  token: string | null,
  options?: { expiresInSeconds?: number | null },
) {
  currentToken = token;
  const normalizedTtl = normalizeExpiresInSeconds(options?.expiresInSeconds);
  accessTokenTtlSeconds =
    normalizedTtl ?? (token ? accessTokenTtlSeconds : null);
  accessTokenExpiresAtMs =
    normalizedTtl !== null
      ? toExpiresAtMs(normalizedTtl)
      : token
        ? accessTokenExpiresAtMs
        : null;
  authStatus = token ? "authenticated" : "expired";
  recoveryStartedAtMs = null;
  recoveryRetryCount = 0;
  authVersion += 1;
  syncAuthStateSnapshot();
  notify();
}

export function getUser(): AuthUser | null {
  return currentUser;
}

export function setUser(user: AuthUser | null) {
  currentUser = user;
  syncAuthStateSnapshot();
  notify();
}

export function getAuthState(): AuthState {
  return authStateSnapshot;
}

export function getAccessTokenExpiresAtMs(): number | null {
  return accessTokenExpiresAtMs;
}

export function getAccessTokenTtlSeconds(): number | null {
  return accessTokenTtlSeconds;
}

export function getRecoveryStartedAtMs(): number | null {
  return recoveryStartedAtMs;
}

export function getRecoveryRetryCount(): number {
  return recoveryRetryCount;
}

export function getAuthVersion(): number {
  return authVersion;
}

export function setAuthStatus(status: AuthStatus) {
  if (authStatus === status) {
    return;
  }

  authStatus = status;
  syncAuthStateSnapshot();
  notify();
}

export function beginAuthRecovery() {
  if (!currentToken) {
    return;
  }

  authStatus = "recovering";
  recoveryStartedAtMs = recoveryStartedAtMs ?? Date.now();
  recoveryRetryCount += 1;
  syncAuthStateSnapshot();
  notify();
}

export function setAuthHydrated(value: boolean) {
  if (hydrated === value) {
    return;
  }

  hydrated = value;
  syncAuthStateSnapshot();
  notify();
}

export function clearAuth() {
  setToken(null);
  setUser(null);
}

export function onAuthChange(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((f) => f !== cb);
  };
}

function notify() {
  for (const cb of listeners) cb();
}
