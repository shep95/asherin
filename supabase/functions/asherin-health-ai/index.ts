// ─────────────────────────────────────────────────────────────────────────────
// asherin.health — vision + assistant endpoint.
//
// Three actions, one gate:
//   body.views    four guided photographs → silhouette band widths + posture +
//                 capture quality. The model NEVER returns a circumference in
//                 centimetres; scale belongs to the measured height on the
//                 device, and letting a model author a size is how photo
//                 anthropometry starts lying.
//   surface.scan  one close photograph of a named region → feature readings
//                 (colour, texture, lesion, vascular, swelling, asymmetry,
//                 geometry) as normalised values with two separate confidences.
//   assist        the room's assistant. It receives the person's own record
//                 summary as context and answers about it. Never diagnoses,
//                 never names a disease as fact, always ends a concern with a
//                 next step.
//
// Nothing is stored server-side. Images pass through this function to the model
// and are not written anywhere: the health record lives on the person's device.
// ─────────────────────────────────────────────────────────────────────────────

import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";
import { callByokJson, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";

const MAX_IMAGE_BYTES = 6_000_000;
const MAX_IMAGES = 4;
const MAX_LABS_DOC_BYTES = 8_000_000;

interface ImageIn {
  view?: string;
  mime: string;
  b64: string;
}

const SAFETY = `
you are the assistant inside asherin.health. hard rules, in order:
- you never diagnose. you never name a disease as fact. you describe what is observed and what it could be consistent with, with likelihood language.
- anything that bleeds, will not heal, changes fast, causes breathlessness, chest pain, one-sided weakness, or new severe pain goes to urgent clinical care, said plainly and first.
- you speak about this person's own record only. you do not invent values that are not in the context.
- when the record does not contain what would be needed to answer, you say what is missing rather than filling it in.
- all prose lowercase. no emoji. short paragraphs. plain words a person without training reads once and understands.
`;

function json(body: unknown, status: number, cors: Record<string, string>) {
  // Every failure carries a `message` as well as `error`: the client reads
  // `message` first, and a body that only names the fault in `error` used to
  // arrive on screen as a generic non-2xx toast.
  const payload =
    body && typeof body === "object" && "error" in (body as Record<string, unknown>) && !("message" in (body as Record<string, unknown>))
      ? { ...(body as Record<string, unknown>), message: (body as Record<string, unknown>).error }
      : body;
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function extractJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

async function callGemini(apiKey: string, prompt: string, images: ImageIn[], maxTokens: number): Promise<string> {
  const parts: unknown[] = [{ text: prompt }];
  for (const img of images) parts.push({ inlineData: { mimeType: img.mime, data: img.b64 } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  let last = "";
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.15, maxOutputTokens: maxTokens, responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      });
      if (resp.ok) {
        const data = await resp.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      }
      lastStatus = resp.status;
      last = `${resp.status} ${(await resp.text()).slice(0, 200)}`;
      if (resp.status !== 429 && resp.status !== 503) break;
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    } catch (e) {
      last = e instanceof Error ? e.message : "request failed";
    } finally {
      clearTimeout(timer);
    }
  }
  // The upstream status decides how the room speaks: a quota wall is not the
  // same event as a broken request, and the person should be told which it is.
  const err = new Error(
    lastStatus === 429
      ? "the vision model is at its rate or quota limit right now. wait a moment and try again, or add your own model key in settings so this runs on your key."
      : lastStatus === 401 || lastStatus === 403
        ? "the vision key was rejected by the model provider. check the key in settings."
        : `the photographs could not be read right now (${last || "no response from the model"}).`,
  ) as Error & { upstreamStatus?: number };
  err.upstreamStatus = lastStatus;
  throw err;
}


const LABS_PROMPT = `you are reading a photograph or pdf page of a laboratory report to extract structured values only.

return every analyte you can read clearly. for each one:
key    — a short lowercase snake_case identifier for the analyte (e.g. "hemoglobin", "ldl_cholesterol", "vitamin_d")
label  — the analyte name as printed on the report
value  — the numeric result as printed (do not convert units)
unit   — the unit exactly as printed, if present
refLow, refHigh — the printed reference range bounds, if present
collectedAt — the collection or report date in ISO 8601 if printed, otherwise omit

list anything you could not read confidently (blurry, cut off, ambiguous) in "unreadable" as short plain descriptions, rather than guessing a value.

never infer a value that is not printed. never diagnose.

STRICT JSON:
{"values":[{"key":"hemoglobin","label":"Hemoglobin","value":13.2,"unit":"g/dL","refLow":13.5,"refHigh":17.5,"collectedAt":"2024-03-01"}],"unreadable":["bottom row of the metabolic panel was cut off"]}`;

