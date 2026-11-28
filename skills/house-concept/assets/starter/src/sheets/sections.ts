/**
 * Vertical sections, generated from the model along a cut line. An "x" cut (x = at) looks west with south on the left;
 * a "y" cut (y = at) looks north with west on the left. Walls crossing the line are cut (dark), rooms beyond are light.
 */
import { BEAM, CHAJJA, FLOOR, FLOORS_TOTAL, HOUSE, LINTEL, MODEL, PARAPET, PLINTH, PLOT, SLAB, STAIRS, STAIR_RISE, STAIR_RISERS, STAIR_TREAD, STAIR_WELLS, roofEdges } from "../model";
import { AIR, DIMC, EView, FUT, INK, MUTED, Svg, dimH, dimV, disclaimerBox, ftin, paragraph } from "../svg";
import type { Opening, Rect, SectionSpec } from "../types";
import { person, railing } from "./elevations";

const POCHE = "#3d4148";
const RCC = "#5b6068";
const BEYOND = "#ece4d6";

export function sheetSection(sec: SectionSpec): string {
  const c = sec.at;
  const cutX = sec.axis === "x";
  /** does the rect cross the cut line, and its range along the section */
  const cross = (r: Rect) => (cutX ? r.x0 < c && r.x1 > c : r.y0 < c && r.y1 > c);
  const hr = (r: Rect): [number, number] => (cutX ? [r.y0, r.y1] : [r.x0, r.x1]);
  const [p0, p1] = cutX ? [PLOT.y0, PLOT.y1] : [PLOT.x0, PLOT.x1];
  const k = Math.min(14, 900 / (p1 - p0 + 16));
  const s = new Svg(1420, 900);
  s.text(40, 46, `SECTION ${sec.name}–${sec.name} — ${sec.title} (looking ${cutX ? "west" : "north"})`, { size: 20, anchor: "start", weight: 700 });
  s.text(40, 70, `Cut at ${cutX ? "x" : "y"} = ${ftin(c)} from the house's ${cutX ? "west" : "south"} face; plot boundary to boundary, ${cutX ? "south on the left" : "west on the left"}.`, { size: 12.5, anchor: "start", fill: MUTED });
  const e = new EView(s, 120 - (p0 - 6) * k, 640, k);

  // ground, boundary walls, footings on the grid lines across the section
  e.rect(p0 - 2, -9.5, p1 + 2, -PLINTH, { fill: "#d8c7a8" });
  for (const [h0, h1] of [[p0 - 0.75, p0], [p1, p1 + 0.75]]) e.rect(h0, -PLINTH, h1, -PLINTH + 5, { fill: "#cfc7b8", stroke: "#9a8f7e", stroke_width: 0.6 });
  const roofs = HOUSE.roofs.filter((r) => cross(r.r));
  const built = roofs.filter((r) => !r.slabOnly);
  for (const g of cutX ? HOUSE.grid.y : HOUSE.grid.x) {
    if (!built.some(({ r }) => { const [a, b] = hr(r); return g >= a - 0.6 && g <= b + 0.6; })) continue;
    e.rect(g - 2.5, -8.0, g + 2.5, -6.75, { fill: "none", stroke: "#6b717b", stroke_width: 1, stroke_dasharray: "5 3" });
    e.rect(g - 0.5, -6.75, g + 0.5, -1.5, { fill: "none", stroke: "#6b717b", stroke_width: 1, stroke_dasharray: "5 3" });
    e.rect(g - 0.375, -1.5, g + 0.375, -0.33, { fill: RCC });
  }
  e.text((p0 + p1) / 2, -9.1, "footings (dashed): type, size and depth by the engineer after a soil test", { size: 8.5, fill: "#4b5059" });

  // plinth fill and rooms beyond, per built roof crossing the cut
  for (const { r, phase } of built) {
    const [a, b] = hr(r);
    e.rect(a, -PLINTH, b, -0.17, { fill: "#e9dcc2" });
    e.rect(a, -0.17, b, 0, { fill: "#8c867b" });
    e.rect(a, 0, b, FLOOR - SLAB, { fill: phase === 2 ? "#f5f0e6" : BEYOND });
  }
  // porches, front steps and canopies crossing the cut
  for (const pr of HOUSE.porches.filter(cross)) { const [a, b] = hr(pr); e.rect(a, -PLINTH, b, 0, { fill: "#d9d3c7", stroke: "#a79d8c", stroke_width: 0.6 }); }
  for (const st of HOUSE.steps.filter((st) => cross(st.r))) {
    const [a, b] = hr(st.r), n = Math.max(2, Math.round(PLINTH / 0.55));
    const down = cutX ? (st.down === "N" ? 1 : st.down === "S" ? -1 : 0) : (st.down === "E" ? 1 : st.down === "W" ? -1 : 0);
    for (let i = 0; i < n - 1; i++) {
      const f = i / (n - 1), g = (i + 1) / (n - 1);
      const [h0, h1] = down >= 0 ? [a + f * (b - a), a + g * (b - a)] : [b - g * (b - a), b - f * (b - a)];
      e.rect(h0, -PLINTH, h1, -PLINTH * (i + 1) / n, { fill: "#d9d3c7", stroke: "#a79d8c", stroke_width: 0.5 });
    }
  }
  for (const cn of HOUSE.canopies.filter(cross)) { const [a, b] = hr(cn); e.rect(a, LINTEL + 1.75, b, LINTEL + 2.2, { fill: RCC }); }
  for (const ct of HOUSE.courts.filter(cross)) {
    const [a, b] = hr(ct);
    e.rect(a, 0, b, FLOOR + 6, { fill: "#fbfaf7" });
    e.rect(a, -0.5, b, 0, { fill: "#c9d8b4" });
  }
  // cut walls with their openings
  const thickH = (w: Rect) => (cutX ? w.y1 - w.y0 : w.x1 - w.x0);
  const cutWalls = MODEL.walls.filter((w) => cross(w) && thickH(w) < 1.2);
  const at = (w: Rect): Opening | undefined => MODEL.openings.find((o) => o.axis === sec.axis && o.a[0] < c && o.a[1] > c
    && Math.min(o.w[1], cutX ? w.y1 : w.x1) - Math.max(o.w[0], cutX ? w.y0 : w.x0) > 0.1);
  for (const w of cutWalls) {
    const [h0, h1] = hr(w);
    const o = at(w);
    if (w.kind === "low") { e.rect(h0, 0, h1, 1.5, { fill: POCHE }); continue; }
    if (!o) { e.rect(h0, 0, h1, FLOOR - SLAB, { fill: POCHE }); continue; }
    const sill = o.kind === "door" || o.kind === "open" || o.kind === "slide" ? 0 : o.sill;
    if (sill > 0) e.rect(h0, 0, h1, sill, { fill: POCHE });
    if (o.kind === "window" || o.kind === "vent" || o.kind === "slide") {
      e.rect(h0 + 0.1, sill, h1 - 0.1, o.head, { fill: "none", stroke: INK, stroke_width: 0.8 });
      e.line((h0 + h1) / 2, sill, (h0 + h1) / 2, o.head, { stroke: AIR, stroke_width: 1.4 });
    } else if (o.kind === "door") {
      e.line(h0, 0, h0, o.head, { stroke: INK, stroke_width: 0.6 });
      e.line(h1, 0, h1, o.head, { stroke: INK, stroke_width: 0.6 });
    }
    e.rect(h0, o.head, h1, o.head + 0.5, { fill: RCC });
    if (o.fanlight) {
      e.rect(h0, o.head + 0.5, h1, o.head + 1.75, { fill: "#fff", stroke: INK, stroke_width: 0.8 });
      e.rect(h0, o.head + 1.75, h1, FLOOR - SLAB, { fill: POCHE });
    } else e.rect(h0, o.head + 0.5, h1, FLOOR - SLAB, { fill: POCHE });
    if (o.face !== "int" && o.kind !== "door" && CHAJJA > 0) {
      const outward = (o.face === "S" || o.face === "W") ? -1 : 1;
      const base = outward < 0 ? h0 : h1, tip = base + outward * CHAJJA;
      e.poly([[base, o.head], [base, o.head + 0.5], [tip, o.head + 0.33], [tip, o.head + 0.17]], { fill: RCC });
    }
  }

  // roof slabs: each crossing roof minus courts and stair wells; beams on grid lines; parapets on outer edges
  const holes = [...HOUSE.courts, ...STAIR_WELLS].filter(cross).map(hr);
  const spans: [number, number][] = [];
  for (const { r } of roofs) {
    let pieces: [number, number][] = [hr(r)];
    for (const [a, b] of holes) pieces = pieces.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [...(a > p ? [[p, a]] : []), ...(b < q ? [[b, q]] : [])]) as [number, number][]);
    spans.push(...pieces);
  }
  for (const [a, b] of spans) {
    e.rect(a, FLOOR - SLAB, b, FLOOR, { fill: RCC });
    e.rect(a, FLOOR, b, FLOOR + 0.22, { fill: "#c9c3b7" });
  }
  for (const g of cutX ? HOUSE.grid.y : HOUSE.grid.x) if (spans.some(([a, b]) => g > a - 0.4 && g < b + 0.4)) e.rect(g - 0.375, FLOOR - BEAM, g + 0.375, FLOOR, { fill: RCC });
  for (const sg of roofEdges()) {
    const crosses = cutX ? sg.y0 === sg.y1 && sg.x0 < c && sg.x1 > c : sg.x0 === sg.x1 && sg.y0 < c && sg.y1 > c;
    if (!crosses || sg.dependsOn2) continue;
    const h = cutX ? sg.y0 : sg.x0;
    const inward = spans.some(([a]) => Math.abs(a - h) < 0.05) ? 1 : -1;
    const [h0, h1] = inward > 0 ? [h, h + 0.375] : [h - 0.375, h];
    e.rect(h0, FLOOR, h1, FLOOR + PARAPET, { fill: POCHE });
  }
  for (const ct of HOUSE.courts.filter(cross)) {
    const [a, b] = hr(ct);
    railing(e, a - 0.6, a - 0.1, FLOOR, FLOOR + PARAPET);
    railing(e, b + 0.1, b + 0.6, FLOOR, FLOOR + PARAPET);
    for (const dh of [-1, 0, 1]) e.line((a + b) / 2 + dh * 2.2, FLOOR + 9, (a + b) / 2 + dh * 1.1, 1.2, { stroke: "#f59e0b", stroke_width: 1.8, opacity: 0.85 });
    e.text((a + b) / 2, FLOOR + 9.8, "open to sky", { size: 9, fill: "#b45309", weight: 700, halo: true });
  }

  // stairs crossing the cut, seen side-on
  for (const d of STAIRS) {
    if (!cross(d.well) || (d.spec.axis === "y") !== cutX) continue;
    const inF1 = c > d.flight1[0] && c < d.flight1[1];
    const half = STAIR_RISERS / 2, zl = half * STAIR_RISE;
    for (const [from, dir, z0, cut] of [[d.start, d.dir, 0, inF1], [d.turn, -d.dir, zl, !inF1]] as const) {
      const pts: [number, number][] = [[from, z0]];
      for (let i = 0; i < half; i++) { pts.push([from + dir * i * STAIR_TREAD, z0 + (i + 1) * STAIR_RISE]); if (i < half - 1) pts.push([from + dir * (i + 1) * STAIR_TREAD, z0 + (i + 1) * STAIR_RISE]); }
      pts.push([from + dir * (half - 1) * STAIR_TREAD, z0 + half * STAIR_RISE - 0.7], [from, z0 - 0.6]);
      e.poly(pts, cut ? { fill: RCC, stroke: INK, stroke_width: 0.6 } : { fill: "#d6ccbb", stroke: "#9a8f7e", stroke_width: 0.8 });
    }
    e.rect(d.landing[0], zl - 0.5, d.landing[1], zl, { fill: RCC });
    e.text((d.start + d.turn) / 2, 1.2, `STAIR · ${STAIR_RISERS} risers`, { size: 9.5, weight: 700, halo: true });
  }

  // future floors (dashed): the same walls and slabs, the same openings
  const fut = { fill: "none", stroke: FUT, stroke_width: 0.9, stroke_dasharray: "6 4" };
  for (let lvl = 1; lvl < FLOORS_TOTAL; lvl++) {
    const base = lvl * FLOOR;
    for (const w of cutWalls.filter((w) => w.kind === "ext" || w.kind === "int")) { const [h0, h1] = hr(w); e.rect(h0, base, h1, base + FLOOR - SLAB, fut); }
    for (const [a, b] of spans) e.rect(a, base + FLOOR - SLAB, b, base + FLOOR, fut);
    if (spans.length) e.text((spans[0][0] + spans[spans.length - 1][1]) / 2, base + FLOOR / 2 + 2.2, lvl === 1 ? "FUTURE FIRST FLOOR" : `FUTURE FLOOR ${lvl + 1}`, { size: 11, fill: FUT, weight: 700, halo: true });
  }

  // room names (from the labelled floors crossing the line) and people for scale
  for (const f of MODEL.floors.filter(cross)) {
    const lb = MODEL.labels.find((l) => l.room && l.x >= f.x0 && l.x <= f.x1 && l.y >= f.y0 && l.y <= f.y1);
    const name = lb ? lb.lines[0][0] : f.kind === "corridor" ? "GALLERY" : f.kind === "court" ? "COURT" : "";
    const [a, b] = hr(f);
    if (name && b - a > 2.5) e.text((a + b) / 2, 5.6, name, { size: b - a > 8 ? 10.5 : 9, weight: 700, halo: true });
  }
  if (built.length) person(e, hr(built[0].r)[0] + 5, 0);

  // dimensions
  const zs = [-PLINTH, 0, LINTEL, FLOOR - BEAM, FLOOR, FLOOR + PARAPET];
  dimV(s, zs.map((z) => e.p(0, z)[1]), e.p(p0 - 4, 0)[0], zs.slice(0, -1).map((z, i) => ftin(zs[i + 1] - z)), e.p(p0 - 1.5, 0)[0], 10);
  const hs = [p0, ...[...new Set(built.flatMap(({ r }) => hr(r)))].sort((a, b) => a - b), p1];
  dimH(s, hs.map((h) => e.p(h, 0)[0]), e.p(0, -10.6)[1], hs.slice(0, -1).map((h, i) => (hs[i + 1] - h > 1.2 ? ftin(hs[i + 1] - h) : "")), undefined, 10);
  for (const [z, lab] of [[0, "FFL ±0′-0″"], [FLOOR, `terrace +${ftin(FLOOR)}`]] as const) e.text(p1 + 1.4, z + 0.25, lab, { size: 9, anchor: "start", fill: DIMC });

  // notes
  let y = 120;
  s.text(1060, y, "WHAT THIS SECTION SHOWS", { size: 13, weight: 700, anchor: "start" });
  y += 22;
  sec.notes.forEach((t, i) => { y = paragraph(s, 1060, y, t, 52, 10.5, `${i + 1}.`) + 6; });
  disclaimerBox(s, 1060, y + 10, 330, 9.5);
  return s.toString(`Section ${sec.name}–${sec.name}`);
}
