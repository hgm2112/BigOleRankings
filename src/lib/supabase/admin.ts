import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function isAdminServiceKey(serviceKey?: string): boolean {
  if (!serviceKey) return false;
  if (serviceKey.startsWith("sb_secret_") && serviceKey.length > 10) return true;
  const segments = serviceKey.split(".");
  if (segments.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8")) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  if (!isAdminServiceKey(serviceKey)) throw new Error("Invalid service role key");
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
