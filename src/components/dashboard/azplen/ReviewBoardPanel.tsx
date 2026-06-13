import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Gavel, Check, X } from "lucide-react";

type Status = "draft" | "in_review" | "revisions" | "approved" | "rejected";
interface Reviewer { name: string; verdict: "approve" | "reject" | "pending"; comment: string; }
interface Submission {
  id: string;
  title: string;
  author: string;
  reportRef: string;
  status: Status;
  reviewers: Reviewer[];
  submittedAt: number;
}

const KEY = "azplen:review-board:global";

const STATUS_STYLE: Record<Status, string> = {
  draft: "border-foreground/15 text-muted-foreground",
  in_review: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  revisions: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  approved: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  rejected: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
};

/**
 * Review Board — formal multi-reviewer approval workflow for intelligence
 * products before publication. Tracks reviewer verdicts, comments, status.
 */
const ReviewBoardPanel = () => {
  const [items, setItems] = useState<Submission[]>([]);
  const [draft, setDraft] = useState({ title: "", author: "", reportRef: "", reviewers: "" });

  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {} }, []);
  useEffect(() => { const h = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(items)), 300); return () => clearTimeout(h); }, [items]);

  const submit = () => {
    if (!draft.title.trim()) return;
    const reviewers: Reviewer[] = draft.reviewers.split(",").map(r => r.trim()).filter(Boolean)
      .map(n => ({ name: n, verdict: "pending", comment: "" }));
    setItems(p => [{
      id: crypto.randomUUID(), title: draft.title.trim(), author: draft.author.trim() || "operator",
      reportRef: draft.reportRef.trim(), status: reviewers.length ? "in_review" : "draft",
      reviewers, submittedAt: Date.now(),
    }, ...p]);
    setDraft({ title: "", author: "", reportRef: "", reviewers: "" });
  };

  const setVerdict = (id: string, name: string, verdict: Reviewer["verdict"]) =>
    setItems(p => p.map(s => {
      if (s.id !== id) return s;
      const reviewers = s.reviewers.map(r => r.name === name ? { ...r, verdict } : r);
      const approved = reviewers.every(r => r.verdict === "approve");
      const rejected = reviewers.some(r => r.verdict === "reject");
      const status: Status = approved ? "approved" : rejected ? "rejected" : "in_review";
      return { ...s, reviewers, status };
    }));
  const setComment = (id: string, name: string, comment: string) =>
    setItems(p => p.map(s => s.id !== id ? s : { ...s, reviewers: s.reviewers.map(r => r.name === name ? { ...r, comment } : r) }));
  const remove = (id: string) => setItems(p => p.filter(s => s.id !== id));

  const counts = useMemo(() => {
    const c: Record<Status, number> = { draft: 0, in_review: 0, revisions: 0, approved: 0, rejected: 0 };
    items.forEach(s => c[s.status]++);
    return c;
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Gavel className="h-5 w-5 text-amber-300/80 mt-1" />
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Review Board</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Formal approval workflow. Every reviewer must sign off before publication.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {(["draft","in_review","revisions","approved","rejected"] as Status[]).map(s => (
          <div key={s} className={`rounded-lg border p-3 ${STATUS_STYLE[s]}`}>
            <p className="text-[9px] font-mono uppercase tracking-wider">{s.replace("_"," ")}</p>
            <p className="text-lg font-extralight mt-0.5">{counts[s]}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Submission title"
            className="col-span-5 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input value={draft.author} onChange={e => setDraft({ ...draft, author: e.target.value })} placeholder="Author"
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input value={draft.reportRef} onChange={e => setDraft({ ...draft, reportRef: e.target.value })} placeholder="Report ref"
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight font-mono" />
          <input value={draft.reviewers} onChange={e => setDraft({ ...draft, reviewers: e.target.value })} placeholder="Reviewers (comma)"
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <button onClick={submit} className="col-span-1 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">Nothing under review</p>}
        {items.map(s => (
          <div key={s.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${STATUS_STYLE[s.status]}`}>{s.status.replace("_"," ")}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">{s.reportRef || "—"}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/40">· {s.author}</span>
                </div>
                <h4 className="text-sm font-extralight text-foreground mt-1">{s.title}</h4>
              </div>
              <button onClick={() => remove(s.id)} className="text-muted-foreground/60 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
            <div className="mt-3 space-y-2">
              {s.reviewers.length === 0 && <p className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-wider">No reviewers assigned</p>}
              {s.reviewers.map(r => (
                <div key={r.name} className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-2">
                  <span className="text-xs font-extralight text-foreground w-32 truncate">{r.name}</span>
                  <input value={r.comment} onChange={e => setComment(s.id, r.name, e.target.value)} placeholder="Comment…"
                    className="flex-1 bg-transparent border-none outline-none text-xs text-muted-foreground placeholder:text-muted-foreground/40 font-extralight" />
                  <button onClick={() => setVerdict(s.id, r.name, "approve")}
                    className={`p-1 rounded ${r.verdict === "approve" ? "text-emerald-300 bg-emerald-300/10" : "text-muted-foreground/60 hover:text-emerald-300"}`}>
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={() => setVerdict(s.id, r.name, "reject")}
                    className={`p-1 rounded ${r.verdict === "reject" ? "text-rose-300 bg-rose-300/10" : "text-muted-foreground/60 hover:text-rose-300"}`}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReviewBoardPanel;
