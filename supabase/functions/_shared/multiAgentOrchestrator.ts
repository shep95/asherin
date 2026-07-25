// Multi-Agent Orchestrator — shared runner used by asherin-free-chat and asher-ai.
// Trigger prefixes: /agents, /orchestrate, "run agents:" (case-insensitive) on last user turn.
// Pipeline: Planner → Executor (tools + reasoning) → Critic (1 corrective replan) → Synthesizer.
// LLM adapter is injected so each surface keeps its own provider/key story.

export type OrchestratorMessage = { role: "system" | "user" | "assistant"; content: string };
export type LLMCall = (messages: OrchestratorMessage[]) => Promise<string>;

export interface OrchestratorOptions {
  goal: string;
  callLLM: LLMCall;
  maxSteps?: number;   // safety cap (default 6)
  timeoutMs?: number;  // per LLM/tool call (default 25s)
}

export interface OrchestratorResult {
  transcript: string;      // markdown, safe to render or stream
  finalAnswer: string;     // synthesizer output only
  steps: ExecutedStep[];   // structured trace
}

interface PlanStep {
  id: string;
  goal: string;
  tool?: string;
  tool_input?: Record<string, unknown>;
}
interface ExecutedStep extends PlanStep {
  output: string;
  ok: boolean;
  ms: number;
}

// ── Trigger detection ────────────────────────────────────────────────────
const TRIGGER_RE = /^\s*(?:\/agents|\/orchestrate|run\s+agents:)\s*/i;
export function detectOrchestratorTrigger(text: string): string | null {
  if (!text) return null;
  const m = text.match(TRIGGER_RE);
  if (!m) return null;
  const goal = text.slice(m[0].length).trim();
  return goal.length ? goal : null;
}

// ── Tool registry ────────────────────────────────────────────────────────
type Tool = {
  name: string;
  description: string;
  schema: string; // JSON-ish shape hint shown to the planner
  run: (input: any, mem: Map<string, string>) => Promise<string>;
};

const TOOLS: Record<string, Tool> = {
  web_search: {
    name: "web_search",
    description: "Search the public web. Returns top result titles + URLs + snippets.",
    schema: `{ "query": "string" }`,
    run: async (input) => {
      const q = String(input?.query || "").trim();
      if (!q) return "web_search: empty query";
      // DuckDuckGo HTML lite — no key, robust.
      const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
      const resp = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 AsherinOrchestrator" } });
      if (!resp.ok) return `web_search: HTTP ${resp.status}`;
      const html = await resp.text();
      const results: string[] = [];
      const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      let n = 0;
      while ((m = re.exec(html)) && n < 5) {
        const link = decodeURIComponent(m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0]);
        const title = stripTags(m[2]);
        const snip = stripTags(m[3]).replace(/\s+/g, " ").slice(0, 240);
        results.push(`${n + 1}. ${title}\n   ${link}\n   ${snip}`);
        n++;
      }
      return results.length ? results.join("\n") : "web_search: no results";
    },
  },
  calc: {
    name: "calc",
    description: "Evaluate a pure numeric expression (+ - * / % ** parentheses).",
    schema: `{ "expression": "string" }`,
    run: async (input) => {
      const expr = String(input?.expression || "").trim();
      if (!/^[-+*/%().\d\s*e]+$/i.test(expr)) return "calc: expression contains disallowed characters";
      try {
        // eslint-disable-next-line no-new-func
        const val = Function(`"use strict"; return (${expr});`)();
        return `calc: ${expr} = ${val}`;
      } catch (e) {
        return `calc: error ${(e as Error).message}`;
      }
    },
  },
  memory_set: {
    name: "memory_set",
    description: "Store a value in scratch memory for later steps.",
    schema: `{ "key": "string", "value": "string" }`,
    run: async (input, mem) => {
      const k = String(input?.key || "");
      const v = String(input?.value || "");
      if (!k) return "memory_set: missing key";
      mem.set(k, v);
      return `memory_set: stored ${k} (${v.length} chars)`;
    },
  },
  memory_get: {
    name: "memory_get",
    description: "Read a value from scratch memory.",
    schema: `{ "key": "string" }`,
    run: async (input, mem) => {
      const k = String(input?.key || "");
      return mem.has(k) ? `memory_get: ${k} = ${mem.get(k)}` : `memory_get: no value for ${k}`;
    },
  },
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

// ── Prompts ──────────────────────────────────────────────────────────────
function toolsSection(): string {
  return Object.values(TOOLS)
    .map((t) => `- ${t.name} — ${t.description}\n    input: ${t.schema}`)
    .join("\n");
}

const PLANNER_SYS = `You are the PLANNER of a multi-agent system. Produce a MINIMAL ordered plan to solve the user's goal. Reply with ONLY valid JSON, no prose, no code fence:
{"steps":[{"id":"s1","goal":"…","tool":"web_search","tool_input":{"query":"…"}}, {"id":"s2","goal":"reason about results","tool":null,"tool_input":null}]}
Rules:
- 1 to 5 steps. Prefer fewer.
- tool must be one of the registry names or null (null = pure reasoning step).
- If the goal needs no tools, emit a single reasoning step.
Available tools:
${toolsSection()}`;

const CRITIC_SYS = `You are the CRITIC. Review the plan + step outputs against the user's goal. Reply with ONLY valid JSON, no prose:
{"verdict":"approve"|"revise","reason":"…","corrective_step":{"id":"c1","goal":"…","tool":null|"<toolname>","tool_input":null|{…}}}
If verdict is "approve", corrective_step must be null. Only ONE corrective step is allowed.`;

