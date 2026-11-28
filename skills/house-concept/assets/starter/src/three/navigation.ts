/**
 * Walk mode: the surfaces you can stand on, the boxes you bump into, moving with wall sliding, the room you are in and
 * the "Go to" spots. Everything is derived from `model.ts`, so a new design gets climbable stairs and a walkable
 * terrace without touching this file.
 *
 * Heights are feet above the ground-floor FFL. A walker has a foot height (`footZ`); every move samples the surfaces
 * under the new point and keeps the one nearest the current foot height, if it is within a stair riser or two.
 */
import {
  BBOX, COLUMNS, COMPOUND, COURT_SINK, FLOOR, HOUSE, MODEL, MODEL_P1, MODEL_P2, PARAPET, PLINTH, PLOT, SITE, SLAB, STAIRS,
  STAIR_WELLS, STEP_TREADS, parapetRect, roofEdges, title, wallOpenings,
} from "../model";
import type { Face, FloorArea, Opening, Rect } from "../types";

export const EYE_HEIGHT = 5.25;
/** fits through a 2′-6″ bath door */
export const WALKER_RADIUS = 0.55;
/** the largest height change in one sub-step: two risers, so a stair climbs and a slab edge is a drop */
const MAX_STEP = 1.25;
/** a box blocks you when its top is more than KNEE above your feet and its bottom is below your head */
const KNEE = 1.0;
const HEAD = EYE_HEIGHT + 0.5;
/** how high a railing or a guard reaches above what it guards */
const RAIL = 3.0;
const WALL_TOP = FLOOR - SLAB;
const PAD = 0.05;
const PASSABLE = new Set(["door", "open", "slide"]);

interface NavBox extends Rect { z0: number; z1: number }
export interface WalkState { x: number; y: number; footZ: number; eyeZ: number; yaw: number; pitch: number }
export interface LocationInfo { room: string; level: string; onRoof: boolean }
/** A "Go to" spot. level 1 stands on the roof; phase2 spots are hidden while phase 2 is off. */
export interface Place { name: string; at: [number, number]; look: [number, number]; level?: 0 | 1; phase2?: boolean }

const inR = (x: number, y: number, r: Rect, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;
const roofs = (phase2: boolean) => HOUSE.roofs.filter((r) => phase2 || r.phase === 1);
const builtRoofs = (phase2: boolean) => roofs(phase2).filter((r) => !r.slabOnly);
const floorsOf = (phase2: boolean): FloorArea[] => (phase2 && MODEL_P2 ? [...MODEL_P1.floors, ...MODEL_P2.floors] : MODEL_P1.floors);

// ---------------------------------------------------------------- surfaces
/** The floor you stand on with no stair or roof involved: house floor, sunk court, porch, outer step or the ground. */
function groundAt(x: number, y: number, phase2: boolean): number {
  if (builtRoofs(phase2).some(({ r }) => inR(x, y, r))) return HOUSE.courts.some((c) => inR(x, y, c)) ? -COURT_SINK : 0;
  if (HOUSE.porches.some((p) => inR(x, y, p))) return 0;
  return STEP_TREADS.find((t) => inR(x, y, t.r))?.z ?? -PLINTH;
}

/**
 * Every walkable height at (x, y): stair treads and landings, the floor or ground below them (unless a flight is
 * solid down to it), and the roof slab minus courts and stair openings.
 */
function surfaceCandidates(x: number, y: number, phase2: boolean): number[] {
  const out: number[] = [];
  const ground = groundAt(x, y, phase2);
  let groundOpen = true;
  for (const d of STAIRS) for (const t of d.treads) {
    if (!inR(x, y, t.r, PAD)) continue;
    out.push(t.z);
    if (t.base <= ground + 0.01) groundOpen = false;
  }
  if (groundOpen) out.push(ground);
  if (roofs(phase2).some(({ r }) => inR(x, y, r, PAD)) && !HOUSE.courts.some((c) => inR(x, y, c)) && !STAIR_WELLS.some((w) => inR(x, y, w))) out.push(FLOOR);
  return out;
}

/** The surface at (x, y) reachable from foot height `currentZ`, or null when it is a wall of stair or a drop. */
function pickSurface(x: number, y: number, currentZ: number, phase2: boolean): number | null {
  let best: number | null = null;
  for (const z of surfaceCandidates(x, y, phase2)) {
    // on the ground you may hop the plinth (an outer door without steps); stairs and roof edges stay strict
    const limit = currentZ <= 0.01 && z <= 0.01 ? PLINTH + 0.1 : MAX_STEP;
    if (Math.abs(z - currentZ) <= limit && (best === null || Math.abs(z - currentZ) < Math.abs(best - currentZ))) best = z;
  }
  return best;
}

/** The surface at (x, y) nearest the ground floor, or nearest the roof with `preferRoof`. */
export function floorHeightAt(x: number, y: number, phase2: boolean, preferRoof = false): number {
  const target = preferRoof ? FLOOR : 0;
  const c = surfaceCandidates(x, y, phase2);
  return c.length ? c.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a)) : -PLINTH;
}

