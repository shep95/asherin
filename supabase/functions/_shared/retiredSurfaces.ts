import { getCorsHeaders } from "./cors.ts";

/**
 * Product surfaces removed from sale must fail closed at every server entry point,
 * not only disappear from the dashboard navigation.
 */
export const RETIRED_SURFACES = new Set(["geospatial", "zacoon", "axrlen", "zeeion", "timeseries"]);

export function retiredSurfaceResponse(req: Request, surface: string): Response | null {
  if (!RETIRED_SURFACES.has(surface)) return null;
  return new Response(
    JSON.stringify({
      error: "SURFACE_RETIRED",
      surface,
      message: "This surface is no longer available.",
    }),
    { status: 410, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
  );
}
