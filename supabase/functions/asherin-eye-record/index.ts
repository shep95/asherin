// ─────────────────────────────────────────────────────────────────────────────
// asherin.eye — the recorder.
//
// The avoidance layer is worthless without history, and history only exists if
// something starts writing today. This function is that writer, and it is
// deliberately the narrowest possible one:
//
//   op="record"   the tab posts the contacts it is already displaying. Raw
//                 fixes land in the caller's OWN table (eye_track_samples,
//                 RLS-scoped to them). The same batch is folded into a shared,
//                 anonymous per-cell hourly tally (eye_grid_hourly) — counts
//                 only: no hex, no callsign, no operator id. Nobody can tell
//                 from the grid who was watching.
//
//   op="grid"     read the shared tally inside a bounding box over a window.
//
//   op="tracks"   read back only YOUR OWN raw fixes for one aircraft.
//
// Refusals held here:
//   • a JWT is required and the user id comes from the verified token, never
//     from the body. A client cannot write rows as someone else.
//   • the batch is capped and every number is coerced and bounded before it
//     reaches SQL. Grid writes go through one security-definer routine that
//     clamps its own inputs again.
//   • per-caller write throttle, because a loop in a tab must not become a
//     write amplifier against the shared grid.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const CELL_DEG = 0.25;
const INV = 1 / CELL_DEG;
const MAX_BATCH = 400;
/** one write per caller per this interval; the tab polls faster than it needs to record */
const WRITE_EVERY_MS = 20_000;
const lastWrite = new Map<string, number>();

interface Fix {
  id: string;
  lat: number;
  lon: number;
  alt?: number;
  speed?: number;
  heading?: number;
  label?: string;
  kind?: string;
}

function num(v: unknown, lo: number, hi: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return n;
}

function clean(rows: unknown): Fix[] {
  if (!Array.isArray(rows)) return [];
  const out: Fix[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(0, MAX_BATCH)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const lat = num(o.lat, -90, 90);
    const lon = num(o.lon, -180, 180);
    const id = String(o.id ?? "").trim().slice(0, 24).toLowerCase();
    if (lat === null || lon === null || !id || !/^[a-z0-9_~-]+$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      lat,
      lon,
      alt: num(o.alt, -500, 120_000) ?? undefined,
      speed: num(o.speed, 0, 3000) ?? undefined,
      heading: num(o.heading, -360, 360) ?? undefined,
      label: String(o.label ?? "").trim().slice(0, 16) || undefined,
      kind: String(o.kind ?? "").trim().slice(0, 16).replace(/[^a-z]/gi, "") || undefined,
    });
  }
  return out;
}

