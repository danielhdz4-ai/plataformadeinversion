import fs from "node:fs";
import path from "node:path";

const root = "app/api";
const files = [
  "notary/[postalCode]/route.ts",
  "listings/[id]/route.ts",
  "listings/[id]/ai-analysis/route.ts",
  "map/listings/route.ts",
  "platform/scrape-status/route.ts",
  "scans/[id]/rank/route.ts",
  "map/listings-by-cp/route.ts",
  "scans/[id]/results/route.ts",
  "scans/[id]/repeat/route.ts",
  "scans/[id]/run/route.ts",
];

const importLine = 'import { publicDbError } from "@/lib/ops/db-api-errors";\n';

const replacements = [
  // notary
  [
    `  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {`,
    `  if (error) {
    return NextResponse.json(
      { error: publicDbError("api/notary", error.message, { userMessage: "No se pudieron cargar los datos notariales." }) },
      { status: 500 }
    );
  }
  if (!data) {`,
  ],
  // listings/[id]
  [
    `  if (error) return NextResponse.json({ error: error.message }, { status: 404 });`,
    `  if (error) {
    return NextResponse.json(
      { error: publicDbError("api/listings/id", error.message, { userMessage: "No encontramos esta vivienda." }) },
      { status: 404 }
    );
  }`,
  ],
  // ai-analysis
  [
    `    const msg = e instanceof Error ? e.message : "Error IA";
    const status = msg.includes("GEMINI_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });`,
    `    const msg = e instanceof Error ? e.message : "Error IA";
    const status = msg.includes("GEMINI_API_KEY") ? 503 : 502;
    return NextResponse.json(
      {
        error: publicDbError("api/ai-analysis", msg, {
          userMessage: "El análisis asistido no está disponible ahora mismo. Prueba más tarde.",
        }),
      },
      { status }
    );`,
  ],
  // map/listings
  [
    `    return NextResponse.json({ error: loadError, code: "DB" }, { status: 500 });`,
    `    return NextResponse.json(
      { error: publicDbError("api/map/listings", loadError), code: "DB" },
      { status: 500 }
    );`,
  ],
  // scrape-status
  [
    `    return NextResponse.json({ error: error.message }, { status: 500 });`,
    `    return NextResponse.json(
      { error: publicDbError("api/scrape-status", error.message) },
      { status: 500 }
    );`,
  ],
  // scans rank
  [
    `    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });`,
    `    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: publicDbError("api/scans/rank", msg, {
          userMessage: "No se pudo completar el ranking. Inténtalo de nuevo.",
        }),
      },
      { status: 500 }
    );`,
  ],
  // listings-by-cp scrape
  [
    `      return NextResponse.json({ error: msg, code: "SCRAPE", postalCode: cp }, { status: 502 });`,
    `      return NextResponse.json(
        {
          error: publicDbError("api/map/listings-by-cp/scrape", msg, {
            userMessage: "No pudimos buscar nuevas viviendas en este momento. Vuelve en unos minutos.",
          }),
          code: "SCRAPE",
          postalCode: cp,
        },
        { status: 502 }
      );`,
  ],
  [
    `      return NextResponse.json({ error: batchErr, code: "DB" }, { status: 500 });`,
    `      return NextResponse.json(
        { error: publicDbError("api/map/listings-by-cp", batchErr), code: "DB" },
        { status: 500 }
      );`,
  ],
  // scans results
  [
    `  if (error) return NextResponse.json({ error: error.message }, { status: 500 });`,
    `  if (error) {
    return NextResponse.json(
      { error: publicDbError("api/scans/results", error.message) },
      { status: 500 }
    );
  }`,
  ],
  // repeat
  [
    `    return NextResponse.json({ error: insErr?.message ?? "insert failed" }, { status: 500 });`,
    `    return NextResponse.json(
      {
        error: publicDbError("api/scans/repeat", insErr?.message ?? "insert failed", {
          userMessage: "No se pudo repetir el análisis.",
        }),
      },
      { status: 500 }
    );`,
  ],
  // run: error_message stored from technical exception
  [
    `            error_message: msg.slice(0, 480) || "Error en scan",`,
    `            error_message: null,`,
  ],
];

for (const rel of files) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, "utf8");
  let changed = false;
  for (const [from, to] of replacements) {
    if (src.includes(from)) {
      src = src.replaceAll(from, to);
      changed = true;
    }
  }
  if (changed && !src.includes('from "@/lib/ops/db-api-errors"')) {
    // Insertar tras la última línea de imports del bloque inicial.
    const lines = src.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\b/.test(lines[i])) lastImport = i;
      if (lastImport >= 0 && lines[i] === "}" && /^}\s*from/.test(lines[i + 1] ?? "")) {
        lastImport = i + 1;
      }
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine.trimEnd());
      src = lines.join("\n");
    } else {
      src = importLine + src;
    }
  }
  fs.writeFileSync(file, src);
  console.log(changed ? `updated ${rel}` : `no-change ${rel}`);
}
