/**
 * Everything derived from the design: merged models, heights, stairs, roof edges, areas and self-checks.
 * Views import from here, never from `design/` directly, so swapping the design is one line.
 */
import { HOUSE } from "./design/house";
import { OPTIONS } from "./design/options";
import { EXT, INT } from "./kit/builder";
import type { Design, Model, Rect, StairSpec } from "./types";

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

/** A dog-leg resolved into flights: flight 1 runs start → turn (z 0 → half), flight 2 runs turn → start (half → FLOOR). */
export interface DogLeg {
  spec: StairSpec;
  fw: number;
  start: number; turn: number; dir: 1 | -1;
  landing: [number, number]; flights: [number, number];
  /** plan area the slab must leave open: flights + landing (only when the stair is under a roof) */
  well: Rect;
  flight1: [number, number]; flight2: [number, number];
}
export function dogLeg(spec: StairSpec): DogLeg {
  const [a0, a1] = spec.axis === "y" ? [spec.y0, spec.y1] : [spec.x0, spec.x1];
  const [c0, c1] = spec.axis === "y" ? [spec.x0, spec.x1] : [spec.y0, spec.y1];
  const fw = (c1 - c0 - 0.5) / 2;
  const dir = spec.startHigh ? -1 : 1;
  const landing: [number, number] = spec.startHigh ? [a0, a0 + fw] : [a1 - fw, a1];
  const turn = spec.startHigh ? landing[1] : landing[0];
  const start = turn - dir * FLIGHT_STEPS * STAIR_TREAD;
  const flights: [number, number] = [Math.min(start, turn), Math.max(start, turn)];
  const lo = Math.min(flights[0], landing[0]), hi = Math.max(flights[1], landing[1]);
  const well: Rect = spec.axis === "y" ? { x0: c0, x1: c1, y0: lo, y1: hi } : { x0: lo, x1: hi, y0: c0, y1: c1 };
  const hiSide: [number, number] = [c1 - fw, c1], loSide: [number, number] = [c0, c0 + fw];
  return { spec, fw, start, turn, dir, landing, flights, well, flight1: spec.firstLow ? loSide : hiSide, flight2: spec.firstLow ? hiSide : loSide };
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
  for (const d of STAIRS) {
    if (d.fw < 3) errs.push(`stair flights ${d.fw.toFixed(2)}′ wide (< 3′)`);
  }
  for (const o of MODEL.openings) if (!HOUSE.schedule[o.tag]) errs.push(`opening tag ${o.tag} has no schedule entry`);
  const p = PLOT;
  if (BBOX.x0 < p.x0 || BBOX.x1 > p.x1 || BBOX.y0 < p.y0 || BBOX.y1 > p.y1) errs.push("house crosses the plot boundary");
  for (const d of STAIRS) if (d.well.x0 < p.x0 || d.well.x1 > p.x1 || d.well.y0 < p.y0 || d.well.y1 > p.y1) errs.push("a stair crosses the plot boundary");
  return errs;
}

export const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export const sq = (v: number) => Math.round(v).toLocaleString("en-IN");
