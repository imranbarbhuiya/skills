/**
 * Builds the three.js scene from the shared model. World (x east, y north, z up) → three (X = x, Y = z, Z = −y).
 * Phase-2 parts go into their own layers so the "phase 2" toggle can hide them.
 */
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  BBOX, CHAJJA, COLUMNS, DogLeg, FLOOR, FLOORS_TOTAL, HOUSE, LINTEL, MODEL, MODEL_P1, MODEL_P2, PARAPET, PLINTH, PLOT, SITE, SLAB,
  STAIRS, STAIR_RISE, STAIR_RISERS, STAIR_TREAD, STAIR_WELLS, roofEdges,
} from "../model";
import type { Model, Opening, Rect, Wall } from "../types";

const H = FLOOR - SLAB; // wall height up to the slab soffit
const FAN: [number, number] = [7.5, 8.75]; // fanlight / glass band
const STEP_RISE = PLINTH / Math.max(1, Math.round(PLINTH / 0.55));

const mat = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...o });

export const M = {
  plaster: mat("#f1e9dc"),
  plasterIn: mat("#f7f2ea"),
  stone: mat("#8f8a80"),
  coping: mat("#d3c9b8"),
  slab: mat("#e4ddd0"),
  wood: mat("#6b4a2b", { roughness: 0.7 }),
  woodL: mat("#8a5f39", { roughness: 0.7 }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#a9cbdc", roughness: 0.05, transparent: true, opacity: 0.35, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  metal: mat("#3b3b3b", { metalness: 0.5, roughness: 0.5 }),
  rail: mat("#5a5f66", { metalness: 0.4, roughness: 0.5 }),
  column: mat("#ece4d6"),
  grass: mat("#9dbb78"),
  neighbour: mat("#b7c2a6"),
  path: mat("#d8cfbd"),
  road: mat("#5b5f66"),
  boundary: mat("#cfc7b8"),
  trunk: mat("#6b5a45"),
  leaf: mat("#7fa35a", { flatShading: true }),
  tank: mat("#3c4450", { roughness: 0.6 }),
  furn: mat("#ffffff", { roughness: 0.8 }),
  bed: mat("#f5f1ea"),
  sofa: mat("#b9a9d6"),
  table: mat("#b8875a", { roughness: 0.6 }),
  counter: mat("#a49b8c"),
  wardrobe: mat("#c8b495"),
  fix: mat("#ffffff", { roughness: 0.3 }),
  plant: mat("#7fa35a", { flatShading: true }),
  ghost: new THREE.MeshBasicMaterial({ color: "#4f46e5", transparent: true, opacity: 0.07, depthWrite: false }),
  ghostLine: new THREE.LineDashedMaterial({ color: "#4f46e5", dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.8 }),
};

const FLOOR_MAT: Record<string, THREE.Material> = {
  bed: mat("#d9c7a8"), bath: mat("#c9dbe3"), kitchen: mat("#d6c3a5"), dining: mat("#cdb38e"), living: mat("#d8c29c"),
  corridor: mat("#cbbfa9"), porch: mat("#b9a68a"), wash: mat("#c9dbe3"), court: mat("#a7b693"), stair: mat("#c4b8a2"),
};

/** Axis-aligned box from world extents. */
export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: THREE.Material, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0)), material);
  m.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** Rectangle minus holes → list of rectangles (x-sweep). */
export function rectMinus(r: Rect, holes: Rect[]): Rect[] {
  const xs = new Set([r.x0, r.x1]);
  for (const h of holes) { if (h.x0 > r.x0 && h.x0 < r.x1) xs.add(h.x0); if (h.x1 > r.x0 && h.x1 < r.x1) xs.add(h.x1); }
  const xa = [...xs].sort((a, b) => a - b);
  const out: Rect[] = [];
  for (let i = 0; i < xa.length - 1; i++) {
    const x0 = xa[i], x1 = xa[i + 1], xm = (x0 + x1) / 2;
    const cuts = holes.filter((h) => h.x0 < xm && h.x1 > xm).map((h) => [Math.max(h.y0, r.y0), Math.min(h.y1, r.y1)] as [number, number]).sort((a, b) => a[0] - b[0]);
    let y = r.y0;
    for (const [c0, c1] of cuts) { if (c0 > y) out.push({ x0, x1, y0: y, y1: c0 }); y = Math.max(y, c1); }
    if (y < r.y1) out.push({ x0, x1, y0: y, y1: r.y1 });
  }
  return out;
}

