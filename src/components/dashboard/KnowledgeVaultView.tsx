import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Link as LinkIcon, Trash2, Database, Sparkles, Loader2, Wand2, Send } from "lucide-react";
import { toast } from "sonner";

type VaultSource = {
  id: string;
  name: string;
  source_type: "text" | "file" | "api";
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

  // Natural-language agent
  type AgentTurn = { role: "user" | "aureon"; text: string; intent?: string; matches?: { sourceName: string; similarity: number; content: string }[] };
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

  const ingest = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("vault-ingest", { body: payload });
      if (error) throw error;
      const r = data as { chunks?: number; name?: string } | null;
      toast.success(`Indexed “${r?.name ?? "source"}” — ${r?.chunks ?? 0} chunks embedded`);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Ingest failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const handleText = async () => {
    if (!textName.trim() || !textBody.trim()) return toast.error("Name and content required");
    await ingest({ sourceType: "text", name: textName.trim(), content: textBody });
    setTextName(""); setTextBody("");
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    await ingest({ sourceType: "file", name: file.name, content: text });
  };

  const handleApi = async () => {
    if (!apiName.trim() || !apiUrl.trim()) return toast.error("Name and URL required");
    let apiHeadersObj: Record<string, string> | undefined;
    if (apiHeaders.trim()) {
      try { apiHeadersObj = JSON.parse(apiHeaders); } catch { return toast.error("Headers must be valid JSON"); }
    }
    await ingest({ sourceType: "api", name: apiName.trim(), apiUrl: apiUrl.trim(), apiHeaders: apiHeadersObj });
    setApiName(""); setApiUrl(""); setApiHeaders("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("aureon_vault_sources").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Source removed"); refresh(); }
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
      setAgentLog((l) => [...l, { role: "aureon", text, intent: r?.intent, matches: r?.matches }]);
      if (r?.intent === "WRITE" || r?.intent === "FETCH_WRITE") await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAgentLog((l) => [...l, { role: "aureon", text: `Agent error: ${msg}` }]);
      toast.error(msg);
    } finally {
      setAgentBusy(false);
    }
  };

  return (
    <div className="relative h-full overflow-y-auto">
      {/* Ambient glass wash — matches the app's dashboard aesthetic (grey → transparent) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative p-6 space-y-6">
        <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/40 backdrop-blur-xl px-5 py-4 shadow-[0_8px_32px_hsl(var(--background)/0.4)]">
          <Database className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge Vault</h1>
            <p className="text-sm text-muted-foreground">
              Private RAG — upload files, paste text, or connect APIs. asherin retrieves matching chunks during every chat automatically.
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto bg-background/60 backdrop-blur border-border/40">Pro · $399/mo</Badge>
        </div>

        {/* ─── Natural-language agent (WRITE / FETCH+WRITE / QUERY) ─── */}
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
            <TabsList className="bg-background/40 backdrop-blur border border-border/40">
              <TabsTrigger value="text"><FileText className="h-4 w-4 mr-1" /> Text</TabsTrigger>
              <TabsTrigger value="file"><Upload className="h-4 w-4 mr-1" /> File</TabsTrigger>
              <TabsTrigger value="api"><LinkIcon className="h-4 w-4 mr-1" /> API</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-3 pt-3">
              <Input placeholder="Name" value={textName} onChange={(e) => setTextName(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Textarea placeholder="Paste any text — notes, transcripts, manuals…" rows={6} value={textBody} onChange={(e) => setTextBody(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Button onClick={handleText} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Embed & Index
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

            <TabsContent value="api" className="space-y-3 pt-3">
              <Input placeholder="Source name" value={apiName} onChange={(e) => setApiName(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Input placeholder="https://api.example.com/endpoint" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Textarea placeholder='Optional headers as JSON, e.g. {"Authorization":"Bearer …"}' rows={3} value={apiHeaders} onChange={(e) => setApiHeaders(e.target.value)} className="bg-background/40 backdrop-blur border-border/40" />
              <Button onClick={handleApi} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                Pull & Index
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
                      {s.chunk_count ?? 0} chunks · {s.status}
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
