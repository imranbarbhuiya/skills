/** Elevations of all four faces, generated from the roofs, grid and outer openings. Future floors are dashed. */
import { BBOX, CHAJJA, DogLeg, FLOOR, FLOORS_TOTAL, HOUSE, LINTEL, MODEL, PARAPET, PLINTH, STAIRS, STAIR_RISE, STAIR_RISERS, STAIR_TREAD, roofEdges } from "../model";
import { EView, FUT, INK, MUTED, Pt, Svg, disclaimerBox, ftin, paragraph } from "../svg";
import type { Face, Opening, Rect } from "../types";

export const PLASTER = "#f3ece0";
export const PLASTER_SH = "#e3d8c6";
const PILASTER = "#ece3d4";
const STONE = "#8f8a80";
const STONE_L = "#a9a397";
export const GLASS = "#5f7683";
export const GLASS_L = "#8ea5b1";
export const WOOD = "#6b4a2b";
const WOOD_L = "#8a5f39";
export const COPING = "#cfc5b5";
const RAIL = "#3b3b3b";
const GROUND = "#6f8f4e";

export type FaceName = Face;

export function tree(e: EView, h: number, height = 22, r = 6.5, op = 1) {
  const z0 = -PLINTH;
  e.rect(h - 0.35, z0, h + 0.35, z0 + height * 0.55, { fill: "#6b5a45", opacity: op });
  for (const [dh, dz, rr] of [[0, 0.78, 1.0], [-0.55, 0.62, 0.8], [0.6, 0.6, 0.85], [0.1, 0.5, 0.7]]) {
    const [X, Y] = e.p(h + dh * r, z0 + height * dz);
    e.s.circle(X, Y, rr * r * e.k, { fill: "#9bb87a", stroke: "#6f8f4e", stroke_width: 0.8, opacity: 0.85 * op });
  }
}

export function person(e: EView, h: number, z = -PLINTH, ht = 5.5, col = "#4b5059") {
  const s = ht / 5.5;
  const [X, Y] = e.p(h, z + 5.05 * s);
  e.s.circle(X, Y, 0.42 * s * e.k, { fill: col });
  e.poly([[h - 0.75 * s, z + 4.4 * s], [h + 0.75 * s, z + 4.4 * s], [h + 0.55 * s, z + 2.6 * s], [h + 0.35 * s, z],
    [h + 0.05 * s, z], [h, z + 2.3 * s], [h - 0.05 * s, z], [h - 0.35 * s, z], [h - 0.55 * s, z + 2.6 * s]], { fill: col });
}

export function windowEl(e: EView, h0: number, h1: number, sill: number, head: number, kind: string, shade = false) {
  const fr = 0.18;
  e.rect(h0 - 0.25, sill - 0.17, h1 + 0.25, sill, { fill: COPING, stroke: "#a79d8c", stroke_width: 0.5 });
  e.rect(h0, sill, h1, head, { fill: WOOD });
  if (kind === "vent") {
    e.rect(h0 + fr, sill + fr, h1 - fr, head - fr, { fill: GLASS_L });
    for (let k = 1; k < 4; k++) { const z = sill + ((head - sill) * k) / 4; e.line(h0 + fr, z, h1 - fr, z, { stroke: WOOD, stroke_width: 1 }); }
    return;
  }
  e.rect(h0 + fr, sill + fr, h1 - fr, head - fr, { fill: shade ? "#4e616c" : GLASS });
  e.poly([[h0 + fr, head - fr], [h0 + fr + (h1 - h0) * 0.35, head - fr], [h0 + fr, sill + (head - sill) * 0.45]], { fill: "#fff", opacity: 0.12 });
  const panes = h1 - h0 < 5.5 ? 2 : 3;
  for (let k = 1; k < panes; k++) { const hh = h0 + ((h1 - h0) * k) / panes; e.rect(hh - 0.08, sill, hh + 0.08, head, { fill: WOOD }); }
}