function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  return m;
}
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

// ---------------------------------------------------------------- walls with openings
function wallOpenings(w: Wall, alongX: boolean, openings: Opening[]): Opening[] {
  const tol = 0.02;
  return openings.filter((o) => {
    if ((o.axis === "x") !== alongX) return false;
    const [t0, t1] = alongX ? [w.y0, w.y1] : [w.x0, w.x1];
    const [a0, a1] = alongX ? [w.x0, w.x1] : [w.y0, w.y1];
    const overlap = Math.min(t1, o.w[1]) - Math.max(t0, o.w[0]);
    return overlap > (t1 - t0) * 0.5 - tol && o.a[0] >= a0 - tol && o.a[1] <= a1 + tol;
  }).sort((p, q) => p.a[0] - q.a[0]);
}

function insert(g: THREE.Group, o: Opening, alongX: boolean, w: Wall) {
  const [t0, t1] = alongX ? [w.y0, w.y1] : [w.x0, w.x1];
  const mid = (t0 + t1) / 2;
  const B = (a0: number, a1: number, z0: number, z1: number, m: THREE.Material, d = 0.18) =>
    alongX ? box(a0, a1, mid - d / 2, mid + d / 2, z0, z1, m, false) : box(mid - d / 2, mid + d / 2, a0, a1, z0, z1, m, false);
  const [a0, a1] = o.a;
  const fr = 0.15;
  if (o.kind === "window" || o.kind === "vent" || o.kind === "slide") {
    const z0 = o.sill, z1 = o.head;
    g.add(B(a0, a1, z0, z0 + fr, M.wood), B(a0, a1, z1 - fr, z1, M.wood), B(a0, a0 + fr, z0, z1, M.wood), B(a1 - fr, a1, z0, z1, M.wood));
    g.add(B(a0 + fr, a1 - fr, z0 + fr, z1 - fr, M.glass, 0.05));
    const panes = o.kind === "slide" ? 4 : a1 - a0 > 3 ? (a1 - a0 > 5.5 ? 3 : 2) : 1;
    for (let k = 1; k < panes; k++) { const a = a0 + ((a1 - a0) * k) / panes; g.add(B(a - 0.06, a + 0.06, z0, z1, M.wood)); }
    if (o.kind === "vent") for (let k = 1; k < 4; k++) { const z = z0 + ((z1 - z0) * k) / 4; g.add(B(a0, a1, z - 0.04, z + 0.04, M.wood, 0.1)); }
    const out = o.face === "S" || o.face === "W" ? -1 : o.face === "N" || o.face === "E" ? 1 : 0;
    if (out !== 0 && o.kind !== "slide" && CHAJJA > 0) {
      const base = out < 0 ? t0 : t1;
      const c0 = base, c1 = base + out * CHAJJA;
      g.add(alongX ? box(a0 - 0.5, a1 + 0.5, Math.min(c0, c1), Math.max(c0, c1), z1, z1 + 0.35, M.coping)
        : box(Math.min(c0, c1), Math.max(c0, c1), a0 - 0.5, a1 + 0.5, z1, z1 + 0.35, M.coping));
    }
  } else if (o.kind === "door") {
    const leaves = o.double ? 2 : 1;
    const lw = (a1 - a0) / leaves;
    for (let k = 0; k < leaves; k++) {
      const p = a0 + k * lw, q = p + lw;
      // leaves drawn 75° open toward the swing side so the house can be walked through
      const hingeAtLow = o.double ? k === 0 : o.hinge !== "a1";
      const h = hingeAtLow ? p : q;
      const d: [number, number] = alongX ? [hingeAtLow ? 1 : -1, 0] : [0, hingeAtLow ? 1 : -1];
      const sv: [number, number] = alongX ? [0, o.swing || 1] : [o.swing || 1, 0];
      const ang = (75 * Math.PI) / 180;
      const dir: [number, number] = [Math.cos(ang) * d[0] + Math.sin(ang) * sv[0], Math.cos(ang) * d[1] + Math.sin(ang) * sv[1]];
      const len = q - p - 0.06;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(len, o.head, 0.14), k % 2 ? M.woodL : M.wood);
      leaf.position.set(len / 2, o.head / 2, 0);
      const pivot = new THREE.Group();
      const [hx, hy] = alongX ? [h, mid] : [mid, h];
      pivot.position.set(hx, 0, -hy);
      pivot.rotation.y = Math.atan2(dir[1], dir[0]);
      pivot.add(leaf);
      g.add(pivot);
    }
  }
  if (o.fanlight) g.add(B(a0, a1, FAN[0], FAN[1], M.glass, 0.05));
}

