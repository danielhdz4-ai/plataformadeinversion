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
      const emailSel = 'input[type="email"], input[name="email"], input[autocomplete="email"]';
      const passSel = 'input[type="password"], input[name="password"]';
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
