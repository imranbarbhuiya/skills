/**
 * Everything derived from the design: merged models, heights, stairs, roof edges, areas and self-checks.
 * Views import from here, never from `design/` directly, so swapping the design is one line.
 */
import { HOUSE } from "./design/house";
import { OPTIONS } from "./design/options";
import { EXT, INT } from "./kit/builder";
import type { Design, Face, Model, Opening, Rect, StairSpec, Wall } from "./types";

export { EXT, INT, HOUSE, OPTIONS };
export type { Design };

const merge = (a: Model, b?: Model): Model => b
  ? { floors: [...a.floors, ...b.floors], walls: [...a.walls, ...b.walls], openings: [...a.openings, ...b.openings], furniture: [...a.furniture, ...b.furniture], labels: [...a.labels, ...b.labels] }
  : a;

/** phase 1 (built now) and the finished house */
export const MODEL_P1: Model = HOUSE.m;
export const MODEL_P2: Model | undefined = HOUSE.phase2?.m;
export const MODEL: Model = merge(MODEL_P1, MODEL_P2);

export const H = HOUSE.heights;
export const { plinth: PLINTH, floor: FLOOR, slab: SLAB, beam: BEAM, parapet: PARAPET, lintel: LINTEL, chajja: CHAJJA, floorsTotal: FLOORS_TOTAL } = H;
export const GX = HOUSE.grid.x, GY = HOUSE.grid.y;

