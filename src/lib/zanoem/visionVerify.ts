// ZANOEM Vision Verifier
// ──────────────────────
// Captures a PNG screenshot of the live preview iframe and asks ZANOEM
// (via zali-chat / Gemini vision) whether the rendered UI actually matches
// the user's most recent build intent. If it doesn't, it returns a
// suggested follow-up prompt that can be fed straight back into the
// autopilot loop so ZANOEM auto-fixes the UI without the human re-asking.
//
// Runs entirely client-side. Best-effort: any network/canvas failure is
// swallowed and reported as { matches: true } so it never blocks the IDE.

import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";

export interface VisionVerdict {
  matches: boolean;
  confidence: number;          // 0..1
  mismatches: string[];        // short bullet list of what's wrong
  suggestedFixPrompt: string;  // ready-to-send autopilot reply, "" when matches
  rawText: string;             // full assistant text (for the decision log)
  screenshotDataUrl?: string;  // base64 PNG (kept small: 800x500 max)
}

const EMPTY_OK: VisionVerdict = {
  matches: true, confidence: 1, mismatches: [], suggestedFixPrompt: "", rawText: "",
};

/** Capture the preview iframe's BODY (rendered DOM) as a PNG data URL. */
export async function captureIframePng(iframe: HTMLIFrameElement | null): Promise<string | null> {
  if (!iframe) return null;
  try {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return null;
    // html2canvas on the iframe's body works because the iframe is same-origin (srcDoc).
    const canvas = await html2canvas(doc.body, {
      backgroundColor: "#ffffff",
      width: Math.min(doc.body.scrollWidth || 800, 1280),
      height: Math.min(doc.body.scrollHeight || 600, 1600),
      scale: 1,
      logging: false,
      useCORS: true,
      allowTaint: true,
    });
    // Down-rez to keep payload small.
    const target = document.createElement("canvas");
    const maxW = 800, maxH = 500;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
    target.width = Math.max(1, Math.floor(canvas.width * scale));
    target.height = Math.max(1, Math.floor(canvas.height * scale));
    target.getContext("2d")?.drawImage(canvas, 0, 0, target.width, target.height);
    return target.toDataURL("image/png");
  } catch (e) {
    console.warn("[zanoem-vision] capture failed", e);
    return null;
  }
}

interface VerifyInput {
  intent: string;          // last user/autopilot prompt that drove the build
  recentAssistant: string; // ZANOEM's last response (what it CLAIMS it built)
  iframe: HTMLIFrameElement | null;
}

/**
 * Ask ZANOEM (Gemini vision via zali-chat) to compare the rendered preview
 * to what was supposed to be built. Returns a fix prompt if the UI is wrong.
 */
export async function verifyUiMatchesIntent({ intent, recentAssistant, iframe }: VerifyInput): Promise<VisionVerdict> {
  const png = await captureIframePng(iframe);
  if (!png) return EMPTY_OK;

  const systemPrompt = [
    "You are ZANOEM Vision Auditor. You are given:",
    "  (1) The user's most recent BUILD INTENT (what they asked to be built).",
    "  (2) A summary of what the assistant CLAIMED it built.",
    "  (3) A screenshot of the actual rendered UI.",
    "",
    "Your job: decide whether the rendered UI faithfully delivers on the intent.",
    "Be strict. Common failures: blank page, only the wrong component visible,",
    "buttons missing, layout broken, wrong colors/theme, copy mismatched, the",
    "page rendered something completely unrelated.",
    "",
    "Respond ONLY with a single JSON object, no prose, no code fence:",
    '{ "matches": boolean, "confidence": 0..1,',
    '  "mismatches": ["short bullet", ...],',
    '  "fix_prompt": "next instruction to send back to ZANOEM so it auto-fixes the UI" }',
    "If `matches` is true, set `fix_prompt` to an empty string.",
  ].join("\n");

  const userPayload = [
    "BUILD INTENT:",
    intent.slice(0, 4000),
    "",
    "ASSISTANT SUMMARY:",
    recentAssistant.slice(0, 4000),
    "",
    "Now look at the attached screenshot of the rendered preview and decide.",
  ].join("\n");

  // 30s wall-clock timeout — vision audit must never wedge the IDE.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zali-chat`;
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess?.session?.access_token;
    if (!accessToken) {
      // No session → do NOT fall back to the anon key. Silently skip.
      clearTimeout(timeoutId);
      return { ...EMPTY_OK, screenshotDataUrl: png };
    }
    const resp = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPayload },
              { type: "image_url", image_url: { url: png } },
            ],
          },
        ],
        mode: "design",
        projectContext: { name: "ZANOEM Vision Audit", designType: "ui-audit", phase: "verification" },
      }),
    });
    if (!resp.ok || !resp.body) { clearTimeout(timeoutId); return { ...EMPTY_OK, screenshotDataUrl: png }; }

    // Drain SSE stream into a single text blob.
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", out = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) out += delta;
        } catch { /* skip */ }
      }
    }

    // Triple-fallback JSON parse.
    let json: any = null;
    try { json = JSON.parse(out); } catch { /* try fenced */ }
    if (!json) {
      const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(out);
      if (fence) { try { json = JSON.parse(fence[1]); } catch { /* try braces */ } }
    }
    if (!json) {
      const braced = /\{[\s\S]*\}/.exec(out);
      if (braced) { try { json = JSON.parse(braced[0]); } catch { /* give up */ } }
    }
    if (!json || typeof json !== "object") return { ...EMPTY_OK, rawText: out, screenshotDataUrl: png };

    const matches = !!json.matches;
    const fixPrompt = matches ? "" : String(json.fix_prompt || "").trim();
    return {
      matches,
      confidence: typeof json.confidence === "number" ? Math.max(0, Math.min(1, json.confidence)) : 0.5,
      mismatches: Array.isArray(json.mismatches) ? json.mismatches.map((s: any) => String(s).slice(0, 240)).slice(0, 8) : [],
      suggestedFixPrompt: fixPrompt
        ? [
            "[ZANOEM VISION AUDIT — UI does not match build intent]",
            "",
            "Mismatches detected:",
            ...(Array.isArray(json.mismatches) ? json.mismatches.map((m: any) => `  - ${m}`) : []),
            "",
            "Auto-fix instruction:",
            fixPrompt,
            "",
            "Decide on my behalf. Edit the necessary files so the rendered UI actually delivers the original intent. Do not ask me anything.",
          ].join("\n")
        : "",
      rawText: out,
      screenshotDataUrl: png,
    };
  } catch (e) {
    console.warn("[zanoem-vision] verify failed", e);
    return { ...EMPTY_OK, screenshotDataUrl: png };
  }
}