export function doorEl(e: EView, h0: number, h1: number, o: { double?: boolean; glazed?: boolean; fanlight?: boolean } = {}) {
  const head = LINTEL;
  e.rect(h0, 0, h1, head, { fill: WOOD });
  const leaves = o.double ? 2 : 1;
  const w = (h1 - h0) / leaves;
  for (let k = 0; k < leaves; k++) {
    const a = h0 + k * w + 0.15, b = h0 + (k + 1) * w - 0.15;
    e.rect(a, 0.15, b, head - 0.15, { fill: WOOD_L });
    if (o.glazed) e.rect(a + 0.25, head * 0.3, b - 0.25, head - 0.4, { fill: GLASS });
    else {
      e.rect(a + 0.3, head * 0.55, b - 0.3, head - 0.45, { fill: "none", stroke: WOOD, stroke_width: 0.8 });
      e.rect(a + 0.3, 0.45, b - 0.3, head * 0.45, { fill: "none", stroke: WOOD, stroke_width: 0.8 });
    }
  }
  if (o.fanlight) { e.rect(h0, head + 0.5, h1, head + 1.75, { fill: WOOD }); e.rect(h0 + 0.15, head + 0.65, h1 - 0.15, head + 1.6, { fill: GLASS_L }); }
}

function chajja(e: EView, h0: number, h1: number, z: number) {
  e.rect(h0 - 0.5, z - 0.8, h1 + 0.5, z, { fill: "#000", opacity: 0.1 });
  e.rect(h0 - 0.5, z, h1 + 0.5, z + 0.42, { fill: "#ddd3c3", stroke: "#a79d8c", stroke_width: 0.6 });
}

export function railing(e: EView, h0: number, h1: number, z0: number, z1: number) {
  e.rect(h0, z1 - 0.12, h1, z1, { fill: RAIL });
  const nb = Math.max(2, Math.floor((h1 - h0) / 0.45));
  for (let k = 0; k <= nb; k++) { const hh = h0 + ((h1 - h0) * k) / nb; e.line(hh, z0, hh, z1, { stroke: RAIL, stroke_width: 0.9 }); }
}

function levels(e: EView, h: number, items: [number, string][]) {
  for (const [z, lab] of items) {
    const [X, Y] = e.p(h, z);
    e.s.poly([[X, Y], [X - 7, Y - 7], [X, Y - 7]], { fill: INK });
    e.s.text(X - 10, Y - 2, lab, { size: 9.5, anchor: "end" });
  }
}

/** Plan point → horizontal position on an elevation (viewer outside, looking at that face). */
export function hOf(face: Face, x: number, y: number) {
  return face === "S" ? x - BBOX.x0 : face === "N" ? BBOX.x1 - x : face === "E" ? y - BBOX.y0 : BBOX.y1 - y;
}
export const hr = (face: Face, r: Rect): [number, number] => {
  const p = hOf(face, r.x0, r.y0), q = hOf(face, r.x1, r.y1);
  return [Math.min(p, q), Math.max(p, q)];
};
/** distance from the viewer: bigger is further away */
const depth = (face: Face, r: Rect) => (face === "S" ? r.y0 : face === "N" ? -r.y1 : face === "E" ? -r.x1 : r.x0);
/** coordinate of a rect's face toward the viewer */
const faceLine = (face: Face, r: Rect) => (face === "S" ? r.y0 : face === "N" ? r.y1 : face === "E" ? r.x1 : r.x0);
const opRange = (face: Face, o: Opening): [number, number] => {
  const p = o.axis === "x" ? hOf(face, o.a[0], 0) : hOf(face, 0, o.a[0]), q = o.axis === "x" ? hOf(face, o.a[1], 0) : hOf(face, 0, o.a[1]);
  return [Math.min(p, q), Math.max(p, q)];
};

