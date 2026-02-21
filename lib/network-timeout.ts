export const SUPABASE_FETCH_TIMEOUT_MS = 10000;

/**
 * Abort a Supabase request if it exceeds timeoutMs.
 * Use with query builders that support .abortSignal(signal).
 */
export async function withSupabaseTimeout<T>(
  requestFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = SUPABASE_FETCH_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await requestFactory(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
