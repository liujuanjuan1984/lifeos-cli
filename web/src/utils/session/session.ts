/**
 * Generate a session identifier for modal interactions.
 * Uses crypto.randomUUID when available, with a fallback for older browsers.
 */
export function createModalSessionId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timestampPart = Date.now().toString(36);
  return `session_${randomPart}_${timestampPart}`;
}