function fold(rows: Fix[]) {
  const acc = new Map<string, { cy: number; cx: number; samples: number; ids: Set<string>; alt_sum: number; alt_n: number }>();
  for (const r of rows) {
    const cy = Math.floor(r.lat * INV);
    const cx = Math.floor(r.lon * INV);
    const k = `${cy}:${cx}`;
    const cur = acc.get(k) ?? { cy, cx, samples: 0, ids: new Set<string>(), alt_sum: 0, alt_n: 0 };
    cur.samples += 1;
    cur.ids.add(r.id);
    if (typeof r.alt === "number" && r.alt > 0) {
      cur.alt_sum += Math.round(r.alt);
      cur.alt_n += 1;
    }
    acc.set(k, cur);
  }
  return [...acc.values()].map((c) => ({
    cy: c.cy,
    cx: c.cx,
    samples: c.samples,
    contacts: c.ids.size,
    alt_sum: c.alt_sum,
    alt_n: c.alt_n,
  }));
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "sign in to record" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: auth, error: authErr } = await asUser.auth.getUser();
    const user = auth?.user;
    if (authErr || !user) return json({ error: "sign in to record" }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const op = String(body.op ?? "record");

    // ── read the shared grid ────────────────────────────────────────────────
    if (op === "grid") {
      const south = num(body.south, -90, 90) ?? -90;
      const north = num(body.north, -90, 90) ?? 90;
      const west = num(body.west, -180, 180) ?? -180;
      const east = num(body.east, -180, 180) ?? 180;
      const days = Math.min(30, Math.max(1, Number(body.days) || 7));
      const since = new Date(Date.now() - days * 86_400_000).toISOString();

      const { data, error } = await admin
        .from("eye_grid_hourly")
        .select("cy,cx,samples,contacts,alt_sum,alt_n,hour_utc")
        .gte("hour_utc", since)
        .gte("cy", Math.floor(Math.min(south, north) * INV))
        .lte("cy", Math.ceil(Math.max(south, north) * INV))
        .gte("cx", Math.floor(Math.min(west, east) * INV))
        .lte("cx", Math.ceil(Math.max(west, east) * INV))
        .limit(20000);
      if (error) throw error;

      // collapse hours into one cell row; keep the hour count so the client can
      // say out loud how young the grid is.
      const acc = new Map<string, { cy: number; cx: number; samples: number; contacts: number; alt_sum: number; alt_n: number; hours: Set<string> }>();
      for (const r of data ?? []) {
        const k = `${r.cy}:${r.cx}`;
        const cur = acc.get(k) ?? { cy: r.cy, cx: r.cx, samples: 0, contacts: 0, alt_sum: 0, alt_n: 0, hours: new Set<string>() };
        cur.samples += r.samples ?? 0;
        cur.contacts += r.contacts ?? 0;
        cur.alt_sum += Number(r.alt_sum ?? 0);
        cur.alt_n += r.alt_n ?? 0;
        cur.hours.add(String(r.hour_utc));
        acc.set(k, cur);
      }
      const cells = [...acc.values()].map((c) => ({
        cy: c.cy,
        cx: c.cx,
        samples: c.samples,
        contacts: c.contacts,
        altMean: c.alt_n ? Math.round(c.alt_sum / c.alt_n) : null,
        hours: c.hours.size,
      }));
      const distinctHours = new Set((data ?? []).map((r) => String(r.hour_utc))).size;
      return json({
        cells,
        distinctHours,
        days,
        note: "grid counts only · no hex, no callsign, no operator · a cell is what this deployment happened to be watching",
      });
    }

    // ── read back your own raw fixes ────────────────────────────────────────
    if (op === "tracks") {
      const icao = String(body.icao ?? "").toLowerCase().slice(0, 12);
      if (!/^[a-f0-9]{4,8}$/.test(icao)) return json({ error: "that is not an icao hex" }, 400);
      const { data, error } = await asUser
        .from("eye_track_samples")
        .select("lat,lon,alt_m,gs_kt,track_deg,observed_at")
        .eq("icao", icao)
        .order("observed_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return json({ rows: data ?? [], note: "your own recorded fixes for this airframe · not a flight-history vendor" });
    }

    // ── write ───────────────────────────────────────────────────────────────
    if (op !== "record") return json({ error: "unknown op" }, 400);

    const now = Date.now();
    const prev = lastWrite.get(user.id) ?? 0;
    if (now - prev < WRITE_EVERY_MS) {
      return json({ recorded: 0, cells: 0, throttled: true, nextInMs: WRITE_EVERY_MS - (now - prev) });
    }
    lastWrite.set(user.id, now);

    const rows = clean(body.rows);
    if (!rows.length) return json({ recorded: 0, cells: 0 });

    const observedAt = new Date().toISOString();
    const { error: insErr } = await admin.from("eye_track_samples").insert(
      rows.map((r) => ({
        user_id: user.id,
        icao: r.id,
        callsign: r.label ?? null,
        lat: r.lat,
        lon: r.lon,
        alt_m: r.alt != null ? Math.round(r.alt) : null,
        gs_kt: r.speed ?? null,
        track_deg: r.heading ?? null,
        kind: r.kind ?? null,
        observed_at: observedAt,
      })),
    );
    if (insErr) throw insErr;

    const cells = fold(rows);
    const { error: gridErr } = await admin.rpc("eye_grid_absorb", { _cells: cells });
    if (gridErr) throw gridErr;

    return json({ recorded: rows.length, cells: cells.length, at: observedAt });
  } catch (e) {
    return json({ error: (e as Error).message || "recorder unavailable" }, 200);
  }
});