// ---------------------------------------------------------------- collision boxes
function buildNavBoxes(phase2: boolean): NavBox[] {
  const out: NavBox[] = [];
  const at = (r: Rect, z0: number, z1: number) => out.push({ ...r, z0, z1 });

  // ground-floor walls with their doors, arches and sliders left open; low walls are knee-to-hip high
  for (const w of phase2 ? MODEL.walls : MODEL_P1.walls) {
    const alongX = w.x1 - w.x0 >= w.y1 - w.y0;
    const z1 = w.kind === "low" ? 1.5 : WALL_TOP;
    const gaps = w.kind === "low" ? [] : wallOpenings(w, alongX, MODEL.openings).filter((o) => PASSABLE.has(o.kind));
    let cur = alongX ? w.x0 : w.y0;
    const piece = (p: number, q: number) => at(alongX ? { x0: p, x1: q, y0: w.y0, y1: w.y1 } : { x0: w.x0, x1: w.x1, y0: p, y1: q }, 0, z1);
    for (const o of gaps) { if (o.a[0] > cur) piece(cur, o.a[0]); cur = Math.max(cur, o.a[1]); }
    if ((alongX ? w.x1 : w.y1) > cur) piece(cur, alongX ? w.x1 : w.y1);
  }
  for (const c of COLUMNS) if (phase2 || !c.phase2) at({ x0: c.x - 0.5, x1: c.x + 0.5, y0: c.y - 0.5, y1: c.y + 0.5 }, 0, WALL_TOP);
  for (const w of COMPOUND) at(w, -PLINTH, -PLINTH + 5);

  // stairs: every tread is solid from its base to its top, so you climb tread by tread and duck under nothing too
  // low; a guard runs up the gap between the flights; outside stairs stand on posts
  for (const d of STAIRS) {
    for (const t of d.treads) at(t.r, t.base, t.z);
    at(d.gap, d.spec.outside ? -PLINTH : 0, FLOOR + RAIL);
    for (const p of d.posts) at(p, -PLINTH, d.treads.find((t) => t.part === "landing")!.base);
  }

  // terrace: parapets (none on open edges), railings round the courts, the tank stand
  for (const s of roofEdges()) if (s.dependsOn2 ? !phase2 : s.phase === 1 || phase2) at(parapetRect(s), FLOOR, FLOOR + PARAPET);
  for (const c of HOUSE.courts) at({ x0: c.x0 - 0.15, x1: c.x1 + 0.15, y0: c.y0 - 0.15, y1: c.y1 + 0.15 }, FLOOR, FLOOR + PARAPET);
  if (HOUSE.tank) at(HOUSE.tank, FLOOR, FLOOR + RAIL);
  return out;
}
const NAV = { p1: buildNavBoxes(false), p2: buildNavBoxes(true) };
const boxes = (phase2: boolean) => (phase2 ? NAV.p2 : NAV.p1);
const active = (b: NavBox, footZ: number) => b.z1 > footZ + KNEE && b.z0 < footZ + HEAD;