function buildWall(g: THREE.Group, w: Wall, openings: Opening[]) {
  const alongX = w.x1 - w.x0 >= w.y1 - w.y0;
  const material = w.kind === "ext" ? M.plaster : M.plasterIn;
  if (w.kind === "low") { g.add(box(w.x0, w.x1, w.y0, w.y1, 0, 1.5, M.plaster)); return; }
  const piece = (a0: number, a1: number, b0: number, b1: number) => {
    if (a1 - a0 < 0.01 || b1 - b0 < 0.01) return;
    if (w.band && b0 <= FAN[0] && b1 >= FAN[1]) {
      piece(a0, a1, b0, FAN[0]);
      g.add(alongX ? box(a0, a1, (w.y0 + w.y1) / 2 - 0.025, (w.y0 + w.y1) / 2 + 0.025, FAN[0], FAN[1], M.glass, false)
        : box((w.x0 + w.x1) / 2 - 0.025, (w.x0 + w.x1) / 2 + 0.025, a0, a1, FAN[0], FAN[1], M.glass, false));
      piece(a0, a1, FAN[1], b1);
      return;
    }
    g.add(alongX ? box(a0, a1, w.y0, w.y1, b0, b1, material) : box(w.x0, w.x1, a0, a1, b0, b1, material));
  };
  const [s0, s1] = alongX ? [w.x0, w.x1] : [w.y0, w.y1];
  let cur = s0;
  for (const o of wallOpenings(w, alongX, openings)) {
    piece(cur, o.a[0], 0, H);
    if (o.sill > 0.01 && o.kind !== "door" && o.kind !== "open" && o.kind !== "slide") piece(o.a[0], o.a[1], 0, o.sill);
    if (o.fanlight) { piece(o.a[0], o.a[1], o.head, FAN[0]); piece(o.a[0], o.a[1], FAN[1], H); }
    else piece(o.a[0], o.a[1], o.head, H);
    insert(g, o, alongX, w);
    cur = o.a[1];
  }
  piece(cur, s1, 0, H);
}

function railings(g: THREE.Group, x0: number, x1: number, y0: number, y1: number, zb: number, zt: number, spacing = 0.45) {
  const alongX = x1 - x0 >= y1 - y0;
  const len = alongX ? x1 - x0 : y1 - y0;
  const n = Math.max(2, Math.floor(len / spacing));
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, zt - zb, 0.07), M.metal, n + 1);
  const mtx = new THREE.Matrix4();
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    mtx.makeTranslation(alongX ? x0 + (x1 - x0) * t : (x0 + x1) / 2, (zb + zt) / 2, -(alongX ? (y0 + y1) / 2 : y0 + (y1 - y0) * t));
    inst.setMatrixAt(k, mtx);
  }
  inst.castShadow = true;
  g.add(inst);
  g.add(alongX ? box(x0, x1, (y0 + y1) / 2 - 0.08, (y0 + y1) / 2 + 0.08, zt - 0.1, zt, M.metal) : box((x0 + x1) / 2 - 0.08, (x0 + x1) / 2 + 0.08, y0, y1, zt - 0.1, zt, M.metal));
}

