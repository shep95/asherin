// organRouter — the organism contract for an asherin chat turn.
//
// Chat is the mouth: it carries intent, nothing else. The folded software are
// organs: real edge functions that run and return live bytes. Workspaces are
// hands: Maps, the IDE, the Ghost origin pane, the Whiteboard — surfaces that
// must OPEN when the organ that owns them runs, so the operator never hunts a
// tab. Connect is the trace.
//
// Three invariants live here and nowhere else, so a future leg cannot quietly
// break them by forgetting a check:
//
//   1. A retired module never routes. NOMAD, Cipher, video-intel, vibe-video,
//      CROSS, bulwark, geo-audit, media2code and the persona layer were
//      deleted; a classifier that still names them would resurrect dead
//      surfaces as hallucinations. `isRoutableOrgan` is the single gate.
//   2. Guardian Vault secrets are not an organ. The knowledge vault (documents
//      the operator uploaded) is readable; the secret store is not, at any
//      depth, in any prompt.
//   3. An organ is never costumed. There is no "you are the X agent" string in
//      this file and there must not be one downstream: the organ either ran
//      and produced bytes, or it is reported offline.

/** Every organ chat may route to, and the hand it opens when it runs. */
export type OrganId =
  | "maps"
  | "zophiel"
  | "ghost"
  | "zerlal"
  | "azplen"
  | "axrlen"
  | "google"
  | "ide"
  | "zahten"
  | "briefings"
  | "notebooks"
  | "knowledge-vault"
  | "library"
  | "zeeion"
  | "file-scrapper"
  | "zali"
  | "gematria"
  | "vedic"
  | "docs"
  | "pattern"
  | "timeseries"
  | "zaxin"
  | "zacoon"
  | "snippets"
  | "chat";

/** The workspace surface an organ owns. `null` means the organ has no hand. */
export type HandSurface = "maps" | "ide" | "ghost" | "whiteboard" | null;

interface OrganSpec {
  /** Short operator-facing noun. Lowercase — output conduct applies. */
  label: string;
  /** Dashboard view id the hand opens, if the organ owns one. */
  hand: HandSurface;
  /** Dashboard view this organ's own surface lives at, for deep links. */
  view: string | null;
}

const ORGANS: Record<OrganId, OrganSpec> = {
  maps: { label: "asherin maps", hand: "maps", view: "geospatial" },
  zophiel: { label: "zophiel search", hand: null, view: "search" },
  ghost: { label: "ghost", hand: "ghost", view: "ghost-engine" },
  zerlal: { label: "zerlal recon", hand: null, view: "zerlal" },
  azplen: { label: "azplen", hand: null, view: "azplen" },
  axrlen: { label: "axrlen", hand: null, view: "timeseries" },
  google: { label: "google intelligence", hand: null, view: "google" },
  ide: { label: "asherin ide", hand: "ide", view: "ide" },
  zahten: { label: "zahten", hand: null, view: "zahten" },
  briefings: { label: "briefings", hand: null, view: "briefing" },
  notebooks: { label: "notebooks", hand: null, view: "notebooks" },
  "knowledge-vault": { label: "knowledge vault", hand: null, view: "knowledge-vault" },
  library: { label: "library", hand: null, view: "library" },
  zeeion: { label: "zeeion", hand: null, view: "zeeion" },
  "file-scrapper": { label: "file scrapper", hand: null, view: "file-scrapper" },
  zali: { label: "zali design lab", hand: "whiteboard", view: "zali" },
  gematria: { label: "gematria", hand: null, view: "gematria" },
  vedic: { label: "vedic", hand: null, view: "vedic-astrology" },
  docs: { label: "docs", hand: null, view: "pdf-generator" },
  pattern: { label: "pattern analysis", hand: null, view: "pattern-analysis" },
  timeseries: { label: "timeseries", hand: null, view: "timeseries" },
  zaxin: { label: "zaxin", hand: "maps", view: "zaxin" },
  zacoon: { label: "zacoon", hand: null, view: "zacoon" },
  snippets: { label: "snippets", hand: null, view: "snippets" },
  chat: { label: "chat", hand: null, view: "chat" },
};

/**
 * Deleted surfaces. These ids must never appear in a plan, a trace row, a hand,
 * or a prompt line. Kept as strings rather than OrganIds precisely because they
 * are not organs — the type system should reject any attempt to route one.
 */
const RETIRED = new Set<string>([
  "nomad",
  "cipher",
  "video-intel",
  "video-intelligence",
  "vibe-video",
  "cross",
  "bulwark",
  "geo-audit",
  "media2code",
  "persona",
  "imagine-intelligence",
  "self-learning",
]);

export function isRoutableOrgan(id: string): id is OrganId {
  if (RETIRED.has(id)) return false;
  return Object.prototype.hasOwnProperty.call(ORGANS, id);
}

export function organLabel(id: string): string {
  return isRoutableOrgan(id) ? ORGANS[id].label : id;
}

export function organView(id: string): string | null {
  return isRoutableOrgan(id) ? ORGANS[id].view : null;
}

export function organHand(id: string): HandSurface {
  return isRoutableOrgan(id) ? ORGANS[id].hand : null;
}

