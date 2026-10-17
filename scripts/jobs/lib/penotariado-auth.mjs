/**
 * Sesión penotariado.com (área privada) — credenciales solo en env.
 */
export async function penotariadoLogin(page) {
  const email = process.env.PENOTARIADO_EMAIL?.trim();
  const password = process.env.PENOTARIADO_PASSWORD?.trim();
  if (!email || !password) {
    return { ok: false, reason: "missing PENOTARIADO_EMAIL/PASSWORD" };
  }

  const entry =
    process.env.PENOTARIADO_PORTAL_URL?.trim() ||
    "https://www.penotariado.com/inmobiliario/es/home";

  await page.goto(entry, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2000);

  const loginLink = page.getByRole("link", { name: /iniciar sesión|acceder|área privada/i }).first();
  if (await loginLink.isVisible().catch(() => false)) {
    await loginLink.click();
    await page.waitForTimeout(2000);
  }

  const emailSel =
    'input[type="email"], input[name*="email" i], input[name*="usuario" i], input[id*="email" i]';
  const passSel = 'input[type="password"]';
  const hasEmail = await page.locator(emailSel).first().isVisible({ timeout: 12_000 }).catch(() => false);
  if (!hasEmail) {
    const body = await page.content();
    if (/cerrar sesión|nueva habitat|área privada/i.test(body)) {
      return { ok: true, already: true };
    }
    return { ok: false, reason: "login form not found" };
  }

  await page.locator(emailSel).first().fill(email);
  await page.locator(passSel).first().fill(password);
  await page.getByRole("button", { name: /iniciar|entrar|acceder|login/i }).first().click();
  await page.waitForTimeout(5000);

  const url = page.url();
  const html = await page.content();
  if (/incorrect|error|inválid/i.test(html) && !/cerrar sesión/i.test(html)) {
    return { ok: false, reason: "login rejected" };
  }
  return { ok: true, url };
}
