// AsherAIPanel — right-side AI co-pilot inside the Intelligence Map.
// Streams from supabase/functions/asher-ai with tool-calls that drive the map.

import { useEffect, useRef, useState } from "react";
import { Brain, Send, Loader2, ChevronRight, ChevronLeft, Sparkles, Image as ImageIcon, Crosshair, MapPin, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseChatCards } from "@/lib/chatCards/parseChatCards";
import ChatCardRenderer from "@/components/chatCards/ChatCardRenderer";
import { supabase } from "@/integrations/supabase/client";
import { logAsherEvent } from "@/lib/asherAudit";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { toast } from "sonner";
import NumberedFormatToggle, { isNumberedFormatEnabled } from "@/components/dashboard/NumberedFormatToggle";

export type ReconDetection = {
  lat: number; lng: number;
  label: string; color?: string; confidence: number; reason?: string;
};

export type TemporalTrack = {
  lat: number; lng: number;
  label: string; color?: string;
  first_seen: number; last_seen: number;
  years_present: number[];
  confidence: number; reason?: string;
};

/** A point the AI can express either as coordinates or as a geocodable place. */
export type GeoRef = { lat?: number; lng?: number; place?: string };

export type MapAction =
  | { type: "search"; query: string }
  | { type: "toggle_threat"; layer: "earthquakes" | "wildfires" | "aircraft"; enabled: boolean }
  | { type: "save_target"; label?: string }
  | { type: "analyze_entity" }
  | { type: "property_intel"; address?: string; entityName?: string }
  | { type: "visual_recon"; center: { lat: number; lng: number }; bbox: [number, number, number, number]; detections: ReconDetection[]; summary?: string; area?: string; landmark?: string }
  | { type: "temporal_recon"; center: { lat: number; lng: number }; bbox: [number, number, number, number]; tracks: TemporalTrack[]; years: number[]; frames: Array<{ year: number; source: string; detection_count: number; summary: string }>; area?: string; landmark?: string }
  | { type: "set_base"; layer: "street" | "satellite" | "topo" | "dark" }
  /* ── Overlay editing ── */
  | { type: "place_marker"; label: string; ref: GeoRef; note?: string; category?: string; color?: string }
  | { type: "add_label"; text: string; ref: GeoRef; color?: string }
  | { type: "draw_radius"; label: string; radiusKm: number; ref: GeoRef; note?: string; category?: string; color?: string }
  | { type: "draw_zone"; label: string; points: GeoRef[]; note?: string; category?: string; color?: string }
  | { type: "draw_route"; label: string; waypoints: GeoRef[]; note?: string; color?: string }
  | { type: "measure"; from: GeoRef; to: GeoRef }
  | { type: "clear_annotations"; scope: string }
  | { type: "list_annotations" }
  /* ── Analytical tradecraft (terrain, mobility, pattern-of-life) ── */
  | { type: "run_viewshed"; ref: GeoRef; radiusKm?: number; observerHeightM?: number; label?: string }
  | { type: "elevation_profile"; from: GeoRef; to: GeoRef; label?: string }
  | { type: "road_route"; from: GeoRef; to: GeoRef; label?: string }
  | { type: "solar_analysis"; ref: GeoRef; iso?: string }
  | { type: "detect_colocation"; radiusM?: number }
  | { type: "generate_briefing" }
  /* ── Own-force tracking. The model may only *request* the sensor; the
     operator's explicit consent is what actually opens it. ── */
  | { type: "track_location"; mode: "start" | "stop" | "status" | "center" | "follow" | "unfollow"; reason?: string }
  | { type: "distance_from_me"; to: GeoRef; label?: string }
  | { type: "geofence"; label: string; radiusM: number; ref?: GeoRef }
  /* ── Navigation, discovery and live imagery (Asherin Maps parity set) ── */
  | { type: "get_directions"; from?: GeoRef; to: GeoRef; mode?: "driving" | "walking" | "cycling"; withCameras?: boolean }
  | { type: "find_nearby"; category?: string; query?: string; ref?: GeoRef; radiusM?: number; openNow?: boolean }
  | { type: "find_jobs"; role: string; ref?: GeoRef; radiusMi?: number }
  | { type: "street_cameras"; ref?: GeoRef; radiusM?: number; alongRoute?: boolean }
  | { type: "locate_device"; name?: string }
  /* ── Cloud Intelligence overlays ───────────────────────────────────── */
  | { type: "plot_cloud_contacts"; query?: string; limit?: number }
  | { type: "plot_cloud_venues"; limit?: number }
  | { type: "plot_cloud_security"; sinceDays?: number }
  | { type: "focus_cloud_contact"; email?: string; name?: string };



