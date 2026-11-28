/** Site plan (plot, road, setbacks, services) and the structural grid brief for the engineer. */
import { BBOX, COLUMNS, GX, GY, HOUSE, MODEL, PLOT, SITE, STAIR_TREAD, title } from "../model";
import { DIMC, GRIDC, MUTED, PlanView, Svg, dimH, dimV, disclaimerBox, ftin, northArrow, paragraph, scaleBar } from "../svg";
import type { Rect } from "../types";
import { drawSteps } from "./plan";
import { drawModel, drawStair } from "./planDraw";

const built = HOUSE.roofs.filter((r) => !r.slabOnly);

export function sheetSite(): string {
  const k = 9;
  const road = SITE.road;
  const pad = road.width + 8;
  const vx0 = PLOT.x0 - (road.side === "W" ? pad : 8), vx1 = PLOT.x1 + (road.side === "E" ? pad : 8);
  const vy0 = PLOT.y0 - (road.side === "S" ? pad : 8), vy1 = PLOT.y1 + (road.side === "N" ? pad : 8);
  const s = new Svg(Math.max(1300, Math.round((vx1 - vx0) * k + 560)), Math.round((vy1 - vy0) * k + 260));
  const v = new PlanView(s, 80 - vx0 * k, 110, k, vy1);
  s.text(40, 46, "SITE PLAN — schematic", { size: 22, anchor: "start", weight: 700 });
  s.text(40, 70, "Plot limits as described by the family; confirm with a survey. Services are indicative.", { size: 12.5, anchor: "start", fill: MUTED });
  v.rect(vx0, vy0, vx1, vy1, { fill: "#e7eedc" });
  v.rect(PLOT.x0, PLOT.y0, PLOT.x1, PLOT.y1, { fill: "#f4f1e8", stroke: "#9a3412", stroke_width: 2, stroke_dasharray: "12 4 2 4" });
  const rr: Rect = road.side === "N" ? { x0: vx0, y0: PLOT.y1 + 3, x1: vx1, y1: PLOT.y1 + 3 + road.width }
    : road.side === "S" ? { x0: vx0, y0: PLOT.y0 - 3 - road.width, x1: vx1, y1: PLOT.y0 - 3 }
    : road.side === "E" ? { x0: PLOT.x1 + 3, y0: vy0, x1: PLOT.x1 + 3 + road.width, y1: vy1 } : { x0: PLOT.x0 - 3 - road.width, y0: vy0, x1: PLOT.x0 - 3, y1: vy1 };
  v.rect(rr.x0, rr.y0, rr.x1, rr.y1, { fill: "#6b6f76" });
  v.text((rr.x0 + rr.x1) / 2, (rr.y0 + rr.y1) / 2 - 0.5, `ROAD (${road.width}′)`, { size: 12, weight: 700, fill: "#fff", rotate: road.side === "E" || road.side === "W" ? -90 : undefined });
  const p = SITE.path;
  v.rect(p.x0, p.y0, p.x1, p.y1, { fill: "#e3dccd", stroke: "#b8ad97", stroke_width: 0.6 });
  const [g0, g1] = SITE.gate;
  if (road.side === "N" || road.side === "S") v.line(g0, road.side === "N" ? PLOT.y1 : PLOT.y0, g1, road.side === "N" ? PLOT.y1 : PLOT.y0, { stroke: "#9a3412", stroke_width: 4 });
  else v.line(road.side === "E" ? PLOT.x1 : PLOT.x0, g0, road.side === "E" ? PLOT.x1 : PLOT.x0, g1, { stroke: "#9a3412", stroke_width: 4 });
  if (SITE.parking) { const pk = SITE.parking; v.rect(pk.x0, pk.y0, pk.x1, pk.y1, { fill: "none", stroke: MUTED, stroke_width: 1, stroke_dasharray: "5 4" }); v.text((pk.x0 + pk.x1) / 2, (pk.y0 + pk.y1) / 2, "parking", { size: 10, fill: MUTED }); }
  for (const pr of HOUSE.porches) v.rect(pr.x0, pr.y0, pr.x1, pr.y1, { fill: "#ece7dc", stroke: "#b8ad97", stroke_width: 0.6 });
  drawModel(v, MODEL, { furniture: false, labels: false, light: true });
  for (const st of HOUSE.stairs) drawStair(v, st, STAIR_TREAD, 8, false);
  for (const st of HOUSE.steps) drawSteps(v, st.r, st.down);
  for (const { x, y } of COLUMNS) v.rect(x - 0.5, y - 0.5, x + 0.5, y + 0.5, { fill: "#6b717b" });
  for (const lb of MODEL.labels) if (lb.room) v.text(lb.x, lb.y, title(lb.lines[0][0]), { size: 8.5, weight: 700, fill: "#4b5059" });
  for (const { r, phase } of built) if (phase === 2) v.rect(r.x0 - 0.3, r.y0 - 0.3, r.x1 + 0.3, r.y1 + 0.3, { fill: "none", stroke: "#92400e", stroke_width: 1.2, stroke_dasharray: "6 4" });
  if (SITE.septic) { const sp = SITE.septic; v.rect(sp.x0, sp.y0, sp.x1, sp.y1, { fill: "#d9d2c3", stroke: "#6b5a3a", stroke_width: 1 }); v.text((sp.x0 + sp.x1) / 2, (sp.y0 + sp.y1) / 2 - 0.4, "septic tank", { size: 8.5, fill: "#6b5a3a" }); }
  if (SITE.soakPit) { const sk = SITE.soakPit; v.circle(sk.x, sk.y, sk.r, { fill: "#e7e1d4", stroke: "#6b5a3a", stroke_width: 1 }); v.text(sk.x, sk.y - 0.4, "soak pit", { size: 8.5, fill: "#6b5a3a" }); }
  for (const [x, y, r] of SITE.trees) v.circle(x, y, r, { fill: "#b9cf9a", stroke: "#7f9a5f", stroke_width: 0.8, opacity: 0.9 });
  // setbacks
  const px = (x: number) => v.p(x, 0)[0], py = (y: number) => v.p(0, y)[1];
  dimV(s, [py(PLOT.y0), py(BBOX.y0), py(BBOX.y1), py(PLOT.y1)], px(PLOT.x0) - 26, [ftin(BBOX.y0 - PLOT.y0), ftin(BBOX.y1 - BBOX.y0), ftin(PLOT.y1 - BBOX.y1)], px(BBOX.x0), 10.5);
  dimH(s, [px(PLOT.x0), px(BBOX.x0), px(BBOX.x1), px(PLOT.x1)], py(PLOT.y0) + 30, [ftin(BBOX.x0 - PLOT.x0), ftin(BBOX.x1 - BBOX.x0), ftin(PLOT.x1 - BBOX.x1)], py(BBOX.y0), 10.5);
  s.text((px(PLOT.x0) + px(PLOT.x1)) / 2, py(PLOT.y0) + 56, `plot ${ftin(PLOT.x1 - PLOT.x0)} × ${ftin(PLOT.y1 - PLOT.y0)}`, { size: 11, weight: 700, fill: "#9a3412" });
  northArrow(s, s.w - 60, 70, 22);
  const nx = px(vx1) + 30;
  scaleBar(s, nx, 120, k, [0, 10, 20, 30]);
  let y = 180;
  s.text(nx, y, "NOTES", { size: 12, weight: 700, anchor: "start" });
  y += 20;
  SITE.notes.forEach((t, i) => { y = paragraph(s, nx, y, t, 52, 10.5, `${i + 1}.`) + 6; });
  disclaimerBox(s, nx, y + 10, 360, 9.5);
  return s.toString("Site plan — schematic");
}

