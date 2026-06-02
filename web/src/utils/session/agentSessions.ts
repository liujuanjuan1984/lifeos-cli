export const resolveSessionId = (sessionId?: string | null): string | null => {
  if (typeof sessionId !== "string") return null;
  const trimmed = sessionId.trim();
  return trimmed.length > 0 ? trimmed : null;
};