/** Push a circle of WALKER_RADIUS out of every box that is active at `footZ`. */
function resolveCollisions(x: number, y: number, footZ: number, phase2: boolean): [number, number] {
  const r = WALKER_RADIUS;
  let px = x, py = y;
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const b of boxes(phase2)) {
      if (!active(b, footZ)) continue;
      const dx = px - Math.max(b.x0, Math.min(px, b.x1)), dy = py - Math.max(b.y0, Math.min(py, b.y1));
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      moved = true;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        px += (dx / d) * (r - d);
        py += (dy / d) * (r - d);
      } else {
        // centre inside the box: leave by the nearest side
        const m = Math.min(px - b.x0, b.x1 - px, py - b.y0, b.y1 - py);
        if (m === px - b.x0) px = b.x0 - r; else if (m === b.x1 - px) px = b.x1 + r; else if (m === py - b.y0) py = b.y0 - r; else py = b.y1 + r;
      }
    }
    if (!moved) break;
  }
  return [px, py];
}

function colliding(x: number, y: number, footZ: number, phase2: boolean): boolean {
  const r2 = (WALKER_RADIUS - 0.03) ** 2;
  return boxes(phase2).some((b) => active(b, footZ) && (x - Math.max(b.x0, Math.min(x, b.x1))) ** 2 + (y - Math.max(b.y0, Math.min(y, b.y1))) ** 2 < r2);
}

/** Move the walker by (dx, dy) in 0.2′ sub-steps, sliding along walls and following stairs up and down. */
export function stepWalker(s: WalkState, dx: number, dy: number, phase2: boolean, noclip: boolean): void {
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return;
  if (noclip) {
    s.x += dx;
    s.y += dy;
    s.footZ = pickSurface(s.x, s.y, s.footZ, phase2) ?? s.footZ;
    return;
  }
  const tryMove = (tx: number, ty: number): boolean => {
    const [rx, ry] = resolveCollisions(tx, ty, s.footZ, phase2);
    const nz = pickSurface(rx, ry, s.footZ, phase2);
    if (nz === null) return false;
    // stepping up or down changes which boxes are in the way, so resolve again at the new height
    const [qx, qy] = nz !== s.footZ ? resolveCollisions(rx, ry, nz, phase2) : [rx, ry];
    const qz = pickSurface(qx, qy, s.footZ, phase2);
    if (qz === null || colliding(qx, qy, qz, phase2)) return false;
    s.x = qx;
    s.y = qy;
    s.footZ = qz;
    return true;
  };
  const n = Math.max(1, Math.ceil(dist / 0.2)), sx = dx / n, sy = dy / n;
  for (let i = 0; i < n; i++) {
    if (tryMove(s.x + sx, s.y + sy)) continue;
    // blocked: slide along whichever axis is still free
    if (Math.abs(sx) > 1e-6) tryMove(s.x + sx, s.y);
    if (Math.abs(sy) > 1e-6) tryMove(s.x, s.y + sy);
  }
}

/** The nearest spot to (x, y) you can stand on near height `targetZ` (0 ground floor, FLOOR roof), without overlap. */
export function findFreeSpot(x: number, y: number, targetZ: number, phase2: boolean): [number, number, number] {
  const ok = (cx: number, cy: number) => {
    const z = pickSurface(cx, cy, targetZ, phase2);
    return z !== null && !colliding(cx, cy, z, phase2) ? z : null;
  };
  for (let rad = 0; rad <= 8; rad += 0.4) {
    for (let a = 0; a < (rad ? 24 : 1); a++) {
      const nx = x + rad * Math.cos((a / 24) * Math.PI * 2), ny = y + rad * Math.sin((a / 24) * Math.PI * 2);
      const z = ok(nx, ny);
      if (z !== null) return [nx, ny, z];
    }
  }
  return [x, y, floorHeightAt(x, y, phase2, targetZ > FLOOR / 2)];
}

