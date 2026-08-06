import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Users, Clock, Network, Zap, AlertTriangle, RefreshCw, Search,
  HardDrive, Download, Brain, Activity, MessageSquare, Trash2, ChevronDown,
} from "lucide-react";
import { useGoogleApi } from "@/hooks/useGoogleApi";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useMeshSyncState } from "@/hooks/useMeshSyncState";
import { toast } from "sonner";

import {
  buildContactIntel, type ContactDossier, type IntelSummary, type RawMessage,
} from "./contactIntel/messageIntel";
import {
  saveVault, loadVault, clearVault, vaultBytes, exportVaultText, downloadText,
  type VaultSnapshot,
} from "./contactIntel/localVault";

// Depth of the sweep. The Gmail metadata read is the expensive leg, so the
// window is declared once here and honored end to end rather than being
// silently clipped downstream.
const MAIL_DEPTH = 100;
const CONTACT_DEPTH = 1000;

const TIER_LABEL: Record<ContactDossier["tier"], string> = {
  inner: "Inner", active: "Active", periphery: "Periphery", dormant: "Dormant", archive: "Archive",
};

const fmtBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;

const fmtAgo = (ms: number | null) => {
  if (ms === null) return "—";
  const d = Math.round((Date.now() - ms) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
};

/** A metric that has no evidence prints an em dash, never a fabricated zero. */
const Metric = ({ label, value, suffix = "" }: { label: string; value: number | string | null; suffix?: string }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-light text-muted-foreground/50">{label}</p>
    <p className="text-xs font-light text-foreground truncate">
      {value === null || value === "" ? "—" : `${value}${suffix}`}
    </p>
  </div>
);

const Bar = ({ label, value }: { label: string; value: number | null }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] font-light">
      <span className="text-muted-foreground/60">{label}</span>
      <span className="text-foreground/80">{value === null ? "—" : value}</span>
    </div>
    <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-foreground/50 transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${value ?? 0}%` }}
      />
    </div>
  </div>
);

const Sparkline = ({ data, labels }: { data: number[]; labels?: string[] }) => {
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-[2px] h-10" role="img" aria-label="Activity distribution">
      {data.map((v, i) => (
        <div key={i} className="flex-1 min-w-0" title={`${labels?.[i] ?? i}: ${v}`}>
          <div
            className="w-full rounded-sm bg-foreground/30"
            style={{ height: `${Math.max(2, (v / max) * 40)}px` }}
          />
        </div>
      ))}
    </div>
  );
};

const ContactIntelligence = () => {
  const { accounts, isConnected, fetchGoogleData } = useGoogleApi();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<ContactDossier[]>([]);
  const [summary, setSummary] = useState<IntelSummary | null>(null);
  const [vaultMeta, setVaultMeta] = useState<{ savedAt: number; bytes: number } | null>(null);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | ContactDossier["tier"]>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [limit, setLimit] = useState(40);

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const applySnapshot = useCallback((snap: VaultSnapshot) => {
    setDossiers(snap.dossiers);
    setSummary(snap.summary);
    setVaultMeta({ savedAt: snap.savedAt, bytes: vaultBytes(snap) });
  }, []);

  // Offline-first: the device vault paints immediately, so the operator is
  // never staring at an empty roster while the network leg runs.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadVault(userId).then((snap) => {
      if (!cancelled && snap && alive.current) applySnapshot(snap);
    });
    return () => { cancelled = true; };
  }, [userId, applySnapshot]);

  const sweep = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      setPhase("Harvesting address book and mail metadata…");
      // allSettled, not all: a revoked Gmail scope must not void the roster.
      const [contactRes, inboxRes, sentRes, calRes] = await Promise.allSettled([
        fetchGoogleData("contacts", { pageSize: CONTACT_DEPTH }),
        fetchGoogleData("gmail_inbox", { maxResults: MAIL_DEPTH, q: "-in:chats" }),
        fetchGoogleData("gmail_inbox", { maxResults: MAIL_DEPTH, q: "in:sent" }),
        fetchGoogleData("calendar_events", {
          timeMin: new Date(Date.now() - 90 * 86400000).toISOString(),
          timeMax: new Date(Date.now() + 30 * 86400000).toISOString(),
          maxResults: 200,
        }),
      ]);

      const val = (r: PromiseSettledResult<any>) => (r.status === "fulfilled" ? r.value : null);
      const contactData = val(contactRes);
      const inbox = val(inboxRes);
      const sent = val(sentRes);
      const cal = val(calRes);

      const failed = [
        contactRes.status === "rejected" && "contacts",
        inboxRes.status === "rejected" && "inbox",
        sentRes.status === "rejected" && "sent mail",
        calRes.status === "rejected" && "calendar",
      ].filter(Boolean) as string[];

      // Deduplicate on message id — a thread can surface in both queries.
      const seen = new Set<string>();
      const messages: RawMessage[] = [];
      for (const m of [...(inbox?.messages || []), ...(sent?.messages || [])]) {
        if (!m?.id || seen.has(m.id)) continue;
        seen.add(m.id);
        messages.push(m);
      }

      setPhase("Fusing identities and profiling language…");
      const ownAddresses = accounts.map((a) => a.google_email).filter(Boolean);
      const calendarAttendees = (cal?.events || []).flatMap((e: any) => e.attendeeEmails || []);

      const { dossiers: built, summary: sum } = buildContactIntel({
        contacts: contactData?.contacts || [],
        messages,
        ownAddresses,
        calendarAttendees,
      });

      if (!alive.current) return;
      setDossiers(built);
      setSummary(sum);

      setPhase("Writing to device vault…");
      const ok = await saveVault(userId, sum, built);
      if (alive.current) {
        setVaultMeta(
          ok ? { savedAt: Date.now(), bytes: vaultBytes({ id: userId, savedAt: Date.now(), summary: sum, dossiers: built }) } : null,
        );
      }

      if (failed.length) {
        setError(`Partial sweep — ${failed.join(", ")} unavailable. Results below exclude those sources.`);
      }
      toast.success(`${built.length} identities profiled from ${messages.length} messages.`);
    } catch (e: any) {
      console.error("[contact-intel] sweep failed:", e);
      if (alive.current) setError(e?.message || "Sweep failed. The device vault below still holds the last good run.");
      // Rethrow so the scheduler can widen its cadence instead of retrying a
      // revoked credential every interval.
      throw e;
    } finally {
      if (alive.current) { setLoading(false); setPhase(""); }
    }
  }, [isConnected, fetchGoogleData, accounts, userId]);

  // Foreground continuity: sweeps on open, keeps a cadence while the tab is
  // visible, catches up on refocus and reconnect, and yields to sibling tabs.
  const auto = useAutoSync({
    key: `contact-intel:${userId}`,
    enabled: Boolean(isConnected && accounts.length && userId),
    run: sweep,
    intervalMs: 10 * 60_000,
    minGapMs: 3 * 60_000,
  });

  // Background continuity: what the scheduled server sweep did while closed.
  const { state: serverSync } = useMeshSyncState(userId || undefined);


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dossiers.filter((d) => {
      if (tierFilter !== "all" && d.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.emails.some((e) => e.includes(q)) ||
        d.phones.some((p) => p.includes(q)) ||
        d.organization.toLowerCase().includes(q) ||
        d.patterns.topSubjectTokens.some((t) => t.token.includes(q))
      );
    });
  }, [dossiers, query, tierFilter]);

  useEffect(() => { setLimit(40); }, [query, tierFilter]);

  const alerts = useMemo(
    () => dossiers.flatMap((d) => d.signals.filter((s) => s.kind === "warn").map((s) => ({ name: d.name, ...s }))).slice(0, 12),
    [dossiers],
  );

  const onExport = () => {
    if (!summary) return;
    downloadText(
      `contact-intelligence-${new Date().toISOString().slice(0, 10)}.txt`,
      exportVaultText({ id: userId, savedAt: vaultMeta?.savedAt ?? Date.now(), summary, dossiers }),
    );
  };

  const onPurge = async () => {
    await clearVault(userId);
    setDossiers([]); setSummary(null); setVaultMeta(null);
    toast.success("Device vault purged.");
  };

  const stats = summary
    ? [
        { label: "Identities", value: String(summary.contactCount) },
        { label: "Correspondents", value: String(summary.correspondentCount) },
        { label: "Messages Read", value: String(summary.messageCount) },
        { label: "Inner Circle", value: String(summary.tiers.inner) },
      ]
    : [
        { label: "Identities", value: "—" },
        { label: "Correspondents", value: "—" },
        { label: "Messages Read", value: "—" },
        { label: "Inner Circle", value: "—" },
      ];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5 shrink-0">
            <Users className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Contact Intelligence</h2>
              {isConnected && (
                <button
                  onClick={() => void auto.syncNow()}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
                  {loading ? "Sweeping" : "Sync Now"}
                </button>
              )}
            </div>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              {isConnected
                ? "Every identity in reach — address book, inbox, sent mail and calendar — fused into one ledger with message-pattern and language profiling, held on this device. Syncs on open, on a cadence while this tab is visible, and on the server while the app is closed."
                : "Connect Google to fuse your address book with mail and calendar traffic into ranked dossiers."}
            </p>
            {loading && phase && (
              <p className="text-[10px] font-light text-muted-foreground/60" aria-live="polite">{phase}</p>
            )}
            {error && (
              <p className="text-[10px] font-light text-amber-400/90 flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {error}
              </p>
            )}

            {/* Sync posture — foreground cadence and the closed-app sweep,
                stated separately so neither one implies the other. */}
            {isConnected && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1" aria-live="polite">
                <span className="flex items-center gap-1.5 text-[10px] font-light text-muted-foreground/60">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      loading || auto.syncing
                        ? "bg-foreground/70 animate-pulse motion-reduce:animate-none"
                        : auto.lastError
                          ? "bg-amber-400/80"
                          : "bg-emerald-400/70"
                    }`}
                  />
                  {loading || auto.syncing
                    ? "Live sync running"
                    : `This tab: ${fmtWhen(auto.lastRunAt)}${auto.nextRunAt ? ` · next ${fmtIn(auto.nextRunAt)}` : ""}`}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-light text-muted-foreground/60">
                  <Cloud className="h-3 w-3 shrink-0" />
                  {serverSync
                    ? serverSync.enabled
                      ? `Background: ${fmtWhen(serverSync.lastSyncedAt ? Date.parse(serverSync.lastSyncedAt) : null)}` +
                        `${serverSync.nextDueAt ? ` · next ${fmtIn(Date.parse(serverSync.nextDueAt))}` : ""}` +
                        `${serverSync.lastStatus === "error" ? " · last run failed" : ""}`
                      : "Background sync off"
                    : "Background sync arming…"}
                </span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Stat band ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
            <p className="text-xl font-extralight text-foreground tabular-nums">{loading && !summary ? "…" : s.value}</p>
            <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Device vault ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 flex flex-wrap items-center gap-3">
        <HardDrive className="h-4 w-4 text-foreground/60 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">Device Vault</p>
          <p className="text-[10px] font-light text-muted-foreground/60">
            {vaultMeta
              ? `${fmtBytes(vaultMeta.bytes)} held locally · last written ${new Date(vaultMeta.savedAt).toLocaleString()}`
              : "Nothing stored on this device yet — run a deep sweep."}
          </p>
        </div>
        <button
          onClick={onExport}
          disabled={!summary}
          className="flex items-center gap-1.5 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-colors disabled:opacity-40"
        >
          <Download className="h-3 w-3" /> Export Ledger
        </button>
        <button
          onClick={onPurge}
          disabled={!vaultMeta}
          className="flex items-center gap-1.5 rounded-lg bg-foreground/5 px-3 py-1.5 text-[10px] font-light text-muted-foreground hover:bg-foreground/10 transition-colors disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" /> Purge
        </button>
      </div>

      {/* ── Operator language baseline ─────────────────────────────── */}
      {summary && summary.psych.evidence !== "none" && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" /> Your Correspondence Baseline
            </h3>
            <span className="text-[10px] font-light text-muted-foreground/50">
              {summary.psych.evidence} evidence · {summary.psych.tokens} tokens
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2.5">
            <Bar label="Warmth" value={summary.psych.composites.warmth} />
            <Bar label="Assertiveness" value={summary.psych.composites.assertiveness} />
            <Bar label="Formality" value={summary.psych.composites.formalityIndex} />
            <Bar label="Pressure load" value={summary.psych.composites.stressLoad} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4 pt-1">
            <div>
              <p className="text-[10px] font-light text-muted-foreground/50 mb-1.5">Hour of day</p>
              <Sparkline data={summary.patterns.hourHistogram} />
              <p className="text-[10px] font-light text-muted-foreground/50 mt-1">
                Peak {summary.patterns.peakHour ?? "—"}:00 · {Math.round(summary.patterns.afterHoursShare * 100)}% after hours
              </p>
            </div>
            <div>
              <p className="text-[10px] font-light text-muted-foreground/50 mb-1.5">Day of week</p>
              <Sparkline data={summary.patterns.dayHistogram} labels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]} />
              <p className="text-[10px] font-light text-muted-foreground/50 mt-1">
                {Math.round(summary.patterns.questionRate * 100)}% ask a question · {Math.round(summary.patterns.emojiRate * 100)}% carry emoji
              </p>
            </div>
          </div>
          {summary.psych.markers.length > 0 && (
            <ul className="space-y-1 pt-1">
              {summary.psych.markers.map((m, i) => (
                <li key={i} className="text-[10px] font-extralight text-muted-foreground/70 flex gap-2">
                  <span className="text-foreground/40">◈</span> {m}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Alerts ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" /> Relationship Alerts
        </h3>
        <div className="space-y-1.5">
          {alerts.length > 0 ? (
            alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-foreground/5 px-3 py-2">
                <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-[10px] font-extralight text-muted-foreground/80">
                  <span className="text-foreground/80">{a.name}</span> — {a.label}
                </span>
              </div>
            ))
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-foreground/5 px-3 py-2">
              <Zap className="h-3 w-3 text-muted-foreground/30 shrink-0 mt-0.5" />
              <span className="text-[10px] font-extralight text-muted-foreground/60">
                {dossiers.length
                  ? "No overdue, one-way, or unread-heavy relationships in the current window."
                  : "Run a deep sweep to surface drift, one-way threads and unanswered mail."}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Roster ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <Network className="h-4 w-4" /> Identity Ledger
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, address, org, theme…"
                aria-label="Search contacts"
                className="w-48 sm:w-64 rounded-lg border border-border/20 bg-foreground/5 pl-7 pr-2 py-1.5 text-[11px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/30"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", "inner", "active", "periphery", "dormant", "archive"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              aria-pressed={tierFilter === t}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-light transition-colors ${
                tierFilter === t ? "bg-foreground/20 text-foreground" : "bg-foreground/5 text-muted-foreground/60 hover:bg-foreground/10"
              }`}
            >
              {t === "all" ? `All (${dossiers.length})` : `${TIER_LABEL[t]} (${summary?.tiers[t] ?? 0})`}
            </button>
          ))}
        </div>

        {loading && !dossiers.length ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-foreground/5 animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[11px] font-extralight text-muted-foreground/60 py-6 text-center">
            {dossiers.length ? "No identity matches this filter." : "No dossiers yet — connect Google and run a deep sweep."}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {filtered.slice(0, limit).map((d) => {
                const open = openKey === d.key;
                return (
                  <div key={d.key} className="rounded-xl border border-border/20 bg-foreground/5 overflow-hidden">
                    <button
                      onClick={() => setOpenKey(open ? null : d.key)}
                      aria-expanded={open}
                      className="w-full p-3 flex items-center gap-3 text-left hover:bg-foreground/5 transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-light text-foreground shrink-0 overflow-hidden">
                        {d.photo ? (
                          <img src={d.photo} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        ) : (
                          d.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-light text-foreground truncate">{d.name}</span>
                          <span className="text-[9px] font-light text-muted-foreground/50 rounded px-1.5 py-0.5 bg-foreground/10 shrink-0">
                            {TIER_LABEL[d.tier]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-[10px] text-muted-foreground/50">
                          {d.emails[0] && <span className="truncate max-w-[180px]">{d.emails[0]}</span>}
                          {d.organization && <span className="truncate max-w-[120px]">{d.organization}</span>}
                          {d.total > 0 && <span>{d.total} msgs</span>}
                          <span>{fmtAgo(d.lastSeen)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extralight text-foreground tabular-nums">{d.importance}</p>
                        <p className="text-[9px] font-light text-muted-foreground/40">score</p>
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>

                    {open && (
                      <div className="border-t border-border/20 p-4 space-y-4 bg-background/20">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <Metric label="Inbound" value={d.inbound} />
                          <Metric label="Outbound" value={d.outbound} />
                          <Metric label="Threads" value={d.threads} />
                          <Metric label="Unread" value={d.unread} />
                          <Metric label="Cadence" value={d.cadenceDays} suffix="d" />
                          <Metric label="Silent" value={d.silenceDays} suffix="d" />
                          <Metric label="Your reply" value={d.myReplyLatencyHours} suffix="h" />
                          <Metric label="Their reply" value={d.theirReplyLatencyHours} suffix="h" />
                        </div>

                        {(d.emails.length > 1 || d.phones.length > 0 || d.location || d.birthday || d.urls.length > 0) && (
                          <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t border-border/10">
                            <Metric label="All addresses" value={d.emails.join(", ")} />
                            <Metric label="Phones" value={d.phones.join(", ")} />
                            <Metric label="Location" value={d.location} />
                            <Metric label="Birthday" value={d.birthday} />
                            {d.urls.length > 0 && <Metric label="Links" value={d.urls.join(", ")} />}
                            <Metric label="Channels" value={d.channels.join(" · ")} />
                          </div>
                        )}

                        {d.psych.evidence !== "none" ? (
                          <div className="space-y-2 pt-1 border-t border-border/10">
                            <p className="text-[10px] font-light text-muted-foreground/50 flex items-center gap-1.5">
                              <Brain className="h-3 w-3" /> Language profile · {d.psych.evidence} evidence ({d.psych.tokens} tokens)
                            </p>
                            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-2">
                              <Bar label="Warmth" value={d.psych.composites.warmth} />
                              <Bar label="Assertiveness" value={d.psych.composites.assertiveness} />
                              <Bar label="Formality" value={d.psych.composites.formalityIndex} />
                              <Bar label="Pressure" value={d.psych.composites.stressLoad} />
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] font-extralight text-muted-foreground/50 pt-1 border-t border-border/10">
                            No message text in the current window — language profiling withheld rather than guessed.
                          </p>
                        )}

                        {d.patterns.sampleSize > 0 && (
                          <div className="grid sm:grid-cols-2 gap-4 pt-1 border-t border-border/10">
                            <div>
                              <p className="text-[10px] font-light text-muted-foreground/50 mb-1.5 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> When they land
                              </p>
                              <Sparkline data={d.patterns.hourHistogram} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-light text-muted-foreground/50 flex items-center gap-1.5">
                                <MessageSquare className="h-3 w-3" /> Text patterns
                              </p>
                              <p className="text-[10px] font-extralight text-muted-foreground/70">
                                {Math.round(d.patterns.questionRate * 100)}% questions ·{" "}
                                {Math.round(d.patterns.exclamationRate * 100)}% exclamation ·{" "}
                                {Math.round(d.patterns.emojiRate * 100)}% emoji ·{" "}
                                {Math.round(d.patterns.afterHoursShare * 100)}% after hours
                              </p>
                              {d.patterns.topSubjectTokens.length > 0 && (
                                <p className="text-[10px] font-extralight text-muted-foreground/60">
                                  Themes: {d.patterns.topSubjectTokens.map((t) => t.token).join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {d.signals.length > 0 && (
                          <ul className="space-y-1 pt-1 border-t border-border/10">
                            {d.signals.map((s, i) => (
                              <li key={i} className="text-[10px] font-extralight text-muted-foreground/70 flex gap-2">
                                <span className={s.kind === "warn" ? "text-amber-400" : s.kind === "ok" ? "text-emerald-400" : "text-foreground/40"}>◉</span>
                                {s.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filtered.length > limit && (
              <button
                onClick={() => setLimit((l) => l + 60)}
                className="w-full rounded-lg bg-foreground/5 py-2 text-[10px] font-light text-muted-foreground hover:bg-foreground/10 transition-colors"
              >
                Show more — {filtered.length - limit} remaining
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[10px] font-extralight text-muted-foreground/40 flex items-start gap-1.5 px-1">
        <Activity className="h-3 w-3 shrink-0 mt-0.5" />
        Derived from Google People records and Gmail metadata only. Language markers are lexical counts over
        subjects and snippets, reported with their evidence weight — not clinical assessments. Absent evidence
        prints as “—”, never as zero.
      </p>
    </div>
  );
};

export default ContactIntelligence;
