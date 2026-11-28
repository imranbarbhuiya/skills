# Starter architecture

Everything is in feet. World axes: x runs west → east, y runs south → north, z is height above the finished ground
floor (FFL). The origin is the house's outer south-west corner. three.js uses X = x, Y = z, Z = −y.

## Code map

| File | What it does | Change it per house? |
| --- | --- | --- |
| `src/design/house.ts` | The working plan: bays, walls, rooms, openings, furniture, phase 2, and the `Design` object | Yes, rewrite it |
| `src/design/options.ts` | Earlier options and alternatives, plan-only | Yes |
| `src/types.ts` | `Model`, `Opening`, `StairSpec`, `Design` | Only to add a feature |
| `src/kit/builder.ts` | `B` (model builder), `Frame` / `roomFrame`, room parts: `roomDoor`, `farWindow`, `sideWindow`, `bed`, `wardrobe`, `bath` | Add parts as needed |
| `src/model.ts` | Derived data: merged models, heights, `STAIRS` (dog-legs), `COLUMNS`, `roofEdges()` (parapets), areas, `check()` | Add `check()` rules |
| `src/sheets/plan.ts` | Ground-floor plan sheet (full, or short for options) | Rarely |
| `src/sheets/elevations.ts` | Four elevations from roofs, grid and outer openings | Rarely |
| `src/sheets/sections.ts` | Sections cut along any x or y line | Rarely |
| `src/sheets/siteStruct.ts` | Site plan and structural grid brief | Rarely |
| `src/three/buildHouse.ts` | The 3D scene | To add a 3D feature |
| `src/three/navigation.ts` | Walk mode: surfaces you can stand on (ground, steps, stair treads, landings, terrace), collision boxes with a height range, wall sliding, "You are in" readout, "Go to" spots | When you add something walkable or solid |
| `src/three/House3D.tsx` | Orbit and walk modes (mouse-look, keys, touch joystick), views, toggles, ground and roof minimap, sun | Rarely |
| `src/Notes.tsx`, `src/Options.tsx`, `src/App.tsx` | Tabs | Rarely |

Views import from `model.ts`, never from `design/` directly.

## Building a plan

```ts
const b = new B();
b.wall(x0, y0, x1, y1, "ext");            // a wall is a rectangle; kind ext | int | part | low
b.floor(rect, "bed");                     // floor kind sets the plan colour and 3D finish
b.op("window", "W1", "x", [a0, a1], [w0, w1], "S", { where: "Bedroom 1" });
//    kind      tag   axis span along   wall      outside face
//                         the wall     thickness
```

- An opening's `axis` is the direction its wall runs. `w` is the wall's thickness range, so the opening sits inside
  exactly one wall. `face` is the outside face for windows and outer doors, `"int"` for doors between rooms.
- `swing` (+1 / −1) is the side the leaf opens into along the thickness axis. `roomDoor` works it out from the frame.
- Every tag needs an entry in `schedule`; `check()` flags missing ones.

**Frames** make rooms independent of orientation. `roomFrame(rect, "W")` returns a frame whose u runs along the west
(door) wall and v runs into the room, so `bed(b, fr, uc, 0)` puts the headboard on the door wall and
`farWindow(...)` puts a window in the wall opposite the door. Pass `mirror` to start u from the other corner.

**Rooms with baths**: `bath(b, fr, [u0, u1, v0, v1], { door, walls, vent })` builds the partitions, door, WC, basin,
shower and vent, with the WC kept clear of the door swing.

## The Design object

