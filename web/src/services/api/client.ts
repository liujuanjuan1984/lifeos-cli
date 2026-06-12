import { emitApiError } from "./errorBus";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export class ApiError extends Error {
  status: number;
  title?: string;

  constructor(message: string, status: number, options?: { title?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.title = options?.title;
  }
}

type PrimitiveQueryValue = string | number | boolean;
type QueryParamValue =
  | PrimitiveQueryValue
  | PrimitiveQueryValue[]
  | undefined;
export type QueryParams = Record<string, QueryParamValue>;

function buildUrl(path: string, query?: QueryParams): string {
  const base =
    API_BASE_URL ||
    (typeof window === "undefined" ? "http://localhost" : window.location.origin);
  const url = new URL(path, base);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function parseError(response: Response): Promise<ApiError> {
  let message = response.statusText || "Request failed";
  try {
    const payload = (await response.json()) as {
      detail?: unknown;
      message?: unknown;
    };
    if (typeof payload.detail === "string") {
      message = payload.detail;
    } else if (typeof payload.message === "string") {
      message = payload.message;
    }
  } catch {
    // Keep HTTP status text when the body is not JSON.
  }
  return new ApiError(message, response.status);
}

async function request<T>(
  method: string,
  path: string,
  options?: {
    query?: QueryParams;
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<T> {
  try {
    const response = await fetch(buildUrl(path, options?.query), {
      method,
      headers:
        options?.body === undefined
          ? undefined
          : {
              "Content-Type": "application/json",
            },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options?.signal,
    });

    if (!response.ok) {
      throw await parseError(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      emitApiError({ title: error.title, message: error.message });
    } else {
      emitApiError({
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

export const http = {
  get: <T>(
    pathname: string,
    params?: QueryParams,
    options?: { signal?: AbortSignal },
  ) => request<T>("GET", pathname, { query: params, signal: options?.signal }),
  post: <T>(pathname: string, body?: unknown, params?: QueryParams) =>
    request<T>("POST", pathname, { query: params, body }),
  put: <T>(pathname: string, body?: unknown, params?: QueryParams) =>
    request<T>("PUT", pathname, { query: params, body }),
  patch: <T>(pathname: string, body?: unknown, params?: QueryParams) =>
    request<T>("PATCH", pathname, { query: params, body }),
  delete: <T>(pathname: string, params?: QueryParams) =>
    request<T>("DELETE", pathname, { query: params }),
};
