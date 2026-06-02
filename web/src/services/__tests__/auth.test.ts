import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetAuthStateForTests,
  clearAuth,
  decodeJwtSub,
  getAuthState,
  getToken,
  getUser,
  initializeAuthOnStartup,
  onAuthChange,
  beginAuthRecovery,
  setAuthHydrated,
  setAuthStatus,
  setToken,
  setUser,
  __resetAuthListenersForTests,
} from "@/services/auth";
import type { AuthUser } from "@/services/auth";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

const buildToken = (sub: string) => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub }));
  return `${header}.${payload}.signature`;
};

describe("auth service", () => {
  beforeEach(() => {
    __resetAuthStateForTests();
    __resetAuthListenersForTests();
  });

  it("decodes JWT subject when payload contains valid UUID", () => {
    const token = buildToken(validUuid);
    expect(decodeJwtSub(token)).toBe(validUuid);
  });

  it("returns null for malformed JWT payload", () => {
    const token = "invalid.token";
    expect(decodeJwtSub(token)).toBeNull();
  });

  it("clears auth when in-memory user id is not a UUID", () => {
    const invalidUser: AuthUser = {
      id: "not-a-uuid",
      email: "user@example.com",
      name: "User",
    };
    setUser(invalidUser);
    setToken(buildToken(validUuid));

    initializeAuthOnStartup();

    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  it("clears auth when JWT sub mismatches in-memory user id", () => {
    const user: AuthUser = {
      id: validUuid,
      email: "user@example.com",
      name: "User",
    };
    setUser(user);
    setToken(buildToken("08d8a0cb-ef77-4abf-94f6-1b0d37f37ec9"));

    initializeAuthOnStartup();

    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  it("keeps auth when JWT sub matches in-memory user id", () => {
    const user: AuthUser = {
      id: validUuid,
      email: "user@example.com",
      name: "User",
    };
    setUser(user);
    const token = buildToken(validUuid);
    setToken(token);

    initializeAuthOnStartup();

    expect(getToken()).toBe(token);
    expect(getUser()).toEqual(user);
  });

  it("fires listeners when auth state changes", () => {
    const callback = vi.fn();
    onAuthChange(callback);

    setToken("some-token");
    expect(callback).toHaveBeenCalledTimes(1);

    setUser({
      id: validUuid,
      email: "user@example.com",
      name: "User",
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("tracks token ttl metadata and auth version", () => {
    setToken("token", { expiresInSeconds: 60 });

    const authState = getAuthState();
    expect(authState.token).toBe("token");
    expect(authState.accessTokenTtlSeconds).toBe(60);
    expect(authState.accessTokenExpiresAtMs).not.toBeNull();
    expect(authState.authStatus).toBe("authenticated");
    expect(authState.authVersion).toBe(1);
  });

  it("tracks recovering state and hydration flag", () => {
    setToken("token", { expiresInSeconds: 60 });
    setAuthStatus("refreshing");
    beginAuthRecovery();
    setAuthHydrated(true);

    const authState = getAuthState();
    expect(authState.authStatus).toBe("recovering");
    expect(authState.recoveryStartedAtMs).not.toBeNull();
    expect(authState.recoveryRetryCount).toBe(1);
    expect(authState.hydrated).toBe(true);
  });

  it("clearAuth removes in-memory token and user", () => {
    setToken("token");
    setUser({
      id: validUuid,
      email: "user@example.com",
      name: "User",
    });

    const callback = vi.fn();
    onAuthChange(callback);

    clearAuth();

    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