/** A dog-leg seen from the side (flights along the view) or end-on. */
function stairEl(e: EView, face: Face, d: DogLeg, a: Record<string, string | number>) {
  const half = STAIR_RISERS / 2, zl = half * STAIR_RISE;
  const side = (d.spec.axis === "y") === (face === "E" || face === "W");
  const hA = (t: number) => (d.spec.axis === "y" ? hOf(face, 0, t) : hOf(face, t, 0));
  if (side) {
    for (const [from, dir, z0] of [[d.start, d.dir, 0], [d.turn, -d.dir, zl]] as const) {
      const pts: Pt[] = [[hA(from), z0]];
      for (let i = 0; i < half; i++) {
        pts.push([hA(from + dir * i * STAIR_TREAD), z0 + (i + 1) * STAIR_RISE]);
        if (i < half - 1) pts.push([hA(from + dir * (i + 1) * STAIR_TREAD), z0 + (i + 1) * STAIR_RISE]);
      }
      pts.push([hA(from + dir * (half - 1) * STAIR_TREAD), z0 + half * STAIR_RISE - 0.7], [hA(from), z0 - 0.6]);
      e.poly(pts, a);
    }
    const [l0, l1] = [hA(d.landing[0]), hA(d.landing[1])].sort((p, q) => p - q);
    e.rect(l0, zl - 0.5, l1, zl, a);
  } else {
    const across = (c: [number, number]) => (d.spec.axis === "y" ? [hOf(face, c[0], 0), hOf(face, c[1], 0)] : [hOf(face, 0, c[0]), hOf(face, 0, c[1])]).sort((p, q) => p - q) as [number, number];
    const [f1a, f1b] = across(d.flight1), [f2a, f2b] = across(d.flight2);
    e.rect(f1a, 0, f1b, zl, a);
    e.rect(f2a, zl, f2b, FLOOR, a);
    e.rect(Math.min(f1a, f2a), zl - 0.5, Math.max(f1b, f2b), zl, a);
    railing(e, Math.min(f1a, f2a), Math.max(f1b, f2b), zl, zl + 3);
  }
  if (d.spec.outside) {
    // two columns under the landing
    const far = d.dir > 0 ? d.landing[1] : d.landing[0];
    const across = d.spec.axis === "y" ? [d.spec.x0 + 0.5, d.spec.x1 - 0.5] : [d.spec.y0 + 0.5, d.spec.y1 - 0.5];
    for (const c of across) {
      const h = side ? hA(far - d.dir * 0.5) : d.spec.axis === "y" ? hOf(face, c, 0) : hOf(face, 0, c);
      e.rect(h - 0.4, -PLINTH, h + 0.4, zl - 0.5, { fill: PILASTER, stroke: "#c9bda9", stroke_width: 0.6 });
      if (side) break;
    }
  }
}

