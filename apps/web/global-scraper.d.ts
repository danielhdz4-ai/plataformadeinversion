declare global {
  // eslint-disable-next-line no-var
  var __PI_CREATE_SUPABASE__: ((url: string, key: string) => import("@supabase/supabase-js").SupabaseClient) | undefined;
}

export {};
