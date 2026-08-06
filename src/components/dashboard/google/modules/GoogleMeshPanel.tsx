import { useCallback, useEffect, useState } from "react";
import {
  Brain, MapPin, Gauge, PenLine, ShieldCheck, Loader2,
  RefreshCw, AlertTriangle, CheckCircle2, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/**
 * GOOGLE MESH — the control surface for the inward-facing sensor array.
 *
 * Four panes, each backed by a deterministic server measurement:
 *   Voiceprint  · stylometry over your own sent mail
 *   Cartography · place nodes + rhythm anomalies
 *   Attention   · meeting vs protected-focus ledger
 *   Ghostwriter · drafts in your voice — never sends
 *
 * Every pane renders the full state quartet (idle / loading / empty / error).
 */

type Pane = "voice" | "places" | "attention" | "write" | "audit";

interface MeshStatus {
  accounts: Array<{ id: string; email: string; tier: number; canRead: boolean; canCompose: boolean }>;
  voiceprints: Array<{ google_email: string; sample_count: number; built_at: string; stylometry: any }>;
  placesIndexed: number;
  attentionThrough: string | null;
}

const TIER_LABEL: Record<number, string> = {
  1: "Identity", 2: "Read", 3: "Comprehension", 4: "Agency",
};

/** The consent ladder, in the user's language — not Google's scope strings. */
const TIERS: Array<{ tier: number; label: string; grants: string }> = [
  { tier: 1, label: "Identity", grants: "Who you are — name, email, profile." },
  { tier: 2, label: "Read", grants: "Mail and calendar, read-only." },
  { tier: 3, label: "Comprehension", grants: "Adds Drive, Photos and activity so Asherin can understand your patterns." },
  { tier: 4, label: "Agency", grants: "Adds drafting into Gmail Drafts. Sending is never granted." },
];

/**
 * Staged consent: authorize the *smallest* tier that unlocks what the user wants.
 * Tiers are cumulative server-side, so upgrading never drops earlier access.
 */
async function authorizeTier(tier: number) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in first.");
  const { data, error } = await supabase.functions.invoke("google-oauth", {
    body: { action: "get_auth_url", tier, redirect_uri: `${window.location.origin}/dashboard` },
  });
  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error("Google did not return an authorization URL.");
  window.location.href = data.url;
}


async function callMesh<T = any>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in first.");
  const { data, error } = await supabase.functions.invoke("google-mesh", { body: { action, ...extra } });
  if (error) {
    // supabase.functions.invoke flattens every failure into "non-2xx"; read the real body.
    let detail = error.message;
    try { detail = await (error as any).context?.text?.() ?? detail; } catch { /* keep message */ }
    throw new Error(detail);
  }
  if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
  return data as T;
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border/30 bg-card/20 p-5 space-y-4">{children}</div>
);

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-border/20 bg-background/30 px-3 py-2">
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-extralight">{label}</div>
    <div className="text-sm font-light text-foreground mt-0.5">{value}</div>
  </div>
);

