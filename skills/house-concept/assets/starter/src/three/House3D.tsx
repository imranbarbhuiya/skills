import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { BBOX, FLOOR, FLOORS_TOTAL, HOUSE, MODEL, MODEL_P1, PLOT, SITE, STAIRS, STAIR_WELLS, parapetRect, roofEdges } from "../model";
import type { Rect } from "../types";
import { HouseLayers, buildHouse } from "./buildHouse";
import { EYE_HEIGHT, LocationInfo, Place, WalkState, findFreeSpot, floorHeightAt, getPlaces, roomAt, stepWalker } from "./navigation";

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
  walkTo: (x: number, y: number, lookX?: number, lookY?: number, level?: 0 | 1) => void;
  snap: () => void;
  focus: (x: number, y: number) => void;
  setJoy: (strafe: number, forward: number) => void;
  requestLock: () => void;
}

const WALK_SPEED = 7.5; // ft/s
const RUN_MULT = 2;
const inPlot = (x: number, y: number, m = 2) => x > PLOT.x0 + m && x < PLOT.x1 - m && y > PLOT.y0 + m && y < PLOT.y1 - m;
const inHouse = (x: number, y: number) => x > BBOX.x0 && x < BBOX.x1 && y > BBOX.y0 && y < BBOX.y1;
const union = (rs: Rect[]): Rect => rs.reduce((a, r) => ({ x0: Math.min(a.x0, r.x0), y0: Math.min(a.y0, r.y0), x1: Math.max(a.x1, r.x1), y1: Math.max(a.y1, r.y1) }));
const grow = (r: Rect, m: number): Rect => ({ x0: r.x0 - m, y0: r.y0 - m, x1: r.x1 + m, y1: r.y1 + m });
/** minimap extents: the house with its stairs, porches and steps, or the whole plot */
const MINI = {
  house: grow(union([BBOX, ...STAIRS.map((d) => d.well), ...HOUSE.porches, ...HOUSE.steps.map((s) => s.r)]), 5),
  plot: grow(PLOT, 4),
};