/** Dog-leg stair along y or x: flight 1 rises from the start end, flight 2 returns over the landing to the floor above. */
function stair(g: THREE.Group, d: DogLeg) {
  const half = STAIR_RISERS / 2, zl = half * STAIR_RISE, T = STAIR_TREAD;
  const alongY = d.spec.axis === "y";
  const bx = (c: [number, number], a0: number, a1: number, z0: number, z1: number) => (alongY ? box(c[0], c[1], a0, a1, z0, z1, M.coping) : box(a0, a1, c[0], c[1], z0, z1, M.coping));
  for (let i = 0; i < half - 1; i++) {
    g.add(bx(d.flight1, d.start + d.dir * i * T, d.start + d.dir * (i + 1) * T, d.spec.outside ? (i + 1) * STAIR_RISE - 0.75 : 0, (i + 1) * STAIR_RISE));
    const top = zl + (i + 1) * STAIR_RISE;
    g.add(bx(d.flight2, d.turn - d.dir * (i + 1) * T, d.turn - d.dir * i * T, top - 0.75, top));
  }
  const across: [number, number] = alongY ? [d.spec.x0, d.spec.x1] : [d.spec.y0, d.spec.y1];
  g.add(bx(across, d.landing[0], d.landing[1], zl - 0.5, zl));
  // sloped waist slab under each flight, so the flights read as concrete, not floating treads
  const run = (half - 1) * T, rise = (half - 1) * STAIR_RISE, len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
  for (const [c, a0, z0, dir] of [[d.flight1, d.start, 0, d.dir], [d.flight2, d.turn, zl, -d.dir]] as const) {
    const w = c[1] - c[0];
    const slab = new THREE.Mesh(new THREE.BoxGeometry(alongY ? w : len, 0.45, alongY ? len : w), M.coping);
    const am = a0 + (dir * run) / 2, cm = (c[0] + c[1]) / 2, zm = z0 + rise / 2 - 0.45;
    slab.position.set(alongY ? cm : am, zm, -(alongY ? am : cm));
    // tilt about the cross axis so the slab rises along the flight
    if (alongY) slab.rotation.x = dir * ang; else slab.rotation.z = dir * ang;
    slab.castShadow = true;
    g.add(slab);
  }
  // handrails: inner edges of both flights, plus the outer edges when the stair stands in the open
  const inner1 = d.flight1[0] < d.flight2[0] ? d.flight1[1] - 0.1 : d.flight1[0] + 0.1;
  const inner2 = d.flight1[0] < d.flight2[0] ? d.flight2[0] + 0.1 : d.flight2[1] - 0.1;
  const P = (c: number, a: number, z: number) => (alongY ? v3(c, a, z) : v3(a, c, z));
  const rails: [number, number, number, number, number][] = [[inner1, d.start, 0, d.turn, zl], [inner2, d.turn, zl, d.start, FLOOR]];
  if (d.spec.outside) {
    const outer1 = d.flight1[0] < d.flight2[0] ? d.flight1[0] + 0.1 : d.flight1[1] - 0.1;
    const outer2 = d.flight1[0] < d.flight2[0] ? d.flight2[1] - 0.1 : d.flight2[0] + 0.1;
    rails.push([outer1, d.start, 0, d.turn, zl], [outer2, d.turn, zl, d.start, FLOOR]);
    const far = d.dir > 0 ? d.landing[1] : d.landing[0];
    for (const c of [across[0] + 0.5, across[1] - 0.5]) {
      const a = far - d.dir * 0.5;
      g.add(alongY ? box(c - 0.5, c + 0.5, a - 0.5, a + 0.5, -PLINTH, zl - 0.5, M.column) : box(a - 0.5, a + 0.5, c - 0.5, c + 0.5, -PLINTH, zl - 0.5, M.column));
    }
  }
  for (const [c, a0, z0, a1, z1] of rails) {
    g.add(rod(P(c, a0, z0 + 3), P(c, a1, z1 + 3), 0.05, M.rail));
    for (let k = 0; k <= 4; k++) { const a = a0 + ((a1 - a0) * k) / 4, z = z0 + ((z1 - z0) * k) / 4; g.add(rod(P(c, a, z), P(c, a, z + 3), 0.03, M.rail)); }
  }
}

function tree(g: THREE.Group, x: number, y: number, h: number, r: number) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, h * 0.5, 8), M.trunk);
  trunk.position.set(x, -PLINTH + h * 0.25, -y);
  trunk.castShadow = true;
  g.add(trunk);
  for (const [dx, dy, dz, rr] of [[0, 0, 0.62, 1], [0.45, 0.2, 0.5, 0.75], [-0.4, -0.25, 0.52, 0.8]]) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r * rr, 1), M.leaf);
    f.position.set(x + dx * r, -PLINTH + h * dz + r * 0.3, -(y + dy * r));
    f.castShadow = true;
    g.add(f);
  }
}

function label(text: string, x: number, y: number, z: number) {
  const div = document.createElement("div");
  div.className = "room-label";
  div.innerHTML = `<b>${text}</b>`;
  const o = new CSS2DObject(div);
  o.position.set(x, z, -y);
  return o;
}