| Field | Notes |
| --- | --- |
| `roofs` | Roofed rectangles per phase. They give the slabs, the parapets (outer edges only), the built area and the house extent. `slabOnly` marks a slab with no rooms under it (an outside stair's bridge). |
| `courts` | Open-to-sky rectangles inside a roof: no slab, railing at roof level, sunk paving. |
| `grid` | Column centre lines. Columns stand at every intersection inside a roof; those only under phase 2 are drawn hollow. |
| `stairs` | Dog-legs (`StairSpec`). Inside a roof they cut a slab opening; `outside: true` stairs stand on two columns under the landing. |
| `openEdges` | Roof edges without a parapet, e.g. where a stair bridge meets the terrace. |
| `canopies`, `steps`, `porches`, `tank` | Entrance canopy at lintel level, steps down to the ground, paved porch at plinth level, water tank on the roof. |
| `phase2` | A second model built later: faded and dashed on sheets, a toggle in 3D. Walls shared with phase 1 belong to phase 1 (built now as outside walls). |
| `site` | Plot rectangle in house coordinates, road side and width, path, gate, parking, septic tank, soak pit, trees, notes. |
| `sections` | Cut lines with titles and notes. Place them through openings, not along a wall. |
| `notes`, `notesTab`, `cost` | Plan notes, the boxed list, the engineer's brief, Notes-tab sections, open questions, cost rates with their sources. |

## Recipes for features the example doesn't use

Port these from a design that needed them; they are tested patterns, adapt names and positions.

### Stair inside the house, with a stair cabin (mumty) on the roof

- A dog-leg needs flights of at least 3′ (a bay about 7′-6″ to 8′ wide) and about 11′ of length:
  landing (one flight width) + 8 treads × 10″, plus a starting landing (a lobby or corridor counts).
- `STAIR_WELLS` already cuts the roof slab over the flights and landing.
- Add a cabin over the well: walls 8′-6″ high on the roof, a door on the face where flight 2 arrives, a slab on top,
  and put the water tank on it. In plan, draw its outline dashed on the structure sheet; in elevations, a plastered
  box on the roof; in sections, its walls and slab where the cut crosses it. Leave a parapet gap where the cabin
  wall replaces it. In walk mode, add the cabin walls to `buildNavBoxes` (in `src/three/navigation.ts`) as roof-level
  boxes with a gap at the door, or the walker passes through them.
- Something built under the stair (a utility or store under flight 2 and the landing): draw flight 2 and the landing
  dashed in plan, because they are above the cut plane. Headroom under flight 2 drops from about 9′ at its top end
  to the landing height minus the waist slab.

### Light well over a corridor or lobby

- A slab opening between grid beams (no beam cut), kept open through every future floor slab.
- On the roof: a 9″ kerb, a fixed MS grill, and a sloped polycarbonate sheet on four posts with open sides, high on the
  side next to any cabin so rain runs onto the open terrace.
- In 3D: kerb boxes, grill bars, posts, and a thin transparent box rotated about x by `±atan2(rise, run)`.
- In sections: the well, kerb, grill, sloped cover, sun arrows down the well, and "opening kept" on the future slabs.

### Secondary spiral stair

- 5′ to 5′-6″ diameter (about 20–30 sq ft) against a dog-leg's ~66 sq ft. 18 risers of 7″, treads of 22.5° round a
  steel pole: one turn rises about 9′-4″, enough headroom. Good for a second way up, not for carrying furniture.
- Plan: outer circle, pole, one turn of tread lines, an UP arrow along an arc.
- 3D: one wedge (`THREE.Shape` sector, `ExtrudeGeometry`, rotated flat) per tread, rotated about the pole, plus a
  helical handrail made of short rods. Slab opening: the square around the circle. Cabin: room to step off on the
  side where the last tread ends.
- Walk mode: inside the circle and outside the pole, the tread under the walker is
  `floor((angle − start) / step)` going round in the climbing direction, and its height is `(i + 1) × riser`. Because
  one turn overlaps itself, return every tread height on that bearing (i and i + 16) as candidates and let the
  nearest-to-feet rule pick. Add the pole and the outer handrail as collision boxes, and leave the rail open over the
  bottom and top treads.

### Walking stairs and the terrace

`src/three/navigation.ts` keeps walk mode in step with the model; extend it whenever you add something walkable.

- **Surfaces:** `surfaceCandidates(x, y)` lists every height you could stand on at that point: the ground, plinth and
  porches, outer steps, each dog-leg tread and landing (from the stair's start, turn, risers and treads), and the
  terrace slab except over courts and stair openings. The walker takes the candidate nearest its feet within 1.25′
  (two risers), so it climbs one tread at a time and never jumps up to the roof from below.
- **Blocks:** collision boxes carry `z0`–`z1` and only block between knee and head height, so a parapet stops you on
  the terrace but not on the ground under it. Doorways (`door`, `open`, `slide`) are gaps.
- **Stairs arriving:** an inside stair steps off onto the slab past its start end; an outside stair needs a `slabOnly`
  bridge and an `openEdges` entry where flight 2 arrives. `check()` flags a stair that arrives on nothing or through a
  parapet.
- **New elements:** a cabin, a spiral, a light-well kerb or a raised deck each need a surface, a block, or both.
  After adding one, walk onto it and off it in the browser.

### High glass band along a corridor

Set `band: true` on the corridor walls. The 3D wall builder replaces 7′-6″ to 8′-9″ of each wall with glass, so the
rooms' daylight reaches the corridor. Show it on the plan as a dashed blue line along the wall.

### Staggered doors across a corridor

Put the door at the high-u end of one room's door wall and the low-u end of the room opposite, so no two doors face
each other.

## Checking sheets for overflowing text

`scripts/check-sheets.js` runs in the page (paste it into the browser tool's evaluate, or the devtools console). It
lists every text element whose box runs outside its SVG's viewBox. Run it on each tab after a change. Rotated text
gives the odd false positive; look at those by eye.
