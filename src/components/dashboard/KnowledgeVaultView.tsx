import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Link as LinkIcon, Trash2, Database, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

type VaultSource = {
  id: string;
  title: string;
  kind: "text" | "file" | "api";
  chunk_count: number | null;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export default function KnowledgeVaultView() {
  const [sources, setSources] = useState<VaultSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // text input
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");

  // api input
  const [apiTitle, setApiTitle] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiHeaders, setApiHeaders] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("aureon_vault_sources")
      .select("id,title,kind,chunk_count,status,created_at,metadata")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setSources((data as VaultSource[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const ingest = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("vault-ingest", { body: payload });
      if (error) throw error;
      const inserted = (data as { chunks?: number; title?: string } | null);
      toast.success(`Indexed “${inserted?.title ?? "source"}” — ${inserted?.chunks ?? 0} chunks embedded`);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Ingest failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const handleText = async () => {
    if (!textTitle.trim() || !textBody.trim()) return toast.error("Title and content required");
    await ingest({ kind: "text", title: textTitle.trim(), content: textBody });
    setTextTitle(""); setTextBody("");
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    await ingest({ kind: "file", title: file.name, content: text, metadata: { size: file.size, type: file.type } });
  };

  const handleApi = async () => {
    if (!apiTitle.trim() || !apiUrl.trim()) return toast.error("Title and URL required");
    let headers: Record<string, string> | undefined;
    if (apiHeaders.trim()) {
      try { headers = JSON.parse(apiHeaders); } catch { return toast.error("Headers must be valid JSON"); }
    }
    await ingest({ kind: "api", title: apiTitle.trim(), url: apiUrl.trim(), headers });
    setApiTitle(""); setApiUrl(""); setApiHeaders("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("aureon_vault_sources").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Source removed"); refresh(); }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Knowledge Vault</h1>
          <p className="text-sm text-muted-foreground">
            Private RAG — upload files, paste text, or connect APIs. Aureon retrieves matching chunks during every chat automatically.
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">Pro · $399/mo</Badge>
      </div>

      <Card className="p-4">
        <Tabs defaultValue="text">
          <TabsList>
            <TabsTrigger value="text"><FileText className="h-4 w-4 mr-1" /> Text</TabsTrigger>
            <TabsTrigger value="file"><Upload className="h-4 w-4 mr-1" /> File</TabsTrigger>
            <TabsTrigger value="api"><LinkIcon className="h-4 w-4 mr-1" /> API</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-3 pt-3">
            <Input placeholder="Title" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} />
            <Textarea placeholder="Paste any text — notes, transcripts, manuals…" rows={6} value={textBody} onChange={(e) => setTextBody(e.target.value)} />
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
            />
            <p className="text-xs text-muted-foreground">Text-based formats only (.txt, .md, .csv, .json, .log, .html, .xml, .yaml).</p>
          </TabsContent>

          <TabsContent value="api" className="space-y-3 pt-3">
            <Input placeholder="Source title" value={apiTitle} onChange={(e) => setApiTitle(e.target.value)} />
            <Input placeholder="https://api.example.com/endpoint" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
            <Textarea placeholder='Optional headers as JSON, e.g. {"Authorization":"Bearer …"}' rows={3} value={apiHeaders} onChange={(e) => setApiHeaders(e.target.value)} />
            <Button onClick={handleApi} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2" />}
              Pull & Index
            </Button>
          </TabsContent>
        </Tabs>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Indexed Sources</h2>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>Refresh</Button>
        </div>
        {loading ? (
          <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…</div>
        ) : sources.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">No sources yet. Add one above and Aureon will start citing it.</div>
        ) : (
          <div className="divide-y divide-border">
            {sources.map((s) => (
              <div key={s.id} className="py-3 flex items-center gap-3">
                <Badge variant="outline" className="uppercase text-[10px]">{s.kind}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.chunk_count ?? 0} chunks · {s.status} · {new Date(s.created_at).toLocaleString()}
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
  );
}