export function sheetStructure(): string {
  const k = 12;
  // the view covers the house and any outside stair
  const vb = [BBOX, ...HOUSE.stairs].reduce((a, r) => ({ x0: Math.min(a.x0, r.x0), y0: Math.min(a.y0, r.y0), x1: Math.max(a.x1, r.x1), y1: Math.max(a.y1, r.y1) }), BBOX);
  const span = { x: BBOX.x1 - BBOX.x0, y: vb.y1 - vb.y0 };
  const ox = 150 - vb.x0 * k, oy = 230;
  const s = new Svg(Math.max(1500, Math.round(150 + (vb.x1 - vb.x0) * k + 640)), Math.max(820, Math.round(oy + span.y * k + 160)));
  const v = new PlanView(s, ox, oy, k, vb.y1);
  s.text(40, 46, `STRUCTURAL GRID — indicative brief for the engineer (G+${HOUSE.heights.floorsTotal - 1}, seismic zone ${HOUSE.project.seismicZone})`, { size: 22, anchor: "start", weight: 700 });
  s.text(40, 70, "Not a structural design. Member sizes, reinforcement and footings are for the structural engineer after a soil test.", { size: 12.5, anchor: "start", fill: "#9a3412" });
  drawModel(v, MODEL, { furniture: false, labels: false, light: true });
  for (const { x, y } of COLUMNS) v.rect(x - 2.5, y - 2.5, x + 2.5, y + 2.5, { fill: "none", stroke: "#7b818b", stroke_width: 0.8, stroke_dasharray: "4 3" });
  const beam = { stroke: "#9a3412", stroke_width: 2.2, opacity: 0.85 };
  const has = (x: number, y: number) => COLUMNS.some((c) => Math.abs(c.x - x) < 0.01 && Math.abs(c.y - y) < 0.01);
  for (const gy of GY) for (let i = 0; i < GX.length - 1; i++) if (has(GX[i], gy) && has(GX[i + 1], gy)) v.line(GX[i] + 0.5, gy, GX[i + 1] - 0.5, gy, beam);
  for (const gx of GX) for (let j = 0; j < GY.length - 1; j++) if (has(gx, GY[j]) && has(gx, GY[j + 1])) v.line(gx, GY[j] + 0.5, gx, GY[j + 1] - 0.5, beam);
  for (const st of HOUSE.stairs) drawStair(v, st, STAIR_TREAD, 8, false);
  for (const c of HOUSE.courts) {
    v.rect(c.x0, c.y0, c.x1, c.y1, { fill: "#dbeafe", stroke: "#1d4ed8", stroke_width: 1.6 });
    v.line(c.x0, c.y0, c.x1, c.y1, { stroke: "#1d4ed8", stroke_width: 0.8 });
    v.line(c.x0, c.y1, c.x1, c.y0, { stroke: "#1d4ed8", stroke_width: 0.8 });
    v.text((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, "SLAB OPENING", { size: 8.5, fill: "#1d4ed8", weight: 700, halo: true });
    for (const x of [c.x0, c.x1]) v.line(x, c.y0 - 0.4, x, c.y1 + 0.4, { stroke: "#9a3412", stroke_width: 1.6, stroke_dasharray: "6 3" });
  }
  for (const { x, y, i, j, phase2 } of COLUMNS) {
    v.rect(x - 0.5, y - 0.5, x + 0.5, y + 0.5, phase2 ? { fill: "#fff", stroke: "#92400e", stroke_width: 1, stroke_dasharray: "2 2" } : { fill: "#15181c" });
    v.text(x + 0.75, y + 0.85, `${"ABCDEFGH"[j]}${i + 1}`, { size: 8, weight: 700, anchor: "start" });
  }
  GX.forEach((gx, i) => {
    const [X, Y] = v.p(gx, vb.y1 + 3);
    v.line(gx, BBOX.y0 - 2, gx, vb.y1 + 3, { stroke: GRIDC, stroke_width: 0.6, stroke_dasharray: "10 3 2 3", opacity: 0.6 });
    s.circle(X, Y - 12, 11, { fill: "#fff", stroke: GRIDC, stroke_width: 1.1 });
    s.text(X, Y - 7.5, String(i + 1), { size: 12, weight: 700, fill: GRIDC });
  });
  GY.forEach((gy, j) => {
    const [X, Y] = v.p(BBOX.x0 - 3, gy);
    v.line(BBOX.x0 - 3, gy, BBOX.x1 + 2, gy, { stroke: GRIDC, stroke_width: 0.6, stroke_dasharray: "10 3 2 3", opacity: 0.6 });
    s.circle(X - 12, Y, 11, { fill: "#fff", stroke: GRIDC, stroke_width: 1.1 });
    s.text(X - 12, Y + 4.5, "ABCDEFGH"[j], { size: 12, weight: 700, fill: GRIDC });
  });
  for (let i = 0; i < GX.length - 1; i++) v.text((GX[i] + GX[i + 1]) / 2, BBOX.y0 - 2.4, ftin(GX[i + 1] - GX[i]), { size: 10, fill: DIMC });
  for (let j = 0; j < GY.length - 1; j++) { const [X, Y] = v.p(BBOX.x1 + 1.6, (GY[j] + GY[j + 1]) / 2); s.text(X, Y, ftin(GY[j + 1] - GY[j]), { size: 10, fill: DIMC, rotate: -90 }); }
  const ly = oy + span.y * k + 40;
  s.rect(150, ly - 8, 14, 14, { fill: "#15181c" });
  s.text(172, ly + 4, `column (${COLUMNS.length} nos.) — 12″×12″ placeholder; hollow = phase 2`, { size: 10.5, anchor: "start" });
  s.line(560, ly, 590, ly, beam);
  s.text(598, ly + 4, "beam on grid line; dashed = edge beam at a slab opening", { size: 10.5, anchor: "start" });
  const rx = Math.round(v.p(BBOX.x1, 0)[0] + 120);
  let y = 120;
  s.text(rx, y, "BRIEF FOR THE STRUCTURAL ENGINEER", { size: 13, weight: 700, anchor: "start" });
  y += 22;
  const spans = [...GX.slice(1).map((g, i) => g - GX[i]), ...GY.slice(1).map((g, j) => g - GY[j])];
  const brief = [...HOUSE.notes.brief, `Plan ${ftin(BBOX.x1 - BBOX.x0)} × ${ftin(BBOX.y1 - BBOX.y0)}; column spans ${ftin(Math.min(...spans))} to ${ftin(Math.max(...spans))}. Upper floors stay on these columns: no floating columns, no set-backs.`];
  brief.forEach((t, i) => { y = paragraph(s, rx, y, t, 56, 10.5, `${i + 1}.`) + 6; });
  disclaimerBox(s, rx, y + 8, 360, 9.5);
  s.text(150, ly + 30, "Plinth / tie beams run on the same lines and connect every footing in both directions.", { size: 10.5, anchor: "start", fill: MUTED });
  return s.toString("Structural grid — indicative");
}
