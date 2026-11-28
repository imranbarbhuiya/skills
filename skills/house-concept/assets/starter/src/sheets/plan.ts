/** Ground-floor plan sheet: the working plan in full, or an earlier option in short form. */
import { designAreas, scheduleCounts, sq } from "../model";
import { AIR, GRIDC, INK, MUTED, PlanView, Svg, dimH, dimV, disclaimerBox, ftin, northArrow, paragraph, scaleBar } from "../svg";
import type { Design, Face, Rect } from "../types";
import { drawModel, drawStair } from "./planDraw";

const K = 13; // px per foot
const TREAD = 10 / 12;
const inside = (x: number, y: number, rs: Rect[], m = 0.6) => rs.some((r) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m);

/** Steps descending toward `down`: a tread line every foot. */
export function drawSteps(v: PlanView, r: Rect, down: Face) {
  v.rect(r.x0, r.y0, r.x1, r.y1, { fill: "#e4e0d6", stroke: INK, stroke_width: 0.9 });
  if (down === "N" || down === "S") for (let y = r.y0 + 1; y < r.y1 - 0.1; y += 1) v.line(r.x0, y, r.x1, y, { stroke: INK, stroke_width: 0.6 });
  else for (let x = r.x0 + 1; x < r.x1 - 0.1; x += 1) v.line(x, r.y0, x, r.y1, { stroke: INK, stroke_width: 0.6 });
}

