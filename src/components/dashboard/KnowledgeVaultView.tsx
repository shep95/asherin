import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, FileText, Link as LinkIcon, Trash2, Database, Sparkles, Loader2, Wand2, Send,
  Search, Youtube, Globe, AlertTriangle, PenSquare, ChevronDown, ChevronRight, Lock, Network,
} from "lucide-react";
import { toast } from "sonner";
import {
  ingestVault, retrieveVault, getVaultMode, setVaultMode, highlightSegments,
  type VaultMode, type VaultPassage, type RetrieveResult,
} from "@/lib/knowledgeVault/vault";
import { queueBoardDrop } from "@/lib/whiteboard/boardInbox";

type VaultSource = {
  id: string;
  name: string;
  source_type: "text" | "file" | "api" | "url" | "youtube";
  chunk_count: number | null;
  status: string;
  created_at: string;
  error_message: string | null;
};

export default function KnowledgeVaultView() {
  const [sources, setSources] = useState<VaultSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [textName, setTextName] = useState("");
  const [textBody, setTextBody] = useState("");

  const [apiName, setApiName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiHeaders, setApiHeaders] = useState("");

  const [webName, setWebName] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [ytName, setYtName] = useState("");
  const [ytUrl, setYtUrl] = useState("");

  // Retrieval console — numbered cites, jump-to passage, contradiction pairs.
  const [mode, setMode] = useState<VaultMode>(getVaultMode());
  const [query, setQuery] = useState("");
  const [retrieving, setRetrieving] = useState(false);
  const [result, setResult] = useState<RetrieveResult | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [openCite, setOpenCite] = useState<number | null>(null);

  // Natural-language agent
  type AgentTurn = { role: "user" | "asherin"; text: string; intent?: string; matches?: { sourceName: string; similarity: number; content: string }[] };
  const [agentCmd, setAgentCmd] = useState("");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentLog, setAgentLog] = useState<AgentTurn[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("aureon_vault_sources")
      .select("id,name,source_type,chunk_count,status,created_at,error_message")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setSources(((data as unknown) as VaultSource[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const ingest = async (payload: Parameters<typeof ingestVault>[0]) => {
    setBusy(true);
    try {
      const r = await ingestVault(payload);
      if (!r.ok) { toast.error(`Ingest failed: ${r.error}`); return false; }
      toast.success(`Indexed “${payload.name}” — ${r.chunkCount ?? 0} passages embedded`);
      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const handleText = async () => {
    if (!textName.trim() || !textBody.trim()) return toast.error("Name and content required");
    if (await ingest({ sourceType: "text", name: textName.trim(), content: textBody })) {
      setTextName(""); setTextBody("");
    }
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    await ingest({ sourceType: "file", name: file.name, content: text });
  };

  const handleWeb = async () => {
    if (!webUrl.trim()) return toast.error("URL required");
    const name = webName.trim() || webUrl.trim().replace(/^https?:\/\//, "").slice(0, 80);
    if (await ingest({ sourceType: "url", name, url: webUrl.trim() })) {
      setWebName(""); setWebUrl("");
    }
  };

  const handleYoutube = async () => {
    if (!ytUrl.trim()) return toast.error("YouTube URL required");
    const name = ytName.trim() || "youtube transcript";
    if (await ingest({ sourceType: "youtube", name, url: ytUrl.trim() })) {
      setYtName(""); setYtUrl("");
    }
  };

  const handleApi = async () => {
    if (!apiName.trim() || !apiUrl.trim()) return toast.error("Name and URL required");
    let apiHeadersObj: Record<string, string> | undefined;
    if (apiHeaders.trim()) {
      try { apiHeadersObj = JSON.parse(apiHeaders); } catch { return toast.error("Headers must be valid JSON"); }
    }
    if (await ingest({ sourceType: "api", name: apiName.trim(), apiUrl: apiUrl.trim(), apiHeaders: apiHeadersObj })) {
      setApiName(""); setApiUrl(""); setApiHeaders("");
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("aureon_vault_sources").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Source removed"); refresh(); }
  };

  const runRetrieve = async () => {
    const q = query.trim();
    if (!q) return;
    setRetrieving(true);
    setOpenCite(null);
    const r = await retrieveVault(q, 8);
    setResult(r);
    setLastQuery(q);
    setRetrieving(false);
    if (r.error) toast.error(r.error);
    else if (!r.passages.length) toast.message("No passage in the corpus covers that.");
  };

  const changeMode = (next: VaultMode) => {
    setMode(next);
    setVaultMode(next);
    toast.success(next === "isolated"
      ? "Isolated — answers come from vault passages or say unsure."
      : "Hybrid — live web runs as a labelled second tool.");
  };

  const dropToBoard = (passages: VaultPassage[]) => {
    if (!passages.length) return;
    queueBoardDrop({
      kind: "brief",
      source: "knowledge-vault",
      title: lastQuery.slice(0, 80) || "vault notes",
      bullets: passages.slice(0, 8).map((p) => `[${p.n}] ${p.sourceName} — ${p.content.slice(0, 220)}`),
    });
    toast.success("Cited notes queued for the whiteboard.");
  };

  const runAgent = async () => {
    const cmd = agentCmd.trim();
    if (!cmd) return;
    setAgentLog((l) => [...l, { role: "user", text: cmd }]);
    setAgentCmd("");
    setAgentBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("vault-agent", { body: { command: cmd } });
      if (error) throw error;
      const r = data as { intent?: string; message?: string; answer?: string; matches?: AgentTurn["matches"] };
      const text = r?.intent === "QUERY" ? (r.answer ?? r.message ?? "") : (r?.message ?? "Done.");
      setAgentLog((l) => [...l, { role: "asherin", text, intent: r?.intent, matches: r?.matches }]);
      if (r?.intent === "WRITE" || r?.intent === "FETCH_WRITE") await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAgentLog((l) => [...l, { role: "asherin", text: `Agent error: ${msg}` }]);
      toast.error(msg);
    } finally {
      setAgentBusy(false);
    }
  };

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/40 bg-background/40 backdrop-blur-xl px-5 py-4 shadow-[0_8px_32px_hsl(var(--background)/0.4)]">
          <Database className="h-6 w-6 text-primary" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge Vault</h1>
            <p className="text-sm text-muted-foreground">
              Private document RAG — files, pasted text, web pages, YouTube transcripts and APIs. Every answer points at the passage it came from.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-xl border border-border/40 bg-background/40 backdrop-blur p-1">
              <button
                type="button"
                onClick={() => changeMode("isolated")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${mode === "isolated" ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Lock className="h-3.5 w-3.5" /> Isolated
              </button>
              <button
                type="button"
                onClick={() => changeMode("hybrid")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${mode === "hybrid" ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Network className="h-3.5 w-3.5" /> Hybrid
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground -mt-3 px-1">
          {mode === "isolated"
            ? "Isolated: chat answers only from vault passages. If the corpus does not cover it, asherin says unsure instead of reaching for the web."
            : "Hybrid: the vault answers first; live web runs as an explicit second tool and is labelled live-web, never blended into a vault citation."}
        </p>

        {/* ─── Retrieval console ─── */}
        <Card className="p-4 border-border/40 bg-background/30 backdrop-blur-xl shadow-[0_8px_32px_hsl(var(--background)/0.35)]">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-primary" />
            <h2 className="font-medium tracking-tight">Retrieve</h2>
            <Badge variant="outline" className="text-[10px] border-border/40 bg-background/40 backdrop-blur">
              numbered cites · click to open the passage
            </Badge>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ask the corpus — what does my documentation say about …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !retrieving) { e.preventDefault(); runRetrieve(); } }}
              disabled={retrieving}
              className="bg-background/40 backdrop-blur border-border/40"
            />
            <Button onClick={runRetrieve} disabled={retrieving || !query.trim()}>
              {retrieving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {result && (
            <div className="mt-4 space-y-3">
              {result.contradictions.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 text-sm text-amber-300/90">
                    <AlertTriangle className="h-4 w-4" /> Corpus disagrees with itself
                  </div>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {result.contradictions.map((c, i) => (
                      <li key={i}>[{c.a}] vs [{c.b}] — {c.reason}. Both are cited; neither is merged away.</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.passages.length === 0 ? (
                <div className="rounded-xl border border-border/40 bg-background/30 p-4 text-sm text-muted-foreground">
                  No passage in this corpus covers that. In isolated mode asherin will say unsure rather than guess.
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border/40 rounded-xl border border-border/40 bg-background/30">
                    {result.passages.map((p) => {
                      const open = openCite === p.n;
                      return (
                        <div key={p.n} className="p-3">
                          <button
                            type="button"
                            onClick={() => setOpenCite(open ? null : p.n)}
                            className="flex w-full items-center gap-2 text-left"
                          >
                            {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] text-primary">[{p.n}]</span>
                            <span className="truncate text-sm">{p.sourceName}</span>
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                              match {(p.similarity * 100).toFixed(0)}%
                            </span>
                          </button>
                          {open && (
                            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-background/50 p-3 text-[13px] leading-relaxed text-muted-foreground">
                              {highlightSegments(p.content, lastQuery).map((seg, i) =>
                                seg.hit
                                  ? <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">{seg.text}</mark>
                                  : <span key={i}>{seg.text}</span>,
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Studio-lite: one drop of the cited notes, nothing invented. */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => dropToBoard(result.passages)}>
                      <PenSquare className="h-3.5 w-3.5 mr-1.5" /> Send cited notes to whiteboard
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const md = result.passages
                          .map((p) => `[${p.n}] ${p.sourceName}\n${p.content}`)
                          .join("\n\n");
                        navigator.clipboard.writeText(`# ${lastQuery}\n\n${md}`);
                        toast.success("Cited passages copied.");
                      }}
                    >
                      Copy as cited brief
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>

        {/* ─── Natural-language agent ─── */}
        <Card className="p-4 border-border/40 bg-background/30 backdrop-blur-xl shadow-[0_8px_32px_hsl(var(--background)/0.35)]">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <h2 className="font-medium tracking-tight">Vault Agent</h2>
            <Badge variant="outline" className="ml-2 text-[10px] border-border/40 bg-background/40 backdrop-blur">
              Natural language · Auto-classifies write / fetch / query
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Try: <em>"Save this framework: …"</em> · <em>"Fetch the CoinGecko BTC price and add it"</em> · <em>"What does my trading framework say about risk?"</em>
          </p>

          {agentLog.length > 0 && (
            <div className="mb-3 max-h-72 overflow-y-auto space-y-2 rounded-lg border border-border/40 bg-background/30 backdrop-blur p-3">
              {agentLog.map((t, i) => (
                <div key={i} className={t.role === "user" ? "text-sm" : "text-sm text-muted-foreground"}>
                  <span className="font-medium text-foreground">{t.role === "user" ? "You" : "asherin"}</span>
                  {t.intent && <Badge variant="outline" className="ml-2 text-[9px] uppercase border-border/40">{t.intent}</Badge>}
                  <div className="mt-1 whitespace-pre-wrap">{t.text}</div>
                  {t.matches && t.matches.length > 0 && (
                    <div className="mt-2 text-[11px] space-y-1">
                      {t.matches.slice(0, 3).map((m, j) => (
                        <div key={j} className="truncate">
                          <span className="text-primary">[{m.sourceName}]</span> · sim {(m.similarity * 100).toFixed(0)}% · {m.content.slice(0, 140)}…
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Talk to the vault — asherin decides whether to store, fetch, or answer."
              value={agentCmd}
              onChange={(e) => setAgentCmd(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !agentBusy) { e.preventDefault(); runAgent(); } }}
              disabled={agentBusy}
              className="bg-background/40 backdrop-blur border-border/40"
            />
            <Button onClick={runAgent} disabled={agentBusy || !agentCmd.trim()}>
              {agentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>

        <Card className="p-4 border-border/40 bg-background/30 backdrop-blur-xl shadow-[0_8px_32px_hsl(var(--background)/0.35)]">
          <Tabs defaultValue="text">
            <TabsList className="bg-background/40 backdrop-blur border border-border/40 flex-wrap h-auto">
              <TabsTrigger value="text"><FileText className="h-4 w-4 mr-1" /> Text</TabsTrigger>
              <TabsTrigger value="file"><Upload className="h-4 w-4 mr-1" /> File</TabsTrigger>
              <TabsTrigger value="web"><Globe className="h-4 w-4 mr-1" /> Web page</TabsTrigger>
              <TabsTrigger value="youtube"><Youtube className="h-4 w-4 mr-1" /> YouTube</TabsTrigger>
              <TabsTrigger value="api"><LinkIcon className="h-4 w-4 mr-1" /> API</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-3 pt-3">
              <Input placeholder="Name" value={textName} onChange={(e) => setTextName(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Textarea placeholder="Paste any text — notes, transcripts, manuals…" rows={6} value={textBody} onChange={(e) => setTextBody(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Button onClick={handleText} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Embed &amp; Index
              </Button>
            </TabsContent>

            <TabsContent value="file" className="space-y-3 pt-3">
              <Input
                type="file"
                accept=".txt,.md,.csv,.json,.log,.html,.xml,.yaml,.yml"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                disabled={busy}
                className="bg-background/40 backdrop-blur border-border/40"
              />
              <p className="text-xs text-muted-foreground">Text-based formats (.txt, .md, .csv, .json, .log, .html, .xml, .yaml).</p>
            </TabsContent>

            <TabsContent value="web" className="space-y-3 pt-3">
              <Input placeholder="Name (optional)" value={webName} onChange={(e) => setWebName(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Input placeholder="https://example.com/article" value={webUrl} onChange={(e) => setWebUrl(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <p className="text-xs text-muted-foreground">The page is fetched server-side and reduced to readable prose. Private and loopback addresses are refused.</p>
              <Button onClick={handleWeb} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
                Fetch &amp; Index
              </Button>
            </TabsContent>

            <TabsContent value="youtube" className="space-y-3 pt-3">
              <Input placeholder="Name (optional)" value={ytName} onChange={(e) => setYtName(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Input placeholder="https://www.youtube.com/watch?v=…" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <p className="text-xs text-muted-foreground">Uses the caption track the video publishes. If none exists, the ingest fails plainly rather than storing an empty document.</p>
              <Button onClick={handleYoutube} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Youtube className="h-4 w-4 mr-2" />}
                Pull transcript
              </Button>
            </TabsContent>

            <TabsContent value="api" className="space-y-3 pt-3">
              <Input placeholder="Source name" value={apiName} onChange={(e) => setApiName(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Input placeholder="https://api.example.com/endpoint" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Textarea placeholder='Optional headers as JSON, e.g. {"Authorization":"Bearer …"}' rows={3} value={apiHeaders} onChange={(e) => setApiHeaders(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Button onClick={handleApi} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                Pull &amp; Index
              </Button>
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="p-4 border-border/40 bg-background/30 backdrop-blur-xl shadow-[0_8px_32px_hsl(var(--background)/0.35)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium tracking-tight">Indexed Sources</h2>
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>Refresh</Button>
          </div>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…</div>
          ) : sources.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No sources yet. Add one above and asherin will start citing it.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {sources.map((s) => (
                <div key={s.id} className="py-3 flex items-center gap-3 rounded-lg px-2 hover:bg-background/40 transition-colors">
                  <Badge variant="outline" className="uppercase text-[10px] border-border/40 bg-background/40 backdrop-blur">{s.source_type}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.chunk_count ?? 0} passages · {s.status}
                      {s.error_message ? ` · ${s.error_message}` : ""} · {new Date(s.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
