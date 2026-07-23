/**
 * Shared helpers for Supabase data backfill scripts.
 */
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";

export function loadEnvFiles(repoRoot, files = [".env", "functions/.env.supabase"]) {
  for (const relative of files) {
    const full = path.join(repoRoot, relative);
    if (!existsSync(full)) {
      continue;
    }
    let text = readFileSync(full, "utf8");
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

export function requireSupabaseEnv() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in functions/.env.supabase).",
    );
  }
  return {url: url.replace(/\/$/, ""), serviceRoleKey};
}

export async function supabaseRest({url, serviceRoleKey}, pathname, options = {}) {
  const target = `${url}/rest/v1/${pathname.replace(/^\//, "")}`;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: options.prefer ?? "return=minimal",
    ...(options.headers ?? {}),
  };
  const response = await fetch(target, {
    method: options.method ?? "GET",
    headers,
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

export async function supabaseRpc(env, fnName, args, prefer = "return=minimal") {
  return supabaseRest(env, `rpc/${fnName}`, {
    method: "POST",
    body: args,
    prefer,
  });
}
