type ProcessLike = {
  env?: Record<string, string | undefined>;
};

// Ensure a stable TZ for date/time tests without depending on Node's global Process typing.
const globalProcess = (
  globalThis as unknown as {
    process?: ProcessLike;
  }
).process;

if (!globalProcess) {
  (globalThis as unknown as { process: ProcessLike }).process = { env: {} };
}

const env =
  (globalThis as unknown as { process: ProcessLike }).process.env ??
  (((globalThis as unknown as { process: ProcessLike }).process.env =
    {}) as Record<string, string | undefined>);
env.TZ = env.TZ ?? "UTC";

import "@testing-library/jest-dom/vitest";
import { setupTranslationMock } from "@test/setupTranslationMock";

setupTranslationMock();

// Re-export commonly used testing-library utilities to enforce a single import location if needed.
// Additional global test setup (e.g., MSW handlers) can be added here when required.
