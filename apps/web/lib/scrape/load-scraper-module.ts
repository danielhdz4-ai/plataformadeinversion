import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function scraperRepoRoot(): string {
  const cwd = process.cwd();
  const norm = cwd.replace(/\\/g, "/");
  const candidates = [
    cwd,
    norm.endsWith("/apps/web") ? join(cwd, "../..") : null,
    join(cwd, "../.."),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (existsSync(join(root, "scripts/scrapers/lib/env.mjs"))) return root;
  }
  return cwd;
}

export function resolveScraperFile(relativeFromRepo: string): string {
  const tail = relativeFromRepo.replace(/^scripts\//, "");
  const bundled = join(process.cwd(), "lib/scraper-runtime", tail);
  if (existsSync(bundled)) return bundled;
  return join(scraperRepoRoot(), relativeFromRepo);
}

/** Dynamic import of repo scrapers (Windows + Vercel-safe). */
export async function importScraperModule<T>(relativePath: string): Promise<T> {
  const modPath = resolveScraperFile(relativePath);
  return (await import(/* webpackIgnore: true */ pathToFileURL(modPath).href)) as T;
}