/** bounding box of every roof (phase 1 + 2): the house's overall extent */
export const BBOX: Rect = HOUSE.roofs.filter((r) => !r.slabOnly).reduce((a, { r }) => ({ x0: Math.min(a.x0, r.x0), y0: Math.min(a.y0, r.y0), x1: Math.max(a.x1, r.x1), y1: Math.max(a.y1, r.y1) }),
  { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
export const SITE = HOUSE.site;
export const PLOT = SITE.plot;

/** columns stand at every grid intersection inside a built roof; phase2 = only under the phase-2 roof */
const BUILT = HOUSE.roofs.filter((r) => !r.slabOnly);
const near = (x: number, y: number, r: Rect, m = 0.6) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m;
export const COLUMNS: { x: number; y: number; i: number; j: number; phase2: boolean }[] = GX.flatMap((x, i) => GY.flatMap((y, j) =>
  BUILT.some(({ r }) => near(x, y, r)) ? [{ x, y, i, j, phase2: !BUILT.some(({ r, phase }) => phase === 1 && near(x, y, r)) }] : []));

// ---------------------------------------------------------------- stairs
export const STAIR_RISERS = 18;
export const STAIR_RISE = FLOOR / STAIR_RISERS;
export const STAIR_TREAD = 10 / 12;
export const FLIGHT_STEPS = STAIR_RISERS / 2 - 1;

/** One walkable piece of a stair: its plan rect, its top (z) and the bottom of its concrete (base). */
export interface Tread { r: Rect; z: number; base: number; part: "flight1" | "landing" | "flight2" }

/** A dog-leg resolved into flights: flight 1 runs start → turn (z 0 → half), flight 2 runs turn → start (half → FLOOR). */
export interface DogLeg {
  spec: StairSpec;
  fw: number;
  start: number; turn: number; dir: 1 | -1;
  landing: [number, number]; flights: [number, number];
  /** plan area the slab must leave open: flights + landing (only when the stair is under a roof) */
  well: Rect;
  flight1: [number, number]; flight2: [number, number];
  /** the 0.5′ gap between the two flights, along their length */
  gap: Rect;
  /** every tread and the landing, bottom to top: the 3D model draws them and walk mode stands on them */
  treads: Tread[];
  /** columns under the landing of an outside stair */
  posts: Rect[];
}
export function dogLeg(spec: StairSpec): DogLeg {
  const alongY = spec.axis === "y";
  const [a0, a1] = alongY ? [spec.y0, spec.y1] : [spec.x0, spec.x1];
  const [c0, c1] = alongY ? [spec.x0, spec.x1] : [spec.y0, spec.y1];
  const fw = (c1 - c0 - 0.5) / 2;
  const dir = spec.startHigh ? -1 : 1;
  const landing: [number, number] = spec.startHigh ? [a0, a0 + fw] : [a1 - fw, a1];
  const turn = spec.startHigh ? landing[1] : landing[0];
  const start = turn - dir * FLIGHT_STEPS * STAIR_TREAD;
  const flights: [number, number] = [Math.min(start, turn), Math.max(start, turn)];
  const lo = Math.min(flights[0], landing[0]), hi = Math.max(flights[1], landing[1]);
  /** plan rect from a span across the flights and a span along them */
  const rect = ([p, q]: [number, number], u: number, v: number): Rect => {
    const [s0, s1] = [Math.min(u, v), Math.max(u, v)];
    return alongY ? { x0: p, x1: q, y0: s0, y1: s1 } : { x0: s0, x1: s1, y0: p, y1: q };
  };
  const well = rect([c0, c1], lo, hi);
  const hiSide: [number, number] = [c1 - fw, c1], loSide: [number, number] = [c0, c0 + fw];
  const flight1 = spec.firstLow ? loSide : hiSide, flight2 = spec.firstLow ? hiSide : loSide;
  // tread i of flight 1 is the (i + 1)th riser up from the start; flight 2 climbs from the landing back to the start
  // end, where its last riser reaches the floor above. Inside, flight 1 is solid down to the floor.
  const zl = (STAIR_RISERS / 2) * STAIR_RISE, T = STAIR_TREAD;
  const treads: Tread[] = [];
  for (let i = 0; i < FLIGHT_STEPS; i++) {
    const z = (i + 1) * STAIR_RISE;
    treads.push({ r: rect(flight1, start + dir * i * T, start + dir * (i + 1) * T), z, base: spec.outside ? z - 0.75 : 0, part: "flight1" });
  }
  treads.push({ r: rect([c0, c1], landing[0], landing[1]), z: zl, base: zl - 0.5, part: "landing" });
  for (let i = 0; i < FLIGHT_STEPS; i++) {
    const z = zl + (i + 1) * STAIR_RISE;
    treads.push({ r: rect(flight2, turn - dir * (i + 1) * T, turn - dir * i * T), z, base: z - 0.75, part: "flight2" });
  }
  const far = dir > 0 ? landing[1] : landing[0], postAt = far - dir * 0.5;
  const posts = spec.outside ? [c0 + 0.5, c1 - 0.5].map((c) => rect([c - 0.5, c + 0.5], postAt - 0.5, postAt + 0.5)) : [];
  const gap = rect([Math.min(flight1[1], flight2[1]), Math.max(flight1[0], flight2[0])], flights[0], flights[1]);
  return { spec, fw, start, turn, dir, landing, flights, well, flight1, flight2, gap, treads, posts };
}
export const STAIRS = HOUSE.stairs.map(dogLeg);
/** slab openings for stairs that sit under a roof */
export const STAIR_WELLS = STAIRS.filter((d) => !d.spec.outside).map((d) => d.well);

// ---------------------------------------------------------------- roof edges (parapets)
export interface Seg { x0: number; y0: number; x1: number; y1: number; phase: 1 | 2; dependsOn2: boolean }
const EPS = 0.02;
/** subtract intervals from [a, b] */
function minus(a: number, b: number, cuts: [number, number][]): [number, number][] {
  let out: [number, number][] = [[a, b]];
  for (const [c0, c1] of cuts) out = out.flatMap(([p, q]) => (c1 <= p || c0 >= q ? [[p, q]] : [...(c0 > p ? [[p, c0]] : []), ...(c1 < q ? [[c1, q]] : [])]) as [number, number][]);
  return out.filter(([p, q]) => q - p > 0.05);
}
/**
 * Outer edges of the roofs, for parapets. A phase-1 edge shared with a phase-2 roof is marked dependsOn2: it needs a
 * parapet only while phase 2 is unbuilt. Edges listed in `openEdges` get none.
 */
export function roofEdges(): Seg[] {
  const out: Seg[] = [];
  const open = HOUSE.openEdges ?? [];
  for (const { r, phase } of HOUSE.roofs) {
    const sides: { along: "x" | "y"; at: number; span: [number, number] }[] = [
      { along: "x", at: r.y0, span: [r.x0, r.x1] }, { along: "x", at: r.y1, span: [r.x0, r.x1] },
      { along: "y", at: r.x0, span: [r.y0, r.y1] }, { along: "y", at: r.x1, span: [r.y0, r.y1] },
    ];
    for (const s of sides) {
      const shared = (ph: 1 | 2) => HOUSE.roofs.filter((o) => o.r !== r && o.phase === ph).flatMap(({ r: o }) => {
        const onLine = s.along === "x" ? (Math.abs(o.y0 - s.at) < EPS || Math.abs(o.y1 - s.at) < EPS) : (Math.abs(o.x0 - s.at) < EPS || Math.abs(o.x1 - s.at) < EPS);
        return onLine ? [(s.along === "x" ? [o.x0, o.x1] : [o.y0, o.y1]) as [number, number]] : [];
      });
      const openHere = open.filter((e) => (s.along === "x" ? e.y0 - EPS <= s.at && e.y1 + EPS >= s.at : e.x0 - EPS <= s.at && e.x1 + EPS >= s.at))
        .map((e) => (s.along === "x" ? [e.x0, e.x1] : [e.y0, e.y1]) as [number, number]);
      const free = minus(s.span[0], s.span[1], [...shared(1), ...openHere]);
      const seg = (p: number, q: number, dependsOn2: boolean): Seg => (s.along === "x"
        ? { x0: p, x1: q, y0: s.at, y1: s.at, phase, dependsOn2 } : { x0: s.at, x1: s.at, y0: p, y1: q, phase, dependsOn2 });
      for (const [p, q] of free) {
        if (phase === 2) { for (const [m, n] of minus(p, q, shared(1))) out.push(seg(m, n, false)); continue; }
        const p2 = shared(2);
        for (const [m, n] of minus(p, q, p2)) out.push(seg(m, n, false));
        for (const [c0, c1] of p2) { const m = Math.max(p, c0), n = Math.min(q, c1); if (n - m > 0.05) out.push(seg(m, n, true)); }
      }
    }
  }
  return out;
}

const PARAPET_T = 0.375;
/** The parapet's footprint on a roof edge: 4½″ thick, on the roof side of the edge. */
export function parapetRect(s: Seg): Rect {
  const alongX = s.y0 === s.y1, m = 0.05;
  const inward = HOUSE.roofs.some(({ r }) => alongX
    ? Math.abs(r.y0 - s.y0) < m && r.x0 <= s.x0 + m && r.x1 >= s.x1 - m
    : Math.abs(r.x0 - s.x0) < m && r.y0 <= s.y0 + m && r.y1 >= s.y1 - m);
  const [a, b] = inward ? [0, PARAPET_T] : [-PARAPET_T, 0];
  return alongX ? { x0: s.x0, x1: s.x1, y0: s.y0 + a, y1: s.y0 + b } : { x0: s.x0 + a, x1: s.x0 + b, y0: s.y0, y1: s.y1 };
}

// ---------------------------------------------------------------- walls, site and outer steps
/** Openings that sit inside wall `w` (running along x when `alongX`), sorted along it. */
export function wallOpenings(w: Wall, alongX: boolean, openings: Opening[]): Opening[] {
  const tol = 0.02;
  return openings.filter((o) => {
    if ((o.axis === "x") !== alongX) return false;
    const [t0, t1] = alongX ? [w.y0, w.y1] : [w.x0, w.x1];
    const [a0, a1] = alongX ? [w.x0, w.x1] : [w.y0, w.y1];
    const overlap = Math.min(t1, o.w[1]) - Math.max(t0, o.w[0]);
    return overlap > (t1 - t0) * 0.5 - tol && o.a[0] >= a0 - tol && o.a[1] <= a1 + tol;
  }).sort((p, q) => p.a[0] - q.a[0]);
}

/** Compound walls round the plot, 9″ thick, with the gate left open on the road side. */
export const COMPOUND: Rect[] = (() => {
  const P = PLOT, t = 0.75, side = SITE.road.side, [ga, gb] = SITE.gate;
  const out: Rect[] = [];
  const wall = (s: Face, a0: number, a1: number) => out.push(
    s === "N" ? { x0: a0, x1: a1, y0: P.y1, y1: P.y1 + t } : s === "S" ? { x0: a0, x1: a1, y0: P.y0 - t, y1: P.y0 }
      : s === "E" ? { x0: P.x1, x1: P.x1 + t, y0: a0, y1: a1 } : { x0: P.x0 - t, x1: P.x0, y0: a0, y1: a1 });
  for (const s of ["N", "S", "E", "W"] as const) {
    const [a0, a1] = s === "N" || s === "S" ? [P.x0 - t, P.x1 + t] : [P.y0, P.y1];
    if (s === side) { wall(s, a0, ga); wall(s, gb, a1); } else wall(s, a0, a1);
  }
  return out;
})();

/** Outer steps from the porch (z 0) down to the ground, about 6½″ risers: each tread's rect and top. */
export const STEP_RISE = PLINTH / Math.max(1, Math.round(PLINTH / 0.55));
export const STEP_TREADS: { r: Rect; z: number }[] = HOUSE.steps.flatMap(({ r, down }) => {
  const n = Math.round(PLINTH / STEP_RISE) - 1;
  return Array.from({ length: n }, (_, k) => {
    const f = k / n, g = (k + 1) / n;
    const [x0, x1, y0, y1] = down === "N" ? [r.x0, r.x1, r.y0 + f * (r.y1 - r.y0), r.y0 + g * (r.y1 - r.y0)]
      : down === "S" ? [r.x0, r.x1, r.y1 - g * (r.y1 - r.y0), r.y1 - f * (r.y1 - r.y0)]
      : down === "E" ? [r.x0 + f * (r.x1 - r.x0), r.x0 + g * (r.x1 - r.x0), r.y0, r.y1] : [r.x1 - g * (r.x1 - r.x0), r.x1 - f * (r.x1 - r.x0), r.y0, r.y1];
    return { r: { x0, x1, y0, y1 }, z: -(k + 1) * STEP_RISE };
  });
});

/** Courts are paved this far below the floor. */
export const COURT_SINK = 0.5;

// ---------------------------------------------------------------- areas and checks
const area = (r: Rect) => (r.x1 - r.x0) * (r.y1 - r.y0);
/** built (roofed) area per phase; courts and slab-only roofs (stair bridges) excluded */
export function designAreas(d: Design) {
  const courts = d.courts.reduce((s, c) => s + area(c), 0);
  const built = (ph: 1 | 2) => d.roofs.filter((r) => r.phase === ph && !r.slabOnly).reduce((s, { r }) => s + area(r), 0);
  const p1 = built(1) - courts, p2 = built(2);
  return { p1, p2, total: p1 + p2, courts, brief: d.project.briefArea };
}
export const AREAS = designAreas(HOUSE);

export function scheduleCounts(m: Model = MODEL) {
  const c: Record<string, number> = {};
  for (const o of m.openings) c[o.tag] = (c[o.tag] ?? 0) + 1;
  return c;
}

/** Cheap geometry checks shown on the Notes tab; add one whenever a design rule bites. */
export function check(): string[] {
  const errs: string[] = [];
  const edges = roofEdges();
  for (const d of STAIRS) {
    if (d.fw < 3) errs.push(`stair flights ${d.fw.toFixed(2)}′ wide (< 3′)`);
    // flight 2 must step off onto a roof, through no parapet (list the edge in openEdges)
    const c = (d.flight2[0] + d.flight2[1]) / 2, a = d.start - d.dir * 0.4;
    const [x, y] = d.spec.axis === "y" ? [c, a] : [a, c];
    if (!HOUSE.roofs.some(({ r }) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) errs.push("a stair's top flight arrives where there is no roof to step onto");
    const step = d.treads[d.treads.length - 1].r, m = 0.1;
    const zone: Rect = d.spec.axis === "y" ? { x0: step.x0 + m, x1: step.x1 - m, y0: Math.min(d.start, a), y1: Math.max(d.start, a) }
      : { x0: Math.min(d.start, a), x1: Math.max(d.start, a), y0: step.y0 + m, y1: step.y1 - m };
    if (edges.some((s) => s.x1 >= zone.x0 && s.x0 <= zone.x1 && s.y1 >= zone.y0 && s.y0 <= zone.y1)) errs.push("a parapet stands where a stair arrives on the roof: add that edge to openEdges");
  }
  for (const o of MODEL.openings) if (!HOUSE.schedule[o.tag]) errs.push(`opening tag ${o.tag} has no schedule entry`);
  const p = PLOT;
  if (BBOX.x0 < p.x0 || BBOX.x1 > p.x1 || BBOX.y0 < p.y0 || BBOX.y1 > p.y1) errs.push("house crosses the plot boundary");
  for (const d of STAIRS) if (d.well.x0 < p.x0 || d.well.x1 > p.x1 || d.well.y0 < p.y0 || d.well.y1 > p.y1) errs.push("a stair crosses the plot boundary");
  return errs;
}

export const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export const sq = (v: number) => Math.round(v).toLocaleString("en-IN");
