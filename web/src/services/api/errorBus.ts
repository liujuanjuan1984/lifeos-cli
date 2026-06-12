export interface ApiErrorDetail {
  title?: string;
  message: string;
}

type Listener = (detail: ApiErrorDetail) => void;

const listeners = new Set<Listener>();

export function subscribeApiError(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitApiError(detail: ApiErrorDetail): void {
  listeners.forEach((listener) => {
    try {
      listener(detail);
    } catch {
      // Swallow errors from listeners to avoid cascading failures
    }
  });
}
