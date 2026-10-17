/**
 * Login opcional en kelify.com (solo si hay credenciales en env).
 * No guardar email/password en git — solo .env.local o GitHub Secrets.
 */
export async function kelifyLoginIfConfigured(page) {
  const email = process.env.KELIFY_EMAIL?.trim();
  const password = process.env.KELIFY_PASSWORD?.trim();
  if (!email || !password) {
    console.log(JSON.stringify({ kelifyAuth: "skipped", reason: "no KELIFY_EMAIL/KELIFY_PASSWORD" }));
    return false;
  }

  const loginUrls = ["https://kelify.com/es/login", "https://kelify.com/login"];
  for (const url of loginUrls) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(1500);
      const loginBtn = page.getByRole("button", { name: /Iniciar sesión/i }).first();
      if (await loginBtn.isVisible().catch(() => false)) {
        await loginBtn.click();
        await page.waitForTimeout(2000);
      }
      const emailSel =
        'input[type="email"], input[name="email"], input[name*="email"], input[autocomplete="email"]';
      const passSel = 'input[type="password"], input[name="password"], input[name*="password"]';
      const hasEmail = await page.locator(emailSel).first().isVisible({ timeout: 8_000 }).catch(() => false);
      if (!hasEmail) {
        console.log(
          JSON.stringify({
            kelifyAuth: "skipped",
            reason: "kelify login is OAuth-only (no email/password form); using public listings",
          })
        );
        return false;
      }
      await page.waitForSelector(emailSel, { timeout: 15_000 });
      await page.fill(emailSel, email);
      await page.fill(passSel, password);
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForTimeout(4000);
      const stillLogin = page.url().includes("login");
      if (!stillLogin) {
        console.log(JSON.stringify({ kelifyAuth: "ok" }));
        return true;
      }
    } catch {
      /* try next URL */
    }
  }
  console.log(JSON.stringify({ kelifyAuth: "failed", reason: "login form not completed" }));
  return false;
}
