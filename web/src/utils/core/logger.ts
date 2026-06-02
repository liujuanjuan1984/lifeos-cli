type LogLevel = "debug" | "info" | "warn" | "error";

const isProd = import.meta.env.PROD;
const enabled = (import.meta.env.VITE_ENABLE_DEBUG ?? "false") === "true";

function shouldLog(level: LogLevel): boolean {
  if (isProd) {
    // In production, only allow warn/error unless explicitly enabled
    if (!enabled) return level === "warn" || level === "error";
  }
  return true;
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog("debug")) console.debug("[DEBUG]", ...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog("info")) console.info("[INFO]", ...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) console.warn("[WARN]", ...args);
  },
  error: (...args: unknown[]) => {
    if (shouldLog("error")) console.error("[ERROR]", ...args);
  },
};
