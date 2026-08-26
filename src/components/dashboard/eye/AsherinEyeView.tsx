// @ts-nocheck
// asherin.eye — 3d globe + live public spatial layers
// adapted from gods-eye-view (mit, © 2026 bilawal sidhu) for asherin.com glass.
// asherin.engine is composed here as location detection → globe pins, never a serp dump.
// never: palantir chrome, public "god's eye" costume, telegeography nc cables,
// leftover "paste a google key", radio hijack, pcap/web tap.

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emitPull } from "@/lib/connect/emitPull";

const CESIUM_BASE = "https://cdn.jsdelivr.net/npm/cesium@1.124.0/Build/Cesium/";
const SAT_JS = "https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js";
const HANGAR_GLB =
  "https://cdn.jsdelivr.net/gh/CesiumGS/cesium@1.124.0/Apps/SampleData/models/CesiumAir/Cesium_Air.glb";
const TRACKED_MODEL_ENTER_M = 150000;
const TRACKED_MODEL_EXIT_M = 172500;
const HUB = "http://127.0.0.1:8768/log";

const STYLES = ["normal", "crt", "nvg", "flir", "saturation", "noir"];
const GLOBES = ["osm", "dark", "sat"];

const LAYER_ROWS = [
  { id: "flights", label: "flights", honesty: "opensky · asherin.eye feed · live follow", keyed: false },
  { id: "military", label: "military flights", honesty: "adsb.lol mil · asherin.eye feed", keyed: false },
  { id: "ships", label: "ships", honesty: "aisstream needs a bound key", keyed: true },
  { id: "stations", label: "stations", honesty: "iss + tiangong · asherin.eye feed", keyed: false },
  { id: "quakes", label: "earthquakes", honesty: "usgs last 24h · asherin.eye feed", keyed: false },
  { id: "fires", label: "fires", honesty: "nasa firms needs a bound key", keyed: true },
  { id: "launches", label: "launches", honesty: "the spacedevs · asherin.eye feed", keyed: false },
  { id: "traffic", label: "traffic", honesty: "tomtom needs a bound key", keyed: true },
  { id: "cameras", label: "public cameras", honesty: "austin + tfl catalogs · no hijack", keyed: false },
  { id: "radio", label: "radio", honesty: "radio browser · asherin.eye feed", keyed: false },
  { id: "spaceweather", label: "space weather", honesty: "noaa kp index · asherin.eye feed", keyed: false },
  {
    id: "engine",
    label: "engine pins",
    honesty: "asherin.engine places on the globe · not a search results list",
    keyed: false,
  },
  {
    id: "near",
    label: "bluetooth near",
    honesty: "this-box ble ads polled live · radio range is meters · sees ≠ joins",
    keyed: false,
  },
  {
    id: "meta",
    label: "web metadata",
    honesty: "public cameras + radio hosts + osm mapped webcams · live poll · not a tap · not a port scan",
    keyed: false,
  },
  {
    id: "sats",
    label: "satellites",
    honesty: "celestrak tle + sgp4 orbit rings · gev class · not a classified catalog",
    keyed: false,
  },
  {
    id: "atmo",
    label: "atmosphere",
    honesty: "nasa gibs ozone tiles + ionosphere shell scaled by noaa kp · schematic height, not a lab",
    keyed: false,
  },
  {
    id: "lands",
    label: "territories",
    honesty: "world-atlas countries · click a country to highlight · ice/amber glass · not a threat tint",
    keyed: false,
  },
  {
    id: "zones",
    label: "zones",
    honesty: "open-meteo air quality grid · green good · brown no/mid · red unhealthy · not a war overlay",
    keyed: false,
  },
  {
    id: "dark",
    label: "dark zones",
    honesty:
      "cells where our live public layers are sparse · missing public data is a signal · not an intercept blackout",
    keyed: false,
  },
  {
    id: "brittle",
    label: "fault lines",
    honesty: "osm power/port/air/hospital/mast + usgs quakes nearby · public brittle nodes · not an attack list",
    keyed: false,
  },
  {
    id: "future",
    label: "future land",
    honesty: "pb2002 plate edges · 50-200yr motion is meters · speculative cartography, not a new continent",
    keyed: false,
  },
  {
    id: "route",
    label: "unstable route",
    honesty: "osrm + open-meteo wind/precip as cost · sci-fi quantum routing rewritten · not a quantum computer",
    keyed: false,
  },
];

const LAYER_COLOR = {
  flights: "#fbbf24",
  military: "#34d399",
  stations: "#67e8f9",
  quakes: "#f87171",
  launches: "#fb7185",
  cameras: "#f472b6",
  radio: "#a78bfa",
  spaceweather: "#fde68a",
  engine: "#9ec9ff",
  near: "#e8c56b",
  meta: "#c4b5fd",
  sats: "#7dd3fc",
  atmo: "#a5f3fc",
  lands: "#9ec9ff",
  zones: "#86efac",
  dark: "#64748b",
  brittle: "#fb7185",
  future: "#fde68a",
  route: "#67e8f9",
};

const MISSIONS = [
  { id: "air", title: "air", layers: ["flights", "military"], fly: { lat: 40.64, lon: -73.78, alt: 280000 } },
  { id: "space", title: "space", layers: ["stations", "sats", "atmo"], fly: { lat: 28.57, lon: -80.65, alt: 4.2e6 } },
  { id: "earth", title: "earth watch", layers: ["quakes"], fly: { lat: 19.4, lon: -155.3, alt: 1.1e6 } },
  { id: "city", title: "city", layers: ["cameras", "radio"], fly: { lat: 51.5, lon: -0.12, alt: 420000 } },
];

const CAM_MODES = ["chase", "orbit", "nadir"];
const TOUR_SHOTS = [
  { lat: 20, lon: -30, alt: 1.9e7, heading: 25, pitch: -65, duration: 5 },
  { lat: 46, lon: 2, alt: 8e6, heading: 40, pitch: -52, duration: 5 },
  { lat: 35, lon: 139, alt: 4.2e6, heading: 22, pitch: -46, duration: 5 },
  { lat: 37.6, lon: -122.4, alt: 1.7e6, heading: 8, pitch: -40, duration: 5 },
];

