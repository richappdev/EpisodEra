/**
 * Supabase server client for Model A (service-role only).
 * Never import this module from browser bundles.
 */

export interface SupabaseEnv {
  url: string;
  serviceRoleKey: string;
}

export function readSupabaseEnv(env: NodeJS.ProcessEnv = process.env): SupabaseEnv | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    return null;
  }
  return {url, serviceRoleKey};
}

/** Placeholder until @supabase/supabase-js is added when dual-write is enabled. */
export function assertServerOnlySupabaseConfig(env: SupabaseEnv): void {
  if (!env.url.startsWith("https://")) {
    throw new Error("SUPABASE_URL must be https");
  }
  if (env.serviceRoleKey.length < 20) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY looks invalid");
  }
}
