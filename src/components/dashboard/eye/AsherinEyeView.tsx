// @ts-nocheck
// asherin.eye — 3d globe + live public spatial layers
// adapted from gods-eye-view (mit, © 2026 bilawal sidhu) for asherin.com glass.
// never: palantir chrome, public "god's eye" costume, telegeography nc cables,
// hangar models that are not mit, leftover "paste a google key".

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emitPull } from "@/lib/connect/emitPull";

const CESIUM_BASE = "https://cdn.jsdelivr.net/npm/cesium@1.124.0/Build/Cesium/";
const SAT_JS = "https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js";

const STYLES = ["normal", "crt", "nvg", "flir", "anime", "noir", "snow"];

const LAYER_ROWS = [
  { id: "flights", label: "flights", honesty: "opensky · asherin.eye feed", keyed: false },
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
};

const MISSIONS = [
  { id: "air", title: "air", layers: ["flights", "military"], fly: { lat: 40.64, lon: -73.78, alt: 280000 } },
  { id: "space", title: "space", layers: ["stations", "launches"], fly: { lat: 28.57, lon: -80.65, alt: 4.2e6 } },
  { id: "earth", title: "earth watch", layers: ["quakes"], fly: { lat: 19.4, lon: -155.3, alt: 1.1e6 } },
  { id: "city", title: "city", layers: ["cameras", "radio"], fly: { lat: 51.5, lon: -0.12, alt: 420000 } },
];