export function House3D() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const marker = useRef<SVGGElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const joyPadRef = useRef<HTMLDivElement>(null);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Toggles>({ roof: true, furniture: true, ghost: false, labels: true, shadows: true, noclip: false, phase2: true });
  const [sun, setSun] = useState(10.5);
  const [active, setActive] = useState(PRESETS[0].name);
  const [mode, setModeState] = useState<Mode>("orbit");
  const [locked, setLocked] = useState(false);
  const [help, setHelp] = useState(true);
  const [tour, setTour] = useState(false);
  const [miniScope, setMiniScope] = useState<keyof typeof MINI>("house");
  const [loc, setLoc] = useState<LocationInfo>({ room: "", level: "", onRoof: false });
  const [isTouch, setIsTouch] = useState(() => window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
  const [panelsOpen, setPanelsOpen] = useState(true);
  const allSpots = useMemo(() => getPlaces(), []);
  const spots = useMemo(() => allSpots.filter((p) => t.phase2 || !p.phase2), [allSpots, t.phase2]);
  const tRef = useRef(t);
  tRef.current = t;
  const spotsRef = useRef(spots);
  spotsRef.current = spots;

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
    const walk: WalkState = { x: 0, y: 0, footZ: 0, eyeZ: EYE_HEIGHT, yaw: 0, pitch: -0.05 };
    let walkStarted = false;
    /** the orbit pivot set when walk mode was left: if it is still there, F resumes where you stood */
    let leftAt: THREE.Vector3 | null = null;
    let vel = { x: 0, y: 0 };
    const joy = { s: 0, f: 0 };
    const keys = new Set<string>();
    let mode: Mode = "orbit";
    let shadows = true;
    let lastLoc = "";
    let lockLostAt = 0;
    const cv = renderer.domElement;
    const dir = new THREE.Vector3();

    const exitLock = () => { if (document.pointerLockElement === cv) document.exitPointerLock(); };
    const requestLock = () => {
      if (mode !== "walk" || document.pointerLockElement === cv) return;
      // refused under automation or without a user gesture; drag-to-look still works
      cv.requestPointerLock()?.catch(() => {});
    };
    const syncLocation = (force = false) => {
      const info = roomAt(walk.x, walk.y, walk.footZ, tRef.current.phase2);
      const key = `${info.room}|${info.level}`;
      if (force || key !== lastLoc) { lastLoc = key; setLoc(info); }
    };
    const placeCamera = () => {
      camera.position.set(walk.x, walk.eyeZ, -walk.y);
      const cp = Math.cos(walk.pitch);
      camera.lookAt(walk.x + Math.cos(walk.yaw) * cp, walk.eyeZ + Math.sin(walk.pitch), -(walk.y + Math.sin(walk.yaw) * cp));
    };
    /** stand on the nearest free spot to (x, y) at ground (0) or roof level */
    const standAt = (x: number, y: number, roof: boolean) => {
      [walk.x, walk.y, walk.footZ] = findFreeSpot(x, y, roof ? FLOOR : 0, tRef.current.phase2);
      walk.eyeZ = walk.footZ + EYE_HEIGHT;
      vel = { x: 0, y: 0 };
      walkStarted = true;
    };
    const enterWalk = () => {
      mode = "walk";
      anim = null;
      controls.enabled = false;
      placeCamera();
      syncLocation(true);
      setModeState("walk");
    };
    const walkTo = (x: number, y: number, lx?: number, ly?: number, level?: 0 | 1) => {
      standAt(x, y, level === 1 || (level === undefined && walk.footZ >= FLOOR - 1 && inHouse(x, y)));
      if (lx !== undefined && ly !== undefined) walk.yaw = Math.atan2(ly - walk.y, lx - walk.x);
      walk.pitch = -0.05;
      enterWalk();
    };
    /**
     * Orbit → walk: resume where you left if the view has not moved, else stand under a close camera, at a roof
     * target, or at the first "Go to" spot. The orbit target's height says whether you were looking at the roof.
     */
    const placeFromOrbit = () => {
      const cam = camera.position, tg = controls.target;
      if (walkStarted && leftAt && tg.distanceTo(leftAt) < 1) return;
      camera.getWorldDirection(dir);
      const yaw = Math.atan2(-dir.z, dir.x);
      const onRoof = tRef.current.roof && tg.y >= FLOOR - 1.5;
      if (inPlot(cam.x, -cam.z) && cam.distanceTo(tg) < 28 && cam.y < FLOOR + 14) {
        standAt(cam.x, -cam.z, onRoof);
        walk.yaw = yaw;
        walk.pitch = Math.max(-0.8, Math.min(0.6, Math.asin(Math.max(-1, Math.min(1, dir.y)))));
      } else if (inPlot(tg.x, -tg.z) && onRoof) {
        standAt(tg.x, -tg.z, true);
        walk.yaw = yaw;
        walk.pitch = -0.05;
      } else if (!walkStarted) {
        const first = spotsRef.current[0];
        standAt(first.at[0], first.at[1], first.level === 1);
        walk.yaw = Math.atan2(first.look[1] - walk.y, first.look[0] - walk.x);
        walk.pitch = -0.05;
      }
    };
    const setMode = (m: Mode) => {
      if (m === mode) return;
      anim = null;
      vel = { x: 0, y: 0 };
      keys.clear();
      joy.s = joy.f = 0;
      if (m === "orbit") {
        exitLock();
        mode = "orbit";
        controls.enabled = true;
        // pull back from where you stood, so the orbit pivots there
        const fx = Math.cos(walk.yaw), fy = Math.sin(walk.yaw);
        const tgt = new THREE.Vector3(walk.x + fx * 3, Math.max(0, walk.footZ + 2.5), -(walk.y + fy * 3));
        controls.target.copy(tgt);
        leftAt = tgt.clone();
        animateTo(new THREE.Vector3(walk.x - fx * 14, walk.footZ + EYE_HEIGHT + 8, -(walk.y - fy * 14)), tgt);
        setModeState("orbit");
        return;
      }
      placeFromOrbit();
      enterWalk();
    };
    const focus = (x: number, y: number) => {
      if (mode === "walk") {
        walkTo(x, y, x + Math.cos(walk.yaw), y + Math.sin(walk.yaw), walk.footZ >= FLOOR - 1 && tRef.current.roof ? 1 : 0);
        return;
      }
      const tgt = new THREE.Vector3(x, floorHeightAt(x, y, tRef.current.phase2) + 2, -y);
      const off = camera.position.clone().sub(controls.target);
      animateTo(tgt.clone().add(off.normalize().multiplyScalar(Math.min(off.length(), 45))), tgt);
    };

    // ---------------- input: keys, pointer-lock mouse-look, drag-to-look, wheel, double-click
    const MOVE_KEYS = ["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"];
    const onKey = (e: KeyboardEvent, down: boolean) => {
      // a focused checkbox still lets you walk; text fields and the sun slider keep their keys
      const el = e.target as HTMLInputElement | null;
      if (el?.tagName === "TEXTAREA" || (el?.tagName === "INPUT" && el.type !== "checkbox")) return;
      const k = e.key.toLowerCase();
      if (down && k === "f") { e.preventDefault(); setMode(mode === "walk" ? "orbit" : "walk"); return; }
      if (mode !== "walk") return;
      // the first Esc only releases mouse-look (the browser does that); the next one leaves walk mode
      if (down && k === "escape") { if (document.pointerLockElement !== cv && performance.now() - lockLostAt > 250) setMode("orbit"); return; }
      if (MOVE_KEYS.includes(k)) {
        e.preventDefault();
        if (down) keys.add(k); else keys.delete(k);
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    const onBlur = () => { keys.clear(); joy.s = joy.f = 0; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", onBlur);
    const onLockChange = () => {
      const on = document.pointerLockElement === cv;
      setLocked(on);
      if (!on) { keys.clear(); lockLostAt = performance.now(); }
    };
    document.addEventListener("pointerlockchange", onLockChange);
    const look = (dx: number, dy: number, k: number) => {
      walk.yaw -= dx * k;
      walk.pitch = Math.max(-1.35, Math.min(1.35, walk.pitch - dy * k));
    };
    const onMouseMove = (e: MouseEvent) => {
      if (mode === "walk" && document.pointerLockElement === cv) look(Math.max(-120, Math.min(120, e.movementX)), Math.max(-120, Math.min(120, e.movementY)), 0.0024);
    };
    document.addEventListener("mousemove", onMouseMove);
    // drag to look (touch, or a mouse without pointer lock); a click without a drag asks for mouse-look
    let drag: { id: number; x: number; y: number; sx: number; sy: number; moved: boolean; touch: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") setIsTouch(true);
      if (mode !== "walk" || document.pointerLockElement === cv || drag) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, touch: e.pointerType === "touch" };
      cv.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (mode !== "walk" || !drag || drag.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
      look(e.clientX - drag.x, e.clientY - drag.y, drag.touch ? 0.005 : 0.0038);
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const click = !drag.touch && !drag.moved && e.button === 0;
      drag = null;
      if (click) requestLock();
    };
    const onWheel = (e: WheelEvent) => {
      if (mode !== "walk") return;
      e.preventDefault();
      const d = Math.max(-2.5, Math.min(2.5, -e.deltaY * 0.015));
      stepWalker(walk, Math.cos(walk.yaw) * d, Math.sin(walk.yaw) * d, tRef.current.phase2, tRef.current.noclip);
      syncLocation();
    };
    const raycaster = new THREE.Raycaster();
    const onDbl = (e: MouseEvent) => {
      if (document.pointerLockElement === cv) return;
      const r = cv.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const tg = tRef.current;
      const hit = raycaster.intersectObjects([layers.site, layers.house, ...(tg.phase2 ? [layers.p2House] : []), ...(tg.roof ? [layers.roof, ...(tg.phase2 ? [layers.p2Roof] : [])] : [])], true)[0];
      if (!hit) return;
      if (mode === "walk") {
        walkTo(hit.point.x, -hit.point.z, hit.point.x + Math.cos(walk.yaw), -hit.point.z + Math.sin(walk.yaw), hit.point.y >= FLOOR - 1 && tg.roof ? 1 : 0);
        return;
      }
      const tgt = hit.point.clone();
      animateTo(tgt.clone().add(camera.position.clone().sub(controls.target).multiplyScalar(0.55)), tgt);
    };
    const stopTour = () => window.dispatchEvent(new CustomEvent("house-stop-tour"));
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("dblclick", onDbl);
    cv.addEventListener("pointerdown", stopTour);

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
      if (tg.shadows !== shadows) {
        shadows = tg.shadows;
        renderer.shadowMap.enabled = tg.shadows;
        sunLight.castShadow = tg.shadows;
        scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; });
      }
      const f = (hour - 6) / 12;
      const az = (90 + 180 * f) * (Math.PI / 180);
      const el_ = Math.max(4, 68 * Math.sin(Math.PI * f)) * (Math.PI / 180);
      const d = 240;
      sunLight.position.set(C[0] + d * Math.sin(az) * Math.cos(el_), d * Math.sin(el_), C[2] - d * Math.cos(az) * Math.cos(el_));
      sunLight.intensity = 0.6 + 2.0 * Math.sin(Math.PI * Math.min(Math.max(f, 0), 1));
      if (mode === "walk") {
        // phase 2 may have taken away the floor or put a wall where you stand: move to the nearest free spot
        const z = walk.footZ;
        [walk.x, walk.y, walk.footZ] = findFreeSpot(walk.x, walk.y, z, tg.phase2);
        if (walk.footZ !== z) walk.eyeZ = walk.footZ + EYE_HEIGHT;
        syncLocation(true);
      }
    };
    const snap = () => {
      renderer.render(scene, camera);
      const a = document.createElement("a");
      a.href = renderer.domElement.toDataURL("image/png");
      a.download = `house-3d-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
      a.click();
    };
    api.current = {
      goTo: (p) => { setMode("orbit"); animateTo(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.target)); },
      apply, setMode, walkTo, focus, snap, requestLock,
      setJoy: (s, f) => { joy.s = s; joy.f = f; },
    };

    // ---------------- loop
    let raf = 0, last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (mode === "walk") {
        let f = joy.f, s = -joy.s; // s > 0 strafes left
        if (keys.has("w") || keys.has("arrowup")) f += 1;
        if (keys.has("s") || keys.has("arrowdown")) f -= 1;
        if (keys.has("a") || keys.has("arrowleft")) s += 1;
        if (keys.has("d") || keys.has("arrowright")) s -= 1;
        if (keys.has("q")) walk.yaw += 1.9 * dt;
        if (keys.has("e")) walk.yaw -= 1.9 * dt;
        const mag = Math.hypot(f, s);
        if (mag > 1) { f /= mag; s /= mag; }
        const speed = WALK_SPEED * (keys.has("shift") ? RUN_MULT : 1);
        const k = 1 - Math.exp(-18 * dt);
        vel.x += ((Math.cos(walk.yaw) * f - Math.sin(walk.yaw) * s) * speed - vel.x) * k;
        vel.y += ((Math.sin(walk.yaw) * f + Math.cos(walk.yaw) * s) * speed - vel.y) * k;
        if (Math.hypot(vel.x, vel.y) > 0.02) {
          stepWalker(walk, vel.x * dt, vel.y * dt, tRef.current.phase2, tRef.current.noclip);
          syncLocation();
        }
        walk.eyeZ += (walk.footZ + EYE_HEIGHT - walk.eyeZ) * (1 - Math.exp(-15 * dt));
        placeCamera();
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
        camera.getWorldDirection(dir);
        const ang = (Math.atan2(-dir.z, dir.x) * 180) / Math.PI;
        mk.setAttribute("transform", `translate(${px.toFixed(2)} ${(-py).toFixed(2)}) rotate(${(-ang).toFixed(1)})`);
      }
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      exitLock();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
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
  const goToPlace = (p: Place) => {
    setTour(false);
    if (p.level === 1 && !t.roof) setT({ ...t, roof: true });
    api.current?.walkTo(p.at[0], p.at[1], p.look[0], p.look[1], p.level ?? 0);
  };
  const tog = (k: keyof Toggles) => setT({ ...t, [k]: !t[k] });
  const hourLabel = `${Math.floor(sun)}:${String(Math.round((sun % 1) * 60)).padStart(2, "0")}`;

  // touch joystick: drag the knob to walk, drag the view to look
  const joyPid = useRef<number | null>(null);
  const updateJoy = (clientX: number, clientY: number) => {
    const pad = joyPadRef.current, knob = joyKnobRef.current;
    if (!pad || !knob) return;
    const r = pad.getBoundingClientRect(), maxR = r.width * 0.36;
    let dx = clientX - (r.left + r.width / 2), dy = clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > maxR) { dx *= maxR / d; dy *= maxR / d; }
    knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    api.current?.setJoy(dx / maxR, -dy / maxR);
  };
  const joyHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      joyPid.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      updateJoy(e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => { if (joyPid.current === e.pointerId) updateJoy(e.clientX, e.clientY); },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      if (joyPid.current !== e.pointerId) return;
      joyPid.current = null;
      if (joyKnobRef.current) joyKnobRef.current.style.transform = "";
      api.current?.setJoy(0, 0);
    },
  };

  // minimap (plan coords, y flipped by the svg transform); on the roof it shows the roof plan
  const mm = MINI[miniScope];
  const onMini = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    api.current?.focus(p.x, -p.y);
  };
  const model = t.phase2 ? MODEL : MODEL_P1;
  const roofMap = mode === "walk" && loc.onRoof;
  const cone = miniScope === "house" ? 0.65 : 1;
  const R = (r: Rect, fill: string, extra: React.SVGProps<SVGRectElement> = {}) => <rect x={r.x0} y={-r.y1} width={r.x1 - r.x0} height={r.y1 - r.y0} fill={fill} {...extra} />;
  const treads = STAIRS.flatMap((d) => d.treads).map((s, i) => <g key={`t${i}`}>{R(s.r, "#d7c8ae", { stroke: "#8c7a5b", strokeWidth: 0.12 })}</g>);

  return (
    <div className={`view3d${isTouch ? " is-touch" : ""}`} ref={viewRef}>
      <div ref={host} className={`canvas-host${mode === "walk" ? " walk-cursor" : ""}`} />
      {mode === "walk" && locked && <div className="crosshair" aria-hidden="true" />}
      {mode === "walk" && (
        <div className="walk-bar" role="status" aria-live="polite">
          <div className="walk-loc">
            <span className="walk-loc-prefix">You are in:</span>
            <strong>{loc.room}</strong>
            <span className="walk-loc-lvl">{loc.level}</span>
          </div>
          {!isTouch && !locked && <button className="walk-lock-btn" onClick={() => api.current?.requestLock()}>Mouse-look</button>}
          <button className="walk-exit-btn" onClick={() => api.current?.setMode("orbit")}>Exit walk (F)</button>
        </div>
      )}
      {isTouch && <button className="hud-toggle-mobile" onClick={() => setPanelsOpen(!panelsOpen)}>{panelsOpen ? "Hide menu" : "Rooms & options"}</button>}
      {panelsOpen && (
        <>
          <div className="hud hud-left">
            <div className="seg">
              <button className={mode === "orbit" ? "on" : ""} onClick={() => api.current?.setMode("orbit")}>Orbit</button>
              <button className={mode === "walk" ? "on" : ""} onClick={() => api.current?.setMode("walk")}>Walk inside</button>
            </div>
            <div className="hud-title">Go to</div>
            <div className="goto">
              {spots.map((p) => (
                <button key={p.name} className={mode === "walk" && loc.room === p.name ? "chip on" : "chip"} onClick={() => goToPlace(p)}>{p.name}</button>
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
        </>
      )}
      {help && (
        <div className="hud hud-help">
          {mode === "orbit" ? (
            <>
              <b>Orbit</b> · drag to turn · right-drag or arrow keys to pan · scroll zooms toward the cursor ·
              <b> double-click</b> anything to fly there · click the map to jump · <b>F</b> or “Walk inside” to walk
            </>
          ) : isTouch ? (
            <><b>Walk</b> · move with the thumbstick · drag the view to look · walk up the stairs to the roof · <b>Exit walk</b> for orbit</>
          ) : locked ? (
            <><b>Walk</b> · move the mouse to look · <b>W A S D</b> / arrows move · <b>Shift</b> runs · <b>Q E</b> turn · <b>Esc</b> frees the mouse · <b>F</b> back to orbit</>
          ) : (
            <>
              <b>Walk</b> · <b>click the view</b> for mouse-look, or drag · <b>W A S D</b> / arrows move · <b>Shift</b> runs · <b>Q E</b> turn ·
              walk up the stairs to the roof · double-click or click the map to jump · <b>Esc</b> / <b>F</b> back to orbit
            </>
          )}
        </div>
      )}
      <div className={`minimap${isTouch && mode === "walk" ? " minimap-touch-right" : ""}`}>
        <div className="minimap-head">
          <span>{roofMap ? "Roof plan" : "Ground plan"}</span>
          <button className="mini-scope" onClick={() => setMiniScope(miniScope === "house" ? "plot" : "house")}>{miniScope === "house" ? "Whole plot" : "House"}</button>
        </div>
        <svg viewBox={`${mm.x0} ${-mm.y1} ${mm.x1 - mm.x0} ${mm.y1 - mm.y0}`} onClick={onMini}>
          {R(PLOT, "#dfe9cf", { stroke: "#9a3412", strokeWidth: 0.4 })}
          {R(SITE.path, "#e8e0d0")}
          {roofMap ? (
            <>
              {HOUSE.roofs.filter((r) => t.phase2 || r.phase === 1).map(({ r }, i) => <g key={i}>{R(r, "#ece6dc")}</g>)}
              {[...HOUSE.courts, ...STAIR_WELLS].map((r, i) => <g key={`h${i}`}>{R(r, "#b8d4e3", { stroke: "#4b7b94", strokeWidth: 0.3 })}</g>)}
              {treads}
              {HOUSE.tank && R(HOUSE.tank, "#3c4450")}
              {roofEdges().filter((s) => (s.dependsOn2 ? !t.phase2 : s.phase === 1 || t.phase2)).map((s, i) => <g key={`p${i}`}>{R(parapetRect(s), "#4b5563")}</g>)}
            </>
          ) : (
            <>
              {HOUSE.porches.map((r, i) => <g key={`po${i}`}>{R(r, "#e3dccd")}</g>)}
              {HOUSE.steps.map((s, i) => <g key={`st${i}`}>{R(s.r, "#d8cfbd")}</g>)}
              {model.floors.map((f, i) => <g key={i}>{R(f, f.kind === "bath" || f.kind === "wash" ? "#cfe0e8" : f.kind === "court" ? "#c9d8b4" : "#f4efe6")}</g>)}
              {treads}
              {model.walls.map((w, i) => <g key={`w${i}`}>{R(w, "#4b5563")}</g>)}
              {miniScope === "house" && model.labels.filter((lb) => lb.room).map((lb, i) => (
                <text key={`l${i}`} x={lb.x} y={-lb.y + 1.1} fontSize={3} fontWeight={700} fill="#5f6b7a" textAnchor="middle" pointerEvents="none">{lb.room}</text>
              ))}
            </>
          )}
          <g ref={marker}>
            <path d={`M0 0 L${16 * cone} ${-8 * cone} L${16 * cone} ${8 * cone} Z`} fill="#2b7bb9" opacity={0.35} />
            <circle r={2.6 * cone} fill="#2b7bb9" stroke="#fff" strokeWidth={0.8 * cone} />
          </g>
        </svg>
        <div className="minimap-cap">click to jump · {mode === "walk" ? "you" : "camera"} in blue</div>
      </div>
      {mode === "walk" && isTouch && (
        <div ref={joyPadRef} className="joystick" {...joyHandlers} onPointerCancel={joyHandlers.onPointerUp} aria-label="Walk joystick">
          <div className="joystick-ring" />
          <div ref={joyKnobRef} className="joystick-knob" />
        </div>
      )}
      <div className="hud-note-floor">Ground floor FFL ±0 · terrace +{FLOOR}′ · plot limits shown as the compound wall · road on the {{ N: "north", S: "south", E: "east", W: "west" }[ROAD]}</div>
    </div>
  );
}
