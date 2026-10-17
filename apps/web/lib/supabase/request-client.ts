import { isOpenAccess, openAccessUserId } from "@/lib/open-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export async function getDbClient(): Promise<SupabaseClient> {
  if (isOpenAccess()) return createAdminClient();
  return createClient();
}

export async function requireAppUser(): Promise<
  { ok: true; user: User; supabase: SupabaseClient } | { ok: false; status: number; error: string }
> {
  if (isOpenAccess()) {
    const supabase = createAdminClient();
    return {
      ok: true,
      user: { id: openAccessUserId() } as User,
      supabase,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true, user, supabase };
}
