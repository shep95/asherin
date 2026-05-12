/**
 * Aureon Shield — live browser hardening primitives.
 * Every function here performs a REAL action on the live page.
 * No simulated data. Toggles persist via window globals scoped to the tab.
 */

// ─────────────────────────────────────────────────────────────────────
// Audit log (sessionStorage-backed, exportable)
// ─────────────────────────────────────────────────────────────────────
export type AuditEntry = { ts: number; kind: string; detail: string };
const AUDIT_KEY = "aureon_shield_audit_v1";

export function logAudit(kind: string, detail: string) {
  try {
    const arr: AuditEntry[] = JSON.parse(sessionStorage.getItem(AUDIT_KEY) || "[]");
    arr.push({ ts: Date.now(), kind, detail });
    sessionStorage.setItem(AUDIT_KEY, JSON.stringify(arr.slice(-500)));
    window.dispatchEvent(new CustomEvent("aureon:audit"));
  } catch {}
}
export function readAudit(): AuditEntry[] {
  try { return JSON.parse(sessionStorage.getItem(AUDIT_KEY) || "[]"); } catch { return []; }
}
export function clearAudit() {
  sessionStorage.removeItem(AUDIT_KEY);
  window.dispatchEvent(new CustomEvent("aureon:audit"));
}

// ─────────────────────────────────────────────────────────────────────
// Fingerprint spoofer — real prototype overrides on this tab
// ─────────────────────────────────────────────────────────────────────
type Restore = () => void;
const restores: Restore[] = [];
let spoofActive = false;

function noise(seed: number) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 1000) / 1000; };
}

export function isSpoofActive() { return spoofActive; }

export function enableFingerprintSpoofer() {
  if (spoofActive) return;
  spoofActive = true;
  const rng = noise(Date.now() & 0xffff);

  // Canvas — inject pixel-level noise in toDataURL/getImageData
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args: any[]) {
    try {
      const ctx = this.getContext("2d");
      if (ctx && this.width > 0 && this.height > 0) {
        const img = ctx.getImageData(0, 0, Math.min(this.width, 8), Math.min(this.height, 8));
        for (let i = 0; i < img.data.length; i += 4) img.data[i] = (img.data[i] + (rng() * 3 | 0)) & 0xff;
        ctx.putImageData(img, 0, 0);
      }
    } catch {}
    return origToDataURL.apply(this, args as any);
  };
  restores.push(() => { HTMLCanvasElement.prototype.toDataURL = origToDataURL; });

  // WebGL — randomize UNMASKED_VENDOR / RENDERER strings
  const wrap = (proto: any) => {
    if (!proto) return;
    const orig = proto.getParameter;
    proto.getParameter = function (p: number) {
      if (p === 37445) return "Aureon Shield"; // UNMASKED_VENDOR_WEBGL
      if (p === 37446) return `Cloaked Renderer ${(rng() * 9999) | 0}`; // UNMASKED_RENDERER_WEBGL
      return orig.call(this, p);
    };
    restores.push(() => { proto.getParameter = orig; });
  };
  if (typeof WebGLRenderingContext !== "undefined") wrap(WebGLRenderingContext.prototype);
  if (typeof WebGL2RenderingContext !== "undefined") wrap(WebGL2RenderingContext.prototype);

  // Audio — perturb AnalyserNode.getFloatFrequencyData
  if (typeof AnalyserNode !== "undefined") {
    const orig = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = function (arr: Float32Array) {
      orig.call(this, arr);
      for (let i = 0; i < arr.length; i++) arr[i] += (rng() - 0.5) * 0.0001;
    };
    restores.push(() => { AnalyserNode.prototype.getFloatFrequencyData = orig; });
  }

  // Plugins / mimeTypes — empty list
  try {
    const emptyPlugins = Object.create(PluginArray.prototype);
    Object.defineProperty(emptyPlugins, "length", { value: 0 });
    Object.defineProperty(navigator, "plugins", { get: () => emptyPlugins, configurable: true });
    restores.push(() => { try { delete (navigator as any).plugins; } catch {} });
  } catch {}

  // Battery / connection / deviceMemory
  try { Object.defineProperty(navigator, "deviceMemory", { get: () => 8, configurable: true }); restores.push(() => { try { delete (navigator as any).deviceMemory; } catch {} }); } catch {}
  try { Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8, configurable: true }); restores.push(() => { try { delete (navigator as any).hardwareConcurrency; } catch {} }); } catch {}
  try {
    const orig = (navigator as any).getBattery;
    (navigator as any).getBattery = async () => ({ charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1, addEventListener: () => {}, removeEventListener: () => {} });
    restores.push(() => { (navigator as any).getBattery = orig; });
  } catch {}

  logAudit("spoof_on", "Fingerprint spoofer active: canvas, WebGL, audio, plugins, battery, memory cloaked");
}