const EYE_HUD_CSS = `
  .eye-root { position:absolute; inset:0; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; background:#000; color-scheme:dark; container-type:size; container-name:eye; }
  .eye-root {
    --bg: hsl(var(--background));
    --ink: hsl(var(--foreground));
    --mute: hsl(var(--muted-foreground));
    --line: hsl(var(--border));
    --accent: hsl(var(--accent));
    --accent-ink: hsl(var(--accent-foreground));
    --r: 1rem;
    margin: 0; color: var(--ink);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-weight: 300; letter-spacing: -.01em;
  }
  .eye-root, .eye-root * { box-sizing: border-box; }
  .eye-root * { scrollbar-width: thin; }
  #eye-stage { position:absolute; inset:0; background:#000; }
  .eye-root .cesium-widget, .eye-root .cesium-widget canvas { width:100% !important; height:100% !important; }
  .eye-root .cesium-viewer-bottom, .eye-root .cesium-viewer-toolbar, .eye-root .cesium-viewer-animationContainer, .eye-root .cesium-viewer-timelineContainer { display:none !important; }
  #eye-credits { position:absolute; left:12px; bottom:92px; z-index:6; max-width:min(420px,70%); font:300 9px/1.4 inherit; color:var(--mute); pointer-events:auto; }
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
    position:absolute; top:16px; left:16px; z-index:8;
    padding:12px 16px; pointer-events:auto; min-width:0; max-width:min(280px, calc(100% - 80px));
    font: 300 12px/1.5 inherit; color: var(--ink);
  }
  .misb b { color: var(--accent); font-weight: 500; }
  .misb .m { color: var(--mute); font-size: 11px; }
  .sheet {
    position:absolute; right:16px; top:16px; bottom:110px; z-index:8;
    width: min(300px, 36cqi, calc(100% - 24px)); padding:16px; overflow:auto; pointer-events:auto;
  }
  .sheet h2 { margin:0 0 10px; font:400 13px/1.2 inherit; letter-spacing:.02em; text-transform:lowercase; color:var(--mute); }
  .sheet .row { display:flex; justify-content:space-between; gap:10px; font-size:12px; padding:6px 0; border-bottom:1px solid var(--line); }
  .sheet .k { color: var(--mute); }
  .sheet .list { margin-top:8px; }
  .tog {
    border:1px solid var(--line); border-radius:999px; padding:7px 11px; cursor:pointer;
    color:var(--mute); font:400 12px/1 inherit; background: hsl(var(--card) / .55);
    margin: 0 6px 6px 0;
  }
  .tog.on { background: hsl(var(--accent)); color: var(--accent-ink); border-color:transparent; }
  .talk {
    position:absolute; left:50%; bottom:18px; transform:translateX(-50%);
    z-index:9; display:flex; gap:8px; align-items:center; flex-wrap:wrap;
    padding:10px 12px; width:min(980px, calc(100% - 16px)); justify-content:center;
  }
  .talk button {
    border:1px solid transparent; border-radius:999px; padding:10px 16px; cursor:pointer;
    background: hsl(var(--accent)); color: var(--accent-ink); font:500 13px/1 inherit;
  }
  .talk button.ghost { background: hsl(var(--muted) / .6); color: var(--ink); border-color: var(--line); }
  .contacts { position:absolute; left:16px; top:116px; bottom:110px; z-index:8; width:min(260px,32cqi); padding:14px; overflow:auto; pointer-events:auto; }
  .contacts[hidden] { display:none; }
  .contacts .hit { display:block; width:100%; text-align:left; border:0; background:transparent; color:var(--ink); font:300 12px/1.4 inherit; padding:6px 0; border-bottom:1px solid var(--line); cursor:pointer; }
  .contacts .hit span { color:var(--mute); display:block; font-size:11px; }
  #gate { position:absolute; inset:0; z-index:20; display:grid; place-items:center; background: hsl(var(--background) / .78); backdrop-filter:blur(18px); }
  #gate[hidden] { display:none; }
  #gate .card { padding:28px 32px; max-width:min(520px, calc(100% - 24px)); text-align:center; }
  #gate p { color:var(--mute); font-size:14px; line-height:1.6; }
  #gate .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:16px; }
  #note { position:absolute; left:16px; bottom:110px; z-index:8; padding:10px 14px; font-size:12px; color:var(--mute); max-width:min(320px, calc(100% - 24px)); pointer-events:none; }
  #detect { position:absolute; inset:0; z-index:5; pointer-events:none; }
  @container eye (max-width: 780px) {
    .misb { top:8px; left:8px; right:clamp(8px, 4cqi, 16px); max-width:none; }
    .sheet { right:8px; left:8px; top:auto; bottom:calc(72px + env(safe-area-inset-bottom,0px)); width:auto; height:38%; }
    .contacts { left:8px; top:96px; width:auto; right:8px; bottom:auto; height:28%; }
    .talk { bottom:10px; }
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

async function eyeFeed(feed, params = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error("sign in to load live layers");
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const r = await fetch(`${base}/functions/v1/asherin-eye-feed`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: key,
    },
    body: JSON.stringify({ feed, params }),
  });
  const j = await r.json();
  if (j.error && !Array.isArray(j.rows)) throw new Error(j.error);
  return j;
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
  return new Cesium.PostProcessStage({
    fragmentShader: src,
    uniforms: { time },
  });
}

function kmBetween(Cesium, a, b) {
  return Cesium.Cartesian3.distance(a, b) / 1000;
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
    const layerOn = {};
    LAYER_ROWS.forEach((l) => (layerOn[l.id] = false));
    const ds = {};
    const status = { photoreal: "pending", voice: "off", style: "normal", map: "osm" };

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
          <h2>layers</h2>
          <div id="layer-btns"></div>
          <h2 style="margin-top:14px">look</h2>
          <div id="style-btns"></div>
          <h2 style="margin-top:14px">first look</h2>
          <div class="grid" id="mission-grid"></div>
          <div class="row"><span class="k">photoreal 3d</span><span id="pr-status">…</span></div>
          <div class="row"><span class="k">cables</span><span>omitted · non-commercial license</span></div>
          <div class="row"><span class="k">3d hangar</span><span>not mit · primitives used</span></div>
        </div>
        <div class="glass contacts" id="contacts" hidden>
          <h2 style="margin:0 0 8px;font:400 13px/1.2 inherit;color:var(--mute)">contacts · 250 km</h2>
          <div id="contact-list"></div>
        </div>
        <div class="glass note" id="note"></div>
        <div class="glass talk">
          <button type="button" id="btn-cockpit">cockpit</button>
          <button type="button" class="ghost" id="btn-contacts">contacts</button>
          <button type="button" class="ghost" id="btn-detect">detect</button>
          <button type="button" class="ghost" id="btn-voice">voice</button>
          <button type="button" class="ghost" id="btn-share">share</button>
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
      $("#hud-honesty").textContent = tracked
        ? `tracking ${tracked.label || "contact"}`
        : "click a contact to track. esc releases in place.";
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
      const h = new URLSearchParams(location.hash.replace(/^#/, "").replace(/&/g, "&"));
      // hash is k=v&k=v — URLSearchParams on that works if we use substring
      const raw = location.hash.replace(/^#/, "");
      const p = Object.fromEntries(
        raw
          .split("&")
          .filter(Boolean)
          .map((x) => x.split("=")),
      );
      return p;
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
    }

    async function enableLayer(id, on) {
      layerOn[id] = on;
      root.querySelectorAll("#layer-btns .tog").forEach((b) => {
        if (b.dataset.layer === id) b.classList.toggle("on", on);
      });
      if (!on) {
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

    function plotRows(id, rows, note) {
      const C = window.Cesium;
      const src = dsFor(id);
      src.entities.removeAll();
      const color = LAYER_COLOR[id] || "#94a3b8";
      (rows || []).forEach((row, i) => {
        if (row.lat == null || row.lon == null) return;
        let alt = Number(row.alt || 0);
        if ((id === "flights" || id === "military") && alt > 20000) alt = alt * 0.3048;
        if (id === "quakes" || id === "launches" || id === "cameras" || id === "radio") alt = 0;
        const mag = Number(row.mag || 0);
        const ent = {
          id: `${id}:${row.id || i}`,
          name: row.label || id,
          position: C.Cartesian3.fromDegrees(row.lon, row.lat, alt),
          asherin: { kind: id, label: row.label || id, lat: row.lat, lon: row.lon, url: row.url, image: row.image },
        };
        if (id === "quakes") {
          ent.ellipse = {
            semiMajorAxis: 4000 + mag * 9000,
            semiMinorAxis: 4000 + mag * 9000,
            material: C.Color.fromCssColorString(color).withAlpha(0.55),
            height: 0,
          };
        } else if (id === "flights") {
          ent.billboard = {
            image: planePng(),
            width: 18,
            height: 18,
            rotation: C.Math.toRadians(-(row.heading || 0)),
            alignedAxis: C.Cartesian3.UNIT_Z,
            color: C.Color.fromCssColorString("#fbbf24"),
          };
        } else {
          ent.point = { pixelSize: id === "stations" ? 8 : 7, color: C.Color.fromCssColorString(color) };
        }
        src.entities.add(ent);
      });
      if (note) setNote(note);
    }

    async function loadLayer(id) {
      if (id === "ships" || id === "fires" || id === "traffic") {
        const row = LAYER_ROWS.find((x) => x.id === id);
        throw new Error(row.honesty);
      }
      if (id === "spaceweather") {
        const j = await eyeFeed("spaceweather");
        const kp = j.rows?.[0]?.kp;
        const at = j.rows?.[0]?.at || "";
        setNote(`planetary k-index ${kp} · ${at} · ${j.source || "noaa"}`);
        return;
      }
      const feed = id === "cameras" ? "cameras" : id;
      const cam = viewer?.camera?.positionCartographic;
      const params = {};
      if (cam && window.Cesium) {
        params.lat = window.Cesium.Math.toDegrees(cam.latitude);
        params.lon = window.Cesium.Math.toDegrees(cam.longitude);
      }
      const j = await eyeFeed(feed, params);
      const note = [j.note, j.fresh === false ? `stale ${Math.round((j.ageMs || 0) / 1000)}s` : ""]
        .filter(Boolean)
        .join(" · ");
      plotRows(id, j.rows, note);
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
      viewer.trackedEntity = ent;
      if (trail) viewer.entities.remove(trail);
      const C = window.Cesium;
      trail = viewer.entities.add({
        polyline: {
          positions: new C.CallbackProperty(() => {
            if (!ent.position) return [];
            const p = ent.position.getValue(viewer.clock.currentTime);
            const cam = viewer.camera.positionWC;
            return p ? [p, cam] : [];
          }, false),
          width: 1.5,
          material: C.Color.fromCssColorString("#fbbf24").withAlpha(0.45),
        },
      });
      setHud();
    }

    function releaseTrack() {
      tracked = null;
      viewer.trackedEntity = undefined;
      if (trail) {
        viewer.entities.remove(trail);
        trail = null;
      }
      setHud();
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
      cv.width = root.clientWidth;
      cv.height = root.clientHeight;
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
      viewer.clock.shouldAnimate = true;

      try {
        if (keys.google) {
          const tiles = await CesiumG.createGooglePhotorealistic3DTileset();
          viewer.scene.primitives.add(tiles);
          status.photoreal = "google 3d tiles · bound";
          status.map = "photoreal";
        } else {
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(
            new CesiumG.UrlTemplateImageryProvider({
              url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              credit: "© openstreetmap",
            }),
          );
          status.photoreal = "unavailable until a maps key is bound in connect";
          status.map = "osm";
        }
      } catch (e) {
        status.photoreal = "photoreal failed · osm globe";
        status.map = "osm";
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
        if (ent && ent.asherin) trackEntity(ent);
        else releaseTrack();
      }, CesiumG.ScreenSpaceEventType.LEFT_CLICK);

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
        viewer.trackedEntity = viewer.entities.getById(tracked.id) || viewer.trackedEntity;
        setNote("cockpit · camera follows. esc releases in place.");
      };
      $("#btn-contacts").onclick = () => {
        const el = $("#contacts");
        el.hidden = !el.hidden;
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
      $("#btn-reset").onclick = () => {
        releaseTrack();
        viewer.camera.flyTo({ destination: CesiumG.Cartesian3.fromDegrees(-40, 20, 1.8e7), duration: 2 });
      };
      $("#btn-voice").onclick = startVoice;

      const grid = $("#mission-grid");
      MISSIONS.forEach((m) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = m.title;
        b.style.cssText =
          "border-radius:12px;padding:12px;border:1px solid var(--line);background:hsl(var(--card)/.5);color:var(--ink);cursor:pointer;text-transform:lowercase";
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
          drawDetect(detectOn);
        }, 800),
      );
      pollers.push(
        setInterval(() => {
          if (layerOn.flights) loadLayer("flights").catch(() => {});
          if (layerOn.military) loadLayer("military").catch(() => {});
        }, 28000),
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
        STYLES.forEach((s) => {
          if (t.includes(s)) applyStyle(s);
        });
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
        viewer?.destroy();
      } catch {}
      root.innerHTML = "";
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0 min-h-0 min-w-0" />;
};

export default AsherinEyeView;
