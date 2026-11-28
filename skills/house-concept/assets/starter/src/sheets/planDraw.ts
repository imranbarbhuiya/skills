/** Plan-drawing primitives shared by every plan-type sheet (plan, options, structure, site). */
import { HOUSE } from "../design/house";
import { AIR, INK, MUTED, PlanView, Pt } from "../svg";
import type { Model, Opening, StairSpec } from "../types";

const CHAJJA = HOUSE.heights.chajja;

export const FLOOR_FILL: Record<string, string> = {
  bed: "#fbf1e1", bath: "#e1eef5", kitchen: "#fbe9d2", dining: "#f6eedf", living: "#eef2df", corridor: "#f2efe9",
  porch: "#e9eedb", wash: "#e6f0f2", court: "#dde8cf", stair: "#ece7de",
};
export const WALL_FILL: Record<string, string> = {
  ext: "#3d4148", int: "#4b5059", part: "#6b717b", low: "#9a8f7e",
};
export const CUT = "#fdfcf9";

const ab = (o: Opening, a: number, w: number): Pt => (o.axis === "x" ? [a, w] : [w, a]);

export function outDir(o: Opening): number {
  if (o.face === "S" || o.face === "W") return -1;
  if (o.face === "N" || o.face === "E") return 1;
  return 0;
}

export function drawOpening(v: PlanView, o: Opening) {
  const [a0, a1] = o.a;
  const [w0, w1] = o.w;
  v.rect(...ab(o, a0, w0), ...ab(o, a1, w1), { fill: CUT });
  const jamb = { stroke: INK, stroke_width: 1.1 };
  v.line(...ab(o, a0, w0), ...ab(o, a0, w1), jamb);
  v.line(...ab(o, a1, w0), ...ab(o, a1, w1), jamb);
  const mid = (w0 + w1) / 2;
  if (o.kind === "window" || o.kind === "vent") {
    const thin = { stroke: INK, stroke_width: 0.8 };
    v.line(...ab(o, a0, w0), ...ab(o, a1, w0), thin);
    v.line(...ab(o, a0, w1), ...ab(o, a1, w1), thin);
    v.line(...ab(o, a0, mid), ...ab(o, a1, mid), { stroke: AIR, stroke_width: o.kind === "window" ? 1.6 : 1 });
    const out = outDir(o);
    if (out !== 0) {
      const base = out < 0 ? w0 : w1;
      const cz = base + out * CHAJJA;
      v.poly([ab(o, a0 - 0.5, base), ab(o, a0 - 0.5, cz), ab(o, a1 + 0.5, cz), ab(o, a1 + 0.5, base)],
        { stroke: MUTED, stroke_width: 0.7, stroke_dasharray: "4 3" }, false);
      const off = CHAJJA + 0.8;
      const [tx, ty] = ab(o, (a0 + a1) / 2, base + out * off);
      v.text(tx, ty - 0.25, o.tag, { size: 9, fill: MUTED, weight: 600 });
    }
  } else if (o.kind === "slide") {
    const g = { stroke: AIR, stroke_width: 1.4 };
    const m1 = (a0 + a1) / 2;
    v.line(...ab(o, a0, mid - 0.07), ...ab(o, m1 + 0.4, mid - 0.07), g);
    v.line(...ab(o, m1 - 0.4, mid + 0.07), ...ab(o, a1, mid + 0.07), g);
  } else if (o.kind === "open" || o.kind === "hatch") {
    v.line(...ab(o, a0, mid), ...ab(o, a1, mid), { stroke: MUTED, stroke_width: 0.7, stroke_dasharray: "3 3" });
    if (o.kind === "hatch") v.line(...ab(o, a0, w0), ...ab(o, a1, w0), { stroke: MUTED, stroke_width: 0.7 });
  } else if (o.kind === "door") {
    const face = o.swing > 0 ? w1 : w0;
    const leaves: [number, number, "a0" | "a1"][] = o.double
      ? [[a0, (a0 + a1) / 2, "a0"], [(a0 + a1) / 2, a1, "a1"]]
      : [[a0, a1, o.hinge ?? "a0"]];
    for (const [s0, s1, h] of leaves) {
      const [hp, other] = h === "a0" ? [s0, s1] : [s1, s0];
      const r = Math.abs(s1 - s0);
      v.line(...ab(o, hp, face), ...ab(o, hp, face + o.swing * r), { stroke: INK, stroke_width: 1.6 });
      const pts: Pt[] = [];
      for (let k = 0; k <= 12; k++) {
        const t = (Math.PI / 2) * (k / 12);
        pts.push(ab(o, hp + (other - hp) * Math.cos(t), face + o.swing * r * Math.sin(t)));
      }
      v.poly(pts, { stroke: INK, stroke_width: 0.6 }, false);
    }
  }
}

const FURN_STYLE: Record<string, Record<string, string | number>> = {
  bed: { fill: "#ffffff", stroke: "#8a8f98", stroke_width: 0.9 },
  pillow: { fill: "#f1f1f1", stroke: "#8a8f98", stroke_width: 0.6 },
  furn: { fill: "#ffffff", stroke: "#8a8f98", stroke_width: 0.8 },
  wardrobe: { fill: "#efe9df", stroke: "#8a8f98", stroke_width: 0.8 },
  table: { fill: "#f3e7d3", stroke: "#8a8f98", stroke_width: 0.8 },
  sofa: { fill: "#e9e4f2", stroke: "#8a8f98", stroke_width: 0.8 },
  counter: { fill: "#ece6dc", stroke: "#7b818b", stroke_width: 0.8 },
  fix: { fill: "#ffffff", stroke: "#4b7a92", stroke_width: 0.8 },
  shower: { fill: "none", stroke: "#4b7a92", stroke_width: 0.7, stroke_dasharray: "3 2" },
  plant: { fill: "#b9cf9a", stroke: "#6f8f4e", stroke_width: 0.9 },
};