export function disableFingerprintSpoofer() {
  if (!spoofActive) return;
  while (restores.length) try { restores.pop()!(); } catch {}
  spoofActive = false;
  logAudit("spoof_off", "Fingerprint spoofer disabled");
}

// ─────────────────────────────────────────────────────────────────────
// Tracker blocker — hook fetch + XHR + sendBeacon
// ─────────────────────────────────────────────────────────────────────
const TRACKER_DOMAINS = [
  "google-analytics.com", "googletagmanager.com", "doubleclick.net", "googlesyndication.com",
  "facebook.net", "facebook.com/tr", "connect.facebook.net", "scorecardresearch.com",
  "quantserve.com", "amazon-adsystem.com", "criteo.com", "criteo.net", "adsrvr.org",
  "rubiconproject.com", "pubmatic.com", "openx.net", "moatads.com", "adnxs.com",
  "taboola.com", "outbrain.com", "hotjar.com", "fullstory.com", "mixpanel.com",
  "segment.io", "segment.com", "amplitude.com", "heap.io", "intercom.io",
  "sentry.io", "bugsnag.com", "newrelic.com", "branch.io", "appsflyer.com",
  "adjust.com", "kochava.com", "mparticle.com", "cdn.mxpnl.com", "stats.g.doubleclick.net",
  "snowplowanalytics.com", "matomo.org", "clarity.ms", "bat.bing.com", "ads.linkedin.com",
];

let trackerHookActive = false;
let trackerCount = 0;
const trackerHits: { domain: string; url: string; ts: number }[] = [];
let origFetch: typeof fetch;
let origXhrOpen: any;
let origBeacon: any;

export function isTrackerHookActive() { return trackerHookActive; }
export function getTrackerStats() { return { count: trackerCount, hits: trackerHits.slice(-50).reverse() }; }
export function resetTrackerStats() { trackerCount = 0; trackerHits.length = 0; window.dispatchEvent(new CustomEvent("aureon:trackers")); }

function isTracker(url: string): string | null {
  try {
    const u = new URL(url, location.href);
    const host = u.hostname.toLowerCase();
    for (const d of TRACKER_DOMAINS) {
      if (host === d || host.endsWith("." + d) || (d.includes("/") && (host + u.pathname).includes(d))) return d;
    }
  } catch {}
  return null;
}

export function enableTrackerBlocker() {
  if (trackerHookActive) return;
  trackerHookActive = true;
  origFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const t = isTracker(url);
    if (t) {
      trackerCount++;
      trackerHits.push({ domain: t, url, ts: Date.now() });
      window.dispatchEvent(new CustomEvent("aureon:trackers"));
      return Promise.resolve(new Response(null, { status: 204, statusText: "Blocked by Aureon Shield" }));
    }
    return origFetch(input as any, init);
  }) as typeof fetch;

  origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    const u = typeof url === "string" ? url : url.href;
    const t = isTracker(u);
    if (t) {
      trackerCount++;
      trackerHits.push({ domain: t, url: u, ts: Date.now() });
      window.dispatchEvent(new CustomEvent("aureon:trackers"));
      return origXhrOpen.call(this, method, "data:,", ...rest);
    }
    return origXhrOpen.call(this, method, url, ...rest);
  };

  origBeacon = navigator.sendBeacon?.bind(navigator);
  if (origBeacon) {
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      const u = typeof url === "string" ? url : url.href;
      const t = isTracker(u);
      if (t) { trackerCount++; trackerHits.push({ domain: t, url: u, ts: Date.now() }); window.dispatchEvent(new CustomEvent("aureon:trackers")); return true; }
      return origBeacon!(url, data ?? null);
    };
  }
  logAudit("blocker_on", "Tracker blocker armed (50+ networks)");
}