const EYE_HUD_CSS = `
  /* eye-fit-any-screen — size from the pane, never vw/window */
  .eye-root {
    position:absolute; inset:0; width:100%; height:100%; min-width:0; min-height:0;
    overflow:hidden; background:#000; color-scheme:dark;
    container-type:size; container-name:eye;
    --bg: hsl(var(--background));
    --ink: hsl(var(--foreground));
    --mute: hsl(var(--muted-foreground));
    --line: hsl(var(--border));
    --accent: hsl(var(--accent));
    --accent-ink: hsl(var(--accent-foreground));
    --r: clamp(0.7rem, 1.6cqi, 1rem);
    --pad: clamp(6px, 1.4cqi, 16px);
    --dock-h: clamp(52px, 11cqh, 92px);
    --safe-t: env(safe-area-inset-top, 0px);
    --safe-r: env(safe-area-inset-right, 0px);
    --safe-b: env(safe-area-inset-bottom, 0px);
    --safe-l: env(safe-area-inset-left, 0px);
    --fs: clamp(11px, 0.9cqi + 0.35cqh, 14px);
    margin: 0; color: var(--ink);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-weight: 300; letter-spacing: -.01em; font-size: var(--fs);
  }
  .eye-root, .eye-root * { box-sizing: border-box; }
  .eye-root * { scrollbar-width: thin; overscroll-behavior: contain; }
  #eye-stage { position:absolute; inset:0; background:#000; width:100%; height:100%; min-width:0; min-height:0; }
  .eye-root .cesium-widget, .eye-root .cesium-viewer, .eye-root .cesium-widget canvas, .eye-root .cesium-viewer canvas {
    width:100% !important; height:100% !important; max-width:100%; max-height:100%;
  }
  .eye-root .cesium-viewer-bottom, .eye-root .cesium-viewer-toolbar, .eye-root .cesium-viewer-animationContainer, .eye-root .cesium-viewer-timelineContainer { display:none !important; }
  #eye-credits {
    position:absolute; left:calc(var(--pad) + var(--safe-l));
    bottom:calc(var(--dock-h) + var(--safe-b) + 6px); z-index:6;
    max-width:min(420px, calc(100cqi - 2 * var(--pad)));
    font:300 clamp(8px, 0.85cqi, 10px)/1.4 inherit; color:var(--mute); pointer-events:auto;
  }
  #eye-credits a { color: var(--accent); }
  .glass {
    background: hsl(var(--card) / .62);
    backdrop-filter: blur(24px) saturate(1.2);
    -webkit-backdrop-filter: blur(24px) saturate(1.2);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: 0 18px 50px -24px rgba(0,0,0,.9);
  }
  .misb {
    position:absolute; top:calc(var(--pad) + var(--safe-t)); left:calc(var(--pad) + var(--safe-l)); z-index:8;
    padding: clamp(8px, 1.3cqi, 14px) clamp(10px, 1.6cqi, 16px); pointer-events:auto; min-width:0;
    max-width: min(280px, calc(100cqi - 2 * var(--pad) - 72px));
    font: 300 clamp(11px, 1.15cqi, 13px)/1.45 inherit; color: var(--ink);
  }
  .misb b { color: var(--accent); font-weight: 500; }
  .misb .m { color: var(--mute); font-size: clamp(10px, 1.05cqi, 12px); overflow-wrap:anywhere; }
  .sheet {
    position:absolute; right:calc(var(--pad) + var(--safe-r)); top:calc(var(--pad) + var(--safe-t));
    bottom:calc(var(--dock-h) + var(--safe-b) + 8px); z-index:8;
    width: min(300px, 32cqi, calc(100% - 2 * var(--pad)));
    max-height: calc(100cqh - var(--dock-h) - var(--pad) * 2 - var(--safe-t) - var(--safe-b));
    padding: clamp(10px, 1.5cqi, 16px); overflow:auto; pointer-events:auto;
    -webkit-overflow-scrolling: touch;
  }
  .sheet-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .sheet-close { display:none; border:0; background:transparent; color:var(--mute); cursor:pointer; font:400 12px/1 inherit; padding:6px 8px; }
  .sheet h2 { margin:0 0 10px; font:400 clamp(12px, 1.2cqi, 13px)/1.2 inherit; letter-spacing:.02em; text-transform:lowercase; color:var(--mute); }
  .sheet .row { display:flex; justify-content:space-between; gap:10px; font-size:clamp(11px, 1.1cqi, 12px); padding:6px 0; border-bottom:1px solid var(--line); min-width:0; }
  .sheet .row span { min-width:0; overflow-wrap:anywhere; }
  .sheet .k { color: var(--mute); flex:0 0 auto; }
  #layer-btns, #globe-btns, #style-btns { display:flex; flex-wrap:wrap; gap:6px; }
  .grid, #mission-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 8.5rem), 1fr)); gap:8px; }
  #mission-grid button {
    border-radius:12px; padding:clamp(8px, 1.2cqi, 12px); border:1px solid var(--line);
    background:hsl(var(--card)/.5); color:var(--ink); cursor:pointer; text-transform:lowercase;
    min-height:40px; width:100%; font:400 clamp(11px, 1.1cqi, 13px)/1 inherit;
  }
  .tog {
    border:1px solid var(--line); border-radius:999px; padding:7px 11px; cursor:pointer;
    color:var(--mute); font:400 clamp(11px, 1.1cqi, 12px)/1 inherit; background: hsl(var(--card) / .55);
  }
  .tog.on { background: hsl(var(--accent)); color: var(--accent-ink); border-color:transparent; }
  .talk {
    position:absolute; left:50%; bottom:calc(var(--pad) + var(--safe-b)); transform:translateX(-50%);
    z-index:9; display:flex; gap:6px; align-items:center; flex-wrap:wrap;
    padding: clamp(6px, 1cqi, 10px) clamp(8px, 1.2cqi, 12px);
    width: min(980px, calc(100cqi - var(--pad) * 2 - var(--safe-l) - var(--safe-r)));
    max-height: min(28cqh, 148px); justify-content:center;
    overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch;
  }
  .talk button {
    border:1px solid transparent; border-radius:999px;
    padding: clamp(8px, 1.1cqi, 10px) clamp(10px, 1.5cqi, 16px); cursor:pointer;
    background: hsl(var(--accent)); color: var(--accent-ink);
    font:500 clamp(11px, 1.15cqi, 13px)/1 inherit; flex:0 0 auto; white-space:nowrap; min-height:40px;
  }
  .talk button.ghost { background: hsl(var(--muted) / .6); color: var(--ink); border-color: var(--line); }
  .talk button.on { background: hsl(var(--accent)); color: var(--accent-ink); border-color:transparent; }
  #btn-layers { display:none; }
  .contacts {
    position:absolute; left:calc(var(--pad) + var(--safe-l));
    top:calc(var(--pad) + var(--safe-t) + clamp(64px, 14cqh, 116px));
    bottom:calc(var(--dock-h) + var(--safe-b) + 8px); z-index:8;
    width:min(260px, 28cqi); padding:clamp(10px, 1.4cqi, 14px); overflow:auto; pointer-events:auto;
    -webkit-overflow-scrolling: touch;
  }
  .contacts[hidden] { display:none; }
  .contacts .hit { display:block; width:100%; text-align:left; border:0; background:transparent; color:var(--ink); font:300 clamp(11px, 1.1cqi, 12px)/1.4 inherit; padding:8px 0; border-bottom:1px solid var(--line); cursor:pointer; }
  .contacts .hit span { color:var(--mute); display:block; font-size:clamp(10px, 1cqi, 11px); }
  #note {
    position:absolute; left:calc(var(--pad) + var(--safe-l));
    bottom:calc(var(--dock-h) + var(--safe-b) + 8px); z-index:8;
    padding:clamp(8px, 1.2cqi, 12px) clamp(10px, 1.4cqi, 14px);
    font-size:clamp(11px, 1.1cqi, 12px); color:var(--mute);
    max-width:min(320px, calc(100cqi - 2 * var(--pad))); pointer-events:none;
  }
  #detect { position:absolute; inset:0; z-index:5; pointer-events:none; width:100%; height:100%; }
  .eye-chat {
    position:absolute; left:calc(var(--pad) + var(--safe-l));
    bottom:calc(var(--dock-h) + var(--safe-b) + 8px); z-index:11;
    width:min(268px, 32cqi); pointer-events:auto;
    display:flex; flex-direction:column; max-height:min(42cqh, 340px); min-width:0;
  }
  .eye-chat.shut { width:auto; max-height:none; }
  .eye-chat .chat-head {
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    padding:clamp(8px, 1.1cqi, 10px) clamp(10px, 1.3cqi, 12px); cursor:pointer;
    font:400 clamp(11px, 1.1cqi, 12px)/1 inherit; color:var(--mute);
  }
  .eye-chat .chat-log { overflow:auto; padding:0 12px 8px; font:300 clamp(11px, 1.1cqi, 12px)/1.45 inherit; flex:1; min-height:0; -webkit-overflow-scrolling:touch; }
  .eye-chat .chat-log .me { color: var(--ink); margin:6px 0; overflow-wrap:anywhere; }
  .eye-chat .chat-log .bot { color: var(--mute); margin:6px 0; white-space:pre-wrap; overflow-wrap:anywhere; }
  .eye-chat .cmd-row { display:flex; gap:6px; padding:0 10px 6px; flex-wrap:wrap; }
  .eye-chat .cmd {
    border:1px solid var(--line); border-radius:999px; padding:6px 10px; cursor:pointer;
    background: transparent; color: var(--mute); font:400 clamp(10px, 1cqi, 11px)/1 inherit; min-height:36px;
  }
  .eye-chat .cmd.on { background: hsl(var(--accent)); color: var(--accent-ink); border-color:transparent; }
  .eye-chat .chat-row { display:flex; gap:6px; padding:8px 10px 10px; min-width:0; }
  .eye-chat input {
    flex:1; min-width:0; border-radius:999px; border:1px solid var(--line);
    background: hsl(var(--background) / .5); color: var(--ink);
    padding:8px 12px; font:300 clamp(11px, 1.1cqi, 12px) inherit;
  }
  .eye-chat button.go {
    border:0; border-radius:999px; padding:8px 12px; cursor:pointer;
    background: hsl(var(--accent)); color: var(--accent-ink); font:500 12px inherit; flex:0 0 auto; min-height:40px;
  }
  #hover-card {
    position:absolute; z-index:12; display:none; pointer-events:none;
    min-width:min(160px, calc(100cqi - 16px)); max-width:min(240px, calc(100cqi - 16px));
    max-height:min(40cqh, 220px); overflow:auto;
    padding:clamp(8px, 1.2cqi, 12px); font:300 clamp(10px, 1.05cqi, 11px)/1.4 inherit; color:var(--ink);
    transform:translate(-50%, calc(-100% - 14px));
  }
  #hover-card.below { transform:translate(-50%, 14px); }
  #hover-card b { display:block; color:var(--accent); font-weight:500; margin-bottom:4px; overflow-wrap:anywhere; }
  #hover-card .m { color:var(--mute); overflow-wrap:anywhere; }
  #glitch {
    position:absolute; inset:0; z-index:7; pointer-events:none; display:none;
    background:
      repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(158,201,255,.08) 3px),
      rgba(7,8,10,.18);
    mix-blend-mode: screen;
    animation: eye-glitch .28s linear;
  }
  @keyframes eye-glitch {
    0% { opacity:0; transform:translateX(0); }
    30% { opacity:1; transform:translateX(-6px); }
    60% { opacity:.7; transform:translateX(5px); }
    100% { opacity:0; transform:translateX(0); }
  }
  @container eye (max-width: 900px) {
    #btn-layers { display:inline-flex; }
    .sheet-close { display:inline-flex; }
    .misb { max-width: calc(100cqi - 2 * var(--pad)); right:calc(var(--pad) + var(--safe-r)); }
    .sheet {
      display:none; left:calc(var(--pad) + var(--safe-l)); right:calc(var(--pad) + var(--safe-r));
      top:auto; width:auto; height:min(42cqh, 52%); bottom:calc(var(--dock-h) + var(--safe-b) + 6px);
    }
    .sheet.open { display:flex; flex-direction:column; }
    .contacts {
      left:calc(var(--pad) + var(--safe-l)); right:calc(var(--pad) + var(--safe-r));
      width:auto; top:calc(var(--pad) + var(--safe-t) + 56px); bottom:auto; height:min(32cqh, 240px);
    }
    .talk { flex-wrap:nowrap; max-height:none; justify-content:flex-start; }
    .eye-chat { left:calc(var(--pad) + var(--safe-l)); right:calc(var(--pad) + var(--safe-r)); width:auto; }
    #note { max-width:calc(100cqi - 2 * var(--pad)); }
    #eye-credits { max-width:calc(100cqi - 2 * var(--pad)); }
  }
  @container eye (max-width: 420px) {
    .misb { padding:8px 10px; }
    .talk button { padding:8px 10px; min-height:44px; }
    .eye-chat .cmd { min-height:44px; }
  }
  @container eye (max-height: 520px) {
    .misb { padding:6px 10px; }
    .talk { padding:4px 8px; }
    .talk button { min-height:36px; padding:6px 10px; }
    .sheet { max-height:calc(100cqh - var(--dock-h) - 12px); }
    .eye-chat { max-height:min(50cqh, 200px); }
    .contacts { top:calc(var(--pad) + 44px); }
  }
  @container eye (min-width: 1600px) {
    .sheet { width: min(340px, 22cqi); }
    .contacts { width: min(280px, 18cqi); }
    .talk { width: min(1180px, calc(100cqi - 2 * var(--pad))); }
    .eye-chat { width: min(300px, 20cqi); }
  }
  @media (pointer: coarse) {
    .talk button, .tog, .cmd, .go, .hit, .sheet-close, #mission-grid button { min-height:44px; }
  }
`;

function discoverMapsKey() {
  try {
    const env = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || import.meta.env?.VITE_CESIUM_ION_TOKEN || "";
    if (env)
      return {
        google: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
        ion: import.meta.env.VITE_CESIUM_ION_TOKEN || "",
      };
  } catch {}
  const keys = ["asherin_google_maps_key", "google_maps_api_key", "GOOGLE_MAPS_API_KEY", "cesium_ion_token"];
  const out = { google: "", ion: "" };
  try {
    for (const k of keys) {
      const v = localStorage.getItem(k) || "";
      if (!v) continue;
      if (/ion|cesium/i.test(k)) out.ion = v;
      else out.google = v;
    }
  } catch {}
  return out;
}

function keyBound() {
  const names = [
    "asherin_venice_key",
    "venice_api_key",
    "openai_api_key",
    "OPENAI_API_KEY",
    "gemini_api_key",
    "GEMINI_API_KEY",
    "anthropic_api_key",
    "asherin_openai_key",
    "asherin_gemini_key",
  ];
  try {
    for (const n of names) if (localStorage.getItem(n)) return true;
  } catch {}
  return false;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("script fail " + src));
    document.head.appendChild(s);
  });
}

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

