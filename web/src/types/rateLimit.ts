export interface RateLimitInfo {
  message: string;
  limit: number | null;
  used: number | null;
  resetAt: string | null;
  capturedAt: string;
}