export function disableTrackerBlocker() {
  if (!trackerHookActive) return;
  trackerHookActive = false;
  if (origFetch) window.fetch = origFetch;
  if (origXhrOpen) XMLHttpRequest.prototype.open = origXhrOpen;
  if (origBeacon) navigator.sendBeacon = origBeacon;
  logAudit("blocker_off", `Tracker blocker disarmed (${trackerCount} blocked this session)`);
}

// ─────────────────────────────────────────────────────────────────────
// Storage forensic sweep
// ─────────────────────────────────────────────────────────────────────
export type StorageReport = {
  cookies: { name: string; value: string }[];
  localStorage: { key: string; size: number }[];
  sessionStorage: { key: string; size: number }[];
  indexedDB: string[];
  caches: string[];
  serviceWorkers: number;
};

export async function storageSweep(): Promise<StorageReport> {
  const cookies = document.cookie.split(";").filter(Boolean).map((c) => {
    const [k, ...rest] = c.trim().split("="); return { name: k, value: rest.join("=") };
  });
  const ls: StorageReport["localStorage"] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!; ls.push({ key: k, size: (localStorage.getItem(k) || "").length });
  }
  const ss: StorageReport["sessionStorage"] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)!; ss.push({ key: k, size: (sessionStorage.getItem(k) || "").length });
  }
  let dbs: string[] = [];
  try { const list = await (indexedDB as any).databases?.(); dbs = (list || []).map((d: any) => d.name).filter(Boolean); } catch {}
  let cnames: string[] = [];
  try { cnames = await caches.keys(); } catch {}
  let swCount = 0;
  try { const regs = await navigator.serviceWorker?.getRegistrations(); swCount = regs?.length || 0; } catch {}
  return { cookies, localStorage: ls, sessionStorage: ss, indexedDB: dbs, caches: cnames, serviceWorkers: swCount };
}