async function authedJson(path, body) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error("sign in to load live layers");
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const r = await fetch(`${base}/functions/v1/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: key,
    },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function eyeFeed(feed, params = {}) {
  const j = await authedJson("asherin-eye-feed", { feed, params });
  if (j.error && !Array.isArray(j.rows)) throw new Error(j.error);
  return j;
}

async function eyeTalk(messages) {
  try {
    const j = await authedJson("chat", { messages, organ: "eye", surface: "asherin.eye" });
    return j;
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

function hangarClass(row) {
  const t = String(row.origin || row.label || "").toUpperCase();
  if (/B06|B407|H500|R44|A109|EC3|H60|BELL|HELI/.test(t)) return "helo";
  if (/MQ9|MQ1|RQ|UAV|Q9|DRONE/.test(t)) return "uav";
  if (/B78|B77|A38|A35|A33|B74|C17|C130|C5|KC/.test(t)) return "heavy";
  return "air";
}

function hangarScale(klass) {
  return { helo: 1.1, uav: 0.8, heavy: 14, air: 4.2 }[klass] || 4.2;
}

function reckon(sample, nowMs) {
  const dt = Math.max(0, Math.min(90, (nowMs - (sample.t || nowMs)) / 1000));
  const speed = Number(sample.speed || 0);
  const hdg = Number(sample.heading || 0);
  if (!speed || dt < 0.05) return { lat: sample.lat, lon: sample.lon, alt: sample.alt || 0, heading: hdg };
  const dist = speed * dt;
  const R = 6371000;
  const lat1 = (sample.lat * Math.PI) / 180;
  const lon1 = (sample.lon * Math.PI) / 180;
  const brng = (hdg * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist / R) + Math.cos(lat1) * Math.sin(dist / R) * Math.cos(brng));
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dist / R) * Math.cos(lat1),
      Math.cos(dist / R) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
    alt: sample.alt || 0,
    heading: hdg,
  };
}

function shaderFor(style, Cesium) {
  const time = () => performance.now() / 1000;
  const stages = {
    crt: `uniform sampler2D colorTexture; in vec2 v_textureCoordinates; uniform float time;
      void main() { vec2 uv=v_textureCoordinates; uv.x += sin(uv.y*80.0+time*6.0)*0.0015;
        vec3 c=texture(colorTexture,uv).rgb; float scan=0.88+0.12*sin(uv.y*720.0);
        c*=vec3(0.75,1.05,0.72)*scan; out_FragColor=vec4(c,1.0); }`,
    nvg: `uniform sampler2D colorTexture; in vec2 v_textureCoordinates;
      void main() { vec3 c=texture(colorTexture,v_textureCoordinates).rgb;
        float l=dot(c,vec3(0.3,0.59,0.11)); vec2 uv=v_textureCoordinates-0.5;
        float vig=smoothstep(0.85,0.15,length(uv));
        out_FragColor=vec4(vec3(0.05,l*1.35,0.08)*vig,1.0); }`,
    flir: `uniform sampler2D colorTexture; in vec2 v_textureCoordinates;
      void main() { vec3 c=texture(colorTexture,v_textureCoordinates).rgb;
        float t=dot(c,vec3(0.3,0.59,0.11)); vec3 iron=mix(vec3(0.0,0.0,0.12),vec3(1.0,0.85,0.2),t);
        iron=mix(iron,vec3(1.0),smoothstep(0.7,1.0,t)); out_FragColor=vec4(iron,1.0); }`,
    anime: `uniform sampler2D colorTexture; in vec2 v_textureCoordinates;
      void main() { vec3 c=texture(colorTexture,v_textureCoordinates).rgb;
        c=mix(vec3(dot(c,vec3(0.3,0.59,0.11))),c,1.35); c=floor(c*5.0)/5.0;
        out_FragColor=vec4(c,1.0); }`,
    noir: `uniform sampler2D colorTexture; in vec2 v_textureCoordinates;
      void main() { vec3 c=texture(colorTexture,v_textureCoordinates).rgb;
        float l=dot(c,vec3(0.3,0.59,0.11)); l=smoothstep(0.12,0.88,l);
        vec2 uv=v_textureCoordinates-0.5; float vig=smoothstep(0.9,0.2,length(uv));
        out_FragColor=vec4(vec3(l)*vig,1.0); }`,
    snow: `uniform sampler2D colorTexture; in vec2 v_textureCoordinates; uniform float time;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
      void main() { vec3 c=texture(colorTexture,v_textureCoordinates).rgb;
        c=mix(c,vec3(0.92),0.28); vec2 uv=v_textureCoordinates*vec2(80.0,50.0);
        float flake=step(0.97,hash(floor(uv+vec2(time*8.0,time*-14.0))));
        out_FragColor=vec4(mix(c,vec3(1.0),flake),1.0); }`,
  };
  const src = stages[style];
  if (!src) return null;
  return new Cesium.PostProcessStage({ fragmentShader: src, uniforms: { time } });
}

function kmBetween(Cesium, a, b) {
  return Cesium.Cartesian3.distance(a, b) / 1000;
}

function extractPlaces(text) {
  const out = [];
  const re = /(-?\d{1,2}\.\d{2,})\s*[, ]\s*(-?\d{1,3}\.\d{2,})/g;
  let m;
  while ((m = re.exec(text || ""))) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
      out.push({ lat, lon, label: `${lat.toFixed(3)}, ${lon.toFixed(3)}` });
  }
  return out;
}

const AsherinEyeView = () => {
  const hostRef = useRef(null);

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    let dead = false;
    let viewer;
    let pollers = [];
    let stage;
    let tracked;
    let trail;
    let modelOn = false;
    let camMode = "chase";
    let orbitHeading = 0;
    let nearOnce = false;
    let atmoLayer = null;
    let lastAltBand = "";
    let hoverEnt = null;
    let paneWatch = null;
    const fitGlobe = () => {
      try {
        viewer?.resize();
      } catch {}
      const box = root.querySelector(".eye-root") || root;
      const cv = root.querySelector("#detect");
      if (cv && box) {
        const w = Math.max(1, box.clientWidth);
        const h = Math.max(1, box.clientHeight);
        if (cv.width !== w || cv.height !== h) {
          cv.width = w;
          cv.height = h;
        }
      }
    };
    const satRecs = {};
    const pathHist = {};
    const layerOn = {};
    let cmdMode = "place";
    LAYER_ROWS.forEach((l) => (layerOn[l.id] = false));
    const ds = {};
    const samples = {};
    const status = { photoreal: "pending", voice: "off", style: "normal", map: "osm" };
    const chatLog = [];

    const html = `
      <style>${EYE_HUD_CSS}</style>
      <div class="eye-root">
        <div id="eye-stage"></div>
        <canvas id="detect"></canvas>
        <div id="eye-credits"></div>
        <div class="glass misb">
          <div><b>asherin.eye</b></div>
          <div class="m" id="hud-line">loading globe…</div>
          <div class="m" id="hud-honesty"></div>
        </div>
        <div class="glass sheet" id="sheet">
          <div class="sheet-head">
            <h2>layers</h2>
            <button type="button" class="sheet-close" id="sheet-close">close</button>
          </div>
          <div id="layer-btns"></div>
          <h2 style="margin-top:14px">globe</h2>
          <div id="globe-btns"></div>
          <h2 style="margin-top:14px">look</h2>
          <div id="style-btns"></div>
          <h2 style="margin-top:14px">first look</h2>
          <div class="grid" id="mission-grid"></div>
          <div class="row"><span class="k">photoreal 3d</span><span id="pr-status">…</span></div>
          <div class="row"><span class="k">cables</span><span>omitted · non-commercial license</span></div>
          <div class="row"><span class="k">3d hangar</span><span>cesium sample airframe · class-scaled · live follow</span></div>
          <div class="row"><span class="k">engine</span><span>places pin on the globe · no serp</span></div>
          <div class="row"><span class="k">property</span><span>command · z19 fly + public osm/census/wiki dossier · not a deed office</span></div>
          <div class="row"><span class="k">trail</span><span>session historic from live ads-b fixes · geodesic</span></div>
          <div class="row"><span class="k">camera</span><span>chase · orbit · nadir · tour (zip scene director class)</span></div>
          <div class="row"><span class="k">bluetooth</span><span>this radio · meters · not a peninsula scan</span></div>
          <div class="row"><span class="k">web metadata</span><span>public catalogs + osm mapped webcams · not a tap</span></div>
          <div class="row"><span class="k">satellites</span><span>celestrak orbits + coverage cones · gev class</span></div>
          <div class="row"><span class="k">atmosphere</span><span>gibs ozone + kp-scaled iono shell · not floating lab glass from a tweet</span></div>
          <div class="row"><span class="k">territories</span><span>click a country · ice highlight · not a red-threat costume</span></div>
          <div class="row"><span class="k">hover card</span><span>public fields sit above the asset · not a kinetic pop</span></div>
          <div class="row"><span class="k">zones / dark / brittle</span><span>air quality · sparse public data · osm infra · not intercept</span></div>
          <div class="row"><span class="k">future land</span><span>plate edges · meters per century · not invented coastlines</span></div>
          <div class="row"><span class="k">unstable route</span><span>osrm + weather cost · quantum routing rewritten</span></div>
          <div class="row"><span class="k">exif pin</span><span>drop an image you own · gps if present · stripped stays stripped</span></div>
        </div>
        <div class="glass contacts" id="contacts" hidden>
          <h2 style="margin:0 0 8px;font:400 13px/1.2 inherit;color:var(--mute)">contacts · 250 km</h2>
          <div id="contact-list"></div>
        </div>
        <div class="glass eye-chat shut" id="eye-chat">
          <div class="chat-head" id="chat-toggle"><span>asherin.engine chat</span><span id="chat-key">…</span></div>
          <div id="chat-body" hidden>
            <div class="cmd-row">
              <button type="button" class="cmd on" id="cmd-place">go to a place</button>
              <button type="button" class="cmd" id="cmd-property">property</button>
            </div>
            <div class="chat-log" id="chat-log"></div>
            <div class="chat-row">
              <input id="chat-in" type="text" placeholder="go to a place" autocomplete="off" />
              <button type="button" class="go" id="chat-go">go</button>
            </div>
          </div>
        </div>
        <div class="glass hover-card" id="hover-card"></div>
        <div id="glitch"></div>
        <input id="exif-file" type="file" accept="image/jpeg,image/jpg,image/png" hidden />
        <div class="glass note" id="note"></div>
        <div class="glass talk">
          <button type="button" class="ghost" id="btn-layers">layers</button>
          <button type="button" id="btn-cockpit">cockpit</button>
          <button type="button" class="ghost" id="btn-chase">chase</button>
          <button type="button" class="ghost" id="btn-orbit">orbit</button>
          <button type="button" class="ghost" id="btn-nadir">nadir</button>
          <button type="button" class="ghost" id="btn-tour">tour</button>
          <button type="button" class="ghost" id="btn-contacts">contacts</button>
          <button type="button" class="ghost" id="btn-detect">detect</button>
          <button type="button" class="ghost" id="btn-voice">voice</button>
          <button type="button" class="ghost" id="btn-share">share</button>
          <button type="button" class="ghost" id="btn-exif">pin photo</button>
          <button type="button" class="ghost" id="btn-reset">reset globe</button>
        </div>
      </div>`;
    root.innerHTML = html;

    const $ = (id) => root.querySelector(id);
    const setNote = (t) => {
      const n = $("#note");
      if (n) n.textContent = t || "";
    };
    const setHud = () => {
      if (!viewer) return;
      const C = window.Cesium;
      const cam = viewer.camera;
      const carto = C.Cartographic.fromCartesian(cam.positionWC);
      const lat = C.Math.toDegrees(carto.latitude).toFixed(3);
      const lon = C.Math.toDegrees(carto.longitude).toFixed(3);
      const alt = Math.round(carto.height);
      $("#hud-line").textContent = `${lat} · ${lon} · ${alt} m · ${status.style} · ${status.map}`;
      const hangar = tracked && modelOn ? " · 3d airframe" : "";
      const modeBit = camMode !== "chase" ? ` · camera ${camMode}` : "";
      $("#hud-honesty").textContent = tracked
        ? `tracking ${tracked.label || "contact"}${hangar}${modeBit} · live trail from ads-b fixes`
        : "click a contact to track. chase / orbit / nadir move the camera. esc releases.";
      $("#pr-status").textContent = status.photoreal;
    };

    function applyStyle(name) {
      status.style = name;
      const C = window.Cesium;
      if (stage) {
        viewer.scene.postProcessStages.remove(stage);
        stage = null;
      }
      if (name !== "normal") {
        stage = shaderFor(name, C);
        if (stage) viewer.scene.postProcessStages.add(stage);
      }
      root.querySelectorAll("#style-btns .tog").forEach((b) => b.classList.toggle("on", b.dataset.style === name));
      writeShare();
    }

    function applyGlobe(kind) {
      const C = window.Cesium;
      status.map = kind;
      try {
        viewer.imageryLayers.removeAll();
        if (kind === "sat") {
          viewer.imageryLayers.addImageryProvider(
            new C.UrlTemplateImageryProvider({
              url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              credit: "esri world imagery",
              maximumLevel: 19,
            }),
          );
          viewer.scene.globe.baseColor = C.Color.BLACK;
          viewer.scene.skyAtmosphere.show = true;
        } else if (kind === "dark") {
          viewer.imageryLayers.addImageryProvider(
            new C.UrlTemplateImageryProvider({
              url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              credit: "© carto · © osm",
            }),
          );
          viewer.scene.globe.baseColor = C.Color.fromCssColorString("#07080a");
          viewer.scene.skyAtmosphere.show = false;
        } else {
          viewer.imageryLayers.addImageryProvider(
            new C.UrlTemplateImageryProvider({
              url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              credit: "© openstreetmap",
            }),
          );
          viewer.scene.globe.baseColor = C.Color.BLUE;
          viewer.scene.skyAtmosphere.show = true;
        }
      } catch (e) {
        setNote("globe look failed · " + (e.message || e));
      }
      root.querySelectorAll("#globe-btns .tog").forEach((b) => b.classList.toggle("on", b.dataset.globe === kind));
      writeShare();
      setHud();
    }

    function writeShare() {
      if (!viewer) return;
      const C = window.Cesium;
      const cam = viewer.camera;
      const c = C.Cartographic.fromCartesian(cam.positionWC);
      const on = Object.keys(layerOn)
        .filter((k) => layerOn[k])
        .join(",");
      const hash = `#lat=${C.Math.toDegrees(c.latitude).toFixed(4)}&lon=${C.Math.toDegrees(c.longitude).toFixed(4)}&alt=${Math.round(c.height)}&heading=${C.Math.toDegrees(cam.heading).toFixed(1)}&pitch=${C.Math.toDegrees(cam.pitch).toFixed(1)}&style=${STYLES.indexOf(status.style) + 1}&layers=${on}&map=${status.map}`;
      try {
        history.replaceState(null, "", hash);
      } catch {}
    }

    function readShare() {
      const raw = location.hash.replace(/^#/, "");
      return Object.fromEntries(
        raw
          .split("&")
          .filter(Boolean)
          .map((x) => x.split("=")),
      );
    }

    function flyTo(lat, lon, alt) {
      viewer.camera.flyTo({
        destination: window.Cesium.Cartesian3.fromDegrees(lon, lat, alt),
        duration: 2.2,
      });
    }

    function dsFor(id) {
      if (!ds[id]) {
        ds[id] = new window.Cesium.CustomDataSource(id);
        viewer.dataSources.add(ds[id]);
      }
      return ds[id];
    }

    function clearDs(id) {
      if (ds[id]) ds[id].entities.removeAll();
      if (id === "flights" || id === "military") {
        Object.keys(samples).forEach((k) => {
          if (k.startsWith(id + ":")) delete samples[k];
        });
      }
    }

    async function enableLayer(id, on) {
      layerOn[id] = on;
      root.querySelectorAll("#layer-btns .tog").forEach((b) => {
        if (b.dataset.layer === id) b.classList.toggle("on", on);
      });
      if (!on) {
        if (id === "near") nearOnce = false;
        if (id === "atmo") clearAtmo();
        clearDs(id);
        return;
      }
      setNote(`loading ${id}…`);
      try {
        await loadLayer(id);
        setNote("");
      } catch (e) {
        setNote(`${id}: ${e.message || e}`);
      }
      writeShare();
    }

    function flightPositionProperty(eid) {
      const C = window.Cesium;
      return new C.CallbackProperty(() => {
        const s = samples[eid];
        if (!s) return undefined;
        const r = reckon(s, Date.now());
        return C.Cartesian3.fromDegrees(r.lon, r.lat, r.alt);
      }, false);
    }

    function flightOrientationProperty(eid) {
      const C = window.Cesium;
      return new C.CallbackProperty(() => {
        const s = samples[eid];
        if (!s) return undefined;
        const r = reckon(s, Date.now());
        const pos = C.Cartesian3.fromDegrees(r.lon, r.lat, r.alt);
        const hpr = new C.HeadingPitchRoll(C.Math.toRadians(r.heading + 90), 0, 0);
        return C.Transforms.headingPitchRollQuaternion(pos, hpr);
      }, false);
    }

    function upsertFlights(id, rows) {
      const C = window.Cesium;
      const src = dsFor(id);
      const seen = new Set();
      const color = LAYER_COLOR[id] || "#94a3b8";
      const now = Date.now();
      (rows || []).forEach((row, i) => {
        if (row.lat == null || row.lon == null) return;
        let alt = Number(row.alt || 0);
        if (alt > 20000) alt = alt * 0.3048;
        const eid = `${id}:${row.id || i}`;
        seen.add(eid);
        const klass = hangarClass(row);
        samples[eid] = {
          lat: Number(row.lat),
          lon: Number(row.lon),
          alt,
          speed: Number(row.speed || 0),
          heading: Number(row.heading || 0),
          t: now,
          label: row.label || id,
          klass,
        };
        const hist = pathHist[eid] || (pathHist[eid] = []);
        const last = hist[hist.length - 1];
        if (!last || Math.abs(last.lat - Number(row.lat)) + Math.abs(last.lon - Number(row.lon)) > 0.00025) {
          hist.push({ lat: Number(row.lat), lon: Number(row.lon), alt, t: now });
          if (hist.length > 240) hist.splice(0, hist.length - 240);
        }
        let ent = src.entities.getById(eid);
        if (!ent) {
          ent = src.entities.add({
            id: eid,
            name: row.label || id,
            position: flightPositionProperty(eid),
            orientation: flightOrientationProperty(eid),
            billboard: {
              image: planePng(),
              width: 18,
              height: 18,
              alignedAxis: C.Cartesian3.UNIT_Z,
              color: C.Color.fromCssColorString(color),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            model: {
              uri: HANGAR_GLB,
              scale: hangarScale(klass),
              minimumPixelSize: 40,
              maximumScale: 40000,
              color: C.Color.fromCssColorString("#e8e4d8"),
              colorBlendMode: C.ColorBlendMode.HIGHLIGHT,
              colorBlendAmount: 0.55,
              show: false,
            },
            viewFrom: new C.Cartesian3(-140, -50, 32),
            asherin: { kind: id, label: row.label || id, lat: row.lat, lon: row.lon, klass },
          });
        } else {
          ent.name = row.label || id;
          ent.asherin = { kind: id, label: row.label || id, lat: row.lat, lon: row.lon, klass };
          if (ent.model) ent.model.scale = hangarScale(klass);
        }
      });
      src.entities.values.slice().forEach((e) => {
        if (!seen.has(e.id) && tracked?.id !== e.id) src.entities.remove(e);
      });
    }

    function plotRows(id, rows, note) {
      const C = window.Cesium;
      if (id === "flights" || id === "military") {
        upsertFlights(id, rows);
        if (note) setNote(note);
        return;
      }
      const src = dsFor(id);
      src.entities.removeAll();
      const color = LAYER_COLOR[id] || "#94a3b8";
      (rows || []).forEach((row, i) => {
        if (row.lat == null || row.lon == null) return;
        const alt = Number(row.alt || 0);
        const mag = Number(row.mag || 0);
        const ent = {
          id: `${id}:${row.id || i}`,
          name: row.label || id,
          position: C.Cartesian3.fromDegrees(row.lon, row.lat, alt),
          asherin: {
            kind: id,
            label: row.label || id,
            lat: row.lat,
            lon: row.lon,
            url: row.url,
            image: row.image,
            note: row.note,
          },
        };
        if (id === "quakes") {
          ent.ellipse = {
            semiMajorAxis: 4000 + mag * 9000,
            semiMinorAxis: 4000 + mag * 9000,
            material: C.Color.fromCssColorString(color).withAlpha(0.55),
            height: 0,
          };
        } else if (id === "zones") {
          const band = String(row.band || "brown");
          const fill = band === "green" ? "#4ade80" : band === "red" ? "#f87171" : "#a8a29e";
          ent.ellipse = {
            semiMajorAxis: 28000,
            semiMinorAxis: 28000,
            material: C.Color.fromCssColorString(fill).withAlpha(0.28),
            height: 0,
            outline: true,
            outlineColor: C.Color.fromCssColorString(fill),
          };
        } else if (id === "dark") {
          ent.ellipse = {
            semiMajorAxis: 42000,
            semiMinorAxis: 42000,
            material: C.Color.fromCssColorString("#334155").withAlpha(0.35),
            height: 0,
          };
        } else {
          ent.point = {
            pixelSize: id === "stations" || id === "sats" ? 8 : 9,
            color: C.Color.fromCssColorString(color),
          };
        }
        if (id === "brittle" || id === "engine" || id === "cameras" || id === "sats" || id === "stations") {
          ent.label = {
            text: String(row.label || id).slice(0, 42),
            font: "11px Inter",
            fillColor: C.Color.WHITE,
            pixelOffset: new C.Cartesian2(0, -18),
            showBackground: true,
            backgroundColor: C.Color.BLACK.withAlpha(0.5),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          };
        }
        src.entities.add(ent);
      });
      if (note) setNote(note);
    }

    function pinEngine(rows, flyFirst) {
      layerOn.engine = true;
      root.querySelectorAll("#layer-btns .tog").forEach((b) => {
        if (b.dataset.layer === "engine") b.classList.add("on");
      });
      const src = dsFor("engine");
      const C = window.Cesium;
      (rows || []).forEach((row, i) => {
        if (row.lat == null || row.lon == null) return;
        const id = `engine:${row.id || row.label || i}:${row.lat}:${row.lon}`;
        if (src.entities.getById(id)) return;
        const ent = {
          id,
          name: row.label || "place",
          position: C.Cartesian3.fromDegrees(row.lon, row.lat, Number(row.alt || 0)),
          point: {
            pixelSize: row.kind === "property" ? 13 : 11,
            color: C.Color.fromCssColorString(row.kind === "property" ? "#f0d08a" : "#9ec9ff"),
          },
          label: {
            text: String(row.label || "place").slice(0, 48),
            font: "12px Inter",
            fillColor: C.Color.WHITE,
            pixelOffset: new C.Cartesian2(0, -16),
            showBackground: true,
            backgroundColor: C.Color.BLACK.withAlpha(0.45),
          },
          asherin: {
            kind: row.kind || "engine",
            label: row.label,
            lat: row.lat,
            lon: row.lon,
            note: row.note,
            intel: row.intel,
          },
        };
        const ring = Array.isArray(row.ring) ? row.ring : [];
        if (ring.length >= 3) {
          const flat = [];
          ring.forEach((p) => {
            const rlon = Number(p.lon ?? p[0]);
            const rlat = Number(p.lat ?? p[1]);
            if (Number.isFinite(rlon) && Number.isFinite(rlat)) {
              flat.push(rlon, rlat);
            }
          });
          if (flat.length >= 6) {
            ent.polygon = {
              hierarchy: new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(flat)),
              material: C.Color.fromCssColorString("#f0d08a").withAlpha(0.28),
              outline: true,
              outlineColor: C.Color.fromCssColorString("#f0d08a"),
              height: 0,
            };
          }
        }
        src.entities.add(ent);
      });
      if (flyFirst && rows?.[0]) {
        const dest = Number(rows[0].flyAlt) || (rows[0].kind === "property" ? 420 : 18000);
        flyTo(rows[0].lat, rows[0].lon, dest);
      }
    }

    function kmBetween(aLat, aLon, bLat, bLon) {
      const R = 6371;
      const p1 = (aLat * Math.PI) / 180;
      const p2 = (bLat * Math.PI) / 180;
      const dLat = p2 - p1;
      const dLon = ((bLon - aLon) * Math.PI) / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    function setCmdMode(mode) {
      cmdMode = mode === "property" ? "property" : "place";
      const placeBtn = $("#cmd-place");
      const propBtn = $("#cmd-property");
      if (placeBtn) placeBtn.classList.toggle("on", cmdMode === "place");
      if (propBtn) propBtn.classList.toggle("on", cmdMode === "property");
      const input = $("#chat-in");
      if (input) input.placeholder = cmdMode === "property" ? "property address" : "go to a place";
      const box = $("#eye-chat");
      const body = $("#chat-body");
      if (body && body.hidden) {
        body.hidden = false;
        box.classList.remove("shut");
      }
    }

    async function loadWebIndexAt(lat, lon, around) {
      const jobs = await Promise.allSettled([
        eyeFeed("cameras"),
        eyeFeed("radio"),
        eyeFeed("osmweb", { lat, lon, around: around || 900 }),
      ]);
      const rows = [];
      const notes = [];
      jobs.forEach((job, i) => {
        const name = ["cameras", "radio", "osm mapped webcams"][i];
        if (job.status !== "fulfilled") {
          notes.push(`${name} refused`);
          return;
        }
        const body = job.value || {};
        if (body.error) {
          notes.push(`${name}: ${body.error}`);
          return;
        }
        (body.rows || []).forEach((row) => {
          if (row.lat == null || row.lon == null) return;
          if (i < 2 && kmBetween(lat, lon, row.lat, row.lon) > 8) return;
          rows.push({ ...row, id: `${name}:${row.id || rows.length}`, note: row.note || name });
        });
      });
      const sliced = rows.slice(0, 220);
      plotRows(
        "meta",
        sliced,
        `web metadata on this property · ${sliced.length} public points inside the focus · not a tap · ${notes.join(" · ")}`.trim(),
      );
    }

    async function focusPropertyLayers(lat, lon) {
      const bits = [];
      if (layerOn.meta) {
        await loadWebIndexAt(lat, lon, 900);
        bits.push("web metadata recentered to ~900m around this address");
      }
      if (layerOn.cameras) {
        try {
          const j = await eyeFeed("cameras");
          const near = (j.rows || []).filter((r) => r.lat != null && kmBetween(lat, lon, r.lat, r.lon) < 8);
          plotRows(
            "cameras",
            near,
            near.length
              ? `public cameras within 8km of this property · ${near.length}`
              : "public camera catalogs (austin/tfl) have no row this close · not a worldwide tap",
          );
          bits.push(near.length ? `public cameras ${near.length} within 8km` : "no catalog camera this close");
        } catch (e) {
          bits.push("cameras: " + String(e.message || e));
        }
      }
      if (layerOn.engine) bits.push("engine pin on this property");
      if (layerOn.near) bits.push("bluetooth near stays this-box radio · it does not jump to that address");
      if (layerOn.flights) bits.push("flights still live around the camera");
      if (layerOn.quakes) bits.push("earthquakes still live");
      if (!bits.length) bits.push("no extra layers were on · toggle cameras/meta/engine to compose them here");
      return bits;
    }

    function formatDossier(intel, layers, note) {
      const d = intel || {};
      return [
        `property · ${d.address || "unlabeled"}`,
        `- fly: z19-class rooftop (~420m), not a city glance`,
        `- quality: ${d.quality || "this is unsure"}`,
        `- owner: ${d.owner || "not on the public osm map"}`,
        `- occupant: ${d.occupant || "none mapped"}`,
        `- building: ${d.building || "no osm building tags"}`,
        `- census: ${d.census || "not a us census hit"}`,
        `- wikipedia: ${d.wikipedia || "none"}`,
        `- crime file: ${d.crime || "no live county court file in this feed"}`,
        `- layers: ${layers.join(" · ")}`,
        `- ${d.honesty || note || "public index only"}`,
      ].join("\n");
    }

    function flashGlitch() {
      const el = $("#glitch");
      if (!el) return;
      el.style.display = "block";
      window.setTimeout(() => {
        el.style.display = "none";
      }, 280);
    }

    function altitudeBand(h) {
      if (h < 80000) return "low";
      if (h < 400000) return "edge";
      if (h < 2000000) return "leo";
      return "high";
    }

    function tickGlitch() {
      if (!viewer) return;
      const h = viewer.camera.positionCartographic?.height ?? 0;
      const band = altitudeBand(h);
      if (lastAltBand && lastAltBand !== band) flashGlitch();
      lastAltBand = band;
    }

    function setHoverCard(ent, win) {
      const card = $("#hover-card");
      if (!card) return;
      if (!ent || !win) {
        card.style.display = "none";
        return;
      }
      const m = ent.asherin || {};
      card.innerHTML = `<b>${String(ent.name || m.label || "asset").slice(0, 48)}</b><div class="m">${m.kind || ""} · ${Number(m.lat || 0).toFixed(3)}, ${Number(m.lon || 0).toFixed(3)}</div><div class="m">${String(m.note || "public index").slice(0, 180)}</div>`;
      card.style.display = "block";
      const box = root.querySelector(".eye-root") || root;
      const cw = box.clientWidth || 1;
      const ch = box.clientHeight || 1;
      const pad = 10;
      const half = Math.min(120, cw * 0.42);
      let x = Number(win.x) || 0;
      let y = Number(win.y) || 0;
      x = Math.min(Math.max(x, pad + half), cw - pad - half);
      const below = y < 88;
      card.classList.toggle("below", below);
      y = Math.min(Math.max(y, pad + 8), ch - pad);
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
    }

    function pinHoverCard() {
      if (!viewer) return;
      const ent =
        hoverEnt ||
        (tracked &&
          (() => {
            for (let i = 0; i < viewer.dataSources.length; i++) {
              const e = viewer.dataSources.get(i).entities.getById(tracked.id);
              if (e) return e;
            }
            return viewer.entities.getById(tracked?.id);
          })());
      if (!ent?.position) {
        if (!hoverEnt) setHoverCard(null);
        return;
      }
      const p = ent.position.getValue(viewer.clock.currentTime);
      if (!p) return;
      const win = window.Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, p);
      if (win) setHoverCard(ent, win);
    }

    function clearAtmo() {
      const C = window.Cesium;
      if (atmoLayer && viewer) {
        try {
          viewer.imageryLayers.remove(atmoLayer, true);
        } catch {}
        atmoLayer = null;
      }
      if (viewer) {
        ["iono-shell", "ozone-pane", "iono-pane"].forEach((id) => {
          const e = viewer.entities.getById(id);
          if (e) viewer.entities.remove(e);
        });
      }
    }

    async function loadAtmo() {
      const C = window.Cesium;
      clearAtmo();
      const cam = viewer.camera.positionCartographic;
      const lat = C.Math.toDegrees(cam.latitude);
      const lon = C.Math.toDegrees(cam.longitude);
      try {
        atmoLayer = viewer.imageryLayers.addImageryProvider(
          new C.UrlTemplateImageryProvider({
            url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/OMI_Aura_Ozone_DOAS_Total_Column_Daily/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png",
            credit: "nasa gibs omi ozone",
          }),
        );
        atmoLayer.alpha = 0.45;
      } catch (e) {
        setNote("ozone tiles missed · " + (e.message || e));
      }
      let kp = 3;
      try {
        const j = await eyeFeed("spaceweather");
        kp = Number(j.rows?.[0]?.kp) || 3;
      } catch {}
      const ionoH = 280000 + kp * 8000;
      viewer.entities.add({
        id: "iono-shell",
        name: "ionosphere shell",
        position: C.Cartesian3.fromDegrees(lon, lat, ionoH),
        ellipsoid: {
          radii: new C.Cartesian3(480000, 480000, 90000),
          material: C.Color.fromCssColorString("#67e8f9").withAlpha(0.08 + Math.min(0.18, kp / 80)),
          outline: true,
          outlineColor: C.Color.fromCssColorString("#67e8f9").withAlpha(0.35),
        },
        asherin: {
          kind: "atmo",
          label: `ionosphere schematic · kp ${kp}`,
          lat,
          lon,
          note: "height follows noaa kp · not a raytrace of the real f2 layer",
        },
      });
      viewer.entities.add({
        id: "ozone-pane",
        name: "ozone pane",
        rectangle: {
          coordinates: C.Rectangle.fromDegrees(lon - 7, lat - 5, lon + 7, lat + 5),
          height: 22000,
          material: C.Color.fromCssColorString("#9ec9ff").withAlpha(0.14),
          outline: true,
          outlineColor: C.Color.fromCssColorString("#9ec9ff").withAlpha(0.4),
        },
        asherin: {
          kind: "atmo",
          label: "ozone pane",
          lat,
          lon,
          note: "glass plane at tropopause class · gibs tiles on the globe are the measurement",
        },
      });
      setNote(
        `atmosphere · ozone tiles + iono shell at ~${Math.round(ionoH / 1000)} km · kp ${kp} · schematic, not a chemistry lab`,
      );
    }

    async function loadSats() {
      const C = window.Cesium;
      const sat = window.satellite;
      if (!sat) throw new Error("satellite.js not loaded");
      const j = await eyeFeed("sats");
      const src = dsFor("sats");
      src.entities.removeAll();
      Object.keys(satRecs).forEach((k) => delete satRecs[k]);
      const now = new Date();
      (j.rows || []).slice(0, 70).forEach((row, i) => {
        if (!row.tle1 || !row.tle2) return;
        let rec;
        try {
          rec = sat.twoline2satrec(String(row.tle1).trim(), String(row.tle2).trim());
        } catch {
          return;
        }
        const pv = sat.propagate(rec, now);
        if (!pv.position) return;
        const gd = sat.eciToGeodetic(pv.position, sat.gstime(now));
        const lat = sat.degreesLat(gd.latitude);
        const lon = sat.degreesLong(gd.longitude);
        const alt = gd.height * 1000;
        const eid = `sats:${row.id || i}`;
        satRecs[eid] = rec;
        const path = [];
        const periodMin = (2 * Math.PI) / rec.no;
        for (let s = 0; s < 72; s++) {
          const t = new Date(now.getTime() + (s / 72) * periodMin * 60000);
          const p2 = sat.propagate(rec, t);
          if (!p2.position) continue;
          const g2 = sat.eciToGeodetic(p2.position, sat.gstime(t));
          path.push(sat.degreesLong(g2.longitude), sat.degreesLat(g2.latitude), g2.height * 1000);
        }
        const footprint = Math.max(180000, alt * 0.35);
        src.entities.add({
          id: eid,
          name: row.label || "sat",
          position: C.Cartesian3.fromDegrees(lon, lat, alt),
          point: { pixelSize: 7, color: C.Color.fromCssColorString("#7dd3fc") },
          polyline:
            path.length >= 6
              ? {
                  positions: C.Cartesian3.fromDegreesArrayHeights(path),
                  width: 1.2,
                  material: C.Color.fromCssColorString("#7dd3fc").withAlpha(0.55),
                }
              : undefined,
          ellipse: {
            semiMajorAxis: footprint,
            semiMinorAxis: footprint,
            material: C.Color.fromCssColorString("#7dd3fc").withAlpha(0.08),
            height: 0,
            outline: true,
            outlineColor: C.Color.fromCssColorString("#7dd3fc").withAlpha(0.25),
          },
          label: {
            text: String(row.label || "sat").slice(0, 28),
            font: "11px Inter",
            fillColor: C.Color.WHITE,
            pixelOffset: new C.Cartesian2(0, -16),
            showBackground: true,
            backgroundColor: C.Color.BLACK.withAlpha(0.45),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          asherin: {
            kind: "sats",
            label: row.label,
            lat,
            lon,
            note: row.note || "celestrak orbit + coverage cone (elevation-class ellipse)",
          },
        });
      });
      setNote(j.note || "satellites · public tle orbits");
    }

    async function loadLands() {
      const C = window.Cesium;
      clearDs("lands");
      const src = dsFor("lands");
      const r = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json", {
        signal: AbortSignal.timeout(12000),
      });
      const topo = await r.json();
      const objects = topo.objects || {};
      const key = objects.countries ? "countries" : Object.keys(objects)[0];
      if (!key) throw new Error("world-atlas had no countries object");
      if (!window.topojson) {
        await loadScript("https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js");
      }
      const geo = window.topojson.feature(topo, objects[key]);
      const dsx = await C.GeoJsonDataSource.load(geo, {
        stroke: C.Color.fromCssColorString("#9ec9ff").withAlpha(0.7),
        fill: C.Color.fromCssColorString("#9ec9ff").withAlpha(0.04),
        strokeWidth: 1.4,
      });
      dsx.entities.values.forEach((e, i) => {
        const name = e.name || e.properties?.name || e.properties?.NAME || "country";
        e.name = String(name).toLowerCase();
        e.asherin = { kind: "lands", label: e.name, note: "admin-0 outline · click to highlight · not a threat zone" };
        if (e.polygon) {
          e.polygon.material = C.Color.fromCssColorString("#9ec9ff").withAlpha(0.04);
          e.polygon.outlineColor = C.Color.fromCssColorString("#9ec9ff").withAlpha(0.55);
        }
      });
      viewer.dataSources.remove(src);
      ds.lands = dsx;
      viewer.dataSources.add(dsx);
      setNote("territories · click a country · ice glass, not a red-threat costume");
    }

    function highlightCountry(ent) {
      const C = window.Cesium;
      const src = ds.lands;
      if (!src) return;
      src.entities.values.forEach((e) => {
        if (!e.polygon) return;
        const on = e.id === ent.id;
        e.polygon.material = C.Color.fromCssColorString(on ? "#e8c56b" : "#9ec9ff").withAlpha(on ? 0.28 : 0.04);
        e.polygon.outlineColor = C.Color.fromCssColorString(on ? "#e8c56b" : "#9ec9ff");
      });
      hoverEnt = ent;
      pinHoverCard();
      setNote(`territory · ${ent.name} · public admin outline`);
    }

    function loadDark() {
      const C = window.Cesium;
      const cam = viewer.camera.positionCartographic;
      const lat = C.Math.toDegrees(cam.latitude);
      const lon = C.Math.toDegrees(cam.longitude);
      const counts = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const rlat = lat + dy * 4;
          const rlon = lon + dx * 5;
          let n = 0;
          for (let i = 0; i < viewer.dataSources.length; i++) {
            viewer.dataSources.get(i).entities.values.forEach((e) => {
              const m = e.asherin;
              if (!m || m.lat == null) return;
              if (Math.abs(m.lat - rlat) < 2.2 && Math.abs(m.lon - rlon) < 2.8) n += 1;
            });
          }
          if (n < 3) {
            counts.push({
              id: `dark-${dx}-${dy}`,
              label: n === 0 ? "no public points" : `${n} public points`,
              lat: rlat,
              lon: rlon,
              note: "sparse live public layers in this cell · not an internet-blackout claim · not intercept",
            });
          }
        }
      }
      plotRows(
        "dark",
        counts,
        counts.length
          ? `dark zones · ${counts.length} sparse cells around the camera`
          : "this view is dense with public points · no dark cell here",
      );
    }

    async function loadFuture() {
      const j = await eyeFeed("plates");
      const C = window.Cesium;
      const src = dsFor("future");
      src.entities.removeAll();
      (j.rows || []).forEach((row, i) => {
        const ring = Array.isArray(row.ring) ? row.ring : [];
        const flat = [];
        ring.forEach((p) => {
          if (Number.isFinite(p.lon) && Number.isFinite(p.lat)) flat.push(p.lon, p.lat);
        });
        if (flat.length < 4) return;
        src.entities.add({
          id: `future:${row.id || i}`,
          name: row.label || "plate edge",
          polyline: {
            positions: C.Cartesian3.fromDegreesArray(flat),
            width: 2,
            material: C.Color.fromCssColorString("#fde68a").withAlpha(0.8),
            clampToGround: true,
          },
          asherin: { kind: "future", label: row.label, lat: row.lat, lon: row.lon, note: row.note },
        });
      });
      setNote(j.note || "plate edges · meters per century");
    }

    async function loadRoutePath(aLat, aLon, bLat, bLon) {
      const j = await eyeFeed("route", { alat: aLat, alon: aLon, blat: bLat, blon: bLon });
      const C = window.Cesium;
      const src = dsFor("route");
      src.entities.removeAll();
      const row = (j.rows || [])[0];
      const ring = Array.isArray(row?.ring) ? row.ring : [];
      const flat = [];
      ring.forEach((p) => {
        if (Number.isFinite(p.lon) && Number.isFinite(p.lat)) flat.push(p.lon, p.lat);
      });
      if (flat.length >= 4) {
        src.entities.add({
          id: "route:0",
          name: "unstable route",
          polyline: {
            positions: C.Cartesian3.fromDegreesArray(flat),
            width: 3.2,
            material: C.Color.fromCssColorString("#67e8f9"),
            clampToGround: true,
          },
          asherin: { kind: "route", label: "unstable route", lat: aLat, lon: aLon, note: row.note },
        });
      }
      layerOn.route = true;
      setNote(row?.note || j.note || "public drive path");
      return j;
    }

    function jpegGps(buf) {
      const u8 = new Uint8Array(buf);
      if (u8[0] !== 0xff || u8[1] !== 0xd8) return null;
      let i = 2;
      while (i + 4 < u8.length) {
        if (u8[i] !== 0xff) break;
        const marker = u8[i + 1];
        const len = (u8[i + 2] << 8) | u8[i + 3];
        if (marker === 0xe1) {
          const start = i + 4;
          const head = String.fromCharCode(...u8.slice(start, start + 6));
          if (head.indexOf("Exif") < 0) {
            i += 2 + len;
            continue;
          }
          const tiff = start + 6;
          const le = u8[tiff] === 0x49;
          const u16 = (p) => (le ? u8[p] | (u8[p + 1] << 8) : (u8[p] << 8) | u8[p + 1]);
          const u32 = (p) =>
            le
              ? u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16) | (u8[p + 3] << 24)
              : (u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3];
          const ifd0 = tiff + u32(tiff + 4);
          const n0 = u16(ifd0);
          let gpsOff = 0;
          for (let k = 0; k < n0; k++) {
            const p = ifd0 + 2 + k * 12;
            if (u16(p) === 0x8825) gpsOff = u32(p + 8);
          }
          if (!gpsOff) return { stripped: false, lat: null, lon: null };
          const gifd = tiff + gpsOff;
          const ng = u16(gifd);
          const tags = {};
          for (let k = 0; k < ng; k++) {
            const p = gifd + 2 + k * 12;
            tags[u16(p)] = { type: u16(p + 2), count: u32(p + 4), val: u32(p + 8) };
          }
          const rationals = (off, n) => {
            const out = [];
            for (let r = 0; r < n; r++) {
              const a = u32(off + r * 8);
              const b = u32(off + r * 8 + 4) || 1;
              out.push(a / b);
            }
            return out;
          };
          const dms = (tag) => {
            const t = tags[tag];
            if (!t) return null;
            const arr = rationals(tiff + t.val, 3);
            return arr[0] + arr[1] / 60 + arr[2] / 3600;
          };
          let lat = dms(2);
          let lon = dms(4);
          const latRef = tags[1] ? String.fromCharCode(tags[1].val & 0xff) : "N";
          const lonRef = tags[3] ? String.fromCharCode(tags[3].val & 0xff) : "E";
          if (latRef === "S") lat = -lat;
          if (lonRef === "W") lon = -lon;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { stripped: false, lat: null, lon: null };
          return { stripped: false, lat, lon };
        }
        if (marker === 0xda) break;
        i += 2 + len;
      }
      return { stripped: true, lat: null, lon: null };
    }

    async function pinOwnedPhoto(file) {
      const buf = await file.arrayBuffer();
      const gps = jpegGps(buf);
      if (!gps || gps.lat == null) {
        setNote(
          "no gps in this file · metadata stripped or not a jpeg with exif · geolocation from pixels is a separate ask",
        );
        chatLog.push({
          role: "eye",
          text: "no gps in that file. this is unsure. drop a jpeg you own that still has exif.",
        });
        paintChat();
        return;
      }
      pinEngine(
        [
          {
            id: "exif",
            label: (file.name || "photo").slice(0, 40),
            lat: gps.lat,
            lon: gps.lon,
            kind: "engine",
            note: "exif gps from a file you dropped · device/time stay on-disk in the organ, not a skip-trace",
          },
        ],
        true,
      );
      chatLog.push({ role: "eye", text: `pinned exif gps ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` });
      paintChat();
    }

    async function loadLayer(id) {
      if (id === "ships" || id === "fires" || id === "traffic") {
        throw new Error(LAYER_ROWS.find((x) => x.id === id).honesty);
      }
      if (id === "spaceweather") {
        const j = await eyeFeed("spaceweather");
        setNote(`planetary k-index ${j.rows?.[0]?.kp} · ${j.source || "noaa"}`);
        return;
      }
      if (id === "engine") {
        setNote("asherin.engine is the chat + pins. type a place. this is not a search results page.");
        return;
      }
      if (id === "near") {
        await loadNear();
        return;
      }
      if (id === "meta") {
        await loadWebIndex();
        return;
      }
      if (id === "sats") {
        await loadSats();
        return;
      }
      if (id === "atmo") {
        await loadAtmo();
        return;
      }
      if (id === "lands") {
        await loadLands();
        return;
      }
      if (id === "dark") {
        loadDark();
        return;
      }
      if (id === "future") {
        await loadFuture();
        return;
      }
      if (id === "route") {
        setNote("type route to <place> in chat · osrm public drive path + weather cost");
        return;
      }
      const cam = viewer?.camera?.positionCartographic;
      const params = {};
      if (cam && window.Cesium) {
        params.lat = window.Cesium.Math.toDegrees(cam.latitude);
        params.lon = window.Cesium.Math.toDegrees(cam.longitude);
      }
      const feedName = id === "cameras" ? "cameras" : id === "zones" ? "airgrid" : id;
      const j = await eyeFeed(feedName, params);
      const note = [j.note, j.fresh === false ? `stale ${Math.round((j.ageMs || 0) / 1000)}s` : ""]
        .filter(Boolean)
        .join(" · ");
      plotRows(id, j.rows, note);
    }

    async function loadNear() {
      try {
        const r = await fetch(HUB, { signal: AbortSignal.timeout(1800) });
        const j = await r.json();
        const last = (j.rows || [])[0] || {};
        const place = last.place || {};
        const lat = Number(place.lat);
        const lon = Number(place.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("companion has no city-scale place");
        const ble = last.bluetooth?.ble_ads?.devices || last.seen_not_connected || [];
        const ads = Array.isArray(ble) ? ble : [];
        const rows = ads.slice(0, 40).map((d, i) => {
          const rssi = Number(d.rssi || -70);
          const ring = Math.min(0.004, Math.max(0.0004, (Math.abs(rssi) - 40) / 18000));
          const ang = (i / Math.max(1, ads.length)) * Math.PI * 2;
          return {
            id: d.address || d.chat_label || i,
            label: (d.chat_label || d.name || "ble ad").slice(0, 40),
            lat: lat + Math.sin(ang) * ring,
            lon: lon + Math.cos(ang) * ring,
            note: "this-box radio · meters · sees ≠ joins",
          };
        });
        if (!rows.length) {
          rows.push({
            id: "box",
            label: `${place.city || "this box"} · radios heard`,
            lat,
            lon,
            note: "no ble ads this tick",
          });
        }
        plotRows(
          "near",
          rows,
          `bluetooth near · ${rows.length} ads this tick · this radio is meters, not a state · not a hijack`,
        );
        if (!nearOnce) {
          nearOnce = true;
          flyTo(lat, lon, 12000);
        }
      } catch (e) {
        throw new Error("companion not readable from this https tab · sees ≠ joins · " + (e.message || e));
      }
    }

    async function loadWebIndex() {
      const C = window.Cesium;
      const cam = viewer?.camera?.positionCartographic;
      const lat = cam ? C.Math.toDegrees(cam.latitude) : 0;
      const lon = cam ? C.Math.toDegrees(cam.longitude) : 0;
      const jobs = await Promise.allSettled([eyeFeed("cameras"), eyeFeed("radio"), eyeFeed("osmweb", { lat, lon })]);
      const rows = [];
      const notes = [];
      jobs.forEach((job, i) => {
        const name = ["cameras", "radio", "osm mapped webcams"][i];
        if (job.status !== "fulfilled") {
          notes.push(`${name} refused`);
          return;
        }
        const body = job.value || {};
        if (body.error) {
          notes.push(`${name}: ${body.error}`);
          return;
        }
        (body.rows || []).forEach((row) => {
          if (row.lat == null || row.lon == null) return;
          rows.push({
            ...row,
            id: `${name}:${row.id || rows.length}`,
            note: row.note || name,
          });
        });
      });
      const sliced = rows.slice(0, 220);
      plotRows(
        "meta",
        sliced,
        `web metadata live layer · ${sliced.length} public web-connected points · not a tap · not a port scan · ${notes.join(" · ")}`.trim(),
      );
    }

    function planePng() {
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 32;
      const g = c.getContext("2d");
      g.fillStyle = "#fbbf24";
      g.beginPath();
      g.moveTo(16, 2);
      g.lineTo(22, 14);
      g.lineTo(30, 16);
      g.lineTo(22, 18);
      g.lineTo(16, 30);
      g.lineTo(10, 18);
      g.lineTo(2, 16);
      g.lineTo(10, 14);
      g.closePath();
      g.fill();
      return c.toDataURL();
    }

    function trackEntity(ent) {
      tracked = { id: ent.id, label: ent.name, meta: ent.asherin || {} };
      const C = window.Cesium;
      if (trail) viewer.entities.remove(trail);
      trail = viewer.entities.add({
        polyline: {
          positions: new C.CallbackProperty(() => {
            const hist = pathHist[ent.id] || [];
            const pts = hist.map((p) => C.Cartesian3.fromDegrees(p.lon, p.lat, p.alt));
            if (ent.position) {
              const p = ent.position.getValue(viewer.clock.currentTime);
              if (p) pts.push(p);
            }
            return pts;
          }, false),
          width: 2.6,
          material: C.Color.fromCssColorString("#fbbf24").withAlpha(0.85),
          depthFailMaterial: C.Color.fromCssColorString("#fbbf24").withAlpha(0.4),
          arcType: C.ArcType.GEODESIC,
        },
      });
      applyCamMode(camMode);
      const icao = String(ent.id || "").split(":")[1] || "";
      if (/^[a-fA-F0-9]{4,8}$/.test(icao)) {
        eyeFeed("hex", { icao })
          .then((j) => {
            const extra = j.rows || [];
            const hist = pathHist[ent.id] || (pathHist[ent.id] = []);
            extra.forEach((row) => {
              if (row.lat == null || row.lon == null) return;
              hist.unshift({ lat: Number(row.lat), lon: Number(row.lon), alt: Number(row.alt || 0), t: 0 });
            });
            if (hist.length > 240) hist.splice(0, hist.length - 240);
          })
          .catch(() => {});
      }
      setHud();
    }

    function applyCamMode(mode) {
      camMode = CAM_MODES.includes(mode) ? mode : "chase";
      const C = window.Cesium;
      const ent =
        viewer?.trackedEntity ||
        (tracked &&
          (() => {
            for (let i = 0; i < viewer.dataSources.length; i++) {
              const e = viewer.dataSources.get(i).entities.getById(tracked.id);
              if (e) return e;
            }
            return null;
          })());
      if (!ent) {
        setNote("click a contact first");
        return;
      }
      if (camMode === "orbit") {
        viewer.trackedEntity = undefined;
        setNote("orbit · camera walks around the contact");
      } else if (camMode === "nadir") {
        ent.viewFrom = new C.Cartesian3(0, 0, 420);
        viewer.trackedEntity = undefined;
        viewer.trackedEntity = ent;
        setNote("nadir · looking down on the contact");
      } else {
        ent.viewFrom = new C.Cartesian3(-140, -50, 32);
        viewer.trackedEntity = undefined;
        viewer.trackedEntity = ent;
        setNote("chase · camera rides behind the contact");
      }
      setHud();
    }

    async function playTour() {
      if (!viewer) return;
      camMode = "chase";
      viewer.trackedEntity = undefined;
      setNote("tour · zip scene-director class · public camera path");
      const C = window.Cesium;
      for (const shot of TOUR_SHOTS) {
        if (dead) return;
        await new Promise((resolve) => {
          viewer.camera.flyTo({
            destination: C.Cartesian3.fromDegrees(shot.lon, shot.lat, shot.alt),
            orientation: {
              heading: C.Math.toRadians(shot.heading || 0),
              pitch: C.Math.toRadians(shot.pitch || -45),
              roll: 0,
            },
            duration: shot.duration || 4,
            complete: resolve,
          });
        });
      }
      setNote("tour ended");
    }

    function releaseTrack() {
      tracked = null;
      modelOn = false;
      viewer.trackedEntity = undefined;
      if (trail) {
        viewer.entities.remove(trail);
        trail = null;
      }
      setHud();
    }

    function refreshHangar() {
      if (!viewer) return;
      const C = window.Cesium;
      const h = viewer.camera.positionCartographic?.height ?? Infinity;
      const want = tracked ? (modelOn ? h < TRACKED_MODEL_EXIT_M : h < TRACKED_MODEL_ENTER_M) : false;
      modelOn = want;
      const srcIds = ["flights", "military"];
      srcIds.forEach((id) => {
        const src = ds[id];
        if (!src) return;
        src.entities.values.forEach((e) => {
          const isTracked = tracked && e.id === tracked.id;
          const close = isTracked && modelOn;
          if (e.model) e.model.show = close;
          if (e.billboard) e.billboard.show = !close;
        });
      });
    }

    function refreshContacts() {
      const list = $("#contact-list");
      if (!list || $("#contacts").hidden) return;
      const cam = viewer.camera.positionWC;
      const hits = [];
      for (let i = 0; i < viewer.dataSources.length; i++) {
        const d = viewer.dataSources.get(i);
        d.entities.values.forEach((e) => {
          if (!e.position) return;
          const p = e.position.getValue(viewer.clock.currentTime);
          if (!p) return;
          const km = kmBetween(window.Cesium, cam, p);
          if (km <= 250) hits.push({ e, km });
        });
      }
      hits.sort((a, b) => a.km - b.km);
      list.innerHTML =
        hits
          .slice(0, 40)
          .map(
            (h) =>
              `<button type="button" class="hit" data-id="${h.e.id}"><b>${(h.e.name || h.e.id).slice(0, 42)}</b><span>${h.km.toFixed(1)} km</span></button>`,
          )
          .join("") ||
        `<p style="color:var(--mute);font-size:12px">nothing inside 250 km. enable layers or fly lower.</p>`;
      list.querySelectorAll(".hit").forEach((b) => {
        b.onclick = () => {
          for (let i = 0; i < viewer.dataSources.length; i++) {
            const e = viewer.dataSources.get(i).entities.getById(b.dataset.id);
            if (e) trackEntity(e);
          }
        };
      });
    }

    function drawDetect(on) {
      const cv = $("#detect");
      if (!cv || !viewer) return;
      const box = root.querySelector(".eye-root") || root;
      cv.width = box.clientWidth;
      cv.height = box.clientHeight;
      const ctx = cv.getContext("2d");
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (!on || !tracked || !viewer.trackedEntity) return;
      const p = viewer.trackedEntity.position?.getValue(viewer.clock.currentTime);
      if (!p) return;
      const win = window.Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, p);
      if (!win) return;
      ctx.strokeStyle = "hsla(38,92%,50%,0.85)";
      ctx.lineWidth = 1.2;
      const s = 28;
      ctx.strokeRect(win.x - s, win.y - s, s * 2, s * 2);
      ctx.font = "11px Inter";
      ctx.fillStyle = "hsla(38,92%,70%,0.9)";
      ctx.fillText(tracked.label || "contact", win.x - s, win.y - s - 6);
    }

    function paintChat() {
      const log = $("#chat-log");
      if (!log) return;
      log.innerHTML = chatLog
        .slice(-16)
        .map(
          (m) =>
            `<div class="${m.role === "user" ? "me" : "bot"}">${m.role === "user" ? "you" : "eye"}: ${String(m.text).slice(0, 1400)}</div>`,
        )
        .join("");
      log.scrollTop = log.scrollHeight;
      $("#chat-key").textContent = keyBound()
        ? "key bound"
        : cmdMode === "property"
          ? "property command"
          : "places still pin";
    }

    async function handleChat(raw) {
      const q0 = String(raw || "").trim();
      if (!q0) return;
      chatLog.push({ role: "user", text: q0 });
      paintChat();
      const url = q0.match(/https?:\/\/[^\s]+/i);
      let q = q0;
      let wantProperty = cmdMode === "property";
      if (/^(route|path) to /i.test(q0)) {
        try {
          const dest = q0.replace(/^(route|path) to /i, "").trim();
          const cam = viewer?.camera?.positionCartographic;
          if (!cam) throw new Error("globe camera not ready");
          const aLat = window.Cesium.Math.toDegrees(cam.latitude);
          const aLon = window.Cesium.Math.toDegrees(cam.longitude);
          const places = await eyeFeed("places", { q: dest });
          const b = (places.rows || [])[0];
          if (!b?.lat) throw new Error("no public place to route to");
          const j = await loadRoutePath(aLat, aLon, b.lat, b.lon);
          flyTo(b.lat, b.lon, 48000);
          chatLog.push({ role: "eye", text: String(j.note || j.rows?.[0]?.note || "public drive path").toLowerCase() });
          paintChat();
          setNote("");
        } catch (e) {
          chatLog.push({ role: "eye", text: String(e.message || e).toLowerCase() });
          paintChat();
          setNote(String(e.message || e));
        }
        return;
      }
      if (/^(property|parcel|cadastre)\b/i.test(q)) {
        wantProperty = true;
        q = q.replace(/^(property|parcel|cadastre)\s+/i, "").trim() || q;
        setCmdMode("property");
      } else if (/^(go to|fly to|take me to)\s+/i.test(q)) {
        wantProperty = false;
        q = q.replace(/^(go to|fly to|take me to)\s+/i, "").trim();
        setCmdMode("place");
      }
      setNote(wantProperty ? "property command · public dossier…" : "engine looking for places…");
      try {
        if (url) {
          const j = await eyeFeed("webmeta", { url: url[0] });
          const rows = j.rows || [];
          plotRows(
            "meta",
            rows.filter((r) => r.lat != null),
            j.note || "public metadata",
          );
          layerOn.meta = true;
          if (rows[0]?.lat) {
            pinEngine(rows, true);
            chatLog.push({
              role: "eye",
              text: `pinned public metadata for that url. ${rows[0].label || ""}`.toLowerCase(),
            });
          } else {
            chatLog.push({
              role: "eye",
              text: `public metadata read. no geo tag on the page. ${j.note || ""}`.toLowerCase(),
            });
          }
          paintChat();
          setNote("");
          return;
        }
        const feed = wantProperty ? "property" : "places";
        const j = await eyeFeed(feed, { q });
        const rows = j.rows || [];
        pinEngine(rows, true);
        void emitPull({
          organ: "eye",
          capability: wantProperty ? "property" : "engine-pin",
          fromSurface: "asherin-eye",
          status: rows.length ? "ok" : "skip",
          quote: q.slice(0, 80),
        });
        if (wantProperty && rows[0]?.lat != null) {
          const intel = j.dossier || rows[0].intel || {};
          const layers = await focusPropertyLayers(rows[0].lat, rows[0].lon);
          chatLog.push({ role: "eye", text: formatDossier(intel, layers, j.note).toLowerCase() });
          if (keyBound()) {
            const talk = await eyeTalk([
              {
                role: "system",
                content:
                  "you sit in asherin.eye. reply in lowercase. never dump a serp. property research is public-index only. do not invent owners, occupants, or crimes.",
              },
              {
                role: "user",
                content: `property dossier already pulled:\n${JSON.stringify(intel).slice(0, 800)}\noperator said: ${q}`,
              },
            ]);
            const text = talk.reply || talk.text || talk.message || "";
            if (text && !talk.error) chatLog.push({ role: "eye", text: String(text).slice(0, 500).toLowerCase() });
          }
        } else {
          let mouth = rows.length
            ? `pinned ${rows.length} place${rows.length === 1 ? "" : "s"} on the globe. asherin.engine finds locations; it does not dump search results here.`
            : "no public place matched. this is unsure.";
          if (keyBound()) {
            const talk = await eyeTalk([
              {
                role: "system",
                content:
                  "you sit in asherin.eye. reply in lowercase. never dump a search engine results page. if the user wants a place, name it and coords.",
              },
              { role: "user", content: q },
            ]);
            const text = talk.reply || talk.text || talk.message || talk.error || "";
            if (text && !talk.error) mouth = String(text).slice(0, 500);
            extractPlaces(String(text)).forEach((p) => pinEngine([{ ...p, id: "talk" }], false));
          } else {
            mouth += " connect a model key in connect if you want the mouth. places still pin without it.";
          }
          chatLog.push({ role: "eye", text: mouth.toLowerCase() });
        }
        paintChat();
        setNote("");
      } catch (e) {
        chatLog.push({ role: "eye", text: String(e.message || e).toLowerCase() });
        paintChat();
        setNote(String(e.message || e));
      }
    }

    async function boot() {
      window.CESIUM_BASE_URL = CESIUM_BASE;
      loadCss(CESIUM_BASE + "Widgets/widgets.css");
      await loadScript(CESIUM_BASE + "Cesium.js");
      await loadScript(SAT_JS);
      if (dead) return;
      const CesiumG = window.Cesium;
      window.Cesium = CesiumG;
      const keys = discoverMapsKey();
      if (keys.ion) CesiumG.Ion.defaultAccessToken = keys.ion;
      if (keys.google) CesiumG.GoogleMaps.defaultApiKey = keys.google;

      const credit = document.createElement("div");
      credit.id = "cesium-credit-host";
      $("#eye-credits").appendChild(credit);

      viewer = new CesiumG.Viewer("eye-stage", {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        vrButton: false,
        selectionIndicator: false,
        infoBox: false,
        creditContainer: credit,
        terrain: undefined,
      });
      viewer.scene.globe.depthTestAgainstTerrain = true;
      if (keys.ion) {
        try {
          viewer.terrainProvider = await CesiumG.createWorldTerrainAsync();
          status.photoreal = (status.photoreal || "") + " · world terrain bound";
        } catch {}
      }
      viewer.clock.shouldAnimate = true;
      try {
        paneWatch = new ResizeObserver(fitGlobe);
        paneWatch.observe(root.querySelector(".eye-root") || root);
        paneWatch.observe($("#eye-stage"));
      } catch {
        paneWatch = null;
      }
      window.visualViewport?.addEventListener("resize", fitGlobe);
      window.addEventListener("orientationchange", fitGlobe);
      fitGlobe();
      viewer.scene.preUpdate.addEventListener(() => {
        if (camMode !== "orbit" || !tracked) return;
        let ent = viewer.trackedEntity;
        if (!ent) {
          for (let i = 0; i < viewer.dataSources.length; i++) {
            const e = viewer.dataSources.get(i).entities.getById(tracked.id);
            if (e) {
              ent = e;
              break;
            }
          }
        }
        if (!ent?.position) return;
        const p = ent.position.getValue(viewer.clock.currentTime);
        if (!p) return;
        orbitHeading += 0.0035;
        viewer.camera.lookAt(p, new CesiumG.HeadingPitchRange(orbitHeading, CesiumG.Math.toRadians(-28), 560));
      });

      try {
        if (keys.google) {
          const tiles = await CesiumG.createGooglePhotorealistic3DTileset();
          viewer.scene.primitives.add(tiles);
          status.photoreal = "google 3d tiles · bound";
          status.map = "photoreal";
        } else {
          applyGlobe("sat");
          status.photoreal = "unavailable until a maps key is bound in connect";
        }
      } catch (e) {
        applyGlobe("osm");
        status.photoreal = "photoreal failed · osm globe";
      }

      const layerHost = $("#layer-btns");
      LAYER_ROWS.forEach((row) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tog";
        b.dataset.layer = row.id;
        b.textContent = row.label;
        b.title = row.honesty;
        b.onclick = () => enableLayer(row.id, !layerOn[row.id]);
        layerHost.appendChild(b);
      });
      const globeHost = $("#globe-btns");
      GLOBES.forEach((g) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tog" + (g === "sat" ? " on" : "");
        b.dataset.globe = g;
        b.textContent = g === "sat" ? "satellite" : g;
        b.onclick = () => applyGlobe(g);
        globeHost.appendChild(b);
      });
      const styleHost = $("#style-btns");
      STYLES.forEach((s, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tog" + (s === "normal" ? " on" : "");
        b.dataset.style = s;
        b.textContent = `${i + 1} ${s}`;
        b.onclick = () => applyStyle(s);
        styleHost.appendChild(b);
      });

      const handler = new CesiumG.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        const ent = picked?.id;
        if (ent?.asherin?.kind === "lands") {
          highlightCountry(ent);
          return;
        }
        if (ent && ent.asherin) {
          hoverEnt = ent;
          trackEntity(ent);
          pinHoverCard();
        } else releaseTrack();
      }, CesiumG.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction((mv) => {
        const picked = viewer.scene.pick(mv.endPosition);
        const ent = picked?.id;
        if (ent?.asherin) {
          hoverEnt = ent;
          setHoverCard(ent, mv.endPosition);
        } else if (!tracked) {
          hoverEnt = null;
          setHoverCard(null);
        }
      }, CesiumG.ScreenSpaceEventType.MOUSE_MOVE);

      document.addEventListener("keydown", onKey);
      function onKey(e) {
        if (e.key === "Escape") releaseTrack();
        const n = Number(e.key);
        if (n >= 1 && n <= 7) applyStyle(STYLES[n - 1]);
      }

      $("#btn-cockpit").onclick = () => {
        if (!tracked) {
          setNote("click a contact first");
          return;
        }
        camMode = "chase";
        const ent = viewer.trackedEntity;
        if (ent) {
          ent.viewFrom = new CesiumG.Cartesian3(-80, -20, 18);
          viewer.trackedEntity = undefined;
          viewer.trackedEntity = ent;
        }
        setNote("cockpit · camera rides with the airframe. esc releases in place.");
      };
      $("#btn-chase").onclick = () => applyCamMode("chase");
      $("#btn-orbit").onclick = () => applyCamMode("orbit");
      $("#btn-nadir").onclick = () => applyCamMode("nadir");
      $("#btn-tour").onclick = () => playTour();
      const setSheetOpen = (on) => {
        $("#sheet")?.classList.toggle("open", on);
        $("#btn-layers")?.classList.toggle("on", on);
      };
      $("#btn-layers").onclick = () => {
        const on = !$("#sheet").classList.contains("open");
        setSheetOpen(on);
        if (on) $("#contacts").hidden = true;
      };
      $("#sheet-close").onclick = () => setSheetOpen(false);
      $("#btn-contacts").onclick = () => {
        const el = $("#contacts");
        el.hidden = !el.hidden;
        if (!el.hidden) setSheetOpen(false);
        refreshContacts();
      };
      let detectOn = false;
      $("#btn-detect").onclick = () => {
        detectOn = !detectOn;
        $("#btn-detect").classList.toggle("on", detectOn);
      };
      $("#btn-share").onclick = async () => {
        writeShare();
        try {
          await navigator.clipboard.writeText(location.href);
          setNote("share link copied");
        } catch {
          setNote(location.href);
        }
      };
      $("#btn-exif").onclick = () => $("#exif-file")?.click();
      $("#exif-file").onchange = (e) => {
        const f = e.target.files?.[0];
        if (f) pinOwnedPhoto(f).catch((err) => setNote(String(err.message || err)));
        e.target.value = "";
      };
      $("#btn-reset").onclick = () => {
        releaseTrack();
        viewer.camera.flyTo({ destination: CesiumG.Cartesian3.fromDegrees(-40, 20, 1.8e7), duration: 2 });
      };
      $("#btn-voice").onclick = startVoice;

      $("#chat-toggle").onclick = () => {
        const box = $("#eye-chat");
        const body = $("#chat-body");
        const shut = body.hidden;
        body.hidden = !shut;
        box.classList.toggle("shut", !shut);
        if (shut) setSheetOpen(false);
        paintChat();
      };
      $("#cmd-place").onclick = () => setCmdMode("place");
      $("#cmd-property").onclick = () => setCmdMode("property");
      $("#chat-go").onclick = () => {
        const v = $("#chat-in").value;
        $("#chat-in").value = "";
        handleChat(v);
      };
      $("#chat-in").onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleChat($("#chat-in").value);
          $("#chat-in").value = "";
        }
      };
      paintChat();

      const grid = $("#mission-grid");
      MISSIONS.forEach((m) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = m.title;
        b.style.cssText = "";
        b.onclick = async () => {
          flyTo(m.fly.lat, m.fly.lon, m.fly.alt);
          for (const id of m.layers) await enableLayer(id, true);
        };
        grid.appendChild(b);
      });

      const share = readShare();
      if (share.lat && share.lon) {
        const alt = Number(share.alt) || 8e5;
        flyTo(Number(share.lat), Number(share.lon), alt);
        if (share.style) applyStyle(STYLES[Number(share.style) - 1 || 0] || "normal");
        if (share.map && GLOBES.includes(share.map)) applyGlobe(share.map);
        (share.layers || "")
          .split(",")
          .filter(Boolean)
          .forEach((id) => enableLayer(id, true));
      } else {
        viewer.camera.setView({ destination: CesiumG.Cartesian3.fromDegrees(-40, 20, 1.8e7) });
        void enableLayer("quakes", true);
      }

      pollers.push(
        setInterval(() => {
          setHud();
          refreshContacts();
          refreshHangar();
          drawDetect(detectOn);
          tickGlitch();
          pinHoverCard();
        }, 250),
      );
      pollers.push(
        setInterval(() => {
          if (layerOn.flights) loadLayer("flights").catch(() => {});
          if (layerOn.military) loadLayer("military").catch(() => {});
          if (layerOn.near) loadNear().catch(() => {});
        }, 12000),
      );
      pollers.push(
        setInterval(() => {
          if (layerOn.meta) loadWebIndex().catch(() => {});
        }, 40000),
      );

      void emitPull({ organ: "eye", capability: "open", fromSurface: "asherin-eye", status: "ok" });
      setHud();
    }

    function startVoice() {
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) {
        setNote("voice unavailable in this browser");
        return;
      }
      const rec = new Rec();
      rec.lang = "en-US";
      rec.continuous = false;
      rec.onresult = (ev) => {
        const t = (ev.results[0][0].transcript || "").toLowerCase();
        setNote("heard: " + t);
        LAYER_ROWS.forEach((row) => {
          if (t.includes(row.label) || t.includes(row.id)) enableLayer(row.id, true);
        });
        if (t.includes("reset")) $("#btn-reset").click();
        if (t.includes("cockpit")) $("#btn-cockpit").click();
        if (t.includes("dark")) applyGlobe("dark");
        if (t.includes("satellite") || t.includes("sat")) applyGlobe("sat");
        STYLES.forEach((s) => {
          if (t.includes(s)) applyStyle(s);
        });
        if (/property |parcel /.test(t)) {
          setCmdMode("property");
          handleChat(t.replace(/^(property|parcel)\s+/i, ""));
        } else if (/go to |fly to |take me/.test(t)) {
          setCmdMode("place");
          handleChat(t.replace(/^(go to|fly to|take me to)\s+/i, ""));
        }
      };
      rec.onerror = () => setNote("voice: unavailable");
      rec.start();
      status.voice = "listening";
    }

    boot().catch((e) => {
      const hud = $("#hud-line");
      if (hud) hud.textContent = "globe engine did not load";
      setNote("globe engine blocked. not a page bug in the hud — the page policy refused the cesium host.");
    });

    return () => {
      dead = true;
      pollers.forEach(clearInterval);
      try {
        paneWatch?.disconnect();
      } catch {}
      try {
        window.visualViewport?.removeEventListener("resize", fitGlobe);
        window.removeEventListener("orientationchange", fitGlobe);
      } catch {}
      try {
        viewer?.destroy();
      } catch {}
      root.innerHTML = "";
    };
  }, []);

  return (
    <div ref={hostRef} className="asherin-eye-host relative h-full min-h-0 min-w-0 w-full flex-1 overflow-hidden" />
  );
};

export default AsherinEyeView;