// ---------------------------------------------------------------- where am I
const stairName = (i: number) => `${STAIRS[i].spec.outside ? "Outside stair" : "Stair"}${STAIRS.length > 1 ? ` ${i + 1}` : ""}`;
const underStair = (i: number) => `Under the ${STAIRS[i].spec.outside ? "outside " : ""}stair${STAIRS.length > 1 ? ` (${i + 1})` : ""}`;
const PART = { flight1: "Flight 1", landing: "Landing", flight2: "Flight 2" } as const;
const KIND_NAME: Partial<Record<FloorArea["kind"], string>> = { corridor: "Gallery", court: "Court", porch: "Porch", stair: "Stair", wash: "Utility", bath: "Bath" };
const area = (r: Rect) => (r.x1 - r.x0) * (r.y1 - r.y0);
/** the label inside f, a room label first (a bedroom's rect also holds its bath's label) */
const labelIn = (f: Rect, phase2: boolean) => {
  const inside = [...MODEL_P1.labels, ...(phase2 && MODEL_P2 ? MODEL_P2.labels : [])].filter((lb) => inR(lb.x, lb.y, f));
  return inside.find((lb) => lb.room) ?? inside[0];
};
const ftIn = (ft: number) => {
  const total = Math.round(Math.abs(ft) * 12);
  return total ? `${ft < 0 ? "−" : "+"}${Math.floor(total / 12)}′${total % 12 ? `${total % 12}″` : ""}` : "±0";
};

/** The name of a ground-floor area: its label, "<room> · Bath" for a bath inside a room, or its floor kind. */
function floorName(f: FloorArea, phase2: boolean): string {
  const lb = labelIn(f, phase2);
  const own = lb ? title(lb.lines[0][0]) : KIND_NAME[f.kind] ?? title(f.kind);
  const host = f.kind === "bath" && floorsOf(phase2).find((g) => g !== f && g.kind !== "bath" && g.x0 <= f.x0 && g.x1 >= f.x1 && g.y0 <= f.y0 && g.y1 >= f.y1);
  const hostLabel = host && labelIn(host, phase2);
  return hostLabel ? `${title(hostLabel.lines[0][0])} · ${own}` : own;
}

/** The room or area at (x, y) and the level, for the walk-mode readout. */
export function roomAt(x: number, y: number, footZ: number, phase2: boolean): LocationInfo {
  if (footZ > 0.25 && footZ < FLOOR - 0.25) {
    const i = STAIRS.findIndex((d) => inR(x, y, d.well, 0.2));
    if (i >= 0) {
      const t = STAIRS[i].treads.reduce((a, b) => (Math.abs(b.z - footZ) < Math.abs(a.z - footZ) ? b : a));
      return { room: `${stairName(i)} · ${PART[t.part]}`, level: `Climbing · ${ftIn(footZ)}`, onRoof: false };
    }
  }
  if (footZ >= FLOOR - 0.25) {
    const on = roofs(phase2).find(({ r }) => inR(x, y, r, PAD));
    return { room: on?.slabOnly ? "Stair bridge" : "Roof terrace", level: `Roof · ${ftIn(FLOOR)}`, onRoof: true };
  }
  const ground = (room: string) => ({ room, level: "Ground floor", onRoof: false });
  const under = STAIRS.findIndex((d) => inR(x, y, d.well));
  if (under >= 0) return { room: underStair(under), level: footZ < -0.25 ? `Outside · ${ftIn(footZ)}` : "Ground floor", onRoof: false };
  if (builtRoofs(phase2).some(({ r }) => inR(x, y, r))) {
    const floors = floorsOf(phase2);
    const here = floors.filter((f) => inR(x, y, f)).sort((a, b) => area(a) - area(b))[0];
    if (here) return ground(floorName(here, phase2));
    // in a doorway or a wall: the nearest floor
    const dist = (f: Rect) => Math.hypot(x - Math.max(f.x0, Math.min(x, f.x1)), y - Math.max(f.y0, Math.min(y, f.y1)));
    const near = floors.reduce<FloorArea | null>((a, f) => (!a || dist(f) < dist(a) ? f : a), null);
    return ground(near ? floorName(near, phase2) : "Inside");
  }
  const out = (room: string) => ({ room, level: `Outside · ${ftIn(footZ)}`, onRoof: false });
  if (HOUSE.porches.some((p) => inR(x, y, p))) return out("Porch");
  if (HOUSE.steps.some((s) => inR(x, y, s.r))) return out("Steps");
  if (inR(x, y, SITE.path)) return out("Path");
  if (SITE.parking && inR(x, y, SITE.parking)) return out("Parking");
  if (!inR(x, y, PLOT)) return out(sideOf(x, y, PLOT) === SITE.road.side ? "Road" : "Outside the plot");
  const side = sideOf(x, y, BBOX);
  return out(side === SITE.road.side ? "Front yard" : `${{ N: "North", S: "South", E: "East", W: "West" }[side]} yard`);
}

