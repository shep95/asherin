import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Crosshair, Trash2, MapPin } from "lucide-react";
import { logAsherEvent } from "@/lib/asherAudit";

interface SavedTarget {
  id: string;
  label: string;
  lat: number;
  lng: number;
  payload: Record<string, any>;
  notes: string | null;
  created_at: string;
}

const AsherSavedTargets = () => {
  const [rows, setRows] = useState<SavedTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("asher_saved_targets")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data || []) as unknown as SavedTarget[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    await supabase.from("asher_saved_targets").delete().eq("id", id);
    logAsherEvent("target_deleted", { id });
    setRows((p) => p.filter((r) => r.id !== id));
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase mb-2">Asher Module</p>
        <h2 className="text-3xl font-extralight tracking-wide text-foreground flex items-center gap-3 mb-2">
          <Crosshair className="h-6 w-6" strokeWidth={1.25} />
          Saved Targets
        </h2>
        <p className="text-xs font-light text-muted-foreground/70 mb-6">
          Persistent dossier vault. Save entities from the Intelligence Map and recall them across sessions.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-xs font-light tracking-wide">Loading dossiers…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-10 text-center text-muted-foreground/60 text-sm font-light">
            No saved targets yet. Click any location on the Intelligence Map and use <span className="text-foreground/80">Save Target</span>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map((t) => (
              <div key={t.id} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-light text-foreground truncate">{t.label}</p>
                    <p className="text-[10px] tracking-wide text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" strokeWidth={1.5} />
                      {t.lat.toFixed(4)}°, {t.lng.toFixed(4)}°
                    </p>
                  </div>
                  <button
                    onClick={() => remove(t.id)}
                    className="p-1.5 rounded-md text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10"
                    title="Delete dossier"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                {t.payload?.country && (
                  <p className="mt-2 text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase">{t.payload.country}</p>
                )}
                {t.payload?.weather && (
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {t.payload.weather.temperature_2m}°C · wind {t.payload.weather.wind_speed_10m} km/h
                  </p>
                )}
                <p className="mt-3 text-[9px] tracking-[0.2em] text-muted-foreground/40 uppercase">
                  Saved {new Date(t.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AsherSavedTargets;