/** A workspace the client must open because an organ actually ran this turn. */
export interface HandOpen {
  surface: Exclude<HandSurface, null>;
  organ: OrganId;
  /** Free-text focus the surface uses (a place to fly to, a host to pin). */
  focus?: string;
}

/**
 * Turns the set of organs that REALLY ran into hands to open. Nothing is
 * derived from intent alone: a classifier guess that opened Maps for a turn
 * where no map organ ran would be theatre, and the operator would learn to
 * distrust the surface.
 */
export function handsForOrgans(
  organs: string[],
  focus?: Partial<Record<string, string>>,
): HandOpen[] {
  const out: HandOpen[] = [];
  const seen = new Set<string>();
  for (const id of organs) {
    if (!isRoutableOrgan(id)) continue;
    const hand = ORGANS[id].hand;
    if (!hand || seen.has(hand)) continue;
    seen.add(hand);
    out.push({ surface: hand, organ: id, focus: focus?.[id] });
  }
  return out.slice(0, 3);
}

// ── Intent classification ────────────────────────────────────────────────────
//
// This is a coarse read used for trace and hand hints only. It does NOT decide
// whether an organ runs — each bridge owns its own imperative-strength trigger,
// because a loose classifier that fired real invokes would spend the operator's
// quota on a passing mention. Silence here is not evidence of an idle turn.

const INTENT: Array<[OrganId, RegExp]> = [
  // Cartographic intent also arrives as ownership and street-address language:
  // "who owns 1600 pennsylvania ave" is a map question even without the word map.
  ["maps", /\b(map|satellite|coordinates?|lat(itude)?\s*[,/]?\s*long|fly\s+to|street\s+view|parcel|rooftop|nearby|within\s+\d+\s*(m|km|mi|miles)\b|address|who\s+owns|property\s+(record|owner|intel))\b|\b\d{1,6}\s+[a-z0-9.'-]+\s+(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|hwy|highway|pkwy|parkway)\b/i],
  ["ghost", /\b(ghost|origin\s+pane|source\s+page|cached\s+copy|archive\s+of\s+the\s+page)\b/i],
  ["zophiel", /\b(zophiel|osint|open[-\s]web\s+sweep|dork|breach\s+check|leak\s+check)\b/i],
  ["zerlal", /\b(zerlal|attack\s*surface|subdomains?|security\s+posture|recon)\b/i],
  ["azplen", /\b(azplen|ingest\s+(this\s+)?dataset|entity\s+resolution)\b/i],
  ["axrlen", /\b(axrlen|scenario\s+(run|forecast)|probabilistic\s+forecast|geopolitical\s+forecast)\b/i],
  ["google", /\bmy\s+(gmail|inbox|e-?mail|calendar|schedule|drive|contacts)\b|\b(daily\s+digest|commitments?|dossier)\b/i],
  ["ide", /\b(ide|refactor|write\s+(the\s+)?code|patch\s+this\s+file|coding\s+laws?|compile|stack\s+trace)\b/i],
  ["zahten", /\b(zahten|scheduled\s+agent|run\s+the\s+procedure)\b/i],
  ["briefings", /\b(brief\s+me\s+on|briefing\s+(on|about)|daily\s+brief)\b/i],
  ["notebooks", /\b(notebook|run\s+this\s+cell|sql\s+cell)\b/i],
  ["knowledge-vault", /\b(knowledge\s+vault|in\s+my\s+vault|from\s+the\s+vault)\b/i],
  ["library", /\b@file\b|\bmy\s+(uploaded\s+)?(files?|documents?)\b/i],
  ["zeeion", /\b(zeeion|cost\s+savings?|spend\s+forensics?|financial\s+waste)\b/i],
  ["file-scrapper", /\b(scrape|extract\s+text\s+from|parse\s+this\s+(pdf|doc|file))\b/i],
  ["zali", /\b(zali|dfm|design\s+for\s+manufactur|simulat(e|ion))\b/i],
  ["gematria", /\b(gematria|numerolog)\b/i],
  ["vedic", /\b(vedic|nakshatra|dasha|transit\s+chart)\b/i],
  ["docs", /\b(generate\s+a\s+(pdf|report\s+file)|export\s+as\s+pdf)\b/i],
  ["pattern", /\b(pattern\s+analysis|recurring\s+pattern|anomaly\s+pattern)\b/i],
  ["timeseries", /\b(time\s*series|trend\s+line|forecast\s+the\s+series)\b/i],
  ["zaxin", /\b(zaxin|ar\s+overlay|ble\s+scan)\b/i],
  ["zacoon", /\b(zacoon|phantom\s+grid|web\s+operative)\b/i],
  ["snippets", /\b(snippet|save\s+this\s+as\s+a\s+snippet)\b/i],
];

/**
 * Reads which organs the operator is asking for. Retired ids are structurally
 * unreachable: they are not in the table, and `isRoutableOrgan` gates the
 * result a second time so a future edit cannot slip one back in.
 */
export function classifyOrgans(text: string): OrganId[] {
  const raw = String(text || "");
  if (!raw.trim()) return [];
  const hits: OrganId[] = [];
  for (const [id, re] of INTENT) {
    if (re.test(raw) && isRoutableOrgan(id)) hits.push(id);
  }
  return hits.slice(0, 6);
}
