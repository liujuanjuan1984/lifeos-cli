import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
export type PreferenceValue = string | number | boolean | object | null;

export const preferencesApi = {
  async get<T = PreferenceValue>(
    key: string,
  ): Promise<{ key: string; value: T | null }> {
    // Backend returns { key, value } or 404; http client will throw on 404.
    // For MVP Settings usage, we catch outside and fallback to default.
    return http.get<{ key: string; value: T | null }>(
      ENDPOINTS.PREFERENCES.BY_KEY(key),
    );
  },

  async getWithMeta<T = PreferenceValue>(
    key: string,
  ): Promise<{
    key: string;
    value: T | null;
    meta?: {
      allowed_values?: unknown[];
      default_value?: T;
      description?: string;
      module?: string;
    };
  }> {
    return http.get<{
      key: string;
      value: T | null;
      meta?: {
        allowed_values?: unknown[];
        default_value?: T;
        description?: string;
        module?: string;
      };
    }>(`${ENDPOINTS.PREFERENCES.BY_KEY(key)}?meta=true`);
  },

  async set<T = PreferenceValue>(
    key: string,
    value: T,
    module: string = "general",
  ) {
    // Backend expects PUT with body containing { value, module }
    return http.put(ENDPOINTS.PREFERENCES.BY_KEY(key), {
      value,
      module,
    });
  },
};
