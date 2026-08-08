// Asherin Maps — Street camera client.
//
// The browser cannot pull DOT camera catalogues directly (no CORS on the
// agency JSON endpoints), so the catalogue is resolved server-side by the
// `asher-street-cameras` edge function. Camera *images* are then loaded
// straight into <img> tags, which is a cross-origin read the browser allows.

import { supabase } from "@/integrations/supabase/client";

export interface StreetCamera {
  id: string;
  lat: number;
  lng: number;
  name: string;
  roadway?: string;
  direction?: string;
  /** Still-image endpoint, refreshable with a cache-busting query. */
  imageUrl?: string;
  /** HLS / MJPEG stream, when the agency publishes one. */
  streamUrl?: string;
  source: string;
  operator?: string;
  /** Distance from the query anchor, metres. */
  distanceM?: number;
}

export interface CameraSweep {
  cameras: StreetCamera[];
  /** Feeds that answered, e.g. ["Caltrans CCTV", "OpenStreetMap"]. */
  sources: string[];
  /** Human note when a jurisdiction publishes no open feed. */
  coverageNote?: string;
}

export interface CameraQuery {
  /** Anchor point (used with radiusM). */
  center?: { lat: number; lng: number };
  /** Route polyline — cameras are gathered along the whole corridor. */
  path?: Array<{ lat: number; lng: number }>;
  radiusM?: number;
  limit?: number;
}

export interface CameraQueryOpts {
  signal?: AbortSignal;
  /** Hard ceiling on the round trip. Agency catalogues fan out; without this
   *  a slow feed leaves the UI spinning forever and the operator reads that
   *  as "the button does nothing". */
  timeoutMs?: number;
}

export async function fetchStreetCameras(q: CameraQuery, opts: CameraQueryOpts = {}): Promise<CameraSweep> {
  // Thin the polyline before it crosses the wire: an OSRM `overview=full`
  // route can carry thousands of vertices and the corridor sampler only needs
  // a point every few hundred metres.
  const path = q.path && q.path.length > 2 ? thin(q.path, 60) : q.path;

  const timeoutMs = opts.timeoutMs ?? 30_000;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const { data, error } = await supabase.functions.invoke("asher-street-cameras", {
      body: {
        center: q.center,
        path,
        radiusM: q.radiusM ?? 1200,
        limit: q.limit ?? 60,
      },
      // The Supabase client forwards this to fetch, so the abort really cancels.
      signal: ctrl.signal,
    });


    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Camera sweep failed");

    return {
      cameras: Array.isArray(data.cameras) ? data.cameras : [],
      sources: Array.isArray(data.sources) ? data.sources : [],
      coverageNote: data.coverageNote,
    };
  } catch (e: any) {
    if (ctrl.signal.aborted && !opts.signal?.aborted) {
      throw new Error(`Camera catalogue did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw e instanceof Error ? e : new Error("Camera sweep failed");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

/** Radii walked when the operator has not named one, metres.
 *  A 4 km sweep over rural ground returns nothing and reads as a dead button;
 *  escalating outward guarantees the panel says something true either way. */
export const CAMERA_LADDER = [4_000, 15_000, 50_000] as const;

/**
 * Sweep outward until cameras are found. Returns the first non-empty sweep,
 * or the last (empty) one with its coverage note intact so the UI can explain
 * the silence instead of pretending the click never happened.
 */
export async function sweepCamerasEscalating(
  center: { lat: number; lng: number },
  opts: CameraQueryOpts & { ladder?: readonly number[]; limit?: number } = {},
): Promise<CameraSweep & { radiusM: number }> {
  const ladder = opts.ladder ?? CAMERA_LADDER;
  let last: CameraSweep = { cameras: [], sources: [], coverageNote: undefined };
  let usedRadius = ladder[ladder.length - 1];

  for (const radiusM of ladder) {
    if (opts.signal?.aborted) break;
    const sweep = await fetchStreetCameras({ center, radiusM, limit: opts.limit ?? 120 }, opts);
    last = sweep;
    usedRadius = radiusM;
    if (sweep.cameras.length) break;
  }
  return { ...last, radiusM: usedRadius };
}


/** Evenly sample a polyline down to at most `max` vertices, keeping the ends. */
function thin<T>(pts: T[], max: number): T[] {
  if (pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

/** Cache-busted still URL so a refresh actually pulls a new frame. */
export function liveFrameUrl(cam: StreetCamera, tick: number): string | undefined {
  if (!cam.imageUrl) return undefined;
  const sep = cam.imageUrl.includes("?") ? "&" : "?";
  return `${cam.imageUrl}${sep}_t=${tick}`;
}
