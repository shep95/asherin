/**
 * Hands — the workspaces asherin opens when an organ runs.
 *
 * Chat carries intent, the folded software runs, and the surface that owns the
 * result opens itself. The operator does not hunt a missing tab. A hand only
 * ever arrives behind a real invoke: the backend derives these from organs that
 * actually returned bytes, so nothing here should be inferred from prompt text.
 *
 * Retired surfaces have no route. An unknown surface is dropped silently rather
 * than navigated to, because a dead view id in the URL is worse than no split.
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
 * Opens at most one hand per turn. Two organs can both own a surface, and
 * flipping the operator through three views mid-answer would be motion for its
 * own sake — the first hand wins and the rest stay in the tool cards.
 */
export function openHands(
  hands: unknown[],
  go: (view: string) => void,
): HandOpen | null {
  const valid = (hands || []).filter(isHandOpen);
  const hand = valid[0];
  if (!hand) return null;

  if (hand.surface === "maps" && hand.focus) {
    // The map module owns the geocode and the fly; chat only names the focus.
    void import("@/lib/geoIntent")
      .then(({ detectGeoIntent, requestMapFocus }) => {
        const geo = detectGeoIntent(hand.focus!);
        if (geo) requestMapFocus(geo);
      })
      .catch(() => { /* a failed focus must never block the split */ });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HAND_OPEN_EVENT, { detail: hand }));
  }
  go(VIEW_OF[hand.surface]);
  return hand;
}
