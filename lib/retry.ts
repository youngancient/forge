// design.md decision #16: 3 attempts, exponential backoff (1s/2s/4s), retryable
// errors only. Used around Claude calls, email send, and PDF-to-blob upload.

export class NonRetryableError extends Error {}

const DELAYS_MS = [1000, 2000, 4000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean = () => true,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (error instanceof NonRetryableError || !isRetryable(error)) {
        throw error;
      }

      if (attempt < DELAYS_MS.length) {
        await sleep(DELAYS_MS[attempt]);
      }
    }
  }

  throw lastError;
}
