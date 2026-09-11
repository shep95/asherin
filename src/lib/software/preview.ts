// preview document for a software artifact.
//
// It reuses the existing artifact browser sandbox — client-side execution in a
// cross-origin frame with scripts only, no session access, no package install,
// no network by default. On top of that it adds one thing: the frame can be
// asked a question about its own dom so a saved check has a real answer.

import { SANDBOX_ATTR, SANDBOX_LIMITS, buildSrcDoc } from "@/lib/artifact/runtimes/browserSandbox";
import type { ArtifactFile } from "./types";

export { SANDBOX_ATTR, SANDBOX_LIMITS };

const PROBE_SCRIPT = `<script>
window.addEventListener("message", function (ev) {
  var d = ev.data;
  if (!d || d.__probe !== 1) return;
  var out = [];
  (d.queries || []).forEach(function (q) {
    try {
      if (q.kind === "dom_selector_exists") {
        out.push({ checkId: q.id, ok: !!document.querySelector(q.value), detail: q.value });
      } else if (q.kind === "dom_text_contains") {
        var t = (document.body && (document.body.innerText || document.body.textContent)) || "";
        out.push({ checkId: q.id, ok: t.indexOf(q.value) >= 0, detail: q.value });
      } else {
        out.push({ checkId: q.id, ok: null, detail: "this artifact cannot answer that kind of question" });
      }
    } catch (e) {
      out.push({ checkId: q.id, ok: false, detail: String((e && e.message) || e) });
    }
  });
  parent.postMessage({ __artifact: 1, channel: "probe", results: out }, "*");
});
</script>`;

export interface PreviewBuild {
  ok: boolean;
  srcDoc: string;
  errors: string[];
  refusedDependencies: string[];
  /** why nothing can be run, when that is the case. */
  unavailableReason: string | null;
}

const RUNNABLE = /\.(html|css|m?jsx?)$/;

export function buildPreview(files: ArtifactFile[]): PreviewBuild {
  const runnable = files.filter((f) => RUNNABLE.test(f.path));
  if (!files.length) {
    return {
      ok: false,
      srcDoc: "",
      errors: [],
      refusedDependencies: [],
      unavailableReason: "this artifact has no files yet — add an html, css or javascript file to run it",
    };
  }
  if (!runnable.length) {
    return {
      ok: false,
      srcDoc: "",
      errors: [],
      refusedDependencies: [],
      unavailableReason:
        "the sandbox runs html, css and plain javascript only — none of these files can be executed in the browser",
    };
  }

  const built = buildSrcDoc(
    runnable.map((f) => ({ path: f.path, content: f.content })),
  );
  const srcDoc = built.srcDoc ? built.srcDoc.replace(/<\/body>/i, `${PROBE_SCRIPT}\n</body>`) : "";
  return {
    ok: built.ok && !!srcDoc,
    srcDoc,
    errors: built.errors,
    refusedDependencies: built.refusedDependencies,
    unavailableReason: built.ok ? null : built.errors[0] ?? "this artifact could not be prepared for the sandbox",
  };
}

export interface ProbeReply {
  checkId: string;
  ok: boolean | null;
  detail?: string;
}

/** Reads a probe reply out of a postMessage payload. Anything else is ignored. */
export function readProbeReply(data: unknown): ProbeReply[] | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.__artifact !== 1 || d.channel !== "probe" || !Array.isArray(d.results)) return null;
  return (d.results as Array<Record<string, unknown>>).map((r) => ({
    checkId: String(r.checkId ?? ""),
    ok: r.ok === null || r.ok === undefined ? null : Boolean(r.ok),
    detail: r.detail ? String(r.detail) : undefined,
  }));
}