function furnish(g: THREE.Group, m: Model) {
  const fmat: Record<string, THREE.Material> = {
    bed: M.bed, pillow: M.furn, furn: M.furn, wardrobe: M.wardrobe, table: M.table, sofa: M.sofa, counter: M.counter, fix: M.fix,
  };
  for (const f of m.furniture) {
    if (f.t === "rect" && fmat[f.k]) g.add(box(f.r.x0, f.r.x1, f.r.y0, f.r.y1, f.k === "pillow" ? 1.7 : 0, f.h, fmat[f.k]));
    else if (f.t === "ellipse" && (f.k === "fix" || f.k === "plant")) {
      const plant = f.k === "plant", hgt = plant ? f.h : f.h > 2 ? 0.12 : Math.max(f.h, 0.05);
      const c = new THREE.Mesh(plant ? new THREE.IcosahedronGeometry(1, 1) : new THREE.CylinderGeometry(1, 1, hgt, 20), plant ? M.plant : f.h > 2 ? M.metal : M.fix);
      c.scale.set(f.rx, plant ? f.h / 2 : 1, f.ry);
      c.position.set(f.cx, plant ? f.h / 2 : f.h > 2 ? f.h + 0.02 : hgt / 2, -f.cy);
      g.add(c);
    }
  }
}

// ---------------------------------------------------------------- scene
export interface HouseLayers {
  site: THREE.Group; house: THREE.Group; roof: THREE.Group; furniture: THREE.Group; ghost: THREE.Group; labels: THREE.Group;
  /** phase 2, split per layer so the usual toggles still apply */
  p2House: THREE.Group; p2Roof: THREE.Group; p2Furniture: THREE.Group; p2Labels: THREE.Group;
  /** phase-1 parapets that only stand while phase 2 is unbuilt */
  p1Only: THREE.Group;
}

