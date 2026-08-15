/**
 * Hands — the workspaces asherin opens when an organ runs.
 *
 * Chat is the mouth. Maps is a hand that docks beside the thread — it does
 * not steal the conversation. IDE / ghost / whiteboard still take the rail
 * because those rooms are the work. Maps must stay co-visible with the ask.
 */

export interface HandOpen {
  surface: "maps" | "ide" | "ghost" | "whiteboard";
  organ: string;
  focus?: string;
}

const VIEW_OF: Record<HandOpen["surface"], string> = {
  maps: "geospatial",
  ide: "ide",
  ghost: "ghost-engine",
  whiteboard: "whiteboard",
};

/** Fired so the dashboard can split to a workspace without a full navigation. */
export const HAND_OPEN_EVENT = "asherin:hand-open";

export function isHandOpen(value: unknown): value is HandOpen {
  const v = value as HandOpen | null;
  return Boolean(v && typeof v.surface === "string" && v.surface in VIEW_OF);
}

/**
 * Opens at most one hand per turn. Maps docks in-place (no go()).
 * Other hands still navigate — one flip, not three.
 */
export function openHands(hands: unknown[], go: (view: string) => void): HandOpen | null {
  const valid = (hands || []).filter(isHandOpen);
  const hand = valid[0];
  if (!hand) return null;

  if (hand.surface === "maps") {
    const focus = String(hand.focus || "").trim();
    void import("@/lib/geoIntent")
      .then(({ detectGeoIntent, requestMapFocus }) => {
        const geo =
          detectGeoIntent(focus) ||
          (focus ? { place: focus, property: false, zoom: /\d{1,6}\s+\w/.test(focus) ? 17 : 12 } : null);
        if (geo) requestMapFocus(geo);
      })
      .catch(() => {
        /* a failed focus must never block the mouth */
      });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(HAND_OPEN_EVENT, { detail: hand }));
    }
    return hand;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HAND_OPEN_EVENT, { detail: hand }));
  }
  go(VIEW_OF[hand.surface]);
  return hand;
}
