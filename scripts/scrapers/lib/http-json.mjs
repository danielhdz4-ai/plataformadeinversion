/** Evita tumbar ingestión entera por HTML/JSONP en respuestas API. */
export async function readResponseJson(res, label = "HTTP") {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`${label}: respuesta vacía (${res.status})`);
  }
  if (trimmed[0] !== "{" && trimmed[0] !== "[") {
    throw new Error(`${label}: no JSON (${res.status}): ${trimmed.slice(0, 80)}`);
  }
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${label}: JSON inválido (${res.status}): ${msg}`);
  }
}