export function buildHouse(): HouseLayers {
  const Ls: HouseLayers = {
    site: new THREE.Group(), house: new THREE.Group(), roof: new THREE.Group(), furniture: new THREE.Group(), ghost: new THREE.Group(), labels: new THREE.Group(),
    p2House: new THREE.Group(), p2Roof: new THREE.Group(), p2Furniture: new THREE.Group(), p2Labels: new THREE.Group(), p1Only: new THREE.Group(),
  };
  const { site, house, roof, furniture, ghost, labels } = Ls;
  const g0 = -PLINTH;
  const cx = (BBOX.x0 + BBOX.x1) / 2, cy = (BBOX.y0 + BBOX.y1) / 2;

  // ---- site: neighbours, plot, road on its side, compound walls with a gate, path, parking, trees
  const big = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M.neighbour);
  big.rotation.x = -Math.PI / 2;
  big.position.set(cx, g0 - 0.06, -cy);
  big.receiveShadow = true;
  site.add(big);
  site.add(box(PLOT.x0, PLOT.x1, PLOT.y0, PLOT.y1, g0 - 0.05, g0 - 0.01, M.grass, false));
  const rd = SITE.road, rw = rd.width, gap = 0.75;
  if (rd.side === "N") site.add(box(PLOT.x0 - 120, PLOT.x1 + 120, PLOT.y1 + gap, PLOT.y1 + gap + rw, g0 - 0.04, g0 + 0.02, M.road, false));
  if (rd.side === "S") site.add(box(PLOT.x0 - 120, PLOT.x1 + 120, PLOT.y0 - gap - rw, PLOT.y0 - gap, g0 - 0.04, g0 + 0.02, M.road, false));
  if (rd.side === "E") site.add(box(PLOT.x1 + gap, PLOT.x1 + gap + rw, PLOT.y0 - 120, PLOT.y1 + 120, g0 - 0.04, g0 + 0.02, M.road, false));
  if (rd.side === "W") site.add(box(PLOT.x0 - gap - rw, PLOT.x0 - gap, PLOT.y0 - 120, PLOT.y1 + 120, g0 - 0.04, g0 + 0.02, M.road, false));
  const p = SITE.path;
  site.add(box(p.x0, p.x1, p.y0, p.y1, g0 - 0.02, g0 + 0.05, M.path, false));
  if (SITE.parking) { const k = SITE.parking; site.add(box(k.x0, k.x1, k.y0, k.y1, g0 - 0.02, g0 + 0.04, M.path, false)); }
  if (SITE.septic) { const k = SITE.septic; site.add(box(k.x0, k.x1, k.y0, k.y1, g0, g0 + 0.4, M.coping)); }
  const bw = (x0: number, x1: number, y0: number, y1: number) => site.add(box(x0, x1, y0, y1, g0, g0 + 5, M.boundary));
  const t = 0.75, [ga, gb] = SITE.gate;
  const side = (s: typeof rd.side, a0: number, a1: number) => {
    if (s === "N") bw(a0, a1, PLOT.y1, PLOT.y1 + t); else if (s === "S") bw(a0, a1, PLOT.y0 - t, PLOT.y0);
    else if (s === "E") bw(PLOT.x1, PLOT.x1 + t, a0, a1); else bw(PLOT.x0 - t, PLOT.x0, a0, a1);
  };
  for (const s of ["N", "S", "E", "W"] as const) {
    const [a0, a1] = s === "N" || s === "S" ? [PLOT.x0 - t, PLOT.x1 + t] : [PLOT.y0, PLOT.y1];
    if (s === rd.side) { side(s, a0, ga); side(s, gb, a1); } else side(s, a0, a1);
  }
  for (const [x, y, r] of SITE.trees) tree(site, x, y, 4.5 * r + 4, r);
  for (const [x, y] of [[PLOT.x0 - 14, cy], [PLOT.x1 + 14, cy - 10], [cx, PLOT.y0 - 14]] as const) tree(site, x, y, 18, 5);

  // ---- per phase: plinth, floors, walls, columns, furniture
  for (const [ph, m, gHouse, gFurn] of [[1, MODEL_P1, house, furniture], [2, MODEL_P2, Ls.p2House, Ls.p2Furniture]] as const) {
    if (!m) continue;
    for (const { r } of HOUSE.roofs.filter((r) => r.phase === ph && !r.slabOnly)) {
      // the plinth stops short of the courts, whose paving sits 6″ lower
      for (const q of rectMinus(r, HOUSE.courts)) gHouse.add(box(q.x0, q.x1, q.y0, q.y1, g0, -0.06, M.stone));
      for (const c of HOUSE.courts) if (ph === 1) gHouse.add(box(c.x0, c.x1, c.y0, c.y1, g0, -0.56, M.stone));
    }
    for (const f of m.floors) gHouse.add(box(f.x0, f.x1, f.y0, f.y1, f.kind === "court" ? -0.56 : -0.06, f.kind === "court" ? -0.5 : 0, FLOOR_MAT[f.kind], false));
    for (const w of m.walls) buildWall(gHouse, w, MODEL.openings);
    for (const c of COLUMNS.filter((c) => c.phase2 === (ph === 2))) gHouse.add(box(c.x - 0.5, c.x + 0.5, c.y - 0.5, c.y + 0.5, 0, H, M.column));
    furnish(gFurn, m);
    for (const lb of m.labels) if (lb.room) (ph === 1 ? labels : Ls.p2Labels).add(label(lb.lines[0][0], lb.x, lb.y, 4.5));
  }
  for (const pr of HOUSE.porches) house.add(box(pr.x0, pr.x1, pr.y0, pr.y1, g0, 0, M.coping));
  for (const st of HOUSE.steps) {
    // treads step down from the porch (z 0) toward `down`; the last riser lands on the ground
    const n = Math.round(PLINTH / STEP_RISE) - 1;
    for (let k = 0; k < n; k++) {
      const f = k / n, g = (k + 1) / n, r = st.r;
      const [x0, x1, y0, y1] = st.down === "N" ? [r.x0, r.x1, r.y0 + f * (r.y1 - r.y0), r.y0 + g * (r.y1 - r.y0)]
        : st.down === "S" ? [r.x0, r.x1, r.y1 - g * (r.y1 - r.y0), r.y1 - f * (r.y1 - r.y0)]
        : st.down === "E" ? [r.x0 + f * (r.x1 - r.x0), r.x0 + g * (r.x1 - r.x0), r.y0, r.y1] : [r.x1 - g * (r.x1 - r.x0), r.x1 - f * (r.x1 - r.x0), r.y0, r.y1];
      house.add(box(x0, x1, y0, y1, g0, -(k + 1) * STEP_RISE, M.coping));
    }
  }
  for (const c of HOUSE.canopies) house.add(box(c.x0, c.x1, c.y0, c.y1, LINTEL + 1.75, LINTEL + 2.2, M.coping));
  for (const d of STAIRS) stair(house, d);
  const ctr = (r: Rect): [number, number] => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
  for (const d of STAIRS) labels.add(label("STAIR", ...ctr(d.well), 8));

  // ---- roofs: slabs minus courts and stair wells, parapets on outer edges, court railings, tank
  for (const { r, phase } of HOUSE.roofs) {
    for (const q of rectMinus(r, [...HOUSE.courts, ...STAIR_WELLS])) (phase === 1 ? roof : Ls.p2Roof).add(box(q.x0, q.x1, q.y0, q.y1, H, FLOOR, M.slab));
  }
  for (const s of roofEdges()) {
    const pt = 0.375, alongX = s.y0 === s.y1;
    const inward = (alongX ? HOUSE.roofs.some(({ r }) => Math.abs(r.y0 - s.y0) < 0.05 && r.x0 <= s.x0 + 0.05 && r.x1 >= s.x1 - 0.05) : HOUSE.roofs.some(({ r }) => Math.abs(r.x0 - s.x0) < 0.05 && r.y0 <= s.y0 + 0.05 && r.y1 >= s.y1 - 0.05)) ? 1 : -1;
    const [a, b] = inward > 0 ? [0, pt] : [-pt, 0];
    const target = s.dependsOn2 ? Ls.p1Only : s.phase === 2 ? Ls.p2Roof : roof;
    target.add(alongX ? box(s.x0, s.x1, s.y0 + a, s.y0 + b, FLOOR, FLOOR + PARAPET - 0.2, M.plaster) : box(s.x0 + a, s.x0 + b, s.y0, s.y1, FLOOR, FLOOR + PARAPET - 0.2, M.plaster));
    target.add(alongX ? box(s.x0 - 0.08, s.x1 + 0.08, s.y0 + a - 0.08, s.y0 + b + 0.08, FLOOR + PARAPET - 0.2, FLOOR + PARAPET, M.coping)
      : box(s.x0 + a - 0.08, s.x0 + b + 0.08, s.y0 - 0.08, s.y1 + 0.08, FLOOR + PARAPET - 0.2, FLOOR + PARAPET, M.coping));
  }
  for (const c of HOUSE.courts) {
    railings(roof, c.x0, c.x1, c.y0 - 0.15, c.y0 - 0.05, FLOOR, FLOOR + PARAPET);
    railings(roof, c.x0, c.x1, c.y1 + 0.05, c.y1 + 0.15, FLOOR, FLOOR + PARAPET);
    railings(roof, c.x0 - 0.15, c.x0 - 0.05, c.y0, c.y1, FLOOR, FLOOR + PARAPET);
    railings(roof, c.x1 + 0.05, c.x1 + 0.15, c.y0, c.y1, FLOOR, FLOOR + PARAPET);
  }
  if (HOUSE.tank) {
    const k = HOUSE.tank;
    roof.add(box(k.x0 + 0.3, k.x1 - 0.3, k.y0 + 0.3, k.y1 - 0.3, FLOOR, FLOOR + 3, M.metal));
    const tank = new THREE.Mesh(new THREE.CylinderGeometry((k.x1 - k.x0) / 2, (k.x1 - k.x0) / 2, 4, 28), M.tank);
    tank.position.set((k.x0 + k.x1) / 2, FLOOR + 5, -(k.y0 + k.y1) / 2);
    tank.castShadow = true;
    roof.add(tank);
  }

  // ---- ghost future floors over every built roof
  const top = FLOORS_TOTAL * FLOOR + PARAPET;
  for (const { r } of HOUSE.roofs.filter((r) => !r.slabOnly)) {
    ghost.add(box(r.x0, r.x1, r.y0, r.y1, FLOOR + 0.02, top, M.ghost, false));
    for (let k = 1; k < FLOORS_TOTAL; k++) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(r.x1 - r.x0, FLOOR, r.y1 - r.y0)), M.ghostLine);
      e.position.set((r.x0 + r.x1) / 2, k * FLOOR + FLOOR / 2, -(r.y0 + r.y1) / 2);
      e.computeLineDistances();
      ghost.add(e);
    }
  }
  return Ls;
}

