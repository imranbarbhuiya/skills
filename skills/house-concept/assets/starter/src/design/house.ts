/**
 * THE DESIGN. Rewrite this file for each house; every view (plan, 3D, elevations, sections, site, structure, notes)
 * is derived from what it returns.
 *
 * Example: a courtyard family house on a 40′ × 60′ plot with the road on the north. Warm-humid coastal city,
 * seismic zone III. Ground floor now on a frame designed for G+1; an outside stair in the front yard reaches the
 * terrace now and a separately let first floor later. Phase 2 adds a guest bedroom in the north-west corner.
 *
 *   x: kitchen / bed 2 / guest (A) | galleries + court (B) | bed 1 / baths / bed 3 (C)
 *   y: rear row (0) | court row (1) | front row (2, road side)
 */
import { B, EXT, INT, L3, bath, bed, farWindow, roomDoor, roomFrame, sideWindow, sz, wardrobe } from "../kit/builder";
import type { Design, Rect, StairSpec } from "../types";

const T9 = 0.75; // 9″ walls on the main grid line A|B and on row line 1|2 (outside walls while phase 2 is unbuilt)
const r = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 });

export function courtyardHouse(o: { court: boolean } = { court: true }): Design {
  // ---- clear bays (feet)
  const xA = [EXT, EXT + 10], xB = [xA[1] + T9, xA[1] + T9 + 14], xC = [xB[1] + INT, xB[1] + INT + 10];
  const W = xC[1] + EXT;
  const y0 = [EXT, EXT + 12], y1 = [y0[1] + INT, y0[1] + INT + 12], y2 = [y1[1] + T9, y1[1] + T9 + 12];
  const D = y2[1] + EXT;
  const cell = (x: number[], y: number[]) => r(x[0], y[0], x[1], y[1]);
  const A0 = cell(xA, y0), B0 = cell(xB, y0), C0 = cell(xC, y0);
  const A1 = cell(xA, y1), C1 = cell(xC, y1);
  const A2 = cell(xA, y2), B2 = cell(xB, y2), C2 = cell(xC, y2);
  const GAL = 3.5; // covered gallery each side of the court
  const court = r(xB[0] + GAL, y1[0], xB[1] - GAL, y1[1]);
  const gx = [EXT / 2, xA[1] + T9 / 2, xB[1] + INT / 2, W - EXT / 2];
  const gy = [EXT / 2, y0[1] + INT / 2, y1[1] + T9 / 2, D - EXT / 2];
  const b = new B();

  // ---- shell (phase 1 is everything except the guest room A2)
  b.wall(0, 0, W, EXT, "ext");
  b.wall(W - EXT, EXT, W, D, "ext");
  b.wall(xA[1], D - EXT, W - EXT, D, "ext");
  b.wall(0, EXT, EXT, y1[1] + T9, "ext");
  b.wall(EXT, y1[1], xA[1], y1[1] + T9, "ext"); // A1 | A2: outside wall until phase 2
  b.wall(xA[1], EXT, xA[1] + T9, y1[1]);
  b.wall(xA[1], y1[1], xA[1] + T9, D - EXT, "ext"); // living | A2: outside wall until phase 2
  b.wall(xB[1], EXT, xB[1] + INT, D - EXT);
  for (const [x, w] of [[xA, "a"], [xB, "b"], [xC, "c"]] as const) {
    b.wall(x[0], y0[1], x[1], y0[1] + INT);
    if (w !== "a") b.wall(x[0], y1[1], x[1], y1[1] + T9);
  }

  // ---- kitchen (A0): L-shaped counter on the west and south walls, back door to the wash yard
  b.floor(A0, "kitchen");
  b.op("door", "D2", "y", [A0.y1 - 3.0, A0.y1 - 0.25], [A0.x1, A0.x1 + T9], "int", { hingeAt: A0.y1 - 0.25, swing: -1, fanlight: true, where: "Kitchen" });
  b.op("door", "D6", "x", [A0.x1 - 3.0, A0.x1 - 0.25], [0, EXT], "S", { hingeAt: A0.x1 - 0.25, swing: 1, where: "Kitchen → wash yard" });
  b.op("window", "W3", "y", [3.75, 7.75], [0, EXT], "W", { sill: 3.5, where: "Kitchen (sink)" });
  b.f(r(A0.x0, A0.y0, A0.x0 + 6.5, A0.y0 + 2), "counter", 2.85);
  b.f(r(A0.x0, A0.y0 + 2, A0.x0 + 2, A0.y0 + 9.5), "counter", 2.85);
  b.f(r(A0.x0 + 0.25, 4.75, A0.x0 + 1.75, 6.75), "fix", 2.9);
  for (const y of [8.4, 9.4]) b.e(A0.x0 + 1.0, y, 0.35, 0.35, "fix", 2.9);
  b.f(r(A0.x1 - 2.5, 5.0, A0.x1, 7.5), "furn", 6);
  b.txt(A0.x1 - 1.25, 6.25, "FRIDGE");
  b.txt(A0.x0 + 3.2, 8.9, "HOB", "small_l");
  b.label(5.6, 5.4, L3("KITCHEN", "", sz(10, 12)), "K");

  // ---- family + dining (B0): south window, open to both galleries, glazed slider onto the court
  b.floor(B0, "living");
  b.op("window", "W2", "x", [B0.x0 + 4, B0.x0 + 10], [0, EXT], "S", { where: "Family" });
  b.op("open", "OP", "x", [xB[0] + 0.25, xB[0] + GAL - 0.25], [y0[1], y0[1] + INT], "int", { where: "Family → west gallery" });
  b.op("open", "OP", "x", [xB[1] - GAL + 0.25, xB[1] - 0.25], [y0[1], y0[1] + INT], "int", { where: "Family → east gallery" });
  if (o.court) b.op("slide", "S1", "x", [court.x0 + 0.5, court.x1 - 0.5], [y0[1], y0[1] + INT], "int", { where: "Family → court (glazed slider)" });
  b.f(r(B0.x0 + 1.25, 3.5, B0.x0 + 4.75, 9.0), "table", 2.5);
  for (const y of [4.1, 5.6, 7.1, 8.6]) for (const x of [B0.x0 + 0.1, B0.x0 + 4.9]) b.f(r(x, y - 0.6, x + 1.2, y + 0.6), "furn");
  b.f(r(B0.x1 - 2.8, 1.5, B0.x1, 8.5), "sofa", 2.6);
  b.f(r(B0.x1 - 6.8, 1.0, B0.x1 - 3.5, 3.4), "sofa", 2.6);
  b.f(r(B0.x1 - 6.2, 4.5, B0.x1 - 4.0, 7.0), "table", 1.4);
  b.label(18.75, 9.6, L3("FAMILY + DINING", "", sz(14, 12)), "FD");

  // ---- bedroom 1, master (C0): entered from the family room at its north end, bath in the north-east corner
  {
    const fr = roomFrame(C0, "W");
    b.floor(C0, "bed");
    roomDoor(b, fr, "D2", fr.W - 3.5, fr.W - 0.75, INT, "Bedroom 1", true);
    bed(b, fr, 4.0, 0);
    farWindow(b, fr, "window", "W1", 1.25, 5.25, EXT, "E", "Bedroom 1");
    sideWindow(b, fr, "u0", 3.0, 7.0, EXT, "S", "Bedroom 1 (south)");
    wardrobe(b, fr, 0.1, 2.0, fr.D - 2.0, fr.D);
    bath(b, fr, [fr.W - 5, fr.W, fr.D - 6, fr.D], { name: "Bedroom 1 bath", door: [fr.W - 4.75, fr.W - 2.5], walls: ["u0"], vent: { face: "E", t: EXT } });
    b.label(...fr.p(4.0, 3.6), L3("BEDROOM 1", "master", sz(10, 12)), "B1");
  }

  // ---- bedroom 2 (A1): door from the west gallery
  {
    const fr = roomFrame(A1, "E", true);
    roomDoor(b, fr, "D2", fr.W - 3.5, fr.W - 0.75, T9, "Bedroom 2", true);
    b.floor(A1, "bed");
    bed(b, fr, 4.5, fr.D, -1);
    farWindow(b, fr, "window", "W1", 3.5, 7.5, EXT, "W", "Bedroom 2");
    wardrobe(b, fr, 0.1, 2.0, 0, 5.5);
    b.label(A1.x0 + 4.2, A1.y1 - 2.8, L3("BEDROOM 2", "", sz(10, 12)), "B2");
  }

  // ---- toilet + bath + utility (C1): utility lobby off the east gallery, toilet and bath on the outer wall
  {
    const xP = C1.x0 + 4.5; // utility | wet rooms
    const yS = C1.y0 + 5.625; // toilet | bath
    b.floor(r(C1.x0, C1.y0, xP, C1.y1), "wash");
    b.op("open", "OP", "y", [C1.y0 + 4.5, C1.y0 + 8.0], [xB[1], xB[1] + INT], "int", { where: "Utility (off the east gallery)" });
    b.wall(xP, C1.y0, xP + INT, C1.y1, "part");
    b.wall(xP + INT, yS, C1.x1, yS + INT, "part");
    for (const [ry0, ry1, name, lab] of [[C1.y0, yS, "Toilet", "TOILET"], [yS + INT, C1.y1, "Bath", "BATH"]] as const) {
      b.floor(r(xP + INT, ry0, C1.x1, ry1), "bath");
      b.op("door", "D3", "y", [ry0 + 0.6, ry0 + 3.1], [xP, xP + INT], "int", { hingeAt: ry0 + 0.6, swing: 1, where: name });
      b.op("vent", "V1", "y", [(ry0 + ry1) / 2 - 1, (ry0 + ry1) / 2 + 1], [W - EXT, W], "E", { where: name });
      b.label(xP + 3.3, ry0 + 4.6, [[lab, 8, 700, "#28566e"]]);
    }
    b.f(r(C1.x1 - 0.9, C1.y0 + 1.2, C1.x1, C1.y0 + 2.6), "fix", 2.6);
    b.e(C1.x1 - 1.65, C1.y0 + 1.9, 0.75, 0.55, "fix", 1.3);
    b.f(r(xP + INT, C1.y1 - 2.5, C1.x1, C1.y1), "shower", 0.05);
    b.f(r(C1.x0, C1.y1 - 2.6, C1.x0 + 2.4, C1.y1 - 0.2), "furn", 3.0);
    b.txt(C1.x0 + 1.2, C1.y1 - 1.4, "WM");
    b.f(r(C1.x0, C1.y0 + 0.2, C1.x0 + 1.6, C1.y0 + 3.6), "counter", 2.85);
    for (const y of [C1.y0 + 1.1, C1.y0 + 2.7]) b.e(C1.x0 + 0.8, y, 0.4, 0.45);
    b.label(C1.x0 + 2.3, C1.y0 + 6.3, [["UTILITY", 7.5, 600, "#28566e"], ["2 basins · WM", 7, null, "#28566e"]]);
  }

  // ---- galleries + court (B1)
  b.floor(r(xB[0], y1[0], court.x0, y1[1]), "corridor");
  b.floor(r(court.x1, y1[0], xB[1], y1[1]), "corridor");
  if (o.court) {
    b.floor(court, "court");
    b.e((court.x0 + court.x1) / 2, (court.y0 + court.y1) / 2, 1.3, 1.3, "plant", 2.8);
    b.label((court.x0 + court.x1) / 2, court.y0 + 2.4, [["COURT", 11, 700, "#3f5a2b"], ["open to sky", 8.5, null, "#3f5a2b"]]);
  } else {
    b.floor(court, "living");
    b.label((court.x0 + court.x1) / 2, court.y0 + 2.4, [["FAMILY HALL", 10.5, 700, "#1f2933"]]);
  }

  // ---- living (B2): main door from the front porch, arches to the galleries, window onto the court
  b.floor(B2, "living");
  b.op("door", "D1", "x", [B2.x0 + 5, B2.x0 + 9], [D - EXT, D], "N", { hingeAt: B2.x0 + 5, swing: -1, double: true, fanlight: true, where: "Main door" });
  b.op("window", "W4", "x", [B2.x0 + 0.5, B2.x0 + 4.5], [D - EXT, D], "N", { where: "Living (front)" });
  b.op("window", "W4", "x", [B2.x1 - 4.5, B2.x1 - 0.5], [D - EXT, D], "N", { where: "Living (front)" });
  b.op("open", "OP", "x", [xB[0] + 0.25, xB[0] + GAL - 0.25], [y1[1], y1[1] + T9], "int", { where: "Living → west gallery" });
  b.op("open", "OP", "x", [xB[1] - GAL + 0.25, xB[1] - 0.25], [y1[1], y1[1] + T9], "int", { where: "Living → east gallery" });
  b.op("window", "W2", "x", [court.x0 + 0.5, court.x1 - 0.5], [y1[1], y1[1] + T9], "int", { where: "Living → court" });
  b.op("door", "D2", "y", [B2.y0 + 1.0, B2.y0 + 4.0], [xA[1], xA[1] + T9], "int", { hingeAt: B2.y0 + 1.0, swing: 1, fanlight: true, where: "Guest room (phase 2); locked until then" });
  b.f(r(B2.x0 + 0.6, B2.y0 + 5.5, B2.x0 + 3.2, B2.y1 - 0.8), "sofa", 2.6);
  b.f(r(B2.x0 + 4.2, B2.y0 + 6.5, B2.x0 + 6.4, B2.y0 + 9.0), "table", 1.4);
  b.f(r(B2.x1 - 1.4, B2.y0 + 5.0, B2.x1, B2.y0 + 10.0), "wardrobe", 2);
  b.txt(B2.x1 - 0.7, B2.y0 + 7.5, "TV");
  b.f(r(B2.x0 + 4.0, B2.y0 + 1.2, B2.x0 + 6.6, B2.y0 + 3.6), "sofa", 2.6);
  b.label(B2.x0 + 9.2, B2.y0 + 7.0, L3("LIVING", "", sz(14, 12)), "LV");

  // ---- bedroom 3 (C2): door from the living room
  {
    const fr = roomFrame(C2, "W");
    roomDoor(b, fr, "D2", 1.0, 3.75, INT, "Bedroom 3");
    b.floor(C2, "bed");
    bed(b, fr, 7.5, 0);
    farWindow(b, fr, "window", "W1", 5.5, 9.5, EXT, "E", "Bedroom 3");
    sideWindow(b, fr, "u1", 3.0, 7.0, EXT, "N", "Bedroom 3 (front)");
    wardrobe(b, fr, 0.1, 5.0, fr.D - 2.0, fr.D);
    b.label(C2.x0 + 5.5, C2.y0 + 2.5, L3("BEDROOM 3", "", sz(10, 12)), "B3");
  }

  // ---- phase 2: guest bedroom with its own bath (A2), entered from the living room
  const p2 = new B();
  p2.wall(0, y1[1] + T9, EXT, D, "ext");
  p2.wall(EXT, D - EXT, xA[1], D, "ext");
  {
    const fr = roomFrame(A2, "E", true);
    p2.floor(A2, "bed");
    bed(p2, fr, 8.0, 0);
    farWindow(p2, fr, "window", "W1", 6.5, 10.5, EXT, "W", "Guest room");
    sideWindow(p2, fr, "u1", 0.5, 4.5, EXT, "N", "Guest room (front)");
    bath(p2, fr, [0, 5.0, fr.D - 6.0, fr.D], { name: "Guest bath", door: [2.5, 4.75], walls: ["u1"], vent: { face: "W", t: EXT } });
    p2.label(...fr.p(8.6, 8.2), L3("GUEST ROOM", "bedroom 4", sz(10, 12)), "G");
  }

  // ---- outside stair in the front yard (east end), with a bridge at terrace level back to the roof
  const porch = r(xB[0], D, xC[1] + EXT, D + 4.5);
  const stair: StairSpec = { x0: xC[0] + 1.0, x1: xC[0] + 9.0, y0: porch.y1, y1: porch.y1 + 10.42, axis: "y", startHigh: false, firstLow: false, outside: true };
  const bridge = r(stair.x0, D, stair.x0 + 3.75, porch.y1);
  const front = { x: (B2.x0 + 5 + B2.x0 + 9) / 2 };
  const plot = r(-(40 - W) / 2, -5, W + (40 - W) / 2, 55);
  return {
    id: o.court ? "C1" : "C0",
    name: o.court ? "Courtyard house · working plan" : "Covered family hall instead of the court",
    tagline: o.court
      ? "Four bedrooms around a 7′ × 12′ open court with covered galleries; outside stair for a separately let first floor."
      : "Same plan with the court roofed over as a family hall: simpler and drier, but the middle rooms lose their daylight.",
    badge: o.court ? "CURRENT" : "EARLIER",
    project: { title: "Courtyard house", place: "warm-humid coastal city (example)", climate: "warm-humid, heavy monsoon", seismicZone: "III", briefArea: 1400 },
    m: b.m,
    phase2: { m: p2.m, label: "PHASE 2 · GUEST ROOM (dashed: built later)" },
    roofs: [
      { r: r(0, 0, W, y1[1] + T9), phase: 1 },
      { r: r(xA[1], y1[1] + T9, W, D), phase: 1 },
      { r: bridge, phase: 1, slabOnly: true },
      { r: r(0, y1[1] + T9, xA[1], D), phase: 2 },
    ],
    courts: o.court ? [court] : [],
    grid: { x: gx, y: gy },
    stairs: [stair],
    openEdges: [r(bridge.x0, bridge.y1 - 0.01, bridge.x1, bridge.y1 + 0.01)],
    canopies: [r(front.x - 4, D, front.x + 4, D + 4)],
    steps: [{ r: r(front.x - 3.5, porch.y1, front.x + 3.5, porch.y1 + 4), down: "N" }],
    porches: [porch],
    tank: r(C1.x0 + 3, C1.y0 + 4, C1.x0 + 7, C1.y0 + 8),
    heights: { plinth: 2.0, floor: 10.5, slab: 0.42, beam: 1.5, parapet: 3.5, lintel: 7.0, chajja: 2.0, floorsTotal: 2 },
    site: {
      plot,
      road: { side: "N", width: 20 },
      path: r(front.x - 2.5, porch.y1 + 4, front.x + 2.5, plot.y1),
      gate: [front.x - 5, front.x + 5],
      parking: r(plot.x0 + 1, porch.y1 + 0.5, xB[0] + 2.5, plot.y1 - 0.5),
      septic: r(plot.x0 + 1.5, -4.5, plot.x0 + 9.5, -1.5),
      soakPit: { x: 22, y: -2.6, r: 2 },
      trees: [[W + 0.6, 47, 1.2], [10, -3, 1.6], [W - 3, -3, 1.6]],
      notes: [
        "Front setback (north) holds the car, the porch, the outside stair and the path to the gate. Rear (south) keeps 5′ for the wash yard, septic tank and soak pit.",
        "Side setbacks are under 2′; check the local rules before fixing the width. Windows on the side walls may need to be high or frosted.",
        "Slope the ground away from the house and run an apron + open drain round it; the court drains to the rear line through a trap.",
      ],
    },
    sections: [
      {
        name: "A", axis: "x", at: court.x0 + 2.5, title: "through the family room, the court and the living room",
        notes: [
          "The court is open to the sky: rain falls into a sunken, paved court with a floor trap; the galleries either side stay dry under the roof edge.",
          "The family room and the living room borrow daylight and cross air from the court through a glazed slider and a window.",
          "Plinth 2′-0″, about 10′-0″ clear to the slab, lintels at 7′-0″.",
          "The first floor (dashed) repeats the ring of rooms; the court stays open through it.",
        ],
      },
      {
        name: "B", axis: "y", at: y1[0] + 6.5, title: "through bedroom 2, the galleries and court, and the utility",
        notes: [
          "Galleries are 3′-6″ wide, covered by the roof slab; the court edge gets a 6″ step down and a planter kerb.",
          "Bedroom 2 and the utility open off the galleries, so every room reaches the front door under cover.",
          "At roof level the court gets a 3′-6″ railing; the edge beams carry the slab, no columns in the court.",
        ],
      },
    ],
    schedule: {
      D1: ["4′0″×7′0″", "main door, 2 leaves + fanlight"],
      D2: ["3′0″×7′0″", "room door + fanlight"],
      D3: ["2′6″×7′0″", "bath / toilet door, WPC"],
      D6: ["2′9″×7′0″", "kitchen back door, MS grill"],
      S1: ["5′0″×7′0″", "glazed sliding door to the court"],
      OP: ["3′0″–3′6″", "open arches"],
      W1: ["4′0″×4′6″", "casement + fly-mesh, sill 2′6″"],
      W2: ["6′0″×4′6″", "family / living, sill 2′6″"],
      W3: ["4′0″×3′6″", "kitchen, sill 3′6″"],
      W4: ["4′0″×4′6″", "living front, sill 2′6″"],
      V1: ["2′0″×1′6″", "ventilator + exhaust fan"],
    },
    notes: {
      plan: [
        "Rooms are clear sizes. Walls 9″ outside and on the A|B and 1|2 grid lines, 4½″ elsewhere; columns are 12″ placeholders.",
        "Every room opens onto the galleries, the family room or the living room, so nobody walks through a bedroom.",
        "Phase 2 (dashed) adds the guest room and its bath in the north-west corner; the door from the living room is built now and kept locked.",
        "The outside stair in the front yard reaches the terrace now and lets a first floor be let separately later.",
      ],
      box: {
        title: "COURT — KEEP IT WORKING",
        lines: [
          "Paved court 6″ below the galleries with a floor trap and a rodent-proof grating; overflow to the rear drain.",
          "Deep roof edge (1′-6″ drip) over both galleries so rain stays in the court.",
          "Fly-mesh on the slider and the living window; a lockable grill over the court at roof level if security matters.",
        ],
      },
      brief: [
        "Design the frame as G+1 now: footings, columns and the roof slab as a future floor slab.",
        "Seismic zone III: IS 1893 (Part 1), IS 13920 ductile detailing, IS 4326 lintel and sill bands.",
        "Court: a 7′ × 12′ slab opening between the B-bay beams; edge beams on both long sides carry the gallery slab. Repeat it in the first-floor slab.",
        "Outside stair: its own two columns under the landing; the bridge slab ties into the north beam at grid 4.",
        "Phase 2 (north-west bay): starter bars or couplers at the shared columns now, so the guest room ties in without a joint.",
        "Soil test first; coastal soils may be soft with a high water table.",
      ],
    },
    cost: {
      currency: "₹",
      budget: 3_500_000,
      rates: [["Basic finish", 1600, 2000], ["Mid finish", 2000, 2600]],
      sources: "Placeholder ranges for the example. For a real house, look up current local rates and cite them; never invent them.",
    },
    notesTab: {
      sections: [
        { title: "Why a court", items: [
          "In a warm-humid climate the court pulls air through every room: windows on the outer walls, doors and the slider on the court side.",
          "Galleries either side keep every route under cover, so the court can stay open to the rain.",
        ] },
        { title: "Phasing", items: [
          "Phase 1 builds three bedrooms, the family room, kitchen, living room and the court, with the frame and footings for one more floor.",
          "Phase 2 adds the guest room in the north-west corner; its door from the living room is fitted now and kept locked.",
          "The outside stair lets the first floor be let separately later without passing through the house.",
        ] },
      ],
      questions: [
        "Is a 7′ × 12′ court enough, or should the galleries narrow to 3′ to widen it to 8′?",
        "Side setbacks are under 2′: what do the local rules ask for on this plot?",
        "Will the first floor be let out (keep the outside stair) or family use (an inside stair instead)?",
      ],
    },
    places: [
      ["Living, looking at the court", [(court.x0 + court.x1) / 2 + 1.5, D - EXT - 1.6], [(court.x0 + court.x1) / 2, court.y0]],
      ["Court (from the west gallery)", [xB[0] + 1.6, y1[0] + 0.9], [court.x1 + 1, y1[1]]],
      ["Gallery (east)", [xB[1] - 1.7, y1[0] + 1.5], [xB[1] - 1.7, y1[1]]],
      ["Front porch", [front.x + 6, porch.y1 + 9], [front.x, D - 2]],
    ],
  };
}

export const HOUSE = courtyardHouse();
