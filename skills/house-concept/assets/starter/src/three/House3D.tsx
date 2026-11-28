import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { BBOX, FLOOR, FLOORS_TOTAL, HOUSE, MODEL, PLOT, SITE } from "../model";
import { HouseLayers, buildHouse, floorAt, navBlocks, navBlocksRoof, places } from "./buildHouse";

type Vec = [number, number, number];
interface Preset { name: string; pos: Vec; target: Vec; roof?: boolean; hint: string }
const CX = (BBOX.x0 + BBOX.x1) / 2, CY = (BBOX.y0 + BBOX.y1) / 2;
const C: Vec = [CX, 2, -CY];
const SPAN = Math.max(BBOX.x1 - BBOX.x0, BBOX.y1 - BBOX.y0);
// three coords: X = east, Y = up, Z = −north. Unit vectors (plan x, y) toward each side.
const OUT: Record<string, [number, number]> = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
const from = (side: string, dist: number, h: number, skew = 0.6): Vec => {
  const [ox, oy] = OUT[side];
  const [sx, sy] = [-oy, ox]; // a little to the right of straight-on
  return [CX + (ox + sx * skew) * dist, h, -(CY + (oy + sy * skew) * dist)];
};
const ROAD = SITE.road.side;
const BACK = ({ N: "S", S: "N", E: "W", W: "E" } as const)[ROAD];
export const PRESETS: Preset[] = [
  { name: "Front", pos: from(ROAD, SPAN * 1.3, SPAN * 0.55, -0.75), target: C, hint: "From the road side" },
  { name: "Front (other corner)", pos: from(ROAD, SPAN * 1.3, SPAN * 0.55, 0.75), target: C, hint: "From the road side, the other corner" },
  { name: "Aerial", pos: from(BACK, SPAN * 0.6, SPAN * 2.6, 0.3), target: C, hint: "Whole plot, house and terrace" },
  { name: "Rear", pos: from(BACK, SPAN * 1.2, SPAN * 0.35, -0.5), target: C, hint: "The back of the house" },
  { name: "Terrace", pos: [BBOX.x0 + 2, FLOOR + 8, -(BBOX.y0 + 2)], target: [BBOX.x1, FLOOR + 2, -BBOX.y1], hint: "The roof terrace" },
  { name: "Plan (roof off)", pos: [CX, SPAN * 3.2, -CY + 0.01], target: [CX, 0, -CY], roof: false, hint: "Top view with the roof removed" },
];

export interface Toggles { roof: boolean; furniture: boolean; ghost: boolean; labels: boolean; shadows: boolean; noclip: boolean; phase2: boolean }
type Mode = "orbit" | "walk";
interface Api {
  goTo: (p: Preset) => void;
  apply: (t: Toggles, sun: number) => void;
  setMode: (m: Mode) => void;
  walkTo: (x: number, y: number, lookX?: number, lookY?: number, level?: number) => void;
  snap: () => void;
  focus: (x: number, y: number) => void;
  hold: (k: string, down: boolean) => void;
}

const EYE = 5.25;
const R = 0.9; // walker radius

