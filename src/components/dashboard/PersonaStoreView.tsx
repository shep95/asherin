import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Download, Star, Users, Plus, Globe, Lock, Eye, Trash2,
  ChevronDown, Sparkles, TrendingUp,
} from "lucide-react";
import { ICON_MAP, ICON_OPTIONS } from "./PersonaSelector";
import { Target } from "lucide-react";
import type { Persona } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";

const CATEGORIES = ["all", "general", "engineering", "research", "writing", "strategy", "security", "creative", "analysis"];

interface SharedPersona {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  description: string;
  system_prompt: string;
  category: string;
  is_public: boolean;
  installs: number;
  rating: number;
  tags: string[];
  created_at: string;
}

const PersonaStoreView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"browse" | "my">("browse");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [storePersonas, setStorePersonas] = useState<SharedPersona[]>([]);
  const [myPersonas, setMyPersonas] = useState<SharedPersona[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: publicData }, { data: myData }, { data: installedData }] = await Promise.all([
      supabase.from("shared_personas" as any).select("*").eq("is_public", true).order("installs", { ascending: false }),
      supabase.from("shared_personas" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("installed_personas" as any).select("persona_id").eq("user_id", user.id),
    ]);
    setStorePersonas((publicData as any[]) || []);
    setMyPersonas((myData as any[]) || []);
    setInstalledIds(new Set((installedData as any[] || []).map((i: any) => i.persona_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const installPersona = async (persona: SharedPersona) => {
    if (!user) return;
    await supabase.from("installed_personas" as any).insert({ user_id: user.id, persona_id: persona.id });
    // Increment installs
    await supabase.from("shared_personas" as any).update({ installs: persona.installs + 1 }).eq("id", persona.id);
    // Save to localStorage custom personas
    const existing = JSON.parse(localStorage.getItem("aureon_custom_personas") || "[]");
    const newPersona: Persona = {
      id: `store-${persona.id}`,
      name: persona.name,
      icon: persona.icon,
      description: persona.description,
      systemPrompt: persona.system_prompt,
      builtIn: false,
    };
    localStorage.setItem("aureon_custom_personas", JSON.stringify([...existing, newPersona]));
    setInstalledIds(prev => new Set([...prev, persona.id]));
    toast({ title: "Persona installed", description: `${persona.name} added to your sidebar.` });
    // Dispatch event so Dashboard picks it up
    window.dispatchEvent(new Event("aureon-personas-change"));
  };

  const publishPersona = async (persona: SharedPersona, makePublic: boolean) => {
    await supabase.from("shared_personas" as any).update({ is_public: makePublic }).eq("id", persona.id);
    setMyPersonas(prev => prev.map(p => p.id === persona.id ? { ...p, is_public: makePublic } : p));
    toast({ title: makePublic ? "Persona published to store" : "Persona set to private" });
  };

  const deleteSharedPersona = async (id: string) => {
    await supabase.from("shared_personas" as any).delete().eq("id", id);
    setMyPersonas(prev => prev.filter(p => p.id !== id));
    toast({ title: "Persona deleted from store" });
  };

  // Publish a local custom persona to the store
  const [publishing, setPublishing] = useState(false);
  const [pubName, setPubName] = useState("");
  const [pubDesc, setPubDesc] = useState("");
  const [pubPrompt, setPubPrompt] = useState("");
  const [pubIcon, setPubIcon] = useState("target");
  const [pubCategory, setPubCategory] = useState("general");
  const [pubPublic, setPubPublic] = useState(true);

  const handlePublish = async () => {
    if (!user || !pubName.trim()) return;
    const { error } = await supabase.from("shared_personas" as any).insert({
      user_id: user.id,
      name: pubName.trim(),
      icon: pubIcon,
      description: pubDesc.trim(),
      system_prompt: pubPrompt.trim(),
      category: pubCategory,
      is_public: pubPublic,
    });
    if (!error) {
      toast({ title: "Persona published!" });
      setPublishing(false);
      setPubName(""); setPubDesc(""); setPubPrompt(""); setPubIcon("target"); setPubCategory("general");
      loadData();
    }
  };

  const filtered = (tab === "browse" ? storePersonas : myPersonas).filter(p => {
    if (category !== "all" && p.category !== category) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const previewPersona = filtered.find(p => p.id === previewId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-extralight tracking-wide text-foreground">Persona Store</h1>
            <p className="text-xs font-extralight text-muted-foreground mt-1">Browse, install, and share AI personas</p>
          </div>
          <button
            onClick={() => setPublishing(!publishing)}
            className="flex items-center gap-2 rounded-xl bg-foreground/10 px-4 py-2 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Publish Persona
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setTab("browse")}
            className={`flex items-center gap-2 pb-2 text-xs font-light border-b-2 transition-colors ${
              tab === "browse" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="h-3.5 w-3.5" /> Browse Store
          </button>
          <button
            onClick={() => setTab("my")}
            className={`flex items-center gap-2 pb-2 text-xs font-light border-b-2 transition-colors ${
              tab === "my" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> My Personas
          </button>
        </div>

        {/* Search & Category filter */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personas…"
              className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-light capitalize whitespace-nowrap transition-colors ${
                  category === cat ? "bg-foreground/10 text-foreground" : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Publish form */}
          {publishing && (
            <div className="mb-6 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-3">
              <h3 className="text-sm font-light text-foreground">Publish a New Persona</h3>
              <div className="flex gap-1 flex-wrap">
                {ICON_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => setPubIcon(opt.id)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${pubIcon === opt.id ? "bg-foreground/15 ring-1 ring-foreground/30" : "hover:bg-foreground/5"}`}>
                    <opt.Icon className="h-3.5 w-3.5 text-foreground" />
                  </button>
                ))}
              </div>
              <input value={pubName} onChange={e => setPubName(e.target.value)} placeholder="Persona name"
                className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/20 pb-1" />
              <input value={pubDesc} onChange={e => setPubDesc(e.target.value)} placeholder="Short description"
                className="w-full bg-transparent text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/20 pb-1" />
              <textarea value={pubPrompt} onChange={e => setPubPrompt(e.target.value)} placeholder="System prompt (the brain)"
                rows={4} className="w-full bg-transparent text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none border border-border/20 rounded-lg p-2 resize-none" />
              <div className="flex items-center gap-3">
                <select value={pubCategory} onChange={e => setPubCategory(e.target.value)}
                  className="bg-transparent text-xs font-light text-foreground border border-border/20 rounded-lg px-3 py-1.5 outline-none">
                  {CATEGORIES.filter(c => c !== "all").map(c => <option key={c} value={c} className="bg-card text-foreground">{c}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs font-light text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={pubPublic} onChange={e => setPubPublic(e.target.checked)}
                    className="rounded border-border/30" />
                  {pubPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {pubPublic ? "Public" : "Private"}
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePublish} disabled={!pubName.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground/10 px-4 py-1.5 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-40">
                  <Sparkles className="h-3.5 w-3.5" /> Publish
                </button>
                <button onClick={() => setPublishing(false)}
                  className="rounded-lg px-4 py-1.5 text-xs font-light text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Preview modal */}
          {previewPersona && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setPreviewId(null)}>
              <div className="max-w-lg w-full mx-4 rounded-2xl border border-border/20 bg-card/90 backdrop-blur-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  {(() => { const Ic = ICON_MAP[previewPersona.icon] || Target; return <Ic className="h-6 w-6 text-foreground" />; })()}
                  <div>
                    <h3 className="text-sm font-light text-foreground">{previewPersona.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{previewPersona.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-1"><Download className="h-3 w-3" />{previewPersona.installs} installs</span>
                  <span className="capitalize">{previewPersona.category}</span>
                </div>
                <div className="rounded-xl border border-border/20 bg-card/20 p-3 max-h-48 overflow-y-auto">
                  <p className="text-[10px] font-light text-muted-foreground uppercase tracking-wider mb-1">System Prompt (Brain)</p>
                  <p className="text-[11px] font-extralight text-foreground/80 whitespace-pre-wrap">{previewPersona.system_prompt || "(No system prompt)"}</p>
                </div>
                <div className="flex gap-2">
                  {!installedIds.has(previewPersona.id) && previewPersona.user_id !== user?.id && (
                    <button onClick={() => { installPersona(previewPersona); setPreviewId(null); }}
                      className="flex items-center gap-1.5 rounded-lg bg-foreground/10 px-4 py-2 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors">
                      <Download className="h-3.5 w-3.5" /> Install
                    </button>
                  )}
                  <button onClick={() => setPreviewId(null)}
                    className="rounded-lg px-4 py-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-xs font-extralight text-muted-foreground animate-pulse">Loading personas…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-extralight text-muted-foreground">
                {tab === "browse" ? "No personas found. Be the first to publish one!" : "You haven't published any personas yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(persona => {
                const Ic = ICON_MAP[persona.icon] || Target;
                const isInstalled = installedIds.has(persona.id);
                const isMine = persona.user_id === user?.id;

                return (
                  <div
                    key={persona.id}
                    className="group rounded-2xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-3 hover:border-border/40 transition-colors cursor-pointer"
                    onClick={() => setPreviewId(persona.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-foreground/5 flex items-center justify-center">
                          <Ic className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-light text-foreground truncate">{persona.name}</p>
                          <p className="text-[10px] text-muted-foreground/60 capitalize">{persona.category}</p>
                        </div>
                      </div>
                      {isMine && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button onClick={() => publishPersona(persona, !persona.is_public)}
                            className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground/50 hover:text-foreground transition-colors" title={persona.is_public ? "Make private" : "Make public"}>
                            {persona.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          </button>
                          <button onClick={() => deleteSharedPersona(persona.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground/50 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-extralight text-muted-foreground line-clamp-2">{persona.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
                        <span className="flex items-center gap-1"><Download className="h-3 w-3" />{persona.installs}</span>
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        {isInstalled ? (
                          <span className="text-[10px] font-light text-emerald-500/70">Installed</span>
                        ) : !isMine ? (
                          <button onClick={() => installPersona(persona)}
                            className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1 text-[10px] font-light text-foreground hover:bg-foreground/15 transition-colors">
                            <Download className="h-3 w-3" /> Install
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PersonaStoreView;
