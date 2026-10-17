import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

export function dryRun() {
  return process.env.DRY_RUN === "1";
}

export function maxListings() {
  const n = Number(process.env.MAX_LISTINGS ?? process.env.KELIFY_MAX_LISTINGS ?? "220");
  return Number.isFinite(n) ? n : 220;
}