const SYNTH_SYS = `You are the SYNTHESIZER. Using the user's goal and the executed transcript, write the final answer for the user in clean markdown. Be surgical and grounded — cite tool outputs where they informed the answer. Do NOT repeat the raw JSON plan. Do NOT mention "orchestrator" or "planner" internals in the final answer.`;

// ── JSON extraction (models sometimes wrap in fences) ────────────────────
function extractJson<T = any>(raw: string): T | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)) as T; } catch { return null; }
}

// ── Orchestrator ─────────────────────────────────────────────────────────
export async function runOrchestrator(opts: OrchestratorOptions): Promise<OrchestratorResult> {
  const { goal, callLLM } = opts;
  const maxSteps = Math.min(Math.max(opts.maxSteps ?? 6, 1), 8);
  const mem = new Map<string, string>();
  const executed: ExecutedStep[] = [];
  const traceLines: string[] = [`## ◈ Agent Trace`, ``, `**Goal:** ${goal}`, ``];

  // 1. Planner
  const planRaw = await callLLM([
    { role: "system", content: PLANNER_SYS },
    { role: "user", content: goal },
  ]);
  const plan = extractJson<{ steps: PlanStep[] }>(planRaw);
  const steps: PlanStep[] = (plan?.steps || []).slice(0, maxSteps);
  if (!steps.length) {
    steps.push({ id: "s1", goal, tool: undefined, tool_input: undefined });
  }
  traceLines.push(`### Plan (${steps.length} steps)`);
  steps.forEach((s, i) => traceLines.push(`${i + 1}. **${s.id}** — ${s.goal}${s.tool ? ` _(tool: ${s.tool})_` : ""}`));
  traceLines.push(``);

  // 2. Executor
  traceLines.push(`### Execution`);
  for (const step of steps) {
    const t0 = Date.now();
    let out = "";
    let ok = true;
    try {
      if (step.tool && TOOLS[step.tool]) {
        out = await TOOLS[step.tool].run(step.tool_input || {}, mem);
      } else {
        // Reasoning step
        const ctx = executed.map((e) => `- ${e.id} (${e.tool ?? "reason"}): ${e.output.slice(0, 400)}`).join("\n") || "(no prior steps)";
        out = await callLLM([
          { role: "system", content: "You are an execution agent. Complete the current step using the transcript. Be concise (≤200 words)." },
          { role: "user", content: `Overall goal: ${goal}\n\nTranscript so far:\n${ctx}\n\nCurrent step: ${step.goal}` },
        ]);
      }
    } catch (e) {
      ok = false;
      out = `error: ${(e as Error).message}`;
    }
    const ms = Date.now() - t0;
    executed.push({ ...step, output: out, ok, ms });
    traceLines.push(`- **${step.id}** ${ok ? "✓" : "✗"} _(${ms}ms)_ — ${step.tool ?? "reason"}\n  \`\`\`\n${out.slice(0, 800)}\n\`\`\``);
  }

  // 3. Critic (one corrective step allowed)
  const criticRaw = await callLLM([
    { role: "system", content: CRITIC_SYS },
    { role: "user", content: `Goal: ${goal}\n\nExecuted steps:\n${JSON.stringify(executed.map(e => ({id:e.id, goal:e.goal, tool:e.tool, output:e.output.slice(0,600)})), null, 2)}` },
  ]);
  const critique = extractJson<{ verdict: string; reason: string; corrective_step: PlanStep | null }>(criticRaw);
  traceLines.push(``, `### Critic`, `- Verdict: **${critique?.verdict ?? "unknown"}** — ${critique?.reason ?? "(no reason)"}`);
  if (critique?.verdict === "revise" && critique.corrective_step) {
    const cs = critique.corrective_step;
    const t0 = Date.now();
    let out = "";
    let ok = true;
    try {
      if (cs.tool && TOOLS[cs.tool]) {
        out = await TOOLS[cs.tool].run(cs.tool_input || {}, mem);
      } else {
        const ctx = executed.map((e) => `- ${e.id}: ${e.output.slice(0, 300)}`).join("\n");
        out = await callLLM([
          { role: "system", content: "You are a corrective agent. Address the critic's concern in one focused pass." },
          { role: "user", content: `Goal: ${goal}\nCritic reason: ${critique.reason}\nPrior transcript:\n${ctx}\n\nCorrective step: ${cs.goal}` },
        ]);
      }
    } catch (e) { ok = false; out = `error: ${(e as Error).message}`; }
    const ms = Date.now() - t0;
    executed.push({ ...cs, output: out, ok, ms });
    traceLines.push(`- **${cs.id}** ${ok ? "✓" : "✗"} _(corrective, ${ms}ms)_\n  \`\`\`\n${out.slice(0, 800)}\n\`\`\``);
  }

  // 4. Synthesizer
  const finalAnswer = await callLLM([
    { role: "system", content: SYNTH_SYS },
    { role: "user", content: `User goal: ${goal}\n\nExecuted transcript:\n${executed.map(e => `[${e.id} · ${e.tool ?? "reason"}] ${e.output}`).join("\n\n")}` },
  ]);

  const transcript = `${finalAnswer.trim()}\n\n---\n<details><summary>◈ Show agent trace (${executed.length} steps)</summary>\n\n${traceLines.join("\n")}\n\n</details>`;
  return { transcript, finalAnswer, steps: executed };
}

// ── SSE helper: wrap a finished string in OpenAI-compat delta chunks ─────
export function stringToOpenAiSse(text: string, chunkSize = 48): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const pieces: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) pieces.push(text.slice(i, i + chunkSize));
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < pieces.length) {
        const payload = { choices: [{ delta: { content: pieces[i++] }, index: 0 }] };
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
      } else {
        controller.enqueue(enc.encode(`data: [DONE]\n\n`));
        controller.close();
      }
    },
  });
}
