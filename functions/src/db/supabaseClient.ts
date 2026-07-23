/**
 * Supabase PostgREST helpers for Model A (service-role only).
 * Prefer this over embedding the full JS client for Cloud Functions payload size.
 */
import {assertServerOnlySupabaseConfig, readSupabaseEnv, SupabaseEnv} from "./supabaseEnv";

export function getSupabaseEnvOrNull(): SupabaseEnv | null {
  const env = readSupabaseEnv();
  if (!env) {
    return null;
  }
  assertServerOnlySupabaseConfig(env);
  return env;
}

export async function supabaseRest(
  env: SupabaseEnv,
  pathname: string,
  options: {
    method?: string;
    body?: unknown;
    prefer?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<unknown> {
  const target = `${env.url}/rest/v1/${pathname.replace(/^\//, "")}`;
  const response = await fetch(target, {
    method: options.method ?? "GET",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=minimal",
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase REST ${response.status} ${pathname}: ${text}`);
  }
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function supabaseRpc(
  env: SupabaseEnv,
  fnName: string,
  args: Record<string, unknown>,
  prefer = "return=minimal",
): Promise<unknown> {
  return supabaseRest(env, `rpc/${fnName}`, {
    method: "POST",
    body: args,
    prefer,
  });
}