/** The side of `r` that (x, y) lies furthest beyond. */
function sideOf(x: number, y: number, r: Rect): Face {
  const d: [Face, number][] = [["W", r.x0 - x], ["E", x - r.x1], ["S", r.y0 - y], ["N", y - r.y1]];
  return d.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

// ---------------------------------------------------------------- "Go to" spots
/**
 * Stand 1.6′ inside the room's own doorway, looking across the room. The room's own door is one that swings into
 * it (arches and sliders belong to both sides); the widest wins, then an inside door over an outer one.
 */
function doorwaySpot(room: Rect, openings: Opening[]): Pick<Place, "at" | "look"> {
  const c: [number, number] = [(room.x0 + room.x1) / 2, (room.y0 + room.y1) / 2];
  const m = 0.1;
  let best: { score: number; at: [number, number] } | null = null;
  for (const o of openings) {
    if (!PASSABLE.has(o.kind)) continue;
    const alongX = o.axis === "x";
    const [lo, hi] = alongX ? [room.x0, room.x1] : [room.y0, room.y1];
    if (o.a[0] < lo - m || o.a[1] > hi + m) continue;
    const [e0, e1] = alongX ? [room.y0, room.y1] : [room.x0, room.x1];
    const inward = Math.abs(o.w[1] - e0) < m ? 1 : Math.abs(o.w[0] - e1) < m ? -1 : 0;
    if (!inward) continue;
    const swingsIn = o.kind !== "door" || o.swing === inward;
    const score = (swingsIn ? 100 : 0) + (o.a[1] - o.a[0]) + (o.face === "int" ? 0.1 : 0);
    const u = (o.a[0] + o.a[1]) / 2, v = (inward > 0 ? e0 : e1) + inward * 1.6;
    if (!best || score > best.score) best = { score, at: alongX ? [u, v] : [v, u] };
  }
  const at = best?.at ?? [room.x0 + 1.4, room.y0 + 1.4];
  return { at, look: [c[0] + (c[0] - at[0]) * 0.35, c[1] + (c[1] - at[1]) * 0.35] };
}

/** Rooms (at their doorways), the design's own spots, the foot and top of every stair, and the terrace. */
export function getPlaces(): Place[] {
  const rooms: Place[] = [];
  for (const [m, phase2] of [[MODEL_P1, false], [MODEL_P2, true]] as const) {
    if (!m) continue;
    for (const lb of m.labels) {
      const room = lb.room && m.floors.find((f) => f.kind !== "bath" && inR(lb.x, lb.y, f));
      if (room) rooms.push({ name: title(lb.lines[0][0]), ...doorwaySpot(room, MODEL.openings), phase2: phase2 || undefined });
    }
  }
  rooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const list: Place[] = [...rooms, ...HOUSE.places.map(([name, at, look]): Place => ({ name, at, look }))];
  STAIRS.forEach((d, i) => {
    // foot: just before flight 1, looking up it; top: just off flight 2 on the floor above, looking away from the stair
    const pt = (c: [number, number], a: number): [number, number] => {
      const u = (c[0] + c[1]) / 2;
      return d.spec.axis === "y" ? [u, a] : [a, u];
    };
    list.push(
      { name: `${stairName(i)} (foot)`, at: pt(d.flight1, d.start - d.dir * 1.0), look: pt(d.flight1, d.turn) },
      { name: `${stairName(i)} (top)`, at: pt(d.flight2, d.start - d.dir * 1.2), look: pt(d.flight2, d.start - d.dir * 12), level: 1 },
    );
  });
  const main = HOUSE.roofs.find((r) => r.phase === 1 && !r.slabOnly);
  if (main) {
    const { r } = main;
    list.push({ name: "Roof terrace", at: [r.x0 + 3, r.y0 + 3], look: [r.x1, r.y1], level: 1 });
  }
  return list;
}
