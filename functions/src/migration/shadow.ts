import {isSupabaseShadowWrites, isSupabaseWritePrimary} from "../config/env";
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

/**
 * When SUPABASE_WRITE_PRIMARY=true, write Supabase immediately (Model A primary).
 * Otherwise fall back to optional shadowWrite after Firestore.
 */
export async function writeSupabasePrimaryOrShadow(options: {
  domain: string;
  operation: string;
  firebaseUid: string;
  operationId: string;
  payload: unknown;
  write: () => Promise<void>;
}): Promise<void> {
  if (isSupabaseWritePrimary()) {
    if (!getSupabaseEnvOrNull()) {
      throw new Error("SUPABASE_WRITE_PRIMARY requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
    await options.write();
    return;
  }

  await shadowWrite({
    domain: options.domain,
    operation: options.operation,
    firebaseUid: options.firebaseUid,
    operationId: options.operationId,
    payload: options.payload,
    secondary: options.write,
  });
}
