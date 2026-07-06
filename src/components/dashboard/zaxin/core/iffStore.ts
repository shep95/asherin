// IFF Store — per-contact Friend/Foe tag, persisted locally.
//
// NARRATIVE
// Ghost Recon's Cross-Com and Iron Man's threat prioritizer both key off an
// IFF (Identify-Friend-or-Foe) tag. Zaxin previously showed every contact in
// the same gold. An operator couldn't glance at the HUD and know "that
// AirTag is *mine*, this Flipper Zero is *hostile*, that phone is *neutral*."
//
// FLAW FIXES
// - localStorage only, keyed on contact.id. RPA addresses rotate every ~15
//   minutes, so tags naturally age out with the identity — this is the
//   correct privacy behavior, not a bug.
// - Cross-tab sync via `storage` events so a tag set on one dashboard tab
//   propagates to the AR camera tab instantly.
// - Never touches user PII — tag + note only, no contact-name shadow copy.

export type Iff = "friend" | "neutral" | "suspect" | "hostile" | "unknown";

const IFF_KEY = "zaxin.iff.v1";

interface IffRecord {
  tag: Iff;
  note?: string;
  ts: number;
}

type Store = Record<string, IffRecord>;

function read(): Store {
  try {
    const raw = localStorage.getItem(IFF_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}
function write(s: Store) {
  try { localStorage.setItem(IFF_KEY, JSON.stringify(s)); } catch { /* quota */ }
}

const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === IFF_KEY) listeners.forEach((fn) => fn());
  });
}

export const iffStore = {
  get(id: string): Iff {
    return read()[id]?.tag ?? "unknown";
  },
  set(id: string, tag: Iff, note?: string) {
    const s = read();
    s[id] = { tag, note, ts: Date.now() };
    write(s);
    listeners.forEach((fn) => fn());
  },
  clear(id: string) {
    const s = read();
    delete s[id];
    write(s);
    listeners.forEach((fn) => fn());
  },
  all(): Store {
    return read();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const IFF_COLOR: Record<Iff, string> = {
  friend:  "rgba(74,222,128,0.95)",
  neutral: "rgba(232,198,132,0.85)",
  suspect: "rgba(251,146,60,0.95)",
  hostile: "rgba(248,113,113,0.95)",
  unknown: "rgba(200,200,200,0.55)",
};

export const IFF_GLYPH: Record<Iff, string> = {
  friend:  "◉", neutral: "◈", suspect: "▲", hostile: "◆", unknown: "◌",
};
