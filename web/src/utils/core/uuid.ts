import type { UUID } from "@/types/primitive";

// RFC4122 v4 UUID regex (case-insensitive)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is UUID {
  return typeof value === "string" && UUID_REGEX.test(value);
}