const GoogleMeshPanel = () => {
  const [pane, setPane] = useState<Pane>("voice");
  const [status, setStatus] = useState<MeshStatus | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [places, setPlaces] = useState<any[] | null>(null);
  const [attention, setAttention] = useState<any | null>(null);
  const [audit, setAudit] = useState<any[] | null>(null);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [intent, setIntent] = useState("");
  const [draft, setDraft] = useState<{ subject: string; draft: string; created?: boolean; draftId?: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatusErr(null);
      setStatus(await callMesh<MeshStatus>("status"));
    } catch (e) {
      setStatusErr((e as Error).message);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); }
    catch (e) { toast.error((e as Error).message.slice(0, 200)); }
    finally { setBusy(null); }
  };

  const vp = status?.voiceprints?.[0];
  const sp = vp?.stylometry ?? null;
  const composeReady = !!status?.accounts?.some((a) => a.canCompose);

  const panes: Array<{ id: Pane; label: string; icon: React.ElementType }> = [
    { id: "voice", label: "Voiceprint", icon: Brain },
    { id: "places", label: "Cartography", icon: MapPin },
    { id: "attention", label: "Attention", icon: Gauge },
    { id: "write", label: "Ghostwriter", icon: PenLine },
    { id: "audit", label: "Agency Trail", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      {/* Consent ladder */}
      <Shell>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-light tracking-wide text-foreground">Google Mesh</h3>
            <p className="text-xs font-extralight text-muted-foreground/70 mt-1 max-w-xl">
              Your Google accounts as a retrieval substrate. Asherin reads to understand you and
              drafts in your voice — it never sends mail on its own.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void loadStatus()} className="text-xs font-extralight">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {statusErr && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-extralight text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {statusErr}
          </div>
        )}

        {!status && !statusErr && (
          <div className="h-16 rounded-xl bg-foreground/[0.03] animate-pulse" aria-live="polite" />
        )}

        {status && status.accounts.length === 0 && (
          <p className="text-xs font-extralight text-muted-foreground/60">
            No Google account connected yet. Pick the tier you're comfortable with below — you can raise it later.
          </p>
        )}

        {/* Consent ladder — always available so a connected account can be upgraded */}
        {status && (
          <div className="grid gap-2 sm:grid-cols-2">
            {TIERS.map((t) => {
              const granted = (status.accounts[0]?.tier ?? 0) >= t.tier;
              return (
                <div key={t.tier} className="rounded-xl border border-border/20 bg-background/30 px-3 py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-light text-foreground">
                      Tier {t.tier} · {t.label}
                    </div>
                    <p className="text-[10px] font-extralight text-muted-foreground/60 mt-0.5">{t.grants}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={granted ? "ghost" : "outline"}
                    className="text-[11px] font-extralight shrink-0"
                    disabled={busy === `tier${t.tier}`}
                    onClick={() => run(`tier${t.tier}`, async () => { await authorizeTier(t.tier); })}
                  >
                    {busy === `tier${t.tier}`
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : granted ? "Re-grant" : "Authorize"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}


        {status && status.accounts.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {status.accounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border/20 bg-background/30 px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-light text-foreground truncate">{a.email}</div>
                  <div className="text-[10px] font-extralight text-muted-foreground/60">
                    Tier {a.tier} · {TIER_LABEL[a.tier] ?? "Identity"}
                  </div>
                </div>
                {a.canCompose
                  ? <CheckCircle2 className="h-4 w-4 text-foreground/60 shrink-0" aria-label="Agency granted" />
                  : <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" aria-label="Read only" />}
              </div>
            ))}
          </div>
        )}
      </Shell>

      {/* Pane switcher */}
      <div className="flex flex-wrap gap-2">
        {panes.map((p) => (
          <button
            key={p.id}
            onClick={() => setPane(p.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-extralight border transition-colors ${
              pane === p.id
                ? "border-foreground/30 bg-foreground/10 text-foreground"
                : "border-border/20 text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            <p.icon className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />{p.label}
          </button>
        ))}
      </div>

      {/* VOICEPRINT */}
      {pane === "voice" && (
        <Shell>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-light tracking-wide text-foreground">Stylometric Voiceprint</h4>
            <Button
              size="sm" variant="outline" className="text-xs font-extralight"
              disabled={busy === "voice"}
              onClick={() => run("voice", async () => {
                const r = await callMesh("build_voiceprint", { limit: 60 });
                await loadStatus();
                const ok = (r.voiceprints ?? []).filter((v: any) => v.stylometry).length;
                toast.success(ok ? `Voiceprint built from ${ok} account(s).` : "No usable sent mail found.");
              })}
            >
              {busy === "voice" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Brain className="h-3.5 w-3.5 mr-1.5" />}
              Build from sent mail
            </Button>
          </div>

          {!sp && <p className="text-xs font-extralight text-muted-foreground/60">No voiceprint yet — build one to let Asherin write as you.</p>}

          {sp && (
            <>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                <Stat label="Register" value={sp.formality} />
                <Stat label="Words / msg" value={sp.avgWordsPerMessage} />
                <Stat label="Sentence len" value={`${sp.avgSentenceLength}w`} />
                <Stat label="Samples" value={vp?.sample_count ?? 0} />
                <Stat label="Contractions" value={`${sp.contractionRate}/100w`} />
                <Stat label="Hedging" value={`${sp.hedgeRate}/100w`} />
                <Stat label="Emoji" value={`${sp.emojiRate}/msg`} />
                <Stat label="Vocabulary" value={sp.vocabularyRichness} />
              </div>
              <div className="text-xs font-extralight text-muted-foreground/70 space-y-1">
                <div>Opens with: {sp.greetings?.length ? sp.greetings.map((g: any) => `"${g.phrase}"`).join(", ") : "— no habitual greeting"}</div>
                <div>Signs off: {sp.signoffs?.length ? sp.signoffs.map((g: any) => `"${g.phrase}"`).join(", ") : "— no habitual sign-off"}</div>
              </div>
            </>
          )}
        </Shell>
      )}

      {/* CARTOGRAPHY */}
      {pane === "places" && (
        <Shell>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-light tracking-wide text-foreground">Pattern Cartography</h4>
            <Button
              size="sm" variant="outline" className="text-xs font-extralight" disabled={busy === "places"}
              onClick={() => run("places", async () => {
                const r = await callMesh("pattern_map", { days: 180 });
                setPlaces(r.nodes ?? []);
                toast.success(`${r.nodes?.length ?? 0} place nodes from ${r.observations} observations.`);
              })}
            >
              {busy === "places" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <MapPin className="h-3.5 w-3.5 mr-1.5" />}
              Map last 180 days
            </Button>
          </div>
          {places === null && <p className="text-xs font-extralight text-muted-foreground/60">Run the map to fold your calendar into physical place nodes.</p>}
          {places?.length === 0 && <p className="text-xs font-extralight text-muted-foreground/60">No physical locations found — your calendar events carry no addresses.</p>}
          {!!places?.length && (
            <div className="space-y-1.5">
              {places.slice(0, 25).map((p) => (
                <div key={p.key} className="flex items-center justify-between gap-3 rounded-xl border border-border/20 bg-background/30 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs font-light text-foreground truncate">{p.label}</div>
                    <div className="text-[10px] font-extralight text-muted-foreground/60">
                      {p.visits} visit{p.visits === 1 ? "" : "s"} · last {String(p.lastSeen).slice(0, 10)}
                      {p.cadenceDays ? ` · every ~${p.cadenceDays}d` : ""}
                    </div>
                  </div>
                  {p.anomaly && (
                    <span className="text-[10px] font-extralight text-muted-foreground/80 whitespace-nowrap">⚠ overdue</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Shell>
      )}

      {/* ATTENTION */}
      {pane === "attention" && (
        <Shell>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-light tracking-wide text-foreground">Attention Ledger</h4>
            <Button
              size="sm" variant="outline" className="text-xs font-extralight" disabled={busy === "attn"}
              onClick={() => run("attn", async () => {
                setAttention(await callMesh("attention_ledger", { days: 28 }));
              })}
            >
              {busy === "attn" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Gauge className="h-3.5 w-3.5 mr-1.5" />}
              Compute 28 days
            </Button>
          </div>
          {!attention && <p className="text-xs font-extralight text-muted-foreground/60">Measures meeting load against protected focus blocks (gaps ≥ 45 min).</p>}
          {attention && (
            <>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                <Stat label="Meetings" value={`${attention.summary.meetingHours}h`} />
                <Stat label="Focus" value={`${attention.summary.focusHours}h`} />
                <Stat label="Focus share" value={`${attention.summary.ratio}%`} />
                <Stat label="Heaviest day" value={attention.summary.busiestDay ?? "—"} />
              </div>
              {attention.days?.length === 0 && (
                <p className="text-xs font-extralight text-muted-foreground/60">No timed calendar events in the window.</p>
              )}
            </>
          )}
        </Shell>
      )}

      {/* GHOSTWRITER */}
      {pane === "write" && (
        <Shell>
          <h4 className="text-xs font-light tracking-wide text-foreground">Ghostwriter</h4>
          <p className="text-[11px] font-extralight text-muted-foreground/60">
            Writes in your measured voice and saves to Gmail Drafts. Asherin never sends — you do.
          </p>
          {!composeReady && (
            <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/30 px-3 py-2 text-xs font-extralight text-muted-foreground/70">
              <Lock className="h-3.5 w-3.5" /> Tier 4 (Agency) not granted. Reconnect Google and allow compose access.
            </div>
          )}
          <div className="grid gap-2">
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient email" className="text-xs font-extralight" />
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional — will be proposed)" className="text-xs font-extralight" />
            <Textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={4}
              placeholder="What should this email say?" className="text-xs font-extralight" />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline" className="text-xs font-extralight"
              disabled={busy === "prev" || !sp}
              onClick={() => run("prev", async () => {
                setDraft(await callMesh("ghostwrite", { to, subject, intent, preview: true }));
              })}
            >
              {busy === "prev" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <PenLine className="h-3.5 w-3.5 mr-1.5" />}
              Preview
            </Button>
            <Button
              size="sm" className="text-xs font-extralight"
              disabled={busy === "save" || !sp || !composeReady}
              onClick={() => run("save", async () => {
                const r = await callMesh("ghostwrite", { to, subject, intent });
                setDraft(r);
                toast.success("Saved to Gmail Drafts.");
              })}
            >
              {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save to Drafts
            </Button>
          </div>
          {!sp && <p className="text-[11px] font-extralight text-muted-foreground/60">Build your voiceprint first — without it the draft would not sound like you.</p>}
          {draft && (
            <div className="rounded-xl border border-border/20 bg-background/30 p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-extralight">
                {draft.created ? `Draft saved · ${draft.draftId}` : "Preview"}
              </div>
              <div className="text-xs font-light text-foreground">{draft.subject}</div>
              <pre className="whitespace-pre-wrap text-xs font-extralight text-muted-foreground/80 leading-relaxed">{draft.draft}</pre>
            </div>
          )}
        </Shell>
      )}

      {/* AUDIT */}
      {pane === "audit" && (
        <Shell>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-light tracking-wide text-foreground">Agency Trail</h4>
            <Button size="sm" variant="outline" className="text-xs font-extralight" disabled={busy === "audit"}
              onClick={() => run("audit", async () => { setAudit((await callMesh("audit_log")).entries ?? []); })}>
              {busy === "audit" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
              Load
            </Button>
          </div>
          {audit === null && <p className="text-xs font-extralight text-muted-foreground/60">Append-only record of every action taken on your behalf.</p>}
          {audit?.length === 0 && <p className="text-xs font-extralight text-muted-foreground/60">Nothing has been done on your behalf yet.</p>}
          {!!audit?.length && (
            <div className="space-y-1.5">
              {audit.map((a) => (
                <div key={a.id} className="rounded-xl border border-border/20 bg-background/30 px-3 py-2">
                  <div className="text-xs font-light text-foreground">{a.action}{a.target ? ` → ${a.target}` : ""}</div>
                  <div className="text-[10px] font-extralight text-muted-foreground/60">
                    {new Date(a.created_at).toLocaleString()} · {a.google_email ?? "—"} · {a.confirmed ? "executed" : "requested"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Shell>
      )}
    </div>
  );
};

export default GoogleMeshPanel;
