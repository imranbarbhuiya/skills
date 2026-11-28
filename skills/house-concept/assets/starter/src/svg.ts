/** Tiny SVG string builder + drawing helpers shared by every 2D sheet. */
import { HOUSE } from "./design/house";

export const FONT = "Inter, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif";
export const INK = "#1f2933";
export const MUTED = "#5f6b7a";
export const BG = "#fbfaf7";
export const DIMC = "#56606e";
export const GRIDC = "#c2410c";
export const FUT = "#4f46e5";
export const AIR = "#2b7bb9";

export const n = (v: number) => (Math.round(v * 100) / 100).toString();
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Attrs = Record<string, string | number | undefined | null | false>;
const attrs = (a: Attrs) =>
  Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k.replace(/_/g, "-")}="${esc(typeof v === "number" ? n(v) : String(v))}"`)
    .join(" ");

export type Pt = [number, number];

export interface TextOpts {
  size?: number; anchor?: "start" | "middle" | "end"; weight?: number | null; fill?: string; rotate?: number;
  italic?: boolean; opacity?: number; halo?: boolean;
}

export class Svg {
  parts: string[] = [];
  constructor(public w: number, public h: number, bg: string | null = BG, public font = FONT) {
    if (bg) this.rect(0, 0, w, h, { fill: bg });
  }
  raw(s: string) { this.parts.push(s); }
  rect(x: number, y: number, w: number, h: number, a: Attrs = {}) {
    this.parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs(a)}/>`);
  }
  line(x1: number, y1: number, x2: number, y2: number, a: Attrs = {}) {
    this.parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${attrs({ stroke: INK, ...a })}/>`);
  }
  poly(pts: Pt[], a: Attrs = {}, closed = true) {
    const p = pts.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
    this.parts.push(closed ? `<polygon points="${p}" ${attrs(a)}/>` : `<polyline points="${p}" ${attrs({ fill: "none", ...a })}/>`);
  }
  circle(cx: number, cy: number, r: number, a: Attrs = {}) {
    this.parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs(a)}/>`);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, a: Attrs = {}) {
    this.parts.push(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" ${attrs(a)}/>`);
  }
  path(d: string, a: Attrs = {}) { this.parts.push(`<path d="${d}" ${attrs(a)}/>`); }
  text(x: number, y: number, s: string, o: TextOpts = {}) {
    const tr = o.rotate ? ` transform="rotate(${n(o.rotate)} ${n(x)} ${n(y)})"` : "";
    const a = attrs({
      "font-size": o.size ?? 12, "text-anchor": o.anchor ?? "middle", "font-weight": o.weight ?? undefined,
      fill: o.fill ?? INK, "font-style": o.italic ? "italic" : undefined, opacity: o.opacity,
      stroke: o.halo ? "#ffffff" : undefined, "stroke-width": o.halo ? 3.5 : undefined,
      "paint-order": o.halo ? "stroke" : undefined, "stroke-linejoin": o.halo ? "round" : undefined,
    });
    this.parts.push(`<text x="${n(x)}" y="${n(y)}" ${a}${tr}>${esc(s)}</text>`);
  }
  toString(title: string) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" font-family="${this.font}">\n<title>${esc(title)}</title>\n${this.parts.join("\n")}\n</svg>\n`;
  }
}

/** 13.5 → 13′-6″, 0.375 → 4½″ (nearest quarter inch). */
export function ftin(ft: number): string {
  const q = Math.round(ft * 48);
  const feet = Math.floor(q / 48);
  const rem = q - feet * 48;
  const inches = Math.floor(rem / 4);
  const frac = ["", "¼", "½", "¾"][rem % 4];
  return feet === 0 ? `${inches}${frac}″` : `${feet}′-${inches}${frac}″`;
}

export function dimH(s: Svg, xs: number[], y: number, labels: string[], extTo?: number, size = 11, color = DIMC) {
  s.line(xs[0] - 6, y, xs[xs.length - 1] + 6, y, { stroke: color, stroke_width: 0.9 });
  for (const x of xs) {
    s.line(x - 3.5, y + 3.5, x + 3.5, y - 3.5, { stroke: color, stroke_width: 1.3 });
    if (extTo !== undefined) {
      const d = y > extTo ? 1 : -1;
      s.line(x, extTo + 4 * d, x, y + 5 * d, { stroke: color, stroke_width: 0.6, opacity: 0.8 });
    }
  }
  labels.forEach((lab, i) => { if (lab) s.text((xs[i] + xs[i + 1]) / 2, y - 5, lab, { size, fill: color }); });
}

export function dimV(s: Svg, ys: number[], x: number, labels: string[], extTo?: number, size = 11, color = DIMC) {
  s.line(x, Math.min(...ys) - 6, x, Math.max(...ys) + 6, { stroke: color, stroke_width: 0.9 });
  for (const y of ys) {
    s.line(x - 3.5, y + 3.5, x + 3.5, y - 3.5, { stroke: color, stroke_width: 1.3 });
    if (extTo !== undefined) {
      const d = x > extTo ? 1 : -1;
      s.line(extTo + 4 * d, y, x + 5 * d, y, { stroke: color, stroke_width: 0.6, opacity: 0.8 });
    }
  }
  labels.forEach((lab, i) => { if (lab) s.text(x - 5, (ys[i] + ys[i + 1]) / 2, lab, { size, fill: color, rotate: -90 }); });
}

