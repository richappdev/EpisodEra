import {SyncFailureWriter} from "../repositories/dualWrite";
import {getSupabaseEnvOrNull, supabaseRpc} from "../db/supabaseClient";

export class SupabaseMigrationOutbox implements SyncFailureWriter {
  async record(failure: {
    operationId: string;
    firebaseUid?: string;
    domain: string;
    operation: string;
    payload: unknown;
    error: string;
  }): Promise<void> {
    const env = getSupabaseEnvOrNull();
    if (!env) {
      console.error("migration outbox skipped (no SUPABASE env)", failure.operationId, failure.error);
      return;
    }

    await supabaseRpc(env, "record_migration_sync_failure", {
      p_operation_id: failure.operationId,
      p_firebase_uid: failure.firebaseUid ?? null,
      p_domain: failure.domain,
      p_operation: failure.operation,
      p_payload: failure.payload ?? {},
      p_error: failure.error,
    });
  }
}

export const migrationOutbox = new SupabaseMigrationOutbox();