export function sheetPlan(d: Design, full: boolean): string {
  const p = d.site.plot;
  const roofs1 = d.roofs.filter((r) => r.phase === 1 && !r.slabOnly).map((r) => r.r), roofs2 = d.roofs.filter((r) => r.phase === 2 && !r.slabOnly).map((r) => r.r);
  const all = [...roofs1, ...roofs2];
  const bb = { x0: Math.min(...all.map((r) => r.x0)), y0: Math.min(...all.map((r) => r.y0)), x1: Math.max(...all.map((r) => r.x1)), y1: Math.max(...all.map((r) => r.y1)) };
  const top = p.y1 + 3, bottom = p.y0 - 3, left = p.x0 - 3, right = p.x1 + 3;
  const ox = 230 - left * K, oy = (full ? 250 : 190);
  const planH = (top - bottom) * K;
  const s = new Svg(Math.max(1500, Math.round(ox + right * K + 260)), Math.round(oy + planH + (full ? 560 : 330)));
  const v = new PlanView(s, ox, oy, K, top);
  const a = designAreas(d);

  s.text(40, 44, full ? `GROUND FLOOR PLAN — ${d.name}` : `OPTION · ${d.name}`, { size: 23, anchor: "start", weight: 700 });
  s.text(40, 68, d.tagline, { size: 13, anchor: "start", fill: MUTED });
  if (d.badge) {
    s.rect(40, 80, 128, 22, { fill: "#3f5a2b", rx: 11 });
    s.text(104, 95, d.badge, { size: 11, weight: 700, fill: "#fff" });
  }

  // plot boundary and road
  v.rect(p.x0, p.y0, p.x1, p.y1, { fill: "none", stroke: "#9a3412", stroke_width: 1.6, stroke_dasharray: "12 4 2 4" });
  const road = d.site.road.side;
  const rb = road === "N" ? [p.x0, p.y1, p.x1, p.y1 + 2.5] : road === "S" ? [p.x0, p.y0 - 2.5, p.x1, p.y0] : road === "E" ? [p.x1, p.y0, p.x1 + 2.5, p.y1] : [p.x0 - 2.5, p.y0, p.x0, p.y1];
  v.rect(rb[0], rb[1], rb[2], rb[3], { fill: "#8b9097" });
  const [rx, ry] = [(rb[0] + rb[2]) / 2, (rb[1] + rb[3]) / 2];
  v.text(rx, ry - 0.35, "ROAD", { size: 10, weight: 700, fill: "#fff", rotate: road === "E" || road === "W" ? -90 : undefined });
  if (d.site.parking) v.rect(d.site.parking.x0, d.site.parking.y0, d.site.parking.x1, d.site.parking.y1, { fill: "none", stroke: MUTED, stroke_width: 1, stroke_dasharray: "5 4" });
  if (d.site.parking) v.text((d.site.parking.x0 + d.site.parking.x1) / 2, (d.site.parking.y0 + d.site.parking.y1) / 2, "parking", { size: 10, fill: MUTED });

  // phase 2: drawn, then faded, with a dashed outline
  if (d.phase2) {
    drawModel(v, d.phase2.m);
    for (const r of roofs2) {
      v.rect(r.x0, r.y0, r.x1, r.y1, { fill: "#fbfaf7", opacity: 0.55 });
      v.rect(r.x0 - 0.3, r.y0 - 0.3, r.x1 + 0.3, r.y1 + 0.3, { fill: "none", stroke: "#92400e", stroke_width: 1.4, stroke_dasharray: "7 5" });
    }
  }
  for (const pr of d.porches) v.rect(pr.x0, pr.y0, pr.x1, pr.y1, { fill: "#ece7dc", stroke: "#b8ad97", stroke_width: 0.6 });
  drawModel(v, d.m);
  for (const st of d.stairs) drawStair(v, st, TREAD, 8);
  for (const { r } of d.roofs.filter((r) => r.slabOnly)) {
    v.rect(r.x0, r.y0, r.x1, r.y1, { fill: "none", stroke: INK, stroke_width: 0.9, stroke_dasharray: "6 3" });
    v.text((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2 - 0.3, "bridge above", { size: 7.5, fill: MUTED, halo: true });
  }
  for (const st of d.steps) drawSteps(v, st.r, st.down);
  for (const c of d.canopies) v.rect(c.x0, c.y0, c.x1, c.y1, { fill: "none", stroke: INK, stroke_width: 0.9, stroke_dasharray: "6 3" });
  // phase-2 label last, above the porch and the parking outline
  if (d.phase2 && roofs2[0]) v.text(roofs2[0].x0 + 0.5, roofs2[0].y1 + 4.2, d.phase2.label, { size: 9, weight: 700, fill: "#92400e", halo: true, anchor: "start" });
  for (const c of d.courts) {
    v.rect(c.x0, c.y0, c.x1, c.y1, { fill: "none", stroke: AIR, stroke_width: 1.2, stroke_dasharray: "5 3" });
    v.line(c.x0, c.y0, c.x1, c.y1, { stroke: AIR, stroke_width: 0.5, opacity: 0.6 });
    v.line(c.x0, c.y1, c.x1, c.y0, { stroke: AIR, stroke_width: 0.5, opacity: 0.6 });
  }
  for (const gx of d.grid.x) for (const gy of d.grid.y) {
    if (!inside(gx, gy, all)) continue;
    const later = !inside(gx, gy, roofs1);
    v.rect(gx - 0.5, gy - 0.5, gx + 0.5, gy + 0.5, later ? { fill: "#fff", stroke: "#92400e", stroke_width: 1, stroke_dasharray: "2 2" } : { fill: "#15181c" });
  }

  // dimensions: grid spacing + overall, setbacks to the plot
  const px = (x: number) => v.p(x, 0)[0], py = (y: number) => v.p(0, y)[1];
  const gxs = [bb.x0, ...d.grid.x.slice(1, -1), bb.x1], gys = [bb.y0, ...d.grid.y.slice(1, -1), bb.y1];
  dimH(s, gxs.map(px), py(top) - 12, gxs.slice(0, -1).map((x, i) => ftin(gxs[i + 1] - x)), undefined, 10.5);
  dimH(s, [px(bb.x0), px(bb.x1)], py(top) - 38, [`${ftin(bb.x1 - bb.x0)} overall`], undefined, 12);
  dimV(s, gys.map(py), px(p.x0) - 30, gys.slice(0, -1).map((y, i) => ftin(gys[i + 1] - y)), px(bb.x0) - 4, 10.5);
  dimV(s, [py(bb.y0), py(bb.y1)], px(p.x0) - 58, [`${ftin(bb.y1 - bb.y0)} overall`], undefined, 12);
  const sb = { N: p.y1 - bb.y1, S: bb.y0 - p.y0, E: p.x1 - bb.x1, W: bb.x0 - p.x0 };
  const sbs = { fill: "#9a3412", weight: 700, halo: true, size: 9.5 } as const;
  v.text(bb.x1 - 4, p.y1 - 1.0, `${ftin(sb.N)} to the north boundary`, { ...sbs, anchor: "end" });
  v.text(bb.x1 - 4, p.y0 + 0.6, `${ftin(sb.S)} to the south boundary`, { ...sbs, anchor: "end" });
  v.text(p.x1 + 1.2, bb.y0 + 6, `${ftin(sb.E)} east`, { ...sbs, rotate: -90 });
  v.text(p.x0 - 1.2, bb.y0 + 6, `${ftin(sb.W)} west`, { ...sbs, rotate: -90 });

  if (full) {
    // grid bubbles and section marks
    const st = { stroke: GRIDC, stroke_width: 0.6, stroke_dasharray: "10 3 2 3", opacity: 0.55 };
    d.grid.x.forEach((gx, i) => {
      v.line(gx, bb.y0 - 2, gx, bb.y1 + 2, st);
      s.circle(px(gx), oy - 64, 11, { fill: "#fff", stroke: GRIDC, stroke_width: 1.1 });
      s.text(px(gx), oy - 59.5, String(i + 1), { size: 12, weight: 700, fill: GRIDC });
    });
    d.grid.y.forEach((gy, j) => {
      v.line(bb.x0 - 2, gy, bb.x1 + 2, gy, st);
      s.circle(px(left) - 70, py(gy), 11, { fill: "#fff", stroke: GRIDC, stroke_width: 1.1 });
      s.text(px(left) - 70, py(gy) + 4.5, "ABCDEFGH"[j], { size: 12, weight: 700, fill: GRIDC });
    });
    for (const sec of d.sections) {
      const ends: [number, number][] = sec.axis === "x" ? [[sec.at, bb.y0 - 2.5], [sec.at, bb.y1 + 2.5]] : [[bb.x0 - 2.5, sec.at], [bb.x1 + 2.5, sec.at]];
      v.line(...ends[0], ...ends[1], { stroke: INK, stroke_width: 0.7, stroke_dasharray: "14 4 3 4", opacity: 0.6 });
      for (const [x, y] of ends) {
        const [X, Y] = v.p(x, y);
        // arrows show the looking direction: west for x-cuts, north for y-cuts
        if (sec.axis === "x") { s.line(X, Y, X - 20, Y, { stroke: INK, stroke_width: 1.6 }); s.poly([[X - 28, Y], [X - 19, Y - 5], [X - 19, Y + 5]], { fill: INK }); s.text(X + 9, Y + 4.5, sec.name, { size: 12, weight: 700 }); }
        else { s.line(X, Y, X, Y - 20, { stroke: INK, stroke_width: 1.6 }); s.poly([[X, Y - 28], [X - 5, Y - 19], [X + 5, Y - 19]], { fill: INK }); s.text(X, Y + 16, sec.name, { size: 12, weight: 700 }); }
      }
    }
  }
  northArrow(s, s.w - 60, 70, 22);
  scaleBar(s, s.w - 300, oy + planH + 24, K, [0, 5, 10, 20]);

  // panel
  let y = oy + planH + 70;
  const col = (x: number, heading: string, lines: string[], width: number, bullet = "•") => {
    let yy = y;
    s.text(x, yy, heading, { size: 12, weight: 700, anchor: "start" });
    yy += 18;
    for (const t of lines) yy = paragraph(s, x, yy, t, width, 10.5, bullet) + 4;
    return yy;
  };
  const vsBrief = a.brief ? ` (brief ${sq(a.brief)} · ${a.p1 >= a.brief ? "+" : ""}${Math.round((a.p1 / a.brief - 1) * 100)}%)` : "";
  const yAreas = col(40, "AREAS", [
    `${d.phase2 ? "Phase 1 built" : "Built"}: ${sq(a.p1)} sq ft${vsBrief}${a.courts ? `, court ${sq(a.courts)} sq ft open to sky` : ""}`,
    ...(d.phase2 ? [`Phase 2: ${sq(a.p2)} sq ft · total ${sq(a.total)} sq ft`] : []),
    `House ${ftin(bb.x1 - bb.x0)} × ${ftin(bb.y1 - bb.y0)} on a ${ftin(p.x1 - p.x0)} × ${ftin(p.y1 - p.y0)} plot; road on the ${{ N: "north", S: "south", E: "east", W: "west" }[road]}`,
  ], 62);
  if (full) {
    if (d.notes.box) {
      const bx = 40, by = yAreas + 14, bw = 430, y0 = by + 40;
      let yEnd = y0;
      const tmp = new Svg(1, 1, null);
      for (const t of d.notes.box.lines) yEnd = paragraph(tmp, bx + 14, yEnd, t, 64, 10.5, "•") + 4;
      s.rect(bx, by, bw, yEnd - by, { fill: "#fff7ed", stroke: "#c2410c", stroke_width: 1, rx: 6 });
      s.text(bx + 14, by + 22, d.notes.box.title, { size: 11.5, weight: 700, anchor: "start", fill: "#9a3412" });
      let yy = y0;
      for (const t of d.notes.box.lines) yy = paragraph(s, bx + 14, yy, t, 64, 10.5, "•") + 4;
    }
    const c = scheduleCounts(d.phase2 ? { ...d.m, openings: [...d.m.openings, ...d.phase2.m.openings] } : d.m);
    let yy = y;
    s.text(500, yy, "DOOR & WINDOW SCHEDULE", { size: 12, weight: 700, anchor: "start" });
    yy += 4;
    for (const [tag, [size, desc]] of Object.entries(d.schedule)) {
      if (!c[tag]) continue;
      yy += 15;
      s.text(500, yy, tag, { size: 10, weight: 700, anchor: "start" });
      s.text(528, yy, size, { size: 10, anchor: "start" });
      s.text(600, yy, desc, { size: 9.5, anchor: "start", fill: MUTED });
      s.text(860, yy, `×${c[tag]}`, { size: 10, anchor: "end" });
    }
    const yEnd = col(940, "NOTES", d.notes.plan, 62);
    disclaimerBox(s, 940, Math.max(yEnd + 10, y + 200), 470, 9.5);
  } else {
    disclaimerBox(s, 500, y, 470, 9.5);
  }
  return s.toString(full ? "Ground floor plan" : `Option ${d.name}`);
}