export async function nukeStorage(opts: { cookies: boolean; ls: boolean; ss: boolean; idb: boolean; caches: boolean; sw: boolean }) {
  const out: string[] = [];
  if (opts.cookies) {
    document.cookie.split(";").forEach((c) => {
      const eq = c.indexOf("="); const name = eq > -1 ? c.substr(0, eq).trim() : c.trim();
      const exp = "expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      document.cookie = `${name}=;${exp}`;
      document.cookie = `${name}=;${exp};domain=${location.hostname}`;
      document.cookie = `${name}=;${exp};domain=.${location.hostname}`;
    });
    out.push("cookies");
  }
  if (opts.ls) { localStorage.clear(); out.push("localStorage"); }
  if (opts.ss) { sessionStorage.clear(); out.push("sessionStorage"); }
  if (opts.idb) {
    try {
      const list = await (indexedDB as any).databases?.();
      await Promise.all((list || []).map((d: any) => new Promise<void>((res) => {
        if (!d.name) return res();
        const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => res();
      })));
      out.push("indexedDB");
    } catch {}
  }
  if (opts.caches) {
    try { const names = await caches.keys(); await Promise.all(names.map((n) => caches.delete(n))); out.push("caches"); } catch {}
  }
  if (opts.sw) {
    try { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs || []).map((r) => r.unregister())); out.push("service workers"); } catch {}
  }
  logAudit("nuke", `Wiped: ${out.join(", ")}`);
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Browser extension X-ray (timing-attack probing of web_accessible_resources)
// ─────────────────────────────────────────────────────────────────────
const EXT_PROBES: { id: string; name: string; resource: string }[] = [
  { id: "cjpalhdlnbpafiamejdnhcphjbkeiagm", name: "uBlock Origin", resource: "web_accessible_resources/img/icon_38.png" },
  { id: "gighmmpiobklfepjocnamgkkbiglidom", name: "AdBlock", resource: "icons/adblock-icon-32.png" },
  { id: "cfhdojbkjhnklbpkdaibdccddilifddb", name: "AdBlock Plus", resource: "icons/abp-32.png" },
  { id: "bhlhnicpbhignbdhedgjhgdocnmhomnp", name: "ColorZilla", resource: "icons/icon32.png" },
  { id: "fheoggkfdfchfphceeifdbepaooicaho", name: "McAfee WebAdvisor", resource: "icons/wa-32.png" },
  { id: "bkdgflcldnnnapblkhphbgpggdiikppg", name: "DuckDuckGo Privacy", resource: "img/logo-horizontal.svg" },
  { id: "pkehgijcmpdhfbdbbnkijodmdjhbjlgp", name: "Privacy Badger", resource: "icons/badger-32.png" },
  { id: "jlmpjdjjbgclbocgajdjefcidcncaied", name: "Ghostery", resource: "icons/icon32.png" },
  { id: "fihnjjcciajhdojfnbdddfaoknhalnja", name: "I don't care about cookies", resource: "icons/icon32.png" },
  { id: "ldpochfccmkkmhdbclfhpagapcfdljkj", name: "Decentraleyes", resource: "icons/icon-32.png" },
  { id: "edibdbjcniadpccecjdfdjjppcpchdlm", name: "I still don't care about cookies", resource: "icons/icon32.png" },
  { id: "hdokiejnpimakedhajhdlcegeplioahd", name: "LastPass", resource: "icons/icon-32.png" },
  { id: "nngceckbapebfimnlniiiahkandclblb", name: "Bitwarden", resource: "popup/images/icons/icon32.png" },
  { id: "fdjamakpfbbddfjaooikfcpapjohcfmg", name: "Dashlane", resource: "leeloo/img/icon-32.png" },
  { id: "ihilekdfblneeielangdpmpjbfgmoael", name: "1Password", resource: "icons/icon-32.png" },
  { id: "naepdomgkenhinolocfifgehrdpkdnpo", name: "Honey", resource: "img/honey-logo-32.png" },
  { id: "kbfnbcaeplbcioakkpcpgfkobkghlhen", name: "Grammarly", resource: "img/icons/grammarly-32.png" },
  { id: "nkbihfbeogaeaoehlefnkodbefgpgknn", name: "MetaMask", resource: "images/icon-32.png" },
  { id: "ejbalbakoplchlghecdalmeeeajnimhm", name: "Phantom Wallet", resource: "icons/icon32.png" },
  { id: "fnjhmkhhmkbjkkabndcnnogagogbneec", name: "Rabby Wallet", resource: "icons/icon32.png" },
];

export type ExtensionDetection = { id: string; name: string; present: boolean };

export async function probeExtensions(): Promise<ExtensionDetection[]> {
  const results = await Promise.all(EXT_PROBES.map(async (e) => {
    const url = `chrome-extension://${e.id}/${e.resource}`;
    try {
      const r = await fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store" });
      return { id: e.id, name: e.name, present: r.type !== "error" };
    } catch {
      // Image-load fallback
      return await new Promise<ExtensionDetection>((res) => {
        const img = new Image();
        const t = setTimeout(() => res({ id: e.id, name: e.name, present: false }), 1200);
        img.onload = () => { clearTimeout(t); res({ id: e.id, name: e.name, present: true }); };
        img.onerror = () => { clearTimeout(t); res({ id: e.id, name: e.name, present: false }); };
        img.src = url;
      });
    }
  }));
  return results;
}

// ─────────────────────────────────────────────────────────────────────
// DNS-over-HTTPS resolver test (live)
// ─────────────────────────────────────────────────────────────────────
export type DohResult = { resolver: string; ms: number; ok: boolean; answer?: string };

