/**
 * Plan-building kit: a model builder, room-local frames and furnished room helpers.
 * Designs in `src/design/` use these to place walls, openings, furniture and labels in world feet.
 */
import type { Face, FloorKind, FurnKind, Label, Model, OpeningKind, Rect, WallKind } from "../types";

export const EXT = 0.75; // 9″ external brick wall
export const INT = 0.375; // 4½″ internal wall

/** Default sill / head heights per opening kind; pass `sill` / `head` to override. */
const HEIGHTS: Record<OpeningKind, [number, number]> = {
  door: [0, 7], window: [2.5, 7], vent: [5.5, 7], open: [0, 7], slide: [0, 7], hatch: [3, 6.5],
};

export class B {
  m: Model = { floors: [], walls: [], openings: [], furniture: [], labels: [] };
  wall(x0: number, y0: number, x1: number, y1: number, kind: WallKind = "int", band = false) {
    this.m.walls.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), kind, ...(band ? { band } : {}) });
  }
  floor(r: Rect, kind: FloorKind) { this.m.floors.push({ ...r, kind }); }
  op(kind: OpeningKind, tag: string, axis: "x" | "y", a: [number, number], w: [number, number], face: Face | "int",
    o: { hingeAt?: number; swing?: number; double?: boolean; sill?: number; head?: number; fanlight?: boolean; where?: string } = {}) {
    const a0 = Math.min(...a), a1 = Math.max(...a);
    const hinge = o.hingeAt === undefined ? undefined : Math.abs(o.hingeAt - a0) < Math.abs(o.hingeAt - a1) ? "a0" : "a1";
    const [sill, head] = HEIGHTS[kind];
    this.m.openings.push({
      kind, tag, axis, a: [a0, a1], w: [Math.min(...w), Math.max(...w)], face, hinge, swing: o.swing ?? 0, double: o.double ?? false,
      where: o.where ?? "", sill: o.sill ?? sill, head: o.head ?? head, fanlight: o.fanlight ?? false,
    });
  }
  f(r: Rect, k: FurnKind, h = 1.5) { this.m.furniture.push({ t: "rect", r, k, h }); }
  e(cx: number, cy: number, rx: number, ry: number, k: FurnKind = "fix", h = 2.6) { this.m.furniture.push({ t: "ellipse", cx, cy, rx, ry, k, h }); }
  txt(x: number, y: number, s: string, style: "small" | "vert" | "small_l" = "small") { this.m.furniture.push({ t: "text", x, y, s, style }); }
  label(x: number, y: number, lines: Label["lines"], room?: string) { this.m.labels.push({ x, y, lines, room }); }
}

/**
 * A room-local frame: u runs along the door wall, v runs from the door wall (v = 0) into the room (v = D).
 * ux / vx are unit vectors in world (x, y), so one frame type covers rooms entered from any side.
 */
export class Frame {
  constructor(public ox: number, public oy: number, public ux: [number, number], public vx: [number, number], public W: number, public D: number) {}
  p(u: number, v: number): [number, number] { return [this.ox + u * this.ux[0] + v * this.vx[0], this.oy + u * this.ux[1] + v * this.vx[1]]; }
  rect(u0: number, u1: number, v0: number, v1: number): Rect {
    const [a, b] = this.p(u0, v0), [c, d] = this.p(u1, v1);
    return { x0: Math.min(a, c), y0: Math.min(b, d), x1: Math.max(a, c), y1: Math.max(b, d) };
  }
  get uAxis(): "x" | "y" { return this.ux[0] !== 0 ? "x" : "y"; }
  /** world range along the u axis for u0..u1 */
  ar(u0: number, u1: number): [number, number] { const r = this.rect(u0, u1, 0, 0); return this.uAxis === "x" ? [r.x0, r.x1] : [r.y0, r.y1]; }
  /** world range across the u axis for v0..v1 */
  wr(v0: number, v1: number): [number, number] { const r = this.rect(0, 0, v0, v1); return this.uAxis === "x" ? [r.y0, r.y1] : [r.x0, r.x1]; }
  /** world coordinate of u along the u axis */
  ua(u: number) { const [x, y] = this.p(u, 0); return this.uAxis === "x" ? x : y; }
  /** sign of v along the cross axis (+1 when v runs toward +y or +x) */
  get vSign() { return this.uAxis === "x" ? this.vx[1] : this.vx[0]; }
}

