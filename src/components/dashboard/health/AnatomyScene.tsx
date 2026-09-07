import { useEffect, useRef } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createExplosionLayout } from "@/lib/health/explosionLayout";
import { PointerTap } from "@/lib/health/pointerTap";
import { decodeModelResponse, SYSTEMS, type Atlas, type SceneState } from "@/lib/health/atlas";
import { SHAPE_BANDS, shapeKey, type BodyShape } from "@/lib/health/bodyShape";

interface Props {
  atlas: Atlas;
  state: SceneState;
  /** the person's own proportions, applied to the reference mesh. */
  shape?: BodyShape | null;
  onSelect: (id: string) => void;
  onProgress: (n: number) => void;
  onError: (s: string) => void;
}

/**
 * one draw call per system, per-part state carried in a data texture. part offsets, visibility
 * and intelligence paint are all written into that texture rather than into the scene graph,
 * so 2,000+ structures stay interactive on a laptop.
 */
export default function AnatomyScene({ atlas, state, shape, onSelect, onProgress, onError }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  const select = useRef(onSelect);
  // progress/error are reported through refs. the parent re-renders on every
  // percent tick, and if the effect depended on those callbacks the whole
  // renderer would be torn down and the atlas re-fetched mid-load — that was
  // the body flickering in and out and never finishing.
  const progressRef = useRef(onProgress);
  const errorRef = useRef(onError);
  // the shape rides a ref for the same reason: measurements change while the
  // atlas is on screen, and re-mounting the renderer to apply a waist reading
  // would be a full reload of the body.
  const shapeRef = useRef<BodyShape | null | undefined>(shape);
  latest.current = state;
  select.current = onSelect;
  progressRef.current = onProgress;
  errorRef.current = onError;
  shapeRef.current = shape;



  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let frame = 0;
    let dirty = true;
    let ready = false;
    let lastView = "";
    let lastReset = -1;
    let lastIsolate = "";
    let layoutKey = "";
    let amount = 0;
    let lastState: SceneState | null = null;
    let lastHighlights: SceneState["highlights"] | null = null;
    const abort = new AbortController();

    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      errorRef.current("this browser could not start the 3d view. try a browser with webgl enabled.");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "interactive human anatomy. drag to orbit, scroll or pinch to zoom, tap a structure to open it.",
    );

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.005, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(1.4, 1.05, 3.6);
    controls.target.set(0, 0.85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 0.07;
    controls.maxDistance = 40;
    // full freedom: orbit through any direction, pan in screen space, and dolly
    // toward whatever the pointer is over rather than the scene centre.
    controls.maxPolarAngle = Math.PI;
    controls.minPolarAngle = 0;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.panSpeed = 0.9;
    controls.zoomSpeed = 0.9;
    controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN };
    controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
    controls.addEventListener("change", () => {
      dirty = true;
    });


    const pmrem = new T.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();

    scene.add(new T.HemisphereLight(0xdfe6ef, 0x14161a, 0.85));
    const key = new T.DirectionalLight(0xfff4e2, 2.1);
    key.position.set(-2, 4, 3);
    scene.add(key);
    const rim = new T.DirectionalLight(0x9fc4ff, 1.5);
    rim.position.set(2, 2, -3);
    scene.add(rim);

    // no stage, no rings: the body floats in the room's own darkness.



    const width = T.MathUtils.ceilPowerOfTwo(Math.max(2, atlas.parts.length));
    const data = new Float32Array(width * 4);
    const partTexture = new T.DataTexture(data, width, 1, T.RGBAFormat, T.FloatType);
    partTexture.needsUpdate = true;
    const selectedData = new Uint8Array(width * 4);
    const selectionTexture = new T.DataTexture(selectedData, width, 1);
    selectionTexture.needsUpdate = true;
    const paintData = new Float32Array(width * 4);
    const paintTexture = new T.DataTexture(paintData, width, 1, T.RGBAFormat, T.FloatType);
    paintTexture.needsUpdate = true;
    // per-part affine for the person's own proportions: xyz scale in one row,
    // the matching shift in another. carrying it per part (rather than per
    // vertex) keeps picking, explode offsets and the drawn body in exact
    // agreement — the ray hits what the eye sees.
    const shapeScaleData = new Float32Array(width * 4).fill(1);
    const shapeScaleTexture = new T.DataTexture(shapeScaleData, width, 1, T.RGBAFormat, T.FloatType);
    shapeScaleTexture.needsUpdate = true;
    const shapeShiftData = new Float32Array(width * 4);
    const shapeShiftTexture = new T.DataTexture(shapeShiftData, width, 1, T.RGBAFormat, T.FloatType);
    shapeShiftTexture.needsUpdate = true;

    const materials: T.Material[] = [];
    const geometries: T.BufferGeometry[] = [];
    const pickers: (T.Mesh | undefined)[] = [];
    const baseCenters = atlas.parts.map((p) =>
      new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(0.5),
    );
    const centers = baseCenters.map((c) => c.clone());
    const offsets: T.Vector3[] = [];
    const baseBounds = atlas.parts.map(
      (p) => new T.Box3(new T.Vector3().fromArray(p.bounds[0]), new T.Vector3().fromArray(p.bounds[1])),
    );
    const bounds = baseBounds.map((b) => b.clone());
    // the whole body's vertical extent: bands are read as a fraction of it.
    const bodyBox = new T.Box3();
    baseBounds.forEach((b) => bodyBox.union(b));
    const bodyMinY = bodyBox.min.y;
    const bodyHeight = Math.max(0.001, bodyBox.max.y - bodyBox.min.y);

    /** girth multiplier at a height, interpolated between the shape bands. */
    const bandScaleAt = (scales: number[], y: number) => {
      const n = (y - bodyMinY) / bodyHeight;
      if (n <= SHAPE_BANDS[0].y) return scales[0];
      for (let i = 1; i < SHAPE_BANDS.length; i++) {
        if (n <= SHAPE_BANDS[i].y) {
          const a = SHAPE_BANDS[i - 1];
          const b = SHAPE_BANDS[i];
          const t = (n - a.y) / Math.max(1e-6, b.y - a.y);
          return scales[i - 1] + (scales[i] - scales[i - 1]) * t;
        }
      }
      return scales[SHAPE_BANDS.length - 1];
    };

    const scratch = new T.Vector3();
    let appliedShapeKey = "";
    /**
     * rewrite the per-part affine, the picking bounds and the projected centres
     * from the current shape. cheap: one pass over parts, not over vertices.
     */
    const applyShape = (s: BodyShape | null | undefined) => {
      const heightScale = s && Number.isFinite(s.heightScale) ? s.heightScale : 1;
      const scales = s?.scales?.length === SHAPE_BANDS.length ? s.scales : SHAPE_BANDS.map(() => 1);
      atlas.parts.forEach((_, i) => {
        const c = baseCenters[i];
        const girth = bandScaleAt(scales, c.y);
        const sy = heightScale;
        const cx = c.x * girth;
        const cy = bodyMinY + (c.y - bodyMinY) * sy;
        const cz = c.z * girth;
        // scale the part about the origin, then shift it so its own centre
        // lands where the deformed body wants it.
        const shift = scratch.set(cx - c.x * girth, cy - c.y * sy, cz - c.z * girth);
        shapeScaleData.set([girth, sy, girth, 1], i * 4);
        shapeShiftData.set([shift.x, shift.y, shift.z, 0], i * 4);
        centers[i].set(cx, cy, cz);
        bounds[i].min.set(baseBounds[i].min.x * girth + shift.x, bodyMinY + (baseBounds[i].min.y - bodyMinY) * sy, baseBounds[i].min.z * girth + shift.z);
        bounds[i].max.set(baseBounds[i].max.x * girth + shift.x, bodyMinY + (baseBounds[i].max.y - bodyMinY) * sy, baseBounds[i].max.z * girth + shift.z);
        const mesh = pickers[i];
        if (mesh) mesh.scale.set(girth, sy, girth);
      });
      shapeScaleTexture.needsUpdate = true;
      shapeShiftTexture.needsUpdate = true;
      appliedShapeKey = s ? shapeKey(s) : "";
      // part placement, the explode layout and the camera fit are all derived
      // from centres that just moved, so force them to be recomputed.
      layoutKey = "";
      lastState = null;
      lastExtent = -1;
      dirty = true;
    };

    let packingWidth = 1;
    let packingHeight = 1;

    const markerPositions = new Float32Array(atlas.parts.length * 3);
    const markerGeometry = new T.BufferGeometry();
    markerGeometry.setAttribute("position", new T.BufferAttribute(markerPositions, 3));
    const markerMaterial = new T.PointsMaterial({
      color: 0x9aa3ae,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
    });
    markerMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;",
      );
    };
    const markers = new T.Points(markerGeometry, markerMaterial);
    markers.frustumCulled = false;
    markers.renderOrder = 10;
    markers.visible = false;
    scene.add(markers);

    const hover = document.createElement("div");
    hover.className = "health-part-hover";
    hover.setAttribute("role", "tooltip");
    hover.hidden = true;
    el.appendChild(hover);

    type Target = { index: number; x: number; y: number; left: number; right: number; top: number; bottom: number };
    let targets: Target[] = [];
    const projected = new T.Vector3();
    const findTarget = (x: number, y: number, radius: number) => {
      let best = -1;
      let score = Infinity;
      for (const t of targets) {
        const dx = Math.max(t.left - x, 0, x - t.right);
        const dy = Math.max(t.top - y, 0, y - t.bottom);
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const candidate = distance + Math.hypot(t.x - x, t.y - y) * 0.025;
        if (candidate < score) {
          score = candidate;
          best = t.index;
        }
      }
      return best;
    };

    const materialFor = (system: string) => {
      const m = new T.MeshStandardMaterial({
        color: SYSTEMS.find((s) => s.id === system)?.color ?? "#aebbb8",
        metalness: 0.08,
        roughness: 0.55,
        side: T.DoubleSide,
        transparent: system === "integumentary",
        opacity: system === "integumentary" ? 0.09 : 1,
        depthWrite: system !== "integumentary",
      });
      m.onBeforeCompile = (shader) => {
        shader.uniforms.partState = { value: partTexture };
        shader.uniforms.selectionState = { value: selectionTexture };
        shader.uniforms.paintState = { value: paintTexture };
        shader.uniforms.shapeScaleState = { value: shapeScaleTexture };
        shader.uniforms.shapeShiftState = { value: shapeShiftTexture };
        shader.uniforms.stateWidth = { value: width };
        shader.vertexShader =
          "attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform sampler2D paintState; uniform sampler2D shapeScaleState; uniform sampler2D shapeShiftState; uniform float stateWidth; varying float partVisible; varying float partSelected; varying vec4 partPaint;\n" +
          shader.vertexShader;
        // lighting has to follow the new proportions. the normal is corrected at
        // beginnormal_vertex because three builds its transformed normal before
        // begin_vertex runs — correcting it later would light the old body.
        shader.vertexShader = shader.vertexShader.replace(
          "#include <beginnormal_vertex>",
          "#include <beginnormal_vertex>\nvec3 shapeN = texture2D(shapeScaleState, vec2((partIndex + 0.5) / stateWidth, 0.5)).xyz; objectNormal = normalize(objectNormal / max(shapeN, vec3(0.001)));",
        );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); vec3 shapeScale = texture2D(shapeScaleState, stateUv).xyz; vec3 shapeShift = texture2D(shapeShiftState, stateUv).xyz; transformed = transformed * shapeScale + shapeShift; transformed += state.xyz; partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r; partPaint = texture2D(paintState, stateUv);",
        );
        shader.fragmentShader =
          "varying float partVisible; varying float partSelected; varying vec4 partPaint;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, partPaint.rgb, partPaint.a);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.66, 0.42), partSelected * 0.7);",
        );
      };
      materials.push(m);
      return m;
    };
    const mats = new Map(SYSTEMS.map((s) => [s.id, materialFor(s.id)]));

    let loaded = 0;
    let failed = 0;
    const fetchChunk = async (ci: number) => {
      const chunk = atlas.chunks[ci];
      const compressed = !!chunk.gzip && typeof DecompressionStream !== "undefined";
      // three attempts: a single dropped chunk used to reject the whole load and
      // leave a half-built body on screen with no way back.
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(compressed ? chunk.gzip! : chunk.url, { signal: abort.signal, cache: "force-cache" });
          if (!response.ok) throw new Error(`chunk ${ci} responded ${response.status}`);
          return await decodeModelResponse(response, chunk.bytes, compressed);
        } catch (e) {
          if (abort.signal.aborted || disposed) throw e;
          lastErr = e;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(`chunk ${ci} could not be read`);
    };

    const loadChunk = async (ci: number) => {
      const buffer = await fetchChunk(ci);
      if (disposed) return;
      const groups = new Map<string, T.BufferGeometry[]>();
      atlas.parts.forEach((p, i) => {
        if (p.chunk !== ci) return;
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3));
        // normals are gpu-normalised signed shorts: the whole atlas stays compact in memory.
        g.setAttribute("normal", new T.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true));
        g.setIndex(new T.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
        g.boundingBox = bounds[i].clone();
        g.computeBoundingSphere();
        const pick = new T.Mesh(g);
        // a part that arrives after a measurement was typed must be born with
        // the same proportions as everything already on screen.
        pick.scale.set(shapeScaleData[i * 4], shapeScaleData[i * 4 + 1], shapeScaleData[i * 4 + 2]);
        pick.matrixAutoUpdate = false;
        pickers[i] = pick;
        geometries.push(g);
        g.setAttribute("partIndex", new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1));
        const list = groups.get(p.system) ?? [];
        list.push(g);
        groups.set(p.system, list);
      });
      groups.forEach((gs, system) => {
        const geometry = mergeGeometries(gs, false);
        if (!geometry) throw new Error("the anatomy geometry could not be assembled.");
        geometries.push(geometry);
        const mesh = new T.Mesh(geometry, mats.get(system as never));
        mesh.frustumCulled = false;
        scene.add(mesh);
      });
      lastState = null;
      dirty = true;
    };

    void (async () => {
      let cursor = 0;
      const worker = async () => {
        while (cursor < atlas.chunks.length && !disposed) {
          const i = cursor++;
          try {
            await loadChunk(i);
            loaded++;
          } catch (e) {
            if (disposed || abort.signal.aborted) return;
            failed++;
            console.warn("[health] anatomy chunk failed", i, e);
          }
          progressRef.current(Math.round(((loaded + failed) / atlas.chunks.length) * 100));
        }
      };
      await Promise.all(Array.from({ length: 3 }, worker));
      if (disposed || abort.signal.aborted) return;
      ready = true;
      dirty = true;
      if (failed > 0) {
        errorRef.current(
          loaded === 0
            ? "the anatomy could not be loaded. check your connection and reload the room."
            : `${failed} of ${atlas.chunks.length} sections of the body did not download. what loaded is shown; reload the room to try the rest.`,
        );
      }
    })();


    const fit = (view: string, extent = 0) => {
      const mobile = el.clientWidth < 768;
      const normalDistance = mobile
        ? Math.max(4.2, (1.8 * el.clientHeight) / Math.max(160, el.clientHeight - 320) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))))
        : 3.6;
      const reservedHeight = mobile ? 320 : 200;
      const availableAspect = Math.max(0.35, (el.clientWidth - (mobile ? 40 : 200)) / Math.max(160, el.clientHeight - reservedHeight));
      const atlasDistance =
        (Math.max(packingHeight, packingWidth / availableAspect) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) *
        (el.clientHeight / Math.max(160, el.clientHeight - reservedHeight)) *
        1.08;
      const distance = T.MathUtils.lerp(normalDistance, Math.max(0.2, atlasDistance), extent);
      const resolved = extent > 0.8 ? "front" : view;
      const direction =
        resolved === "front"
          ? new T.Vector3(0, 0.02, 1)
          : resolved === "back"
            ? new T.Vector3(0, 0.02, -1)
            : resolved === "side"
              ? new T.Vector3(1, 0.02, 0)
              : new T.Vector3(0.35, 0.06, 1).normalize();
      controls.target.set(0, extent > 0.1 || mobile ? 0.85 : 0.7, 0);
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      controls.update();
      dirty = true;
    };

    // a resize must never feel like a refresh. scrollbars opening, the mobile
    // url bar collapsing, or a side panel ticking by a pixel all fire this
    // observer — and refitting the camera on every one of those snapped the
    // body back to its default pose mid-orbit, which read as the model
    // "refreshing" over and over. only a genuine size-class change (panel
    // opened, device rotated) earns a refit; everything else keeps the
    // person's exact camera and just updates the drawing surface.
    let lastW = 0;
    let lastH = 0;
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
      const firstRun = lastW === 0 && lastH === 0;
      const sizeClassChange = Math.abs(w - lastW) > 64 || Math.abs(h - lastH) > 96;
      lastW = w;
      lastH = h;
      renderer.setPixelRatio(Math.min(devicePixelRatio, w < 768 || h < 600 ? 1.5 : 2));
      camera.aspect = Math.max(0.2, w / Math.max(1, h));
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (firstRun || sizeClassChange) {
        layoutKey = "";
        lastState = null;
        fit(latest.current.view, amount);
      } else {
        dirty = true;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    const tap = new PointerTap();
    const worldBox = new T.Box3();
    const hitPoint = new T.Vector3();
    const down = (e: PointerEvent) => {
      hover.hidden = true;
      tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === "touch" ? 12 : 5);
    };
    const move = (e: PointerEvent) => {
      tap.move(e.pointerId, e.clientX, e.clientY);
      if (e.buttons || amount < 0.5 || e.pointerType === "touch") {
        hover.hidden = true;
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const index = findTarget(x, y, 12);
      hover.hidden = index < 0;
      renderer.domElement.style.cursor = index < 0 ? "grab" : "pointer";
      if (index >= 0) {
        hover.textContent = atlas.parts[index].name;
        hover.style.left = `${Math.max(8, Math.min(x + 14, el.clientWidth - 260))}px`;
        hover.style.top = `${Math.max(8, Math.min(y + 18, el.clientHeight - 55))}px`;
      }
    };
    const cancel = (e: PointerEvent) => tap.cancel(e.pointerId);
    const up = (e: PointerEvent) => {
      const validTap = tap.up(e.pointerId, e.clientX, e.clientY);
      if (!validTap || !ready) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      let nearest = Infinity;
      let found = -1;
      const hasSolid = atlas.parts.some((p, i) => p.system !== "integumentary" && data[i * 4 + 3] > 0.5);
      pickers.forEach((mesh, i) => {
        if (!mesh || data[i * 4 + 3] < 0.5 || (hasSolid && atlas.parts[i].system === "integumentary")) return;
        worldBox.copy(bounds[i]).translate(mesh.position);
        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
        const hits = raycaster.intersectObject(mesh, false);
        if (hits[0] && hits[0].distance < nearest) {
          nearest = hits[0].distance;
          found = i;
        }
      });
      if (found < 0 && amount > 0.45) found = findTarget(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === "touch" ? 24 : 16);
      if (found >= 0) {
        hover.hidden = true;
        select.current(atlas.parts[found].id);
      }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", cancel);

    const paintColor = new T.Color();
    const applyPaint = (highlights: SceneState["highlights"]) => {
      paintData.fill(0);
      const index = new Map(atlas.parts.map((p, i) => [p.id, i]));
      for (const h of highlights) {
        paintColor.set(h.color).convertSRGBToLinear();
        for (const id of h.partIds) {
          const i = index.get(id);
          if (i === undefined) continue;
          const alpha = Math.max(paintData[i * 4 + 3], Math.min(1, h.intensity) * 0.85);
          paintData[i * 4] = paintColor.r;
          paintData[i * 4 + 1] = paintColor.g;
          paintData[i * 4 + 2] = paintColor.b;
          paintData[i * 4 + 3] = alpha;
        }
      }
      paintTexture.needsUpdate = true;
      dirty = true;
    };

    const clock = new T.Clock();
    let lastExtent = -1;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const s = latest.current;
      if (s.highlights !== lastHighlights) {
        applyPaint(s.highlights);
        lastHighlights = s.highlights;
      }
      const changed = lastState?.visible !== s.visible || lastState?.selected !== s.selected || lastState?.isolate !== s.isolate;
      const moving = Math.abs(amount - s.explode) > 0.0001;
      if (moving) {
        amount = T.MathUtils.damp(amount, s.explode, 8, dt);
        dirty = true;
      }
      if (changed || moving || lastExtent < 0) {
        const visible = new Set(s.visible);
        const selection = new Set(s.selected);
        const visibleParts = atlas.parts.filter((p) => (s.isolate ? selection.has(p.id) : visible.has(p.system) || selection.has(p.id)));
        const nextLayoutKey = visibleParts.map((p) => p.id).join(",") + ":" + camera.aspect.toFixed(3);
        if (nextLayoutKey !== layoutKey) {
          const layout = createExplosionLayout(visibleParts, camera.aspect);
          packingWidth = layout.width;
          packingHeight = layout.height;
          atlas.parts.forEach((p, i) => {
            const cell = layout.cells.get(p.id);
            offsets[i] = cell ? new T.Vector3(cell.x, cell.y + 0.85, 0) : centers[i].clone();
          });
          layoutKey = nextLayoutKey;
          if (amount > 0.05 && !s.isolate) fit(s.view, Math.max(0, (amount - 0.3) / 0.7));
        }
        atlas.parts.forEach((p, i) => {
          const c = centers[i];
          const destination = offsets[i];
          const group = SYSTEMS.findIndex((sys) => sys.id === p.system);
          const angle = (group / SYSTEMS.length) * Math.PI * 2;
          let dx = 0;
          let dy = 0;
          let dz = 0;
          if (amount <= 0.45) {
            const t = amount / 0.45;
            dx = Math.sin(angle) * t * 0.48;
            dy = (c.y - 0.85) * t * 0.28;
            dz = Math.cos(angle) * t * 0.48;
          } else {
            const t = (amount - 0.45) / 0.55;
            dx = T.MathUtils.lerp(Math.sin(angle) * 0.48, destination.x - c.x, t);
            dy = T.MathUtils.lerp((c.y - 0.85) * 0.28, destination.y - c.y, t);
            dz = T.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t);
          }
          const selected = selection.has(p.id);
          data.set([dx, dy, dz, (s.isolate ? selected : visible.has(p.system) || selected) ? 1 : 0], i * 4);
          selectedData[i * 4] = selected ? 255 : 0;
          markerPositions.set(data[i * 4 + 3] > 0.5 ? [c.x + dx, c.y + dy, c.z + dz] : [10000, 10000, 10000], i * 3);
          const mesh = pickers[i];
          if (mesh) {
            mesh.position.set(dx, dy, dz);
            mesh.updateMatrix();
            mesh.updateMatrixWorld(true);
          }
        });
        partTexture.needsUpdate = true;
        selectionTexture.needsUpdate = true;
        markerGeometry.attributes.position.needsUpdate = true;
        lastState = s;
        lastExtent = amount;
        dirty = true;
      }
      if (s.view !== lastView || s.reset !== lastReset) {
        fit(s.view, amount);
        lastView = s.view;
        lastReset = s.reset;
      }
      if (moving && !s.isolate) fit(amount > 0.5 ? "front" : s.view, Math.max(0, (amount - 0.3) / 0.7));

      const isolateKey = s.isolate ? s.selected.join(",") + ":" + s.reset + ":" + camera.aspect.toFixed(3) : "";
      if (isolateKey !== lastIsolate || (s.isolate && moving)) {
        if (s.isolate) {
          const box = new T.Box3();
          atlas.parts.forEach((p, i) => {
            if (s.selected.includes(p.id)) box.union(bounds[i].clone().translate(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])));
          });
          if (!box.isEmpty()) {
            const center = box.getCenter(new T.Vector3());
            const size = box.getSize(new T.Vector3());
            const distance =
              (Math.max(size.y, size.x / camera.aspect, size.z) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) * 1.45;
            controls.maxDistance = Math.max(40, distance * 2);
            controls.target.copy(center);
            camera.position.copy(center).add(new T.Vector3(0.2, 0.1, 1).normalize().multiplyScalar(Math.max(0.07, distance)));
            controls.update();
            dirty = true;
          }
        } else if (lastIsolate) {
          camera.clearViewOffset();
          fit(s.view, amount);
        }
        lastIsolate = isolateKey;
      }

      // rotation stays available at every explosion extent; the flat layout is
      // still reachable because right-drag pans and the wheel dollies to cursor.
      controls.enableRotate = true;
      controls.mouseButtons.LEFT = T.MOUSE.ROTATE;
      controls.touches.ONE = T.TOUCH.ROTATE;

      markers.visible = amount > 0.75;
      controls.autoRotate = s.rotate && !s.isolate && amount < 0.4;
      controls.autoRotateSpeed = 0.6;
      controls.update();
      if (controls.autoRotate) dirty = true;

      if (dirty) {
        renderer.render(scene, camera);
        targets = [];
        if (amount > 0.45) {
          const hasSolid = atlas.parts.some((p, i) => p.system !== "integumentary" && data[i * 4 + 3] > 0.5);
          atlas.parts.forEach((p, i) => {
            if (data[i * 4 + 3] < 0.5 || (hasSolid && p.system === "integumentary")) return;
            let left = Infinity;
            let right = -Infinity;
            let top = Infinity;
            let bottom = -Infinity;
            for (let corner = 0; corner < 8; corner++) {
              projected
                .set(
                  p.bounds[corner & 1 ? 1 : 0][0] + data[i * 4],
                  p.bounds[corner & 2 ? 1 : 0][1] + data[i * 4 + 1],
                  p.bounds[corner & 4 ? 1 : 0][2] + data[i * 4 + 2],
                )
                .project(camera);
              const x = ((projected.x + 1) * el.clientWidth) / 2;
              const y = ((1 - projected.y) * el.clientHeight) / 2;
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
            projected.copy(centers[i]).add(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])).project(camera);
            if (projected.z < -1 || projected.z > 1) return;
            targets.push({
              index: i,
              x: ((projected.x + 1) * el.clientWidth) / 2,
              y: ((1 - projected.y) * el.clientHeight) / 2,
              left,
              right,
              top,
              bottom,
            });
          });
        }
        dirty = false;
      }
    };
    animate();

    const contextLost = (e: Event) => {
      e.preventDefault();
      errorRef.current("the 3d session was paused by your device. reload the room to continue.");
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      scene.traverse((o) => {
        if (o instanceof T.Mesh && !geometries.includes(o.geometry)) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose());
        }
      });
      env.dispose();
      partTexture.dispose();
      selectionTexture.dispose();
      paintTexture.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      hover.remove();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [atlas]);

  return <div className="health-scene absolute inset-0" ref={host} />;
}