const BODY_PROMPT = `you are reading guided body photographs to extract silhouette geometry. you are not judging the person and you are not diagnosing.

for EACH image supplied (they arrive in the order listed below), return one entry.

read, for each of these bands, the width of the body silhouette measured ACROSS the frame at that band, expressed as a FRACTION OF THE SUBJECT'S FULL STANDING HEIGHT in the same image:
neck, shoulder, chest, waist, hip, thigh, calf, upperArm.
on a side view, that same number is the body's DEPTH at the band. return it in the same field.

also return:
subjectFrameFraction — how much of the image height the standing subject occupies, 0..1.
posture — up to three short plain observations (e.g. "left shoulder sits lower than right"), each with a confidence 0..1. describe only what is visible.
quality — lighting, pose, clothing, framing, each 0..1, where 1 means ideal for silhouette reading. loose clothing scores clothing low.

never output centimetres, inches, weight, body fat, or any health judgement. fractions and observations only.

STRICT JSON:
{"views":[{"view":"front","subjectFrameFraction":0.86,"bands":[{"band":"waist","widthFraction":0.16,"confidence":0.7}],"posture":[{"note":"...","confidence":0.6}],"quality":{"lighting":0.8,"pose":0.7,"clothing":0.5,"framing":0.9}}],"note":"one sentence on what limited the reading"}`;

