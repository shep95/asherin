import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileStack, Languages, Combine } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

interface Doc {
  id: string;
  title: string;
  lang: string;
  body: string;
  cluster?: string;
  addedAt: number;
}
interface Synthesis { question: string; answer: string; sourceIds: string[]; updatedAt: number; }

const KEY_D = (sid: string) => `azplen:docs-multi:${sid}`;
const KEY_S = (sid: string) => `azplen:synth:${sid}`;

const STOP = new Set(("the of and to in a is that for on with as by are this it be was at from or an not have but if which has all also any can their our we you i").split(" "));
const tokens = (s: string) => (s.toLowerCase().match(/[a-z][a-z']{2,}/g) || []).filter(t => !STOP.has(t));

/**
 * Multi-Document Synthesis & Clustering — light unsupervised clustering
 * on bag-of-words signature; cross-doc question answering produces
 * synthesized answers grounded in source IDs.
 */
const ClusterPanel = () => {
  const { activeSession } = useAzplenSession();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [synth, setSynth] = useState<Synthesis[]>([]);
  const [draft, setDraft] = useState({ title: "", lang: "en", body: "" });
  const [question, setQuestion] = useState("");

  useEffect(() => {
    if (!activeSession) return;
    try { setDocs(JSON.parse(localStorage.getItem(KEY_D(activeSession.id)) || "[]")); } catch {}
    try { setSynth(JSON.parse(localStorage.getItem(KEY_S(activeSession.id)) || "[]")); } catch {}
  }, [activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY_D(activeSession.id), JSON.stringify(docs)), 300);
    return () => clearTimeout(h);
  }, [docs, activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY_S(activeSession.id), JSON.stringify(synth)), 300);
    return () => clearTimeout(h);
  }, [synth, activeSession?.id]);

  // Naive clustering: assign each doc to the cluster whose dominant token it shares most
  const clustered = useMemo(() => {
    if (docs.length === 0) return docs;
    const sigs = docs.map(d => {
      const t = tokens(d.body + " " + d.title);
      const f: Record<string, number> = {};
      t.forEach(w => f[w] = (f[w] || 0) + 1);
      const top = Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";
      return { id: d.id, cluster: top };
    });
    return docs.map(d => ({ ...d, cluster: sigs.find(s => s.id === d.id)?.cluster ?? "general" }));
  }, [docs]);

  const clusters = useMemo(() => {
    const c: Record<string, Doc[]> = {};
    clustered.forEach(d => { (c[d.cluster!] ||= []).push(d); });
    return Object.entries(c).sort((a, b) => b[1].length - a[1].length);
  }, [clustered]);

  const add = () => {
    if (!draft.title.trim() || !draft.body.trim()) return;
    setDocs(p => [{ ...draft, id: crypto.randomUUID(), addedAt: Date.now() }, ...p]);
    setDraft({ title: "", lang: "en", body: "" });
  };
  const remove = (id: string) => setDocs(p => p.filter(d => d.id !== id));

  const synthesize = () => {
    if (!question.trim() || docs.length === 0) return;
    const qTokens = tokens(question);
    const scored = docs.map(d => {
      const t = tokens(d.body + " " + d.title);
      const overlap = qTokens.filter(q => t.includes(q)).length;
      return { d, overlap };
    }).filter(x => x.overlap > 0).sort((a, b) => b.overlap - a.overlap).slice(0, 5);
    if (scored.length === 0) {
      setSynth(p => [{ question: question.trim(), answer: "No documents contain terms from this question.", sourceIds: [], updatedAt: Date.now() }, ...p]);
    } else {
      const snippets = scored.map(({ d }) => {
        const sentences = d.body.split(/(?<=[.!?])\s+/).filter(Boolean);
        const best = sentences.find(s => qTokens.some(q => s.toLowerCase().includes(q))) ?? sentences[0];
        return `· [${d.title}] ${best.trim()}`;
      });
      const ans = `Synthesis across ${scored.length} source${scored.length > 1 ? "s" : ""}:\n${snippets.join("\n")}`;
      setSynth(p => [{ question: question.trim(), answer: ans, sourceIds: scored.map(s => s.d.id), updatedAt: Date.now() }, ...p]);
    }
    setQuestion("");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <FileStack className="h-5 w-5 text-amber-300/80 mt-1" />
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Multi-Doc Synthesis</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Cluster documents by signature. Synthesize answers across sources.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Document title"
            className="col-span-7 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <select value={draft.lang} onChange={e => setDraft({ ...draft, lang: e.target.value })}
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            <option value="en">EN</option><option value="es">ES</option><option value="fr">FR</option><option value="de">DE</option>
            <option value="ar">AR</option><option value="zh">ZH</option><option value="ru">RU</option><option value="ja">JA</option>
          </select>
          <button onClick={add} className="col-span-3 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 inline mr-1" /> Add
          </button>
        </div>
        <textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} placeholder="Paste document body…" rows={4}
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight resize-none" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-12 lg:col-span-7 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Clusters · {clusters.length}</h3>
          <div className="space-y-2">
            {clusters.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-8 tracking-[0.2em] uppercase font-extralight">No documents</p>}
            {clusters.map(([name, ds]) => (
              <div key={name} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-200/80">#{name}</span>
                  <span className="text-[10px] text-muted-foreground/60 font-mono">{ds.length} docs</span>
                </div>
                <div className="space-y-1">
                  {ds.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-2 group">
                      <div className="flex items-center gap-2 min-w-0">
                        <Languages className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">{d.lang}</span>
                        <span className="text-xs text-foreground font-extralight truncate">{d.title}</span>
                      </div>
                      <button onClick={() => remove(d.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-5 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Synthesis Q&amp;A</h3>
          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 space-y-2">
            <input value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") synthesize(); }}
              placeholder="Ask a question across all documents…"
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
            <button onClick={synthesize} className="w-full rounded-lg bg-amber-300/10 border border-amber-300/20 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20">
              <Combine className="h-3 w-3 inline mr-1" /> Synthesize
            </button>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {synth.map((s, i) => (
              <div key={i} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
                <p className="text-xs font-extralight text-foreground">{s.question}</p>
                <pre className="text-[11px] text-muted-foreground font-extralight mt-2 whitespace-pre-wrap leading-relaxed">{s.answer}</pre>
                <p className="text-[9px] text-muted-foreground/40 font-mono mt-2">{s.sourceIds.length} sources · {new Date(s.updatedAt).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ClusterPanel;