// ---------------------------------------------------------------- navigation data for walk mode
const PASSABLE = new Set(["door", "open", "slide"]);
const T_B = 0.75;

/** Solid footprints a walker bumps into: walls minus doorways, columns, stairs, compound walls. */
export function navBlocks(phase2: boolean): Rect[] {
  const out: Rect[] = [];
  const walls = phase2 ? MODEL.walls : MODEL_P1.walls;
  for (const w of walls) {
    const alongX = w.x1 - w.x0 >= w.y1 - w.y0;
    const gaps = w.kind === "low" ? [] : wallOpenings(w, alongX, MODEL.openings).filter((o) => PASSABLE.has(o.kind));
    let cur = alongX ? w.x0 : w.y0;
    const end = alongX ? w.x1 : w.y1;
    for (const o of gaps) {
      if (o.a[0] > cur) out.push(alongX ? { x0: cur, x1: o.a[0], y0: w.y0, y1: w.y1 } : { x0: w.x0, x1: w.x1, y0: cur, y1: o.a[0] });
      cur = Math.max(cur, o.a[1]);
    }
    if (end > cur) out.push(alongX ? { x0: cur, x1: end, y0: w.y0, y1: w.y1 } : { x0: w.x0, x1: w.x1, y0: cur, y1: end });
  }
  for (const c of COLUMNS) if (phase2 || !c.phase2) out.push({ x0: c.x - 0.5, x1: c.x + 0.5, y0: c.y - 0.5, y1: c.y + 0.5 });
  for (const d of STAIRS) out.push(d.well);
  const P = PLOT;
  out.push({ x0: P.x0 - 1, x1: P.x1 + 1, y0: P.y1, y1: P.y1 + T_B }, { x0: P.x0 - 1, x1: P.x1 + 1, y0: P.y0 - T_B, y1: P.y0 },
    { x0: P.x0 - T_B, x1: P.x0, y0: P.y0, y1: P.y1 }, { x0: P.x1, x1: P.x1 + T_B, y0: P.y0, y1: P.y1 });
  return out;
}