/* Tool arguments arrive as untyped JSON from the model — coerce defensively so
   a hallucinated string ("2km") or null never reaches the map as NaN. */
const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : undefined;
};
const toGeoRef = (v: any): GeoRef => ({
  lat: num(v?.lat), lng: num(v?.lng), place: str(v?.place ?? v?.name ?? (typeof v === "string" ? v : undefined)),
});
const toGeoRefs = (v: any): GeoRef[] => (Array.isArray(v) ? v.map(toGeoRef) : []);

export interface AsherAIPanelHandle {
  appendSystemNote: (text: string) => void;
}


interface Props {
  mapContext: Record<string, any>;
  onAction: (a: MapAction) => Promise<string | void>;
  onClose?: () => void;
  /** Fires whenever the dock expands or collapses so the map chrome can
   *  reserve horizontal space and never render controls underneath it. */
  onDockedChange?: (docked: boolean) => void;
}

interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image?: string;
  actions?: { label: string; status: "ok" | "fail" | "info" }[];
}

const AsherAIPanel = ({ mapContext, onAction, onDockedChange }: Props) => {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { onDockedChange?.(!collapsed); }, [collapsed, onDockedChange]);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "**ASHER AI · Online**\n\nI can drive **and edit** the map for you.\n\n**Navigate & layers**\n- *Fly to Kyiv* · *Show live earthquakes* · *Switch to satellite*\n\n**Edit the overlay**\n- *Pin the port of Odesa as a target, note: crane activity*\n- *Draw a 5km ring around Ramstein Air Base*\n- *Outline a zone over Manhattan south of 14th street*\n- *Draw a route from Warsaw to Lviv to Kyiv*\n- *Measure from here to Sevastopol* · *Clear the overlay*\n\n**Recon & OSINT**\n- *Find all red or blue roofs in northern New Delhi near the Kali Temple*\n- *Locate construction cranes in Doha west bay*\n- *Look up phone +44 7700 900123* (country / carrier / line type / public OSINT — not live GPS)\n- *Property intel on this site* · *Save this target*",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [imagineBusy, setImagineBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const runImagine = async (prompt: string) => {
    setImagineBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("asher-imagine", { body: { prompt } });
      if (error) throw error;
      if (data?.image) {
        setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: `**Imagine** — ${prompt}`, image: data.image }]);
        logAsherEvent("module_open", { module: "imagine_render", prompt: prompt.slice(0, 80) });
      } else {
        toast.error("No image returned");
      }
    } catch (e: any) {
      toast.error(e?.message || "Imagine failed");
    } finally {
      setImagineBusy(false);
    }
  };

  const dispatchToolCall = async (name: string, args: any): Promise<string> => {
    try {
      switch (name) {
        case "map_search": {
          await onAction({ type: "search", query: String(args?.query ?? "") });
          return `Flew to "${args?.query}".`;
        }
        case "toggle_threat_layer": {
          await onAction({ type: "toggle_threat", layer: args?.layer, enabled: !!args?.enabled });
          return `${args?.enabled ? "Enabled" : "Disabled"} ${args?.layer} overlay.`;
        }
        case "save_current_target": {
          await onAction({ type: "save_target", label: args?.label });
          return "Target saved to dossier vault.";
        }
        case "analyze_entity": {
          const summary = await onAction({ type: "analyze_entity" });
          return typeof summary === "string" ? summary : "Entity context loaded.";
        }
        case "set_base_layer": {
          await onAction({ type: "set_base", layer: args?.layer });
          return `Base layer → ${args?.layer}.`;
        }

        /* ── Overlay editing — the map is writable ─────────────────────── */
        case "place_marker": {
          const r = await onAction({
            type: "place_marker",
            label: String(args?.label ?? "Marker"),
            ref: { lat: num(args?.lat), lng: num(args?.lng), place: str(args?.place) },
            note: str(args?.note), category: str(args?.category), color: str(args?.color),
          });
          return typeof r === "string" ? r : "Marker placed.";
        }
        case "add_label": {
          const r = await onAction({
            type: "add_label",
            text: String(args?.text ?? "Label"),
            ref: { lat: num(args?.lat), lng: num(args?.lng), place: str(args?.place) },
            color: str(args?.color),
          });
          return typeof r === "string" ? r : "Label placed.";
        }
        case "draw_radius": {
          const r = await onAction({
            type: "draw_radius",
            label: String(args?.label ?? "Radius"),
            radiusKm: Number(args?.radiusKm) || 1,
            ref: { lat: num(args?.lat), lng: num(args?.lng), place: str(args?.place) },
            note: str(args?.note), category: str(args?.category), color: str(args?.color),
          });
          return typeof r === "string" ? r : "Radius drawn.";
        }
        case "draw_zone": {
          const r = await onAction({
            type: "draw_zone",
            label: String(args?.label ?? "Zone"),
            points: toGeoRefs(args?.points),
            note: str(args?.note), category: str(args?.category), color: str(args?.color),
          });
          return typeof r === "string" ? r : "Zone drawn.";
        }
        case "draw_route": {
          const r = await onAction({
            type: "draw_route",
            label: String(args?.label ?? "Route"),
            waypoints: toGeoRefs(args?.waypoints),
            note: str(args?.note), color: str(args?.color),
          });
          return typeof r === "string" ? r : "Route drawn.";
        }
        case "measure": {
          const r = await onAction({
            type: "measure",
            from: toGeoRef(args?.from),
            to: toGeoRef(args?.to),
          });
          return typeof r === "string" ? r : "Measurement drawn.";
        }
        case "clear_annotations": {
          const r = await onAction({ type: "clear_annotations", scope: String(args?.scope ?? "all") });
          return typeof r === "string" ? r : "Overlay cleared.";
        }
        case "list_annotations": {
          const r = await onAction({ type: "list_annotations" });
          return typeof r === "string" ? r : "Overlay is empty.";
        }

        /* ── Analytical tradecraft ──────────────────────────────────────
           Each of these runs a real computation against live terrain,
           ephemeris or road-graph data and returns a text product the model
           reads back in the follow-up turn. */
        case "run_viewshed": {
          const r = await onAction({
            type: "run_viewshed",
            ref: toGeoRef(args?.ref ?? args),
            radiusKm: num(args?.radiusKm),
            observerHeightM: num(args?.observerHeightM),
            label: str(args?.label),
          });
          return typeof r === "string" ? r : "Viewshed computed.";
        }
        case "elevation_profile": {
          const r = await onAction({
            type: "elevation_profile", from: toGeoRef(args?.from), to: toGeoRef(args?.to), label: str(args?.label),
          });
          return typeof r === "string" ? r : "Profile computed.";
        }
        case "road_route": {
          const r = await onAction({
            type: "road_route", from: toGeoRef(args?.from), to: toGeoRef(args?.to), label: str(args?.label),
          });
          return typeof r === "string" ? r : "Route computed.";
        }
        case "get_directions": {
          const r = await onAction({
            type: "get_directions",
            from: args?.from ? toGeoRef(args.from) : undefined,
            to: toGeoRef(args?.to ?? args?.destination ?? args),
            mode: (["driving", "walking", "cycling"] as const).find((m) => m === str(args?.mode)) ?? "driving",
            withCameras: args?.withCameras === true || args?.cameras === true,
          });
          return typeof r === "string" ? r : "Directions plotted.";
        }
        case "find_nearby": {
          const r = await onAction({
            type: "find_nearby",
            category: str(args?.category),
            query: str(args?.query ?? args?.what),
            ref: args?.ref || args?.near ? toGeoRef(args?.ref ?? args?.near) : undefined,
            radiusM: num(args?.radiusM),
            openNow: args?.openNow === true,
          });
          return typeof r === "string" ? r : "Nearby search complete.";
        }
        case "find_jobs": {
          const role = str(args?.role ?? args?.query ?? args?.what);
          if (!role) return "Name the role to hunt for — e.g. \"line cook\" or \"forklift operator\".";
          const r = await onAction({
            type: "find_jobs",
            role,
            ref: args?.ref || args?.near ? toGeoRef(args?.ref ?? args?.near) : undefined,
            radiusMi: num(args?.radiusMi ?? args?.radius),
          });
          return typeof r === "string" ? r : "Hiring sweep complete.";
        }
        case "locate_device": {
          const r = await onAction({ type: "locate_device", name: str(args?.name ?? args?.device ?? args?.query) });
          return typeof r === "string" ? r : "Device located.";
        }
        case "street_cameras": {
          const r = await onAction({
            type: "street_cameras",
            ref: args?.ref ? toGeoRef(args.ref) : undefined,
            radiusM: num(args?.radiusM),
            alongRoute: args?.alongRoute === true || args?.route === true,
          });
          return typeof r === "string" ? r : "Camera sweep complete.";
        }
        case "solar_analysis": {
          const r = await onAction({ type: "solar_analysis", ref: toGeoRef(args?.ref ?? args), iso: str(args?.iso) });
          return typeof r === "string" ? r : "Solar geometry computed.";
        }
        case "detect_colocation": {
          const r = await onAction({ type: "detect_colocation", radiusM: num(args?.radiusM) });
          return typeof r === "string" ? r : "Co-location scan complete.";
        }
        case "generate_briefing": {
          const r = await onAction({ type: "generate_briefing" });
          return typeof r === "string" ? r : "Briefing generated.";
        }
        case "track_my_location": {
          const raw = String(args?.mode ?? args?.action ?? "start").toLowerCase();
          const mode = (["start", "stop", "status", "center", "follow", "unfollow"].includes(raw) ? raw : "start") as
            | "start" | "stop" | "status" | "center" | "follow" | "unfollow";
          const r = await onAction({ type: "track_location", mode, reason: str(args?.reason) });
          return typeof r === "string" ? r : "Tracking request handled.";
        }
        case "distance_from_me": {
          const r = await onAction({ type: "distance_from_me", to: toGeoRef(args?.to ?? args), label: str(args?.label) });
          return typeof r === "string" ? r : "Range computed.";
        }
        case "set_geofence": {
          const r = await onAction({
            type: "geofence",
            label: str(args?.label) ?? "Geofence",
            radiusM: num(args?.radiusM) ?? (num(args?.radiusKm) ?? 0.5) * 1000,
            ref: args?.ref ? toGeoRef(args.ref) : undefined,
          });
          return typeof r === "string" ? r : "Geofence armed.";
        }

        case "property_intel": {
          // Notify parent (so its property panel can refresh too)
          try { await onAction({ type: "property_intel", address: args?.address, entityName: args?.entityName }); } catch {}
          // Pull the OSINT directly so we can stream a rich summary back into chat

          const sel = (mapContext as any)?.selectedEntity;
          const address = args?.address || sel?.address;
          const entityName = args?.entityName || sel?.entityName;
          if (!address && !entityName) return "Property intel: no address or entity selected.";
          const byok = getActiveIntelMapByok();
          const { data, error } = await supabase.functions.invoke("asher-property-intel", {
            body: {
              address, entityName,
              lat: sel?.lat, lng: sel?.lng,
              ...(byok ? { byok: byok.apiKey } : {}),
            },
          });
          if (error) return `Property intel failed: ${error.message}`;
          if (!data?.success) return `Property intel failed: ${data?.error || "unknown"}`;
          const intel = data.intel || {};
          const lines: string[] = [];
          if (intel.summary) lines.push(`**Brief:** ${intel.summary}`);
          const kv: Array<[string, any]> = [
            ["Owner", intel.owner], ["Operator", intel.operator],
            ["Type", intel.property_type], ["Year Built", intel.year_built],
            ["Size", intel.size], ["Est. Value", intel.value_estimate],
          ];
          const facts = kv.filter(([, v]) => !!v).map(([k, v]) => `- **${k}:** ${v}`).join("\n");
          if (facts) lines.push(facts);
          if (Array.isArray(intel.tenants_or_occupants) && intel.tenants_or_occupants.length)
            lines.push(`**Tenants/Occupants:**\n` + intel.tenants_or_occupants.slice(0, 6).map((x: string) => `- ${x}`).join("\n"));
          if (Array.isArray(intel.history) && intel.history.length)
            lines.push(`**History:**\n` + intel.history.slice(0, 6).map((x: string) => `- ${x}`).join("\n"));
          if (Array.isArray(intel.risks) && intel.risks.length)
            lines.push(`**Risks:**\n` + intel.risks.slice(0, 6).map((x: string) => `- ${x}`).join("\n"));
          if (Array.isArray(data.sources) && data.sources.length)
            lines.push(`**Sources:**\n` + data.sources.slice(0, 5).map((s: any, i: number) => `${i + 1}. [${s.title || s.url}](${s.url})`).join("\n"));
          return lines.join("\n\n") || "Property intel: no facts extracted.";
        }
        case "phone_intel": {
          const phone = String(args?.phone ?? "").trim();
          const defaultCountry = args?.defaultCountry ? String(args.defaultCountry).toUpperCase() : undefined;
          if (!phone) return "Phone intel: phone number required.";
          const byok = getActiveIntelMapByok();
          const { data, error } = await supabase.functions.invoke("asher-phone-intel", {
            body: { phone, defaultCountry, ...(byok ? { byok: byok.apiKey } : {}) },
          });
          if (error) return `Phone intel failed: ${error.message}`;
          if (!data?.success) return `Phone intel failed: ${data?.error || "invalid number"}`;
          const p = data.phone || {};
          const o = data.osint || {};
          // Fly map to country centroid (country-level only)
          if (data.geo?.lat && data.geo?.lng) {
            try { await onAction({ type: "search", query: `${data.geo.country_name || p.country_name || p.country}` }); } catch {}
          }
          const lines: string[] = [];
          lines.push(`**Phone Intel · ${p.international || phone}**`);
          lines.push([
            `- **Country:** ${p.country_name || p.country || "?"} (${p.country_calling_code || ""})`,
            `- **Line type:** ${p.line_type}`,
            `- **National:** ${p.national}`,
            `- **E.164:** ${p.e164}`,
          ].join("\n"));
          if (o.summary) lines.push(`**Brief:** ${o.summary}`);
          if (o.owner_or_business) lines.push(`- **Listed as:** ${o.owner_or_business}`);
          if (o.risk_assessment) lines.push(`- **Risk:** ${o.risk_assessment}`);
          if (Array.isArray(o.spam_or_scam_reports) && o.spam_or_scam_reports.length)
            lines.push(`**Spam/Scam reports:**\n` + o.spam_or_scam_reports.slice(0, 5).map((x: string) => `- ${x}`).join("\n"));
          if (Array.isArray(o.public_listings) && o.public_listings.length)
            lines.push(`**Public listings:**\n` + o.public_listings.slice(0, 5).map((x: string) => `- ${x}`).join("\n"));
          if (Array.isArray(o.social_or_breach_mentions) && o.social_or_breach_mentions.length)
            lines.push(`**Social / breach mentions:**\n` + o.social_or_breach_mentions.slice(0, 5).map((x: string) => `- ${x}`).join("\n"));
          if (Array.isArray(o.associated_locations) && o.associated_locations.length)
            lines.push(`**Associated locations:**\n` + o.associated_locations.slice(0, 5).map((x: string) => `- ${x}`).join("\n"));
          if (Array.isArray(data.sources) && data.sources.length)
            lines.push(`**Sources:**\n` + data.sources.slice(0, 5).map((s: any, i: number) => `${i + 1}. [${s.title || s.url}](${s.url})`).join("\n"));
          lines.push(`\n_${data.disclaimer}_`);
          return lines.join("\n\n");
        }
        case "generate_image": {
          await runImagine(String(args?.prompt ?? "tactical sketch"));
          return `Imagine dispatched: ${args?.prompt}`;
        }
        case "visual_recon": {
          const area = String(args?.area ?? "").trim();
          const criteria = String(args?.criteria ?? "").trim();
          const landmark = args?.landmark ? String(args.landmark) : undefined;
          const radiusKm = typeof args?.radiusKm === "number" ? args.radiusKm : undefined;
          if (!area || !criteria) return "Visual recon: need area and criteria.";
          const byok = getActiveIntelMapByok();
          const { data, error } = await supabase.functions.invoke("asher-visual-recon", {
            body: { area, criteria, landmark, radiusKm, ...(byok ? { byok: byok.apiKey } : {}) },
          });
          if (error) return `Visual recon failed: ${error.message}`;
          if (!data?.success) return `Visual recon failed: ${data?.error || "unknown"}`;
          const dets: ReconDetection[] = data.detections || [];
          try {
            await onAction({
              type: "visual_recon",
              center: data.center,
              bbox: data.bbox,
              detections: dets,
              summary: data.summary,
              area: data.area,
              landmark: data.landmark,
            });
          } catch {}
          const lines: string[] = [];
          lines.push(`**Visual Recon · ${dets.length} match${dets.length === 1 ? "" : "es"}**`);
          if (data.area) lines.push(`Area: ${data.area}`);
          if (data.landmark) lines.push(`Landmark: ${data.landmark}`);
          if (data.summary) lines.push(`\n${data.summary}`);
          if (dets.length) {
            lines.push("\n**Top detections:**");
            dets.slice(0, 8).forEach((d, i) => {
              lines.push(`${i + 1}. **${d.label}** — ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)} · ${(d.confidence * 100).toFixed(0)}%${d.reason ? ` — ${d.reason}` : ""}`);
            });
          } else {
            lines.push("\nNo matches in the imaged tile. Try widening the radius or refining the criteria.");
          }
          return lines.join("\n");
        }
        case "temporal_recon": {
          const area = String(args?.area ?? "").trim();
          const criteria = String(args?.criteria ?? "").trim();
          const landmark = args?.landmark ? String(args.landmark) : undefined;
          const radiusKm = typeof args?.radiusKm === "number" ? args.radiusKm : undefined;
          const startYear = typeof args?.startYear === "number" ? args.startYear : undefined;
          const endYear = typeof args?.endYear === "number" ? args.endYear : undefined;
          const stride = typeof args?.stride === "number" ? args.stride : undefined;
          if (!area || !criteria) return "Temporal recon: need area and criteria.";
          const byok = getActiveIntelMapByok();
          const { data, error } = await supabase.functions.invoke("asher-temporal-recon", {
            body: { area, criteria, landmark, radiusKm, startYear, endYear, stride, ...(byok ? { byok: byok.apiKey } : {}) },
          });
          if (error) return `Temporal recon failed: ${error.message}`;
          if (!data?.success) return `Temporal recon failed: ${data?.error || "unknown"}`;
          const tracks: TemporalTrack[] = data.tracks || [];
          const frames: Array<{ year: number; source: string; detection_count: number; summary: string }> = data.frames || [];
          try {
            await onAction({
              type: "temporal_recon",
              center: data.center, bbox: data.bbox,
              tracks, years: data.years || [], frames,
              area: data.area, landmark: data.landmark,
            });
          } catch {}
          const lines: string[] = [];
          lines.push(`**Temporal Recon · ${tracks.length} track${tracks.length === 1 ? "" : "s"} across ${frames.length} year frame${frames.length === 1 ? "" : "s"}**`);
          if (data.area) lines.push(`Area: ${data.area}`);
          if (data.landmark) lines.push(`Landmark: ${data.landmark}`);
          lines.push("");
          lines.push("| Year | Source | Detections |");
          lines.push("|---|---|---|");
          frames.forEach((f) => lines.push(`| ${f.year} | ${f.source} | ${f.detection_count} |`));
          if (tracks.length) {
            lines.push("\n**Persistent features (with first-seen):**");
            tracks.slice(0, 10).forEach((t, i) => {
              const span = t.first_seen === t.last_seen ? `${t.first_seen} only` : `${t.first_seen} → ${t.last_seen}`;
              lines.push(`${i + 1}. **${t.label}** — ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)} · since **${t.first_seen}** (${span}, ${t.years_present.length} frames)${t.reason ? ` — ${t.reason}` : ""}`);
            });
          }
          return lines.join("\n");
        }

        /* ── Cloud Intelligence map overlays ─────────────────────────────── */
        case "plot_cloud_contacts": {
          const r = await onAction({
            type: "plot_cloud_contacts",
            query: str(args?.query),
            limit: num(args?.limit) ?? 50,
          });
          return typeof r === "string" ? r : "Cloud contacts plotted.";
        }
        case "plot_cloud_venues": {
          const r = await onAction({ type: "plot_cloud_venues" });
          return typeof r === "string" ? r : "Cloud venues plotted.";
        }
        case "plot_cloud_security": {
          const r = await onAction({ type: "plot_cloud_security", sinceDays: num(args?.sinceDays) ?? 30 });
          return typeof r === "string" ? r : "Cloud security events plotted.";
        }
        case "focus_cloud_contact": {
          const r = await onAction({
            type: "focus_cloud_contact",
            email: str(args?.email),
            name: str(args?.name),
          });
          return typeof r === "string" ? r : "Cloud contact focused.";
        }
      }
    } catch (e: any) {
      return `Tool failed: ${e?.message || e}`;
    }
    return "";
  };

  /* ── Autonomous execution loop ────────────────────────────────────────
     A single round can only ever be "call tools, stop". Elite tradecraft is
     multi-step: geocode → viewshed → read the visible fraction → decide where
     the second sensor goes. So each round's tool output is fed back as a new
     turn and the model runs again, up to MAX_ROUNDS. The loop terminates on
     the first round that emits no tool calls, which is also the round that
     produces the analyst-facing prose — so a plain question still costs one
     round, exactly as before. */
  const MAX_ROUNDS = 4;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setBusy(true);

    // Transcript the loop reasons over. Kept local so mid-loop React state
    // updates can never produce a stale-closure history.
    const transcript: Array<{ role: string; content: string }> = [
      ...messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    /** Non-2xx handling stays INSIDE the map — never bounce to Aureon chat. */
    const failInline = (content: string) => {
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content }]);
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asher-ai`;
      // The edge function identifies the caller from this JWT (admin bypass /
      // tier gate / free-tier fallback all key off it). Sending the anon
      // publishable key made every request look anonymous → hard 403.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("Session expired — sign in again to use Asher AI.");
        setBusy(false);
        return;
      }
      const mapByok = getActiveIntelMapByok();

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${accessToken}`,
            ...(mapByok?.provider === "google" && mapByok.apiKey
              ? { "x-byok-gemini-key": mapByok.apiKey }
              : {}),
          },
          body: JSON.stringify({
            mapContext,
            numberedFormat: isNumberedFormatEnabled("asher-ai"),
            ...(mapByok ? { byok: mapByok } : {}),
            messages: transcript,
          }),
        });

        if (resp.status === 429) return failInline("**RATE LIMITED**\n\nThe intelligence core is throttling requests. Wait a few seconds and re-send.");
        if (resp.status === 402) return failInline("**CREDITS EXHAUSTED**\n\nAI credits are spent for this workspace. Top up, or add your own key in Settings → AI Keys.");
        if (resp.status === 401 || resp.status === 403) {
          const { triggerByokRequired } = await import("@/components/ByokRequiredDialog");
          triggerByokRequired({ source: "asher-ai", reason: "Add your AI key to run the map co-pilot.", noRedirect: true });
          return failInline("**KEY REQUIRED**\n\nThis session has no usable model key. Add one in Settings → AI Keys — the map and your overlay stay exactly as they are.");
        }
        if (resp.status === 503 || resp.status === 502) return failInline("**CORE OVERLOADED**\n\nThe intelligence core is saturated or upstream returned an error. Re-send the command in a moment.");
        if (!resp.ok || !resp.body) {
          const detail = await resp.text().catch(() => "");
          throw new Error(detail?.slice(0, 200) || `Asher AI request failed (${resp.status})`);
        }

        const assistantId = crypto.randomUUID();
        let assistantText = "";
        const actionsList: { label: string; status: "ok" | "fail" | "info" }[] = [];
        setMessages((p) => [...p, { id: assistantId, role: "assistant", content: "" }]);

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let done = false;

        // Aggregate tool calls across deltas
        const toolBuf: Record<number, { name: string; args: string }> = {};

        while (!done) {
          const { value, done: d } = await reader.read();
          if (d) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") { done = true; break; }
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                assistantText += delta.content;
                setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, content: assistantText } : m));
              }
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const i = tc.index ?? 0;
                  if (!toolBuf[i]) toolBuf[i] = { name: "", args: "" };
                  if (tc.function?.name) toolBuf[i].name = tc.function.name;
                  if (tc.function?.arguments) toolBuf[i].args += tc.function.arguments;
                }
              }
            } catch {
              buf = line + "\n" + buf; break;
            }
          }
        }

        // Execute tool calls after the stream closes.
        const toolCalls = Object.values(toolBuf).filter((t) => t.name);
        const toolResults: string[] = [];
        for (const tc of toolCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.args || "{}"); } catch {}
          const result = await dispatchToolCall(tc.name, args);
          if (result) toolResults.push(`### ${tc.name}\n${result}`);
          actionsList.push({ label: result || tc.name, status: result.startsWith("Tool failed") ? "fail" : "ok" });
        }
        if (actionsList.length) {
          setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, actions: actionsList } : m));
        }

        // No tools this round → the model has delivered its final analysis.
        if (!toolCalls.length) {
          if (!assistantText.trim()) {
            const fallback = "**ASHER AI · NO RESPONSE PAYLOAD**\n\nThe intelligence core returned an empty stream. Re-send the command or narrow the request.";
            setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, content: fallback } : m));
          }
          return;
        }

        // Tools ran. Drop the empty placeholder bubble (the visible product is
        // the action chip list) and feed results back for the next round.
        if (!assistantText.trim()) {
          setMessages((p) => p.map((m) => m.id === assistantId
            ? { ...m, content: toolResults.length ? toolResults.join("\n\n") : "Executed." }
            : m));
        }
        transcript.push({ role: "assistant", content: assistantText.trim() || `Executed: ${toolCalls.map((t) => t.name).join(", ")}` });
        transcript.push({
          role: "user",
          content: `TOOL RESULTS (system-generated, not operator speech). Use these facts to continue the task, or give the final analysis if the objective is met.\n\n${toolResults.join("\n\n") || "(no output)"}`,
        });

        // Final round guard: never leave the operator without prose.
        if (round === MAX_ROUNDS - 1) {
          setMessages((p) => [...p, {
            id: crypto.randomUUID(), role: "assistant",
            content: "**STEP LIMIT REACHED**\n\nExecuted the maximum autonomous steps for one command. Review the overlay and issue the next instruction.",
          }]);
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Asher AI failed");
    } finally {
      setBusy(false);
    }
  };


  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-16 right-3 z-[1100] flex items-center gap-2 rounded-xl border border-border/30 bg-card/85 backdrop-blur-md px-3 py-2 text-xs text-foreground hover:bg-foreground/5"
      >
        <Brain className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span className="tracking-[0.2em] uppercase text-[10px]">Asher AI</span>
        <ChevronLeft className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="absolute top-3 right-3 bottom-3 z-[1100] flex w-[380px] flex-col rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/15 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Asher AI</p>
          <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">Map Co-Pilot</p>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1 text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Quick actions */}
      <div className="border-b border-border/15 px-3 py-2 flex flex-wrap gap-1.5">
        <QuickChip icon={Zap} label="Earthquakes" onClick={() => onAction({ type: "toggle_threat", layer: "earthquakes", enabled: true })} />
        <QuickChip icon={Zap} label="Wildfires"   onClick={() => onAction({ type: "toggle_threat", layer: "wildfires",   enabled: true })} />
        <QuickChip icon={Zap} label="Aircraft"    onClick={() => onAction({ type: "toggle_threat", layer: "aircraft",    enabled: true })} />
        <QuickChip icon={MapPin}    label="Satellite" onClick={() => onAction({ type: "set_base", layer: "satellite" })} />
        <QuickChip icon={Crosshair} label="Save Target" onClick={() => onAction({ type: "save_target" })} />
        <QuickChip icon={Sparkles} label="Property Intel" onClick={() => { setInput("Run property_intel on the selected location"); setTimeout(() => send(), 0); }} />
        <QuickChip icon={Sparkles} label="Phone Intel" onClick={() => { setInput("Run phone_intel on +"); }} />
      </div>

      {/* Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`text-xs font-light leading-relaxed ${m.role === "user" ? "text-foreground" : "text-foreground/85"}`}>
            <div className="text-[9px] tracking-[0.25em] text-muted-foreground/60 uppercase mb-1">
              {m.role === "user" ? "Operator" : "Asher AI"}
            </div>
            <div className="prose prose-invert prose-xs max-w-none [&_*]:text-foreground/85 [&_strong]:text-foreground">
              {parseChatCards(m.content || "").map((seg, i) =>
                seg.type === "card" || seg.type === "card-unknown" ? (
                  <ChatCardRenderer key={`c-${i}`} segment={seg} source="chat:asher" />
                ) : (
                  <ReactMarkdown
                    key={`t-${i}`}
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children, ...props }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline underline-offset-2 decoration-accent/60 hover:decoration-accent break-all"
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {seg.value || (i === 0 && !m.content ? "…" : "")}
                  </ReactMarkdown>
                )
              )}
            </div>
            {m.image && (
              <img src={m.image} alt="Imagine result" className="mt-2 rounded-lg border border-border/20 max-w-full" />
            )}
            {m.actions && m.actions.length > 0 && (
              <div className="mt-2 space-y-1">
                {m.actions.map((a, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-md border px-2 py-1 text-[10px] ${
                    a.status === "ok" ? "border-emerald-400/30 text-emerald-300" :
                    a.status === "fail" ? "border-red-400/30 text-red-300" :
                    "border-border/30 text-muted-foreground"
                  }`}>
                    <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                    <span>{a.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-[10px] tracking-wide text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Reasoning…
          </div>
        )}
        {imagineBusy && (
          <div className="flex items-center gap-2 text-[10px] tracking-wide text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Imagine rendering…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/15 p-3 space-y-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask Asher AI to drive the map…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="rounded-lg bg-foreground/90 px-3 py-2 text-background hover:bg-foreground disabled:opacity-40"
            title="Send"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => input.trim() && runImagine(input.trim())}
              disabled={imagineBusy || !input.trim()}
              className="flex items-center gap-1.5 text-[10px] tracking-[0.15em] text-muted-foreground hover:text-foreground uppercase disabled:opacity-30"
            >
              <ImageIcon className="h-3 w-3" strokeWidth={1.5} /> Imagine
            </button>
            <NumberedFormatToggle scopeId="asher-ai" />
          </div>
          <p className="text-[9px] tracking-[0.2em] text-muted-foreground/40 uppercase">Enter to send · Shift+Enter newline</p>
        </div>
      </div>
    </div>
  );
};

const QuickChip = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 rounded-md border border-border/25 bg-background/30 px-2 py-1 text-[10px] tracking-wide text-muted-foreground hover:text-foreground hover:border-border/40"
  >
    <Icon className="h-3 w-3" strokeWidth={1.5} />
    {label}
  </button>
);

export default AsherAIPanel;