export function northArrow(s: Svg, cx: number, cy: number, r = 26) {
  s.circle(cx, cy, r, { fill: "none", stroke: INK, stroke_width: 1 });
  s.poly([[cx, cy - r + 3], [cx + r * 0.32, cy + r * 0.55], [cx, cy + r * 0.3]], { fill: INK });
  s.poly([[cx, cy - r + 3], [cx - r * 0.32, cy + r * 0.55], [cx, cy + r * 0.3]], { fill: "#fff", stroke: INK, stroke_width: 1 });
  s.text(cx, cy - r - 5, "N", { size: 13, weight: 700 });
}

export function scaleBar(s: Svg, x: number, y: number, pxPerFt: number, feet = [0, 5, 10, 20]) {
  for (let i = 0; i < feet.length - 1; i++) {
    s.rect(x + feet[i] * pxPerFt, y, (feet[i + 1] - feet[i]) * pxPerFt, 6, { fill: i % 2 === 0 ? INK : "#fff", stroke: INK, stroke_width: 0.8 });
  }
  for (const f of feet) s.text(x + f * pxPerFt, y + 19, String(f), { size: 10, fill: MUTED });
  s.text(x + feet[feet.length - 1] * pxPerFt + 8, y + 7, "feet", { size: 10, anchor: "start", fill: MUTED });
}

export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if (cur && cur.length + w.length + 1 > width) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function paragraph(s: Svg, x: number, y: number, text: string, widthChars: number, size = 11, bullet?: string, fill = INK) {
  const lh = size * 1.4;
  const lines = wrap(text, widthChars);
  lines.forEach((line, i) => {
    const prefix = bullet ? (i === 0 ? `${bullet} ` : "   ") : "";
    s.text(x, y + i * lh, prefix + line, { size, anchor: "start", fill });
  });
  return y + lines.length * lh;
}

export const DISCLAIMER =
  "CONCEPT ONLY — NOT FOR CONSTRUCTION. A licensed architect and a structural engineer must prepare the final " +
  `architectural, structural (seismic zone ${HOUSE.project.seismicZone}) and approval drawings, after a site survey and soil test.`;

export function disclaimerBox(s: Svg, x: number, y: number, w: number, size = 10) {
  const lines = wrap(DISCLAIMER, Math.floor((w - 20) / (size * 0.6)));
  const h = 14 + lines.length * size * 1.4;
  s.rect(x, y, w, h, { fill: "#fff7ed", stroke: "#c2410c", stroke_width: 1.2, rx: 4 });
  lines.forEach((line, i) => s.text(x + 10, y + 18 + i * size * 1.4, line, { size, anchor: "start", fill: "#7c2d12", weight: i === 0 ? 700 : null }));
  return y + h;
}

/** Plan-space view: world feet (x east, y north) → sheet pixels, north up. */
export class PlanView {
  constructor(public s: Svg, public ox: number, public oy: number, public k: number, public ymax: number) {}
  p(x: number, y: number): Pt { return [this.ox + x * this.k, this.oy + (this.ymax - y) * this.k]; }
  rect(x0: number, y0: number, x1: number, y1: number, a: Attrs = {}) {
    const [X, Y] = this.p(Math.min(x0, x1), Math.max(y0, y1));
    this.s.rect(X, Y, Math.abs(x1 - x0) * this.k, Math.abs(y1 - y0) * this.k, a);
  }
  line(x1: number, y1: number, x2: number, y2: number, a: Attrs = {}) { this.s.line(...this.p(x1, y1), ...this.p(x2, y2), a); }
  poly(pts: Pt[], a: Attrs = {}, closed = true) { this.s.poly(pts.map(([x, y]) => this.p(x, y)), a, closed); }
  circle(x: number, y: number, r: number, a: Attrs = {}) { const [X, Y] = this.p(x, y); this.s.circle(X, Y, r * this.k, a); }
  ellipse(x: number, y: number, rx: number, ry: number, a: Attrs = {}) { const [X, Y] = this.p(x, y); this.s.ellipse(X, Y, rx * this.k, ry * this.k, a); }
  text(x: number, y: number, t: string, o: TextOpts = {}) { const [X, Y] = this.p(x, y); this.s.text(X, Y, t, o); }
}

/** Elevation/section view: horizontal h (feet) and height z (feet above FFL) → sheet pixels. */
export class EView {
  constructor(public s: Svg, public ox: number, public oy: number, public k: number) {}
  p(h: number, z: number): Pt { return [this.ox + h * this.k, this.oy - z * this.k]; }
  rect(h0: number, z0: number, h1: number, z1: number, a: Attrs = {}) {
    const [X, Y] = this.p(Math.min(h0, h1), Math.max(z0, z1));
    this.s.rect(X, Y, Math.abs(h1 - h0) * this.k, Math.abs(z1 - z0) * this.k, a);
  }
  line(h0: number, z0: number, h1: number, z1: number, a: Attrs = {}) { this.s.line(...this.p(h0, z0), ...this.p(h1, z1), a); }
  poly(pts: Pt[], a: Attrs = {}, closed = true) { this.s.poly(pts.map(([h, z]) => this.p(h, z)), a, closed); }
  text(h: number, z: number, t: string, o: TextOpts = {}) { const [X, Y] = this.p(h, z); this.s.text(X, Y, t, o); }
}