/** Blocks on the terrace: parapets, court edges, the tank. */
export function navBlocksRoof(): Rect[] {
  const out: Rect[] = roofEdges().filter((s) => !s.dependsOn2).map((s) => ({ x0: s.x0 - 0.3, x1: s.x1 + 0.3, y0: s.y0 - 0.3, y1: s.y1 + 0.3 }));
  for (const c of HOUSE.courts) out.push({ x0: c.x0 - 0.2, x1: c.x1 + 0.2, y0: c.y0 - 0.2, y1: c.y1 + 0.2 });
  if (HOUSE.tank) out.push(HOUSE.tank);
  return out;
}

const roofed = (x: number, y: number) => HOUSE.roofs.some(({ r }) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
/** Floor level under a plan point: the plinth / porch (0), the ground (−plinth), or the terrace (level 1). */
export function floorAt(x: number, y: number, level = 0) {
  if (level === 1) return FLOOR;
  return roofed(x, y) || HOUSE.porches.some((p) => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) ? 0 : -PLINTH;
}

/** Named spots for "Go to": rooms from the model labels plus the design's extra places. */
export interface Place { name: string; at: [number, number]; look: [number, number]; level?: number }
export function places(): Place[] {
  const list: Place[] = [];
  for (const lb of MODEL.labels) {
    if (!lb.room) continue;
    const room = MODEL.floors.find((f) => f.kind !== "bath" && lb.x >= f.x0 && lb.x <= f.x1 && lb.y >= f.y0 && lb.y <= f.y1);
    if (!room) continue;
    const [cx, cy] = [(room.x0 + room.x1) / 2, (room.y0 + room.y1) / 2];
    // stand near a corner, look across the room
    list.push({ name: lb.lines[0][0].toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), at: [room.x0 + 1.4, room.y0 + 1.4], look: [cx + (cx - room.x0), cy + (cy - room.y0)] });
  }
  list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const [name, at, look] of HOUSE.places) list.push({ name, at, look });
  list.push({ name: "Terrace (walk on roof)", at: [BBOX.x0 + 3, BBOX.y0 + 3], look: [BBOX.x1, BBOX.y1], level: 1 });
  return list;
}