export function House3D() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const marker = useRef<SVGGElement>(null);
  const [t, setT] = useState<Toggles>({ roof: true, furniture: true, ghost: false, labels: true, shadows: true, noclip: false, phase2: true });
  const [sun, setSun] = useState(10.5);
  const [active, setActive] = useState(PRESETS[0].name);
  const [mode, setModeState] = useState<Mode>("orbit");
  const [help, setHelp] = useState(true);
  const [tour, setTour] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const spots = useMemo(() => places(), []);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    const css = new CSS2DRenderer();
    css.domElement.className = "css2d";
    el.appendChild(css.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#dce7ef");
    scene.fog = new THREE.Fog("#dce7ef", 280, 560);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.2, 1500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomToCursor = true; // scroll zooms toward what's under the mouse
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 1.5;
    controls.maxDistance = 450;
    controls.keyPanSpeed = 25;
    controls.listenToKeyEvents(window);

    scene.add(new THREE.HemisphereLight("#eef4fb", "#cdbfa6", 1.35), new THREE.AmbientLight("#fff6ea", 0.35));
    const sunLight = new THREE.DirectionalLight("#fff4e0", 2.4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(4096, 4096);
    const sc = sunLight.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 450;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    sunLight.target.position.set(...C);
    scene.add(sunLight, sunLight.target);

    const layers: HouseLayers = buildHouse();
    for (const g of Object.values(layers)) scene.add(g);
    const blocks = [navBlocks(true), navBlocksRoof()];

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      css.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // ---------------- orbit helpers
    let anim: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t0: number } | null = null;
    const animateTo = (pos: THREE.Vector3, target: THREE.Vector3) => {
      anim = { from: [camera.position.clone(), controls.target.clone()], to: [pos, target], t0: performance.now() };
    };
    camera.position.set(...PRESETS[0].pos);
    controls.target.set(...PRESETS[0].target);

    // ---------------- walk state (plan coords)
    const walk = { x: 0, y: 0, yaw: 0, pitch: -0.05, z: EYE, level: 0 };
    const keys = new Set<string>();
    let mode: Mode = "orbit";
    const blocked = (x: number, y: number) => {
      if (tRef.current.noclip) return false;
      for (const b of blocks[walk.level]) {
        const cx = Math.max(b.x0, Math.min(x, b.x1)), cy = Math.max(b.y0, Math.min(y, b.y1));
        if ((x - cx) ** 2 + (y - cy) ** 2 < R * R) return true;
      }
      return false;
    };
    const free = (x: number, y: number) => {
      if (!blocked(x, y)) return [x, y];
      for (let r = 0.5; r < 6; r += 0.5) for (let a = 0; a < 16; a++) {
        const nx = x + r * Math.cos((a / 16) * Math.PI * 2), ny = y + r * Math.sin((a / 16) * Math.PI * 2);
        if (!blocked(nx, ny)) return [nx, ny];
      }
      return [x, y];
    };
    const walkTo = (x: number, y: number, lx?: number, ly?: number, level?: number) => {
      const onRoof = x > BBOX.x0 + 0.5 && x < BBOX.x1 - 0.5 && y > BBOX.y0 + 0.5 && y < BBOX.y1 - 0.5;
      walk.level = level ?? (walk.level === 1 && onRoof ? 1 : 0);
      [walk.x, walk.y] = free(x, y);
      if (lx !== undefined && ly !== undefined) walk.yaw = Math.atan2(ly - walk.y, lx - walk.x);
      walk.pitch = -0.05;
      walk.z = floorAt(walk.x, walk.y, walk.level) + EYE;
      setMode("walk");
    };
    const setMode = (m: Mode) => {
      if (m === mode) return;
      mode = m;
      controls.enabled = m === "orbit";
      if (m === "orbit") {
        const fwd = new THREE.Vector3(Math.cos(walk.yaw), 0, -Math.sin(walk.yaw));
        controls.target.copy(camera.position).add(fwd.multiplyScalar(12));
        controls.target.y = Math.max(0, camera.position.y - 1);
      } else if (walk.x === 0 && walk.y === 0) {
        const first = spots[0];
        walkTo(first.at[0], first.at[1], first.look[0], first.look[1]);
      }
      setModeState(m);
    };
    const focus = (x: number, y: number) => {
      if (mode === "walk") { walkTo(x, y, x + Math.cos(walk.yaw), y + Math.sin(walk.yaw)); return; }
      const tgt = new THREE.Vector3(x, floorAt(x, y) + 2, -y);
      const off = camera.position.clone().sub(controls.target);
      const dist = Math.min(off.length(), 45);
      animateTo(tgt.clone().add(off.normalize().multiplyScalar(dist)), tgt);
    };

    // ---------------- input
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (down && k === "f") { setMode(mode === "walk" ? "orbit" : "walk"); return; }
      if (mode !== "walk") return;
      if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        e.preventDefault();
        if (down) keys.add(k); else keys.delete(k);
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    let drag: { x: number; y: number } | null = null;
    const cv = renderer.domElement;
    const onDown = (e: PointerEvent) => { if (mode === "walk") { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); } };
    const onMove = (e: PointerEvent) => {
      if (mode !== "walk" || !drag) return;
      walk.yaw -= (e.clientX - drag.x) * 0.004;
      walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => { drag = null; };
    const onWheel = (e: WheelEvent) => {
      if (mode !== "walk") return;
      e.preventDefault();
      step(Math.cos(walk.yaw) * -e.deltaY * 0.02, Math.sin(walk.yaw) * -e.deltaY * 0.02);
    };
    const raycaster = new THREE.Raycaster();
    const onDbl = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = raycaster.intersectObjects([layers.site, layers.house, ...(tRef.current.phase2 ? [layers.p2House] : []), ...(tRef.current.roof ? [layers.roof] : [])], true)[0];
      if (!hit) return;
      if (mode === "walk") { walkTo(hit.point.x, -hit.point.z, hit.point.x + Math.cos(walk.yaw), -hit.point.z + Math.sin(walk.yaw)); return; }
      const tgt = hit.point.clone();
      const off = camera.position.clone().sub(controls.target).multiplyScalar(0.55);
      animateTo(tgt.clone().add(off), tgt);
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("dblclick", onDbl);

    const step = (dx: number, dy: number) => {
      const nx = walk.x + dx, ny = walk.y + dy;
      if (!blocked(nx, walk.y)) walk.x = nx;
      if (!blocked(walk.x, ny)) walk.y = ny;
    };

    const apply = (tg: Toggles, hour: number) => {
      layers.roof.visible = tg.roof;
      layers.furniture.visible = tg.furniture;
      layers.ghost.visible = tg.ghost;
      layers.labels.visible = tg.labels && !tg.roof && mode === "orbit";
      layers.p2House.visible = tg.phase2;
      layers.p2Roof.visible = tg.phase2 && tg.roof;
      layers.p2Furniture.visible = tg.phase2 && tg.furniture;
      layers.p1Only.visible = !tg.phase2 && tg.roof;
      // CSS2D labels ignore their parent's visibility, so hide phase 2's labels one by one
      for (const c of layers.p2Labels.children) c.visible = tg.phase2;
      blocks[0] = navBlocks(tg.phase2);
      renderer.shadowMap.enabled = tg.shadows;
      sunLight.castShadow = tg.shadows;
      scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; });
      const f = (hour - 6) / 12;
      const az = (90 + 180 * f) * (Math.PI / 180);
      const el_ = Math.max(4, 68 * Math.sin(Math.PI * f)) * (Math.PI / 180);
      const d = 240;
      sunLight.position.set(C[0] + d * Math.sin(az) * Math.cos(el_), d * Math.sin(el_), C[2] - d * Math.cos(az) * Math.cos(el_));
      sunLight.intensity = 0.6 + 2.0 * Math.sin(Math.PI * Math.min(Math.max(f, 0), 1));
    };
    const hold = (k: string, down: boolean) => { if (down) keys.add(k); else keys.delete(k); };
    const snap = () => {
      renderer.render(scene, camera);
      const a = document.createElement("a");
      a.href = renderer.domElement.toDataURL("image/png");
      a.download = `house-3d-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
      a.click();
    };
    const stopTour = () => window.dispatchEvent(new CustomEvent("house-stop-tour"));
    cv.addEventListener("pointerdown", stopTour);
    api.current = { goTo: (p) => { setMode("orbit"); animateTo(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.target)); }, apply, setMode, walkTo, focus, hold, snap };

    // ---------------- loop
    let raf = 0, last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (mode === "walk") {
        const run = keys.has("shift") ? 2.2 : 1;
        const sp = 9 * run * dt, tr = 1.8 * dt;
        let f = 0, s = 0;
        if (keys.has("w") || keys.has("arrowup")) f += 1;
        if (keys.has("s") || keys.has("arrowdown")) f -= 1;
        if (keys.has("a")) s += 1;
        if (keys.has("d")) s -= 1;
        if (keys.has("arrowleft") || keys.has("q")) walk.yaw += tr;
        if (keys.has("arrowright") || keys.has("e")) walk.yaw -= tr;
        if (f || s) step((Math.cos(walk.yaw) * f - Math.sin(walk.yaw) * s) * sp, (Math.sin(walk.yaw) * f + Math.cos(walk.yaw) * s) * sp);
        const targetZ = floorAt(walk.x, walk.y, walk.level) + EYE;
        walk.z += (targetZ - walk.z) * Math.min(1, dt * 8);
        camera.position.set(walk.x, walk.z, -walk.y);
        const cp = Math.cos(walk.pitch);
        camera.lookAt(walk.x + Math.cos(walk.yaw) * cp, walk.z + Math.sin(walk.pitch), -(walk.y + Math.sin(walk.yaw) * cp));
      } else {
        if (anim) {
          const k = Math.min(1, (now - anim.t0) / 900);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          camera.position.lerpVectors(anim.from[0], anim.to[0], e);
          controls.target.lerpVectors(anim.from[1], anim.to[1], e);
          if (k >= 1) anim = null;
        }
        controls.update();
      }
      renderer.render(scene, camera);
      const showLabels = tRef.current.labels && !tRef.current.roof && mode === "orbit";
      layers.labels.visible = showLabels;
      css.domElement.style.visibility = showLabels ? "visible" : "hidden";
      if (showLabels) css.render(scene, camera);
      // minimap marker
      const mk = marker.current;
      if (mk) {
        const px = mode === "walk" ? walk.x : camera.position.x, py = mode === "walk" ? walk.y : -camera.position.z;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const ang = (Math.atan2(-dir.z, dir.x) * 180) / Math.PI;
        mk.setAttribute("transform", `translate(${px.toFixed(2)} ${(-py).toFixed(2)}) rotate(${(-ang).toFixed(1)})`);
      }
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
      el.replaceChildren();
    };
  }, []);

  useEffect(() => { api.current?.apply(t, sun); }, [t, sun, mode]);

  // auto tour: cycle the views every 5 s until the user touches the scene
  useEffect(() => {
    if (!tour) return;
    const list = PRESETS.filter((p) => p.roof === undefined);
    let i = 0;
    const next = () => { const p = list[i++ % list.length]; setActive(p.name); api.current?.goTo(p); };
    next();
    const id = window.setInterval(next, 5000);
    const stop = () => setTour(false);
    window.addEventListener("house-stop-tour", stop);
    return () => { window.clearInterval(id); window.removeEventListener("house-stop-tour", stop); };
  }, [tour]);
  const fullscreen = () => {
    const el = viewRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  const pick = (p: Preset) => {
    setActive(p.name);
    if (p.roof !== undefined && p.roof !== t.roof) setT({ ...t, roof: p.roof });
    else if (p.roof === undefined && !t.roof) setT({ ...t, roof: true });
    api.current?.goTo(p);
  };
  const tog = (k: keyof Toggles) => setT({ ...t, [k]: !t[k] });
  const hourLabel = `${Math.floor(sun)}:${String(Math.round((sun % 1) * 60)).padStart(2, "0")}`;

  // minimap geometry (plan coords, y flipped by the svg transform)
  const mm = { x0: PLOT.x0 - 4, x1: PLOT.x1 + 4, y0: PLOT.y0 - 4, y1: PLOT.y1 + 4 };
  // fit the plot into 288 × 190 px whatever its shape
  const mmK = Math.min(288 / (mm.x1 - mm.x0), 190 / (mm.y1 - mm.y0));
  const onMini = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    api.current?.focus(p.x, -p.y);
  };
  const hold = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); api.current?.hold(k, true); },
    onPointerUp: () => api.current?.hold(k, false),
    onPointerLeave: () => api.current?.hold(k, false),
  });

  return (
    <div className="view3d" ref={viewRef}>
      <div ref={host} className="canvas-host" />
      <div className="hud hud-left">
        <div className="seg">
          <button className={mode === "orbit" ? "on" : ""} onClick={() => api.current?.setMode("orbit")}>Orbit</button>
          <button className={mode === "walk" ? "on" : ""} onClick={() => api.current?.setMode("walk")}>Walk inside</button>
        </div>
        <div className="hud-title">Go to</div>
        <div className="goto">
          {spots.map((p) => (
            <button key={p.name} className="chip" onClick={() => { setTour(false); api.current?.walkTo(p.at[0], p.at[1], p.look[0], p.look[1], p.level ?? 0); }}>{p.name}</button>
          ))}
        </div>
        <div className="hud-title" style={{ marginTop: 8 }}>Views</div>
        {PRESETS.map((p) => (
          <button key={p.name} className={mode === "orbit" && active === p.name ? "chip on" : "chip"} onClick={() => { setTour(false); pick(p); }} title={p.hint}>{p.name}</button>
        ))}
      </div>
      <div className="hud hud-right">
        <div className="hud-title">Show</div>
        {([...(HOUSE.phase2 ? [["phase2", "Phase 2"]] : []), ["roof", "Roof & terrace"], ["furniture", "Furniture"], ...(FLOORS_TOTAL > 1 ? [["ghost", `Future floors (G+${FLOORS_TOTAL - 1})`]] : []),
          ["labels", "Room labels (roof off)"], ["shadows", "Sun shadows"], ["noclip", "Walk through walls"]] as [keyof Toggles, string][]).map(([k, lab]) => (
          <label key={k} className="tog"><input type="checkbox" checked={t[k]} onChange={() => tog(k)} />{lab}</label>
        ))}
        <div className="hud-title" style={{ marginTop: 10 }}>Sun · {hourLabel}</div>
        <input type="range" min={6.5} max={17.5} step={0.25} value={sun} onChange={(e) => setSun(Number(e.target.value))} />
        <div className="hud-row">
          <button className={tour ? "chip on" : "chip"} onClick={() => setTour(!tour)}>{tour ? "Stop tour" : "Auto tour"}</button>
          <button className="chip" onClick={fullscreen}>Fullscreen</button>
        </div>
        <div className="hud-row">
          <button className="chip" onClick={() => api.current?.snap()}>Save image</button>
          <button className="chip" onClick={() => setHelp(!help)}>{help ? "Hide help" : "Help"}</button>
        </div>
      </div>
      {help && (
        <div className="hud hud-help">
          {mode === "orbit" ? (
            <>
              <b>Orbit</b> · drag to turn · right-drag or arrow keys to pan · scroll zooms toward the cursor ·
              <b> double-click</b> anything to fly there · click the map to jump · <b>F</b> or “Walk inside” to walk
            </>
          ) : (
            <>
              <b>Walk</b> · <b>W A S D</b> move · <b>Q E</b> / ← → turn · drag to look · scroll steps forward · <b>Shift</b> runs ·
              double-click a spot or click the map to jump · <b>F</b> back to orbit
            </>
          )}
        </div>
      )}
      <div className="minimap">
        <svg viewBox={`${mm.x0} ${-mm.y1} ${mm.x1 - mm.x0} ${mm.y1 - mm.y0}`} width={(mm.x1 - mm.x0) * mmK} height={(mm.y1 - mm.y0) * mmK} onClick={onMini}>
          <rect x={PLOT.x0} y={-PLOT.y1} width={PLOT.x1 - PLOT.x0} height={PLOT.y1 - PLOT.y0} fill="#dfe9cf" stroke="#9a3412" strokeWidth={0.4} />
          {MODEL.floors.map((f, i) => <rect key={i} x={f.x0} y={-f.y1} width={f.x1 - f.x0} height={f.y1 - f.y0} fill={f.kind === "bath" ? "#cfe0e8" : f.kind === "court" ? "#c9d8b4" : "#f4efe6"} />)}
          {MODEL.walls.map((w, i) => <rect key={i} x={w.x0} y={-w.y1} width={w.x1 - w.x0} height={w.y1 - w.y0} fill="#555" />)}
          <g ref={marker}>
            <path d="M0 0 L18 -9 L18 9 Z" fill="#2b7bb9" opacity={0.35} />
            <circle r={3.2} fill="#2b7bb9" stroke="#fff" strokeWidth={1} />
          </g>
        </svg>
        <div className="minimap-cap">click to jump · {mode === "walk" ? "you" : "camera"} in blue</div>
      </div>
      {mode === "walk" && (
        <div className="dpad">
          <button {...hold("q")}>⟲</button><button {...hold("w")}>▲</button><button {...hold("e")}>⟳</button>
          <button {...hold("a")}>◀</button><button {...hold("s")}>▼</button><button {...hold("d")}>▶</button>
        </div>
      )}
      <div className="hud-note-floor">Ground floor FFL ±0 · terrace +{FLOOR}′ · plot limits shown as the compound wall · road on the {{ N: "north", S: "south", E: "east", W: "west" }[ROAD]}</div>
    </div>
  );
}
