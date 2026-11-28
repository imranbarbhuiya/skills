/**
 * Shared types. All values are in feet.
 *
 * World axes: x runs west → east, y runs south → north, z is height above the finished ground-floor level (FFL).
 * Origin = the outer south-west corner of the house. three.js uses X = x, Y = z, Z = −y.
 */
export type Face = "S" | "N" | "E" | "W";
export type WallKind = "ext" | "int" | "part" | "low";
export type OpeningKind = "door" | "window" | "vent" | "open" | "slide" | "hatch";
export type FloorKind = "bed" | "bath" | "kitchen" | "dining" | "living" | "corridor" | "porch" | "wash" | "court" | "stair";
export type FurnKind = "bed" | "pillow" | "furn" | "wardrobe" | "table" | "sofa" | "counter" | "fix" | "shower" | "plant";

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Wall extends Rect {
  kind: WallKind;
  /** continuous high glass band (7′-6″ to 8′-9″) along this wall, e.g. a corridor wall that borrows daylight */
  band?: boolean;
}
export interface FloorArea extends Rect { kind: FloorKind }
export interface Opening {
  kind: OpeningKind;
  tag: string;
  axis: "x" | "y"; // "x": the wall runs along x, so the opening spans x
  a: [number, number]; // span along the wall
  w: [number, number]; // the wall's thickness range
  /** outside face for windows and outer doors; "int" for doors between rooms */
  face: Face | "int";
  hinge?: "a0" | "a1";
  swing: number; // +1 / −1: the side (along the thickness axis) the leaf opens into
  double: boolean;
  where: string;
  sill: number;
  head: number;
  fanlight: boolean;
}
export type Furn =
  | { t: "rect"; r: Rect; k: FurnKind; h: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; k: FurnKind; h: number }
  | { t: "text"; x: number; y: number; s: string; style: "small" | "vert" | "small_l" };
/** Room label: lines of [text, size, weight, colour]. `room` marks a named room (used by 3D labels and "Go to"). */
export interface Label { x: number; y: number; lines: [string, number, number | null, string][]; room?: string }
export interface Model { floors: FloorArea[]; walls: Wall[]; openings: Opening[]; furniture: Furn[]; labels: Label[] }

/**
 * Dog-leg stair, flights along `axis`. The start end is where flight 1 begins (at `z0`); the landing is at the far end.
 * firstLow: flight 1 is on the low-coordinate side across the flights.
 */
export interface StairSpec {
  x0: number; x1: number; y0: number; y1: number;
  axis: "x" | "y";
  startHigh: boolean;
  firstLow: boolean;
  /** stands outside the roof: its own columns under the landing, no slab opening */
  outside?: boolean;
}

export interface Heights {
  plinth: number; floor: number; slab: number; beam: number; parapet: number; lintel: number; chajja: number;
  /** storeys the frame is designed for (the ground floor is built now, the rest are drawn dashed) */
  floorsTotal: number;
}

/** A sheet section: a vertical cut perpendicular to `axis` at `at`. "x" cuts at x = at looking west; "y" at y = at looking north. */
export interface SectionSpec { name: string; axis: "x" | "y"; at: number; title: string; notes: string[] }

/** Everything that defines one house. `design/house.ts` builds the current one; earlier options reuse the type. */
export interface Design {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  project: {
    title: string; place: string; climate: string; seismicZone: string;
    /** the brief's own footprint (sq ft), if the family gave one, to compare against */
    briefArea?: number;
  };
  /** ground floor built now */
  m: Model;
  /** built later (drawn faded and dashed); its walls may lean on phase-1 walls */
  phase2?: { m: Model; label: string };
  /** roofed footprint, per phase: these become roof slabs, parapets and built area. slabOnly: a slab with no rooms
   * under it (an outside stair's bridge), left out of the built area */
  roofs: { r: Rect; phase: 1 | 2; slabOnly?: boolean }[];
  /** open-to-sky courts inside the footprint (no slab; railing at roof level) */
  courts: Rect[];
  /** column centre lines; columns stand at every intersection inside the footprint */
  grid: { x: number[]; y: number[] };
  stairs: StairSpec[];
  /** parapet-free roof edges (e.g. where an outside stair's bridge meets the terrace) */
  openEdges?: Rect[];
  /** RCC canopies over outer doors, at lintel level */
  canopies: Rect[];
  /** outer steps down to the ground; `down` is the direction they descend */
  steps: { r: Rect; down: Face }[];
  /** paved porch at plinth level */
  porches: Rect[];
  tank?: Rect;
  heights: Heights;
  site: {
    /** plot boundary in house coordinates */
    plot: Rect;
    road: { side: Face; width: number };
    /** path from the front steps to the gate */
    path: Rect;
    gate: [number, number];
    parking?: Rect;
    septic?: Rect;
    soakPit?: { x: number; y: number; r: number };
    trees: [number, number, number][];
    notes: string[];
  };
  sections: SectionSpec[];
  schedule: Record<string, [string, string]>;
  /** sheet text: plan notes, an optional boxed list, the engineer's brief */
  notes: { plan: string[]; box?: { title: string; lines: string[] }; brief: string[] };
  /** Notes & cost tab: cost rates are ₹ (or the local currency) per sq ft, low–high, with where they came from */
  cost: { currency: string; budget?: number; rates: [string, number, number][]; sources: string };
  /** Notes & cost tab: free sections and the questions still open */
  notesTab: { sections: { title: string; items: string[] }[]; questions: string[] };
  /** extra "Go to" spots in 3D: [name, standing point, look-at point] */
  places: [string, [number, number], [number, number]][];
}
