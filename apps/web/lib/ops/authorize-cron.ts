import type { NextRequest } from "next/server";

/** Vercel Cron y GitHub Actions deben enviar `Authorization: Bearer ${CRON_SECRET}`. */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}