let bootstrapStarted = false;
let bootstrapRetryPending = false;

export function hasAuthBootstrapStarted(): boolean {
  return bootstrapStarted;
}

export function markAuthBootstrapStarted() {
  bootstrapStarted = true;
}

export function hasAuthBootstrapRetryPending(): boolean {
  return bootstrapRetryPending;
}

export function markAuthBootstrapRetryPending() {
  bootstrapRetryPending = true;
}

export function clearAuthBootstrapRetryPending() {
  bootstrapRetryPending = false;
}

export function resetAuthBootstrapForTests() {
  bootstrapStarted = false;
  bootstrapRetryPending = false;
}
