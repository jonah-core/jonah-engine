// server/core/security.ts

const MAX_ALLOWED_AGE_MS = 60000;
const MAX_FUTURE_DRIFT_MS = 5000;

export function validateExpiration(
  timestamp: string,
  maxAgeMs: number
): void {

  if (!timestamp) {
    throw new Error("Missing timestamp");
  }

  if (!maxAgeMs) {
    throw new Error("Missing max_age_ms");
  }

  if (maxAgeMs > MAX_ALLOWED_AGE_MS) {
    throw new Error("max_age_ms exceeds allowed limit");
  }

  const requestTime = new Date(timestamp);

  if (isNaN(requestTime.getTime())) {
    throw new Error("Invalid RFC3339 timestamp");
  }

  const now = new Date();
  const ageMs = now.getTime() - requestTime.getTime();

  if (ageMs < -MAX_FUTURE_DRIFT_MS) {
    throw new Error("Timestamp too far in future");
  }

  if (ageMs > maxAgeMs) {
    throw new Error("Signature expired");
  }
}
