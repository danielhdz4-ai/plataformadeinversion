export async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    return { ok: false, status: 0, body: "RESEND not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() };
  }
  return { ok: true };
}