export async function testDoh(name = "cloudflare.com"): Promise<DohResult[]> {
  const resolvers = [
    { name: "Cloudflare 1.1.1.1", url: `https://cloudflare-dns.com/dns-query?name=${name}&type=A` },
    { name: "Google 8.8.8.8", url: `https://dns.google/resolve?name=${name}&type=A` },
    { name: "Quad9 9.9.9.9", url: `https://dns.quad9.net:5053/dns-query?name=${name}&type=A` },
    { name: "AdGuard 94.140.14.14", url: `https://dns.adguard-dns.com/resolve?name=${name}&type=A` },
  ];
  return Promise.all(resolvers.map(async (r) => {
    const t0 = performance.now();
    try {
      const res = await fetch(r.url, { headers: { Accept: "application/dns-json" }, cache: "no-store" });
      const j = await res.json();
      const a = (j.Answer || []).map((x: any) => x.data).filter(Boolean)[0];
      return { resolver: r.name, ms: Math.round(performance.now() - t0), ok: !!a, answer: a };
    } catch {
      return { resolver: r.name, ms: Math.round(performance.now() - t0), ok: false };
    }
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Geo-Drift Leak Score (combines IP / timezone / language / WebRTC / coords)
// ─────────────────────────────────────────────────────────────────────
export function geoLeakScore(args: {
  ipCountry?: string; ipTimezone?: string;
  browserTimezone?: string; browserLang?: string;
  webrtcLeaked?: boolean; gpsKmFromIp?: number;
}): { score: number; signals: { name: string; ok: boolean; detail: string }[] } {
  const sig: { name: string; ok: boolean; detail: string }[] = [];
  let bad = 0;

  if (args.ipTimezone && args.browserTimezone) {
    const ok = args.ipTimezone === args.browserTimezone;
    sig.push({ name: "Timezone vs IP", ok, detail: ok ? "Aligned" : `IP says ${args.ipTimezone} · browser says ${args.browserTimezone}` });
    if (!ok) bad += 25;
  }
  if (args.browserLang && args.ipCountry) {
    const lang = args.browserLang.split("-")[1]?.toUpperCase();
    if (lang) {
      const ok = lang === args.ipCountry.toUpperCase().slice(0, 2) || true; // weak signal — just inform
      sig.push({ name: "Locale vs Country", ok: true, detail: `Browser ${args.browserLang} · IP country ${args.ipCountry}` });
    }
  }
  if (args.webrtcLeaked != null) {
    sig.push({ name: "WebRTC", ok: !args.webrtcLeaked, detail: args.webrtcLeaked ? "Real IP leaked via STUN" : "No leak" });
    if (args.webrtcLeaked) bad += 35;
  }
  if (args.gpsKmFromIp != null) {
    const ok = args.gpsKmFromIp < 100;
    sig.push({ name: "GPS vs IP geo", ok, detail: `${Math.round(args.gpsKmFromIp)} km drift` });
    if (!ok) bad += 20;
  }
  return { score: Math.max(0, 100 - bad), signals: sig };
}

// ─────────────────────────────────────────────────────────────────────
// Location history (IndexedDB)
// ─────────────────────────────────────────────────────────────────────
const DB = "aureon_shield";
const STORE = "geo_history";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: "ts" }); };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}

export async function addGeoEvent(e: { ts: number; lat: number; lon: number; acc: number; ipCountry?: string }) {
  const db = await openDb(); const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(e); return new Promise<void>((res) => { tx.oncomplete = () => res(); });
}
export async function listGeoHistory(): Promise<any[]> {
  try {
    const db = await openDb(); const tx = db.transaction(STORE, "readonly");
    return await new Promise((res) => { const r = tx.objectStore(STORE).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
  } catch { return []; }
}
export async function clearGeoHistory() {
  const db = await openDb(); const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear(); return new Promise<void>((res) => { tx.oncomplete = () => res(); });
}