export function drawModel(v: PlanView, m: Model, o: { furniture?: boolean; labels?: boolean; light?: boolean } = {}) {
  const { furniture = true, labels = true, light = false } = o;
  for (const f of m.floors) v.rect(f.x0, f.y0, f.x1, f.y1, { fill: light ? (f.kind === "court" ? "#e3ecd6" : "#f4f4f2") : FLOOR_FILL[f.kind] });
  if (!light) {
    for (const c of m.floors.filter((f) => f.kind === "court")) {
      for (let x = c.x0 + 1.5; x < c.x1; x += 1.5) v.line(x, c.y0 + 0.4, x, c.y1 - 0.05, { stroke: "#c6d4b2", stroke_width: 0.5 });
      for (let y = c.y0 + 1.5; y < c.y1; y += 1.5) v.line(c.x0, y, c.x1, y, { stroke: "#c6d4b2", stroke_width: 0.5 });
    }
  }
  if (furniture) {
    for (const f of m.furniture) {
      if (f.t === "rect") v.rect(f.r.x0, f.r.y0, f.r.x1, f.r.y1, FURN_STYLE[f.k]);
      else if (f.t === "ellipse") v.ellipse(f.cx, f.cy, f.rx, f.ry, FURN_STYLE[f.k]);
      else if (f.style === "vert") v.text(f.x, f.y, f.s, { size: 7.5, fill: MUTED, rotate: -90 });
      else v.text(f.x, f.y, f.s, { size: 7.5, fill: MUTED, anchor: f.style === "small_l" ? "start" : "middle" });
    }
  }
  for (const w of m.walls) {
    const fill = light ? (w.kind === "low" ? "#cfc8bb" : "#b8bcc2") : WALL_FILL[w.kind];
    v.rect(w.x0, w.y0, w.x1, w.y1, { fill });
  }
  for (const op of m.openings) {
    if (light) v.rect(...ab(op, op.a[0], op.w[0]), ...ab(op, op.a[1], op.w[1]), { fill: "#f4f4f2" });
    else drawOpening(v, op);
  }
  if (labels) {
    for (const lb of m.labels) {
      const [X, Y] = v.p(lb.x, lb.y);
      const total = lb.lines.reduce((acc, l) => acc + l[1] * 1.3, 0);
      let cy = Y - total / 2 + lb.lines[0][1];
      for (const [t, sz, wt, col] of lb.lines) {
        v.s.text(X, cy, t, { size: sz, weight: wt, fill: col });
        cy += sz * 1.3;
      }
    }
  }
}

/** Generic dog-leg stair: flights along `axis`, landing at the far end from the start. */
export function drawStair(v: PlanView, st: StairSpec, tread: number, flightSteps: number, labels = true) {
  const along = st.axis;
  const [a0, a1] = along === "y" ? [st.y0, st.y1] : [st.x0, st.x1];
  const [c0, c1] = along === "y" ? [st.x0, st.x1] : [st.y0, st.y1];
  const fw = (c1 - c0 - 0.5) / 2;
  const P = (a: number, c: number): Pt => (along === "y" ? [c, a] : [a, c]);
  const R = (aa: number, ab_: number, ca: number, cb: number, attrs: Record<string, string | number>) => v.rect(...P(aa, ca), ...P(ab_, cb), attrs);
  const far = st.startHigh ? a0 : a1, dir = st.startHigh ? -1 : 1;
  const landA = far - dir * fw;
  const fStart = landA - dir * flightSteps * tread;
  R(Math.min(far, landA), Math.max(far, landA), c0, c1, { fill: "#e6dfd2", stroke: INK, stroke_width: 0.8 });
  const flights: [number, number][] = st.firstLow ? [[c0, c0 + fw], [c1 - fw, c1]] : [[c1 - fw, c1], [c0, c0 + fw]];
  for (const [ca, cb] of flights) {
    R(Math.min(fStart, landA), Math.max(fStart, landA), ca, cb, { fill: "#efe9df", stroke: INK, stroke_width: 0.9 });
    for (let k = 1; k <= flightSteps - 1; k++) {
      const a = fStart + dir * k * tread;
      v.line(...P(a, ca), ...P(a, cb), { stroke: INK, stroke_width: 0.8 });
    }
  }
  R(Math.min(fStart, landA), Math.max(fStart, landA), c0 + fw, c1 - fw, { fill: "#d9d2c5" });
  if (!labels) return;
  const m1 = (flights[0][0] + flights[0][1]) / 2, m2 = (flights[1][0] + flights[1][1]) / 2;
  const start = st.startHigh ? a1 : a0;
  const lm = (far + landA) / 2;
  v.poly([P(start + dir * 0.9, m1), P(lm, m1), P(lm, m2), P(fStart + dir * 0.6, m2)], { stroke: AIR, stroke_width: 1.1 }, false);
  v.poly([P(fStart + dir * 0.1, m2), P(fStart + dir * 0.8, m2 - 0.35), P(fStart + dir * 0.8, m2 + 0.35)], { fill: AIR });
  v.text(...P(start + dir * 0.55, m1), "UP", { size: 8, fill: AIR, weight: 700 });
}