/**
 * Frame for a clear room rectangle entered through the wall on side `door`.
 * mirror flips u so the door end (u = 0) sits at the other corner.
 */
export function roomFrame(r: Rect, door: Face, mirror = false): Frame {
  const w = r.x1 - r.x0, d = r.y1 - r.y0;
  switch (door) {
    case "S": return mirror ? new Frame(r.x1, r.y0, [-1, 0], [0, 1], w, d) : new Frame(r.x0, r.y0, [1, 0], [0, 1], w, d);
    case "N": return mirror ? new Frame(r.x0, r.y1, [1, 0], [0, -1], w, d) : new Frame(r.x1, r.y1, [-1, 0], [0, -1], w, d);
    case "W": return mirror ? new Frame(r.x0, r.y1, [0, -1], [1, 0], d, w) : new Frame(r.x0, r.y0, [0, 1], [1, 0], d, w);
    case "E": return mirror ? new Frame(r.x1, r.y0, [0, 1], [-1, 0], d, w) : new Frame(r.x1, r.y1, [0, -1], [-1, 0], d, w);
  }
}

export const fi = (ft: number) => { const q = Math.round(ft * 12); return `${Math.floor(q / 12)}′${q % 12}″`; };
export const sz = (a: number, b: number) => `${fi(a)} × ${fi(b)}`;
export const L3 = (name: string, sub: string, size: string): Label["lines"] => [
  [name, 12.5, 700, "#1f2933"], ...(sub ? [[sub, 9.5, null, "#5f6b7a"] as [string, number, null, string]] : []), [size, 9.5, null, "#5f6b7a"],
];
export const SMALL = "#28566e";

/** Door in the frame's door wall (v = −t … 0) between u0 and u1, opening into the room. */
export function roomDoor(b: B, fr: Frame, tag: string, u0: number, u1: number, t: number, where: string, hingeHigh = false, fanlight = true) {
  b.op("door", tag, fr.uAxis, fr.ar(u0, u1), fr.wr(-t, 0), "int", { hingeAt: fr.ua(hingeHigh ? u1 : u0), swing: fr.vSign, fanlight, where });
}

/** Window or vent in the frame's far wall (v = D … D + t). */
export function farWindow(b: B, fr: Frame, kind: "window" | "vent", tag: string, u0: number, u1: number, t: number, face: Face, where: string, sill?: number) {
  b.op(kind, tag, fr.uAxis, fr.ar(u0, u1), fr.wr(fr.D, fr.D + t), face, { where, sill });
}

/** Window in a side wall of the frame: side "u0" is the wall at u = 0, "u1" the wall at u = W; v0..v1 along it. */
export function sideWindow(b: B, fr: Frame, side: "u0" | "u1", v0: number, v1: number, t: number, face: Face, where: string, tag = "W1") {
  const other: "x" | "y" = fr.uAxis === "x" ? "y" : "x";
  const r = side === "u0" ? fr.rect(-t, 0, v0, v1) : fr.rect(fr.W, fr.W + t, v0, v1);
  b.op("window", tag, other, other === "y" ? [r.y0, r.y1] : [r.x0, r.x1], other === "y" ? [r.x0, r.x1] : [r.y0, r.y1], face, { where });
}

/**
 * Double bed (default 5′ × 6′-6″) with two side tables, centred at u = uc. The headboard is on the wall at v = v0;
 * dir = −1 when that wall is the far one (the bed then runs back toward the door).
 */
