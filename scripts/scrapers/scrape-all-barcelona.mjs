/**
 * @deprecated Usa scripts/jobs/scrape-bcn-metro.mjs (metro completo).
 * Wrapper corto por compatibilidad con docs antiguos.
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = {
  ...process.env,
  PISOS_PER_CITY: process.env.PISOS_PER_CITY ?? "500",
  FOTOCASA_PER_ZONE: process.env.FOTOCASA_PER_ZONE ?? "250",
};

await new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [path.join(root, "scripts/jobs/scrape-bcn-metro.mjs")], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
});
