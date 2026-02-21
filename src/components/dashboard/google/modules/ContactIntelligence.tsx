import { useState, useEffect } from "react";
import {
  Users, Star, MessageSquare, Clock, TrendingUp, Heart, Network,
  Zap, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useGoogleApi } from "@/hooks/useGoogleApi";

const ContactIntelligence = () => {
  const { fetchGoogleData, isConnected } = useGoogleApi();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchGoogleData("contacts", { pageSize: 50 });
      setContacts(data.contacts || []);
      setTotalContacts(data.totalContacts || 0);
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) loadData();
  }, [isConnected]);

  const networkStats = contacts.length > 0
    ? [
        { label: "Total Contacts", value: String(totalContacts) },
        { label: "With Email", value: String(contacts.filter((c) => c.email).length) },
        { label: "With Phone", value: String(contacts.filter((c) => c.phone).length) },
        { label: "Organizations", value: String(new Set(contacts.map((c) => c.organization).filter(Boolean)).size) },
      ]
    : [
        { label: "Total Contacts", value: "—" },
        { label: "Active (30d)", value: "—" },
        { label: "Organizations", value: "—" },
        { label: "Social Clusters", value: "—" },
      ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <Users className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Contact Intelligence</h2>
              {isConnected && (
                <button onClick={loadData} disabled={loading} className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all disabled:opacity-50">
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                  Sync
                </button>
              )}
            </div>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              {isConnected
                ? "Live contact data connected — analyzing your social graph and relationship patterns."
                : "Connect Google to unlock relationship scoring, social graph mapping, and fade detection."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {networkStats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
            <p className="text-xl font-extralight text-foreground">{loading ? "…" : s.value}</p>
            <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Live Contacts */}
      {contacts.length > 0 && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <Heart className="h-4 w-4" /> Your Contacts (Live)
          </h3>
          <div className="space-y-2">
            {contacts.slice(0, 15).map((c, i) => (
              <div key={i} className="rounded-xl border border-border/20 bg-foreground/5 p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-light text-foreground shrink-0 overflow-hidden">
                  {c.photo ? (
                    <img src={c.photo} alt="" className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    c.name?.charAt(0) || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-light text-foreground truncate block">{c.name}</span>
                  <div className="flex gap-3 text-[10px] text-muted-foreground/50">
                    {c.email && <span className="truncate">{c.email}</span>}
                    {c.organization && <span>{c.organization}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts placeholder */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" /> Relationship Alerts
        </h3>
        <div className="space-y-1.5">
          {[
            "Connect Google to detect fading relationships",
            "AI will analyze contact patterns and warn you",
            "Frequency tracking identifies who you're losing touch with",
          ].map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-foreground/5 px-3 py-2">
              <Zap className="h-3 w-3 text-muted-foreground/30 shrink-0 mt-0.5" />
              <span className="text-[10px] font-extralight text-muted-foreground/60">{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContactIntelligence;
