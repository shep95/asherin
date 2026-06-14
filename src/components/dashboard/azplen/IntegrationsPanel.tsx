import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Plug, ExternalLink } from "lucide-react";

type Category = "government" | "toolchain" | "visualization" | "communication" | "regulatory";
interface Integration {
  id: string;
  name: string;
  category: Category;
  endpoint: string;
  status: "configured" | "connected" | "error" | "disabled";
  notes: string;
  lastSync?: number;
}

const KEY = "azplen:integrations:global";

const CAT_STYLE: Record<Category, string> = {
  government: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
  toolchain: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  visualization: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]",
  communication: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  regulatory: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
};

const STATUS_STYLE: Record<Integration["status"], string> = {
  configured: "text-muted-foreground",
  connected: "text-emerald-300",
  error: "text-rose-300",
  disabled: "text-muted-foreground/40",
};

const SEEDS: Omit<Integration, "id" | "lastSync">[] = [
  { name: "OFAC SDN List", category: "government", endpoint: "https://sanctionslistservice.ofac.treas.gov/api", status: "configured", notes: "Sanctions enforcement reference." },
  { name: "OpenCorporates", category: "government", endpoint: "https://api.opencorporates.com/v0.4/", status: "configured", notes: "Global corporate registry." },
  { name: "SEC EDGAR", category: "regulatory", endpoint: "https://data.sec.gov/submissions/", status: "configured", notes: "US public filings." },
  { name: "Companies House (UK)", category: "regulatory", endpoint: "https://api.company-information.service.gov.uk/", status: "configured", notes: "UK filings + officers." },
  { name: "Jira Cases", category: "toolchain", endpoint: "https://your.atlassian.net/rest/api/3", status: "disabled", notes: "Case → ticket bridge." },
  { name: "GitHub", category: "toolchain", endpoint: "https://api.github.com", status: "disabled", notes: "Investigation repos & playbooks." },
  { name: "Tableau Server", category: "visualization", endpoint: "https://your.tableau.com/api", status: "disabled", notes: "Embed published views." },
  { name: "PowerBI", category: "visualization", endpoint: "https://api.powerbi.com/v1.0", status: "disabled", notes: "Embed published reports." },
  { name: "Slack", category: "communication", endpoint: "https://hooks.slack.com/services/…", status: "disabled", notes: "Briefing webhooks." },
  { name: "MS Teams", category: "communication", endpoint: "https://outlook.office.com/webhook/…", status: "disabled", notes: "Briefing webhooks." },
];

/**
 * Integration Hub — government, toolchain, visualization, communication,
 * and regulatory connectors. Single registry for all third-party plumbing.
 */
const IntegrationsPanel = () => {
  const [items, setItems] = useState<Integration[]>([]);
  const [draft, setDraft] = useState<Omit<Integration, "id" | "lastSync">>({
    name: "", category: "toolchain", endpoint: "", status: "configured", notes: "",
  });
  const [filter, setFilter] = useState<Category | "all">("all");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setItems(raw ? JSON.parse(raw) : SEEDS.map(s => ({ ...s, id: crypto.randomUUID() })));
    } catch { setItems(SEEDS.map(s => ({ ...s, id: crypto.randomUUID() }))); }
  }, []);
  useEffect(() => { const h = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(items)), 300); return () => clearTimeout(h); }, [items]);

  const filtered = useMemo(() => filter === "all" ? items : items.filter(i => i.category === filter), [items, filter]);

  const add = () => {
    if (!draft.name.trim() || !draft.endpoint.trim()) return;
    setItems(p => [{ ...draft, id: crypto.randomUUID() }, ...p]);
    setDraft({ name: "", category: "toolchain", endpoint: "", status: "configured", notes: "" });
  };
  const cycleStatus = (id: string) => {
    const order: Integration["status"][] = ["disabled", "configured", "connected", "error"];
    setItems(p => p.map(i => i.id === id ? { ...i, status: order[(order.indexOf(i.status) + 1) % order.length], lastSync: Date.now() } : i));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Plug className="h-5 w-5 text-amber-300/80 mt-1" />
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Integrations</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Government, toolchain, visualization, communication, regulatory — every external system in one registry.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Integration name"
            className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as Category })}
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            {(Object.keys(CAT_STYLE) as Category[]).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={draft.endpoint} onChange={e => setDraft({ ...draft, endpoint: e.target.value })} placeholder="Endpoint URL"
            className="col-span-6 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight font-mono" />
          <button onClick={add} className="col-span-1 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
        <input value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes / auth / scope…"
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
      </div>

      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setFilter("all")}
          className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors
            ${filter === "all" ? "border-amber-300/30 bg-amber-300/[0.06] text-amber-200" : "border-foreground/10 text-muted-foreground hover:text-foreground"}`}>
          All
        </button>
        {(Object.keys(CAT_STYLE) as Category[]).map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors
              ${filter === c ? CAT_STYLE[c] : "border-foreground/10 text-muted-foreground hover:text-foreground"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(i => (
          <div key={i.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${CAT_STYLE[i.category]}`}>{i.category}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extralight text-foreground">{i.name}</span>
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${STATUS_STYLE[i.status]}`}>● {i.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate flex items-center gap-1">
                  <ExternalLink className="h-2.5 w-2.5" /> {i.endpoint}
                </p>
                {i.notes && <p className="text-[11px] text-muted-foreground font-extralight mt-1">{i.notes}</p>}
              </div>
              <button onClick={() => cycleStatus(i.id)}
                className="rounded-md border border-foreground/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-amber-300/30">
                cycle
              </button>
              <button onClick={() => setItems(p => p.filter(x => x.id !== i.id))} className="text-muted-foreground/60 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegrationsPanel;
