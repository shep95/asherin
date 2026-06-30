// Vault embedding helper — calls the Lovable AI Gateway /embeddings endpoint
// using openai/text-embedding-3-small (1536 dim → fits pgvector HNSW limits).
// Server-side only. Reads LOVABLE_API_KEY from env.

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIMS = 1536;

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  if (!inputs.length) return [];

  const out: number[][] = [];
  // Batches of 32 keeps individual requests modest and avoids token-limit 400s.
  const BATCH = 32;
  for (let i = 0; i < inputs.length; i += BATCH) {
    const slice = inputs.slice(i, i + BATCH);
    const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: slice,
        dimensions: EMBED_DIMS,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`embed_${r.status}: ${txt.slice(0, 200)}`);
    }
    const j = await r.json();
    for (const d of j?.data ?? []) {
      if (Array.isArray(d?.embedding)) out.push(d.embedding);
    }
  }
  return out;
}

/** Chunk text into ~1200-char chunks with 150-char overlap, snapping to paragraph
 *  / sentence boundaries when possible. Keeps semantic units intact. */
export function chunkText(input: string, target = 1200, overlap = 150): string[] {
  const text = (input ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  if (text.length <= target) return [text];

  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + target, text.length);
    if (end < text.length) {
      // Try to break at paragraph, then sentence, then space.
      const window = text.slice(i, end + 100);
      const para = window.lastIndexOf("\n\n");
      const sent = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
      const space = window.lastIndexOf(" ");
      const cut =
        para > target * 0.4 ? para :
        sent > target * 0.4 ? sent + 1 :
        space > target * 0.4 ? space : -1;
      if (cut > 0) end = i + cut;
    }
    const piece = text.slice(i, end).trim();
    if (piece) out.push(piece);
    if (end >= text.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return out;
}

export function approxTokens(s: string): number {
  // Rough 4 chars ≈ 1 token heuristic.
  return Math.ceil((s?.length ?? 0) / 4);
}

export const VAULT_EMBED_DIMS = EMBED_DIMS;
export const VAULT_EMBED_MODEL = EMBED_MODEL;