export function bed(b: B, fr: Frame, uc: number, v0: number, dir: 1 | -1 = 1, w = 5, l = 6.5) {
  const span = (a: number, c: number) => (dir > 0 ? [v0 + a, v0 + c] : [v0 - c, v0 - a]) as [number, number];
  b.f(fr.rect(uc - w / 2, uc + w / 2, ...span(0, l)), "bed", 1.7);
  b.f(fr.rect(uc - w / 2 + 0.3, uc - 0.15, ...span(0.3, 1.3)), "pillow", 2);
  b.f(fr.rect(uc + 0.15, uc + w / 2 - 0.3, ...span(0.3, 1.3)), "pillow", 2);
  for (const s of [-1, 1]) b.f(fr.rect(uc + s * (w / 2 + 0.1), uc + s * (w / 2 + 1.4), ...span(0, 1.3)), "furn", 1.8);
}

export function wardrobe(b: B, fr: Frame, u0: number, u1: number, v0: number, v1: number) { b.f(fr.rect(u0, u1, v0, v1), "wardrobe", 7); }

/**
 * Bath in the frame rectangle u0..u1 × v0..v1 with its outer wall at v1. Partitions go on the v0 side and on any
 * u side listed in `walls`; the door sits in the v0 partition. WC + basin on the side walls, shower at the outer wall.
 */
export function bath(b: B, fr: Frame, [u0, u1, v0, v1]: [number, number, number, number], o: {
  name: string; door: [number, number]; walls: ("u0" | "u1")[]; vent?: { face: Face; t: number }; label?: string;
}) {
  const w = u1 - u0, d = v1 - v0;
  const wu0 = o.walls.includes("u0") ? u0 - INT : u0, wu1 = o.walls.includes("u1") ? u1 + INT : u1;
  b.floor(fr.rect(u0, u1, v0, v1), "bath");
  b.m.walls.push({ ...fr.rect(wu0, wu1, v0 - INT, v0), kind: "part" });
  if (o.walls.includes("u0")) b.m.walls.push({ ...fr.rect(u0 - INT, u0, v0, v1), kind: "part" });
  if (o.walls.includes("u1")) b.m.walls.push({ ...fr.rect(u1, u1 + INT, v0, v1), kind: "part" });
  b.op("door", "D3", fr.uAxis, fr.ar(o.door[0], o.door[1]), fr.wr(v0 - INT, v0), "int", { hingeAt: fr.ua(o.door[0]), swing: fr.vSign, where: o.name });
  if (o.vent) b.op("vent", "V1", fr.uAxis, fr.ar(u0 + w / 2 - 1, u0 + w / 2 + 1), fr.wr(v1, v1 + o.vent.t), o.vent.face, { where: o.name });
  // shower against the outer wall; WC on the far side wall, basin on the near one, both clear of the door swing
  b.f(fr.rect(u0, u1, v1 - Math.min(2.5, d / 3), v1), "shower", 0.05);
  const farSide = o.door[0] - u0 < u1 - o.door[1] ? u1 : u0, sgn = farSide === u1 ? -1 : 1;
  const vw = v1 - Math.min(2.5, d / 3) - 1.3;
  b.f(fr.rect(Math.min(farSide, farSide + sgn * 0.9), Math.max(farSide, farSide + sgn * 0.9), vw - 0.7, vw + 0.7), "fix", 2.6);
  { const [x, y] = fr.p(farSide + sgn * 1.65, vw); b.e(x, y, fr.uAxis === "x" ? 0.75 : 0.55, fr.uAxis === "x" ? 0.55 : 0.75, "fix", 1.3); }
  { const near = farSide === u1 ? u0 : u1; const [x, y] = fr.p(near - sgn * 0.55, vw); b.e(x, y, 0.42, 0.42, "fix", 2.85); }
  const [lx, ly] = fr.p((u0 + u1) / 2, v0 + 1.4);
  b.label(lx, ly, [[o.label ?? "BATH", 8, 600, SMALL]]);
}