const SURFACE_PROMPT = `you are reading a close photograph of one named body region for visible features only.

return observations for whichever of these features are actually visible: colour, texture, lesion, vascular, swelling, asymmetry, geometry, density.

each observation:
feature      — one of the words above
value        — 0..1, how pronounced the feature is in this frame. this number only has meaning compared to the same person's earlier frames, so be consistent rather than absolute.
detail       — one plain sentence of what is seen. describe, do not diagnose.
imageConfidence        — 0..1, how well the camera could actually see it (focus, light, angle).
interpretationConfidence — 0..1, how much the feature means anything at all.
clinicalRelevance      — "routine" | "watch" | "clinician". use "clinician" for a lesion with irregular border or uneven colour, anything ulcerated or bleeding, or marked one-sided swelling.
lesionMm     — longest dimension in millimetres ONLY if a scale reference (ruler, coin) is visible. otherwise omit.

STRICT JSON:
{"observations":[{"feature":"colour","value":0.4,"detail":"...","imageConfidence":0.7,"interpretationConfidence":0.5,"clinicalRelevance":"routine"}],"summary":"two sentences, plain, no diagnosis","limits":"what this photo could not show"}`;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400, cors);
  }

  let resolution: Awaited<ReturnType<typeof resolveKey>>;
  try {
    resolution = await resolveKey(req, body?.byok);
  } catch (e) {
    return byokErrorResponse(e, cors);
  }

  const action = String(body?.action ?? "");
  const byokCfg = (resolution as { byok?: ZophielByokConfig }).byok ?? null;
  // vision runs on gemini. a staff/platform key arrives directly; a BYOK user
  // whose own key is a gemini key can use it for the photo actions too. any
  // other provider simply has no vision path here, and the room says so.
  const geminiKey =
    (resolution as { geminiKey?: string }).geminiKey ??
    (byokCfg && /gemini|google/i.test(byokCfg.provider ?? "") ? byokCfg.apiKey : null);

  const images: ImageIn[] = Array.isArray(body?.images)
    ? body.images
        .slice(0, MAX_IMAGES)
        .map((i: any) => ({
          view: typeof i?.view === "string" ? i.view.slice(0, 12) : undefined,
          mime: typeof i?.mime === "string" && /^image\/(jpeg|png|webp)$/.test(i.mime) ? i.mime : "image/jpeg",
          b64: typeof i?.b64 === "string" ? i.b64 : "",
        }))
        .filter((i: ImageIn) => i.b64.length > 64)
    : [];

  const oversized = images.find((i) => i.b64.length * 0.75 > MAX_IMAGE_BYTES);
  if (oversized) return json({ error: "one of those photos is too large. the room shrinks them before sending — reload and try again." }, 413, cors);

  try {
    if (action === "body.views") {
      if (images.length === 0) return json({ error: "no photographs were supplied." }, 400, cors);
      if (!geminiKey) {
        return json(
          { error: "reading photographs needs a vision key. add your own model key in settings, and this runs on your key alone." },
          402,
          cors,
        );
      }
      const order = images.map((i, n) => `${n + 1}. ${i.view ?? "unlabelled"}`).join("\n");
      const raw = await callGemini(geminiKey, `${BODY_PROMPT}\n\nimages, in order:\n${order}`, images, 4096);
      const parsed = extractJson(raw);
      if (!parsed?.views) return json({ error: "the photographs could not be read into geometry. try again in even light." }, 502, cors);
      return json({ views: parsed.views, note: parsed.note ?? "" }, 200, cors);
    }

    if (action === "surface.scan") {
      if (images.length === 0) return json({ error: "no photograph was supplied." }, 400, cors);
      if (!geminiKey) {
        return json(
          { error: "reading photographs needs a vision key. add your own model key in settings, and this runs on your key alone." },
          402,
          cors,
        );
      }
      const region = String(body?.region ?? "").slice(0, 80) || "unnamed region";
      const module = String(body?.module ?? "skin").slice(0, 20);
      const raw = await callGemini(geminiKey, `${SURFACE_PROMPT}\n\nregion: ${region}\nmodule: ${module}`, images.slice(0, 1), 3072);
      const parsed = extractJson(raw);
      if (!parsed?.observations) return json({ error: "that photograph could not be read. move closer, in even light." }, 502, cors);
      return json({ observations: parsed.observations, summary: parsed.summary ?? "", limits: parsed.limits ?? "" }, 200, cors);
    }

    if (action === "labs.read") {
      const doc = body?.document;
      const mime = typeof doc?.mime === "string" ? doc.mime : "";
      const b64 = typeof doc?.b64 === "string" ? doc.b64 : "";
      if (!b64 || b64.length < 64) return json({ error: "no image or pdf was supplied." }, 400, cors);
      if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(mime)) {
        return json({ error: "that file type is not supported — send a jpeg, png, webp or pdf." }, 400, cors);
      }
      if (b64.length * 0.75 > MAX_LABS_DOC_BYTES) {
        return json({ error: "that file is too large. the room shrinks images before sending — try a smaller export or a single page." }, 413, cors);
      }
      if (!geminiKey) {
        return json(
          { error: "reading a lab document needs a vision key. add your own model key in settings, and this runs on your key alone." },
          402,
          cors,
        );
      }
      const raw = await callGemini(geminiKey, LABS_PROMPT, [{ mime, b64 }], 3072);
      const parsed = extractJson(raw);
      if (!parsed?.values) return json({ error: "that document could not be read into values. try a clearer photo or a single page." }, 502, cors);
      const values = Array.isArray(parsed.values)
        ? parsed.values
            .slice(0, 60)
            .map((v: any) => ({
              key: typeof v?.key === "string" ? v.key.slice(0, 60) : "",
              label: typeof v?.label === "string" ? v.label.slice(0, 120) : "",
              value: Number(v?.value),
              unit: typeof v?.unit === "string" ? v.unit.slice(0, 20) : undefined,
              refLow: Number.isFinite(Number(v?.refLow)) ? Number(v.refLow) : undefined,
              refHigh: Number.isFinite(Number(v?.refHigh)) ? Number(v.refHigh) : undefined,
              collectedAt: typeof v?.collectedAt === "string" ? v.collectedAt.slice(0, 40) : undefined,
            }))
            .filter((v: any) => v.key && Number.isFinite(v.value))
        : [];
      const unreadable = Array.isArray(parsed.unreadable) ? parsed.unreadable.slice(0, 20).map((u: any) => String(u).slice(0, 200)) : [];
      return json({ values, unreadable }, 200, cors);
    }

    if (action === "assist") {
      const question = String(body?.question ?? "").slice(0, 4000).trim();
      const context = String(body?.context ?? "").slice(0, 24_000);
      if (!question) return json({ error: "no question was asked." }, 400, cors);
      const system = `${SAFETY}\nthe person's own record, as held on their device:\n${context || "(the record is empty)"}`;
      const user = `${question}\n\nanswer in plain sentences. if this touches something that needs a clinician, say that first.`;

      if (byokCfg) {
        const raw = await callByokJson(byokCfg, system, `${user}\n\nreturn json: {"reply":"..."}`, { jsonMode: true, maxOutputTokens: 2048 });
        const parsed = extractJson(raw);
        return json({ reply: parsed?.reply ?? raw.slice(0, 4000) }, 200, cors);
      }
      if (!geminiKey) return json({ error: "no model key is available for this account." }, 402, cors);
      const raw = await callGemini(geminiKey, `${system}\n\n${user}\n\nSTRICT JSON: {"reply":"..."}`, [], 2048);
      const parsed = extractJson(raw);
      return json({ reply: parsed?.reply ?? raw.slice(0, 4000) }, 200, cors);
    }

    return json({ error: "unknown action" }, 400, cors);
  } catch (e) {
    const upstream = (e as { upstreamStatus?: number })?.upstreamStatus ?? 0;
    const message = e instanceof Error ? e.message : "the request failed.";
    // A provider rate limit is retryable and the client knows how to wait it
    // out; anything else is reported as it happened.
    if (upstream === 429) {
      return json({ error: "RATE_LIMITED", message, retryAfterMs: 20_000 }, 429, cors);
    }
    return json({ error: message, message }, upstream === 401 || upstream === 403 ? 402 : 502, cors);
  }
});
