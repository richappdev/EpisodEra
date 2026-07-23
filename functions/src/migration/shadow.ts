import {isSupabaseShadowWrites} from "../config/env";
import {getSupabaseEnvOrNull} from "../db/supabaseClient";
import {dualWrite} from "../repositories/dualWrite";
import {migrationOutbox} from "./outbox";

/**
 * Firestore remains primary. When SUPABASE_SHADOW_WRITES=true and Supabase env
 * is configured, run secondary write; failures are recorded in the outbox.
 */
export async function shadowWrite(options: {
  domain: string;
  operation: string;
  firebaseUid: string;
  operationId: string;
  payload: unknown;
  secondary: () => Promise<void>;
}): Promise<void> {
  if (!isSupabaseShadowWrites() || !getSupabaseEnvOrNull()) {
    return;
  }

  await dualWrite({
    operationId: options.operationId,
    firebaseUid: options.firebaseUid,
    domain: options.domain,
    operation: options.operation,
    payload: options.payload,
    primary: async () => undefined,
    secondary: options.secondary,
    failures: migrationOutbox,
  });
}