export function drawElevation(e: EView, face: Face) {
  const wide = face === "S" || face === "N";
  const span = wide ? BBOX.x1 - BBOX.x0 : BBOX.y1 - BBOX.y0;
  const ops = MODEL.openings.filter((o) => o.face === face);
  for (const [h, ht, r] of [[-9, 24, 6], [span + 9, 26, 6.5]] as const) tree(e, h, ht, r, 0.9);

  // future floors (dashed), above the whole footprint
  const top = FLOORS_TOTAL * FLOOR;
  const fut = { fill: "none", stroke: FUT, stroke_width: 1, stroke_dasharray: "6 4" };
  if (FLOORS_TOTAL > 1) {
    e.rect(0, FLOOR, span, top + PARAPET, { fill: FUT, opacity: 0.035 });
    e.rect(0, FLOOR, span, top + PARAPET, fut);
    for (let k = 2; k <= FLOORS_TOTAL; k++) e.line(0, k * FLOOR, span, k * FLOOR, { ...fut, stroke_width: 0.8 });
    for (let lvl = 1; lvl < FLOORS_TOTAL; lvl++) for (const o of ops) if (o.kind !== "door") {
      const [a0, a1] = opRange(face, o);
      e.rect(a0, lvl * FLOOR + o.sill, a1, lvl * FLOOR + o.head, { ...fut, stroke_width: 0.6, stroke_dasharray: "3 3" });
    }
  }
  // stairs that stand behind the house (relative to this face) first
  const stairs = STAIRS.map((d) => ({ d, depth: depth(face, d.well) }));
  const roofs = HOUSE.roofs.map((r) => ({ ...r, depth: depth(face, r.r) }));
  const nearest = Math.min(...roofs.map((r) => r.depth));
  for (const s of stairs) if (s.depth > nearest + 1) stairEl(e, face, s.d, { fill: "#ddd5c6", stroke: "#a79d8c", stroke_width: 0.6 });

  // roofs far → near: wall face, plinth, parapet, pilasters, the openings on that face line
  const edges = roofEdges();
  for (const { r, phase, slabOnly } of [...roofs].sort((p, q) => q.depth - p.depth)) {
    const [h0, h1] = hr(face, r);
    const shade = face === "E" || face === "W";
    if (slabOnly) {
      e.rect(h0, FLOOR - 0.6, h1, FLOOR, { fill: "#e8dfd0", stroke: "#c9bda9", stroke_width: 0.6 });
      railing(e, h0, h1, FLOOR, FLOOR + PARAPET);
      continue;
    }
    e.rect(h0, -PLINTH, h1, 0, { fill: STONE });
    for (const z of [-PLINTH * 0.66, -PLINTH * 0.33]) e.line(h0, z, h1, z, { stroke: STONE_L, stroke_width: 0.7 });
    e.rect(h0, 0, h1, FLOOR, { fill: shade ? PLASTER_SH : PLASTER, stroke: "#d6cab6", stroke_width: 0.5 });
    const fl = faceLine(face, r);
    const along = (g: number) => (wide ? g > r.x0 - 0.1 && g < r.x1 + 0.1 : g > r.y0 - 0.1 && g < r.y1 + 0.1);
    for (const g of (wide ? HOUSE.grid.x : HOUSE.grid.y).filter(along)) {
      const h = wide ? hOf(face, g, 0) : hOf(face, 0, g);
      e.rect(h - 0.5, 0, h + 0.5, FLOOR - 0.45, { fill: PILASTER, stroke: "#d6cab6", stroke_width: 0.6 });
    }
    for (const o of ops) {
      const onLine = Math.abs(o.w[0] - fl) < 1.2 || Math.abs(o.w[1] - fl) < 1.2;
      const [a0, a1] = opRange(face, o);
      if (!onLine || a0 < h0 - 0.1 || a1 > h1 + 0.1) continue;
      if (o.kind === "door") doorEl(e, a0, a1, { double: o.double, glazed: o.tag !== "D1", fanlight: o.fanlight });
      else windowEl(e, a0, a1, o.sill, o.head, o.kind, shade);
      if (o.kind !== "door" && CHAJJA > 0) chajja(e, a0, a1, o.head);
    }
    e.rect(h0 - 0.25, FLOOR - 0.45, h1 + 0.25, FLOOR, { fill: "#e8dfd0", stroke: "#c9bda9", stroke_width: 0.6 });
    // parapet where this roof has an outer edge facing the viewer
    for (const s of edges.filter((s) => s.phase === phase)) {
      const [p0, p1] = hr(face, s);
      if (p1 - p0 < 0.1) continue;
      const near = wide ? Math.abs(s.y0 - fl) < 0.05 : Math.abs(s.x0 - fl) < 0.05;
      if (!near) continue;
      e.rect(p0, FLOOR, p1, FLOOR + PARAPET, { fill: shade ? PLASTER_SH : PLASTER });
      e.rect(p0 - 0.15, FLOOR + PARAPET - 0.25, p1 + 0.15, FLOOR + PARAPET, { fill: COPING });
    }
    if (phase === 2) {
      e.rect(h0, -PLINTH, h1, FLOOR + PARAPET, { fill: "#fff", opacity: 0.45 });
      e.rect(h0, -PLINTH, h1, FLOOR + PARAPET, { fill: "none", stroke: "#92400e", stroke_width: 1.1, stroke_dasharray: "7 5" });
      e.text((h0 + h1) / 2, FLOOR + PARAPET + 1.2, "phase 2", { size: 9, fill: "#92400e", weight: 700 });
    }
  }
  // porches, steps, canopies, outside stairs in front, tank
  for (const p of HOUSE.porches) { const [a, b] = hr(face, p); e.rect(a, -PLINTH, b, 0, { fill: "#d9d3c7", stroke: "#a79d8c", stroke_width: 0.5 }); }
  for (const st of HOUSE.steps) {
    const [a, b] = hr(face, st.r);
    e.rect(a, -PLINTH, b, -0.05, { fill: "#d9d3c7", stroke: "#a79d8c", stroke_width: 0.5 });
    for (let k = 1; k < 5; k++) e.line(a, -k * PLINTH / 5, b, -k * PLINTH / 5, { stroke: "#a79d8c", stroke_width: 0.6 });
  }
  for (const c of HOUSE.canopies) { const [a, b] = hr(face, c); chajja(e, a, b, LINTEL + 1.75); }
  for (const s of stairs) if (s.depth <= nearest + 1) stairEl(e, face, s.d, { fill: "#e9e2d4", stroke: "#8f8577", stroke_width: 0.8 });
  if (HOUSE.tank) {
    const [t0, t1] = hr(face, HOUSE.tank);
    e.rect(t0 + 0.4, FLOOR, t1 - 0.4, FLOOR + 3, { fill: "#9aa0a8" });
    e.rect(t0, FLOOR + 3, t1, FLOOR + 7, { fill: "#2f3338", rx: 3 });
  }
  person(e, span + 3);
  e.rect(-12, -PLINTH - 0.5, span + 12, -PLINTH, { fill: GROUND });
  e.line(-12, -PLINTH, span + 12, -PLINTH, { stroke: INK, stroke_width: 1.6 });
}

