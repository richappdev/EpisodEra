/**
 * Dual-write helper: primary store succeeds or fails the request;
 * secondary failures are recorded for replay (never silent).
 */

export interface SyncFailureWriter {
  record(failure: {
    operationId: string;
    firebaseUid?: string;
    domain: string;
    operation: string;
    payload: unknown;
    error: string;
  }): Promise<void>;
}

export interface DualWriteResult<T> {
  primary: T;
  secondaryError: string | null;
}

export async function dualWrite<T>(options: {
  operationId: string;
  firebaseUid?: string;
  domain: string;
  operation: string;
  payload: unknown;
  primary: () => Promise<T>;
  secondary: (primaryResult: T) => Promise<void>;
  failures: SyncFailureWriter;
}): Promise<DualWriteResult<T>> {
  const primary = await options.primary();
  try {
    await options.secondary(primary);
    return {primary, secondaryError: null};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await options.failures.record({
      operationId: options.operationId,
      firebaseUid: options.firebaseUid,
      domain: options.domain,
      operation: options.operation,
      payload: options.payload,
      error: message,
    });
    return {primary, secondaryError: message};
  }
}
