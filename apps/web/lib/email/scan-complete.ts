import { sendResendEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export async function notifyScanCompleteIfRequested(scanId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: scan } = await admin
    .from("scans")
    .select("user_id, filters, status")
    .eq("id", scanId)
    .maybeSingle();

  if (!scan || scan.status !== "completed") return;

  const filters = (scan.filters ?? {}) as Record<string, unknown>;
  if (!filters.notifyEmail) return;

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(scan.user_id);
  if (userErr || !userData.user?.email) {
    console.warn("scan email skip: no user email", scanId, userErr?.message);
    return;
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const url = `${site}/app/scan/${scanId}`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Radar Inversión";

  const result = await sendResendEmail({
    to: userData.user.email,
    subject: `${appName} — tu scan está listo`,
    html: `<p>Tu búsqueda por zona ha terminado.</p><p><a href="${url}">Ver resultados</a></p><p style="color:#666;font-size:12px">Información orientativa, no asesoramiento.</p>`,
  });

  if (!result.ok) {
    console.warn("scan email failed", scanId, result.status, result.body);
  }
}