const NAMES: Record<Face, string> = { N: "NORTH", S: "SOUTH", E: "EAST", W: "WEST" };
const ENDS: Record<Face, string> = { S: "west ← → east", N: "east ← → west", E: "south ← → north", W: "north ← → south" };

export function sheetElevation(face: Face): string {
  const k = 12;
  const wide = face === "S" || face === "N";
  const span = wide ? BBOX.x1 - BBOX.x0 : BBOX.y1 - BBOX.y0;
  const s = new Svg(Math.max(1300, Math.round(span * k + 700)), 820);
  const front = HOUSE.site.road.side === face ? " (FRONT, faces the road)" : "";
  s.text(40, 46, `${NAMES[face]} ELEVATION${front}`, { size: 22, anchor: "start", weight: 700 });
  s.text(40, 70, `Ground floor now (solid) · ${FLOORS_TOTAL > 1 ? "future floors on the same grid (dashed) · " : ""}plastered brick, stone plinth, windows under ${ftin(CHAJJA)} chajjas`,
    { size: 12.5, anchor: "start", fill: MUTED });
  const oy = 600, ox = Math.round((s.w - span * k) / 2);
  const e = new EView(s, ox, oy, k);
  drawElevation(e, face);
  levels(e, -4, [[-PLINTH, `ground −${ftin(PLINTH)}`], [0, "FFL ±0″"], [LINTEL, `lintel +${ftin(LINTEL)}`], [FLOOR, `terrace +${ftin(FLOOR)}`],
    [FLOOR + PARAPET, `parapet +${ftin(FLOOR + PARAPET)}`], ...(FLOORS_TOTAL > 1 ? [[FLOORS_TOTAL * FLOOR, `future roof +${ftin(FLOORS_TOTAL * FLOOR)}`] as [number, string]] : [])]);
  s.text(e.p(span / 2, 0)[0], oy + PLINTH * k + 36, `${NAMES[face]} ELEVATION`, { size: 14, weight: 700 });
  s.text(e.p(span / 2, 0)[0], oy + PLINTH * k + 54, ENDS[face], { size: 11, fill: MUTED });
  paragraph(s, 40, 712, `${ftin(CHAJJA)} chajjas with drip grooves over every window; sloped sills; a ${ftin(PLINTH)} stone plinth band. The terrace has a ${ftin(PARAPET)} parapet.`, wide ? 150 : 110, 10.5, "•");
  disclaimerBox(s, s.w - 420, 700, 390, 9.5);
  return s.toString(`${NAMES[face]} elevation`);
}
