import { useEffect, useMemo, useState } from "react";
import { AREAS, BBOX, HOUSE, sq } from "./model";
import { Notes } from "./Notes";
import { Options } from "./Options";
import { sheetElevation } from "./sheets/elevations";
import { sheetPlan } from "./sheets/plan";
import { sheetSection } from "./sheets/sections";
import { sheetSite, sheetStructure } from "./sheets/siteStruct";
import { DISCLAIMER, ftin } from "./svg";
import { SvgViewer } from "./SvgViewer";
import { House3D } from "./three/House3D";
import type { Face } from "./types";

type Tab = "3d" | "plan" | "site" | "elev" | "section" | "structure" | "notes" | "options";
const TABS: [Tab, string][] = [
  ["3d", "3D"], ["plan", "Floor plan"], ["elev", "Elevations"], ["section", "Sections"], ["site", "Site"],
  ["structure", "Structure"], ["notes", "Notes & cost"], ["options", "Earlier options"],
];
const FACES: [Face, string][] = [["N", "North"], ["E", "East"], ["S", "South"], ["W", "West"]];

export function App() {
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || "3d");
  const [face, setFace] = useState<Face>(HOUSE.site.road.side);
  const [sec, setSec] = useState(0);
  const sheets = useMemo(() => ({
    plan: sheetPlan(HOUSE, true), site: sheetSite(), structure: sheetStructure(),
    sections: HOUSE.sections.map(sheetSection), elev: Object.fromEntries(FACES.map(([f]) => [f, sheetElevation(f)])) as Record<Face, string>,
  }), []);
  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `#${t}`); };
  useEffect(() => {
    const onHash = () => { const h = location.hash.slice(1) as Tab; if (TABS.some(([k]) => k === h)) setTab(h); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const p = HOUSE.project;

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="logo">{p.title.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="name">{p.title} · {p.place}</div>
            <div className="meta">
              {HOUSE.name} · {ftin(BBOX.x1 - BBOX.x0)} × {ftin(BBOX.y1 - BBOX.y0)} · {sq(AREAS.p1)} sq ft{HOUSE.phase2 ? ` + ${sq(AREAS.p2)} sq ft phase 2` : ""} · RCC frame for G+{HOUSE.heights.floorsTotal - 1} · seismic zone {p.seismicZone}
            </div>
          </div>
        </div>
        <nav>
          {TABS.map(([k, label]) => <button key={k} className={tab === k ? "tab on" : "tab"} onClick={() => go(k)}>{label}</button>)}
        </nav>
      </header>
      <main>
        {tab === "options" && <Options />}
        {tab === "3d" && <House3D />}
        {tab === "plan" && <SvgViewer svg={sheets.plan} filename="ground-floor-plan.svg" />}
        {tab === "site" && <SvgViewer svg={sheets.site} filename="site-plan.svg" />}
        {tab === "structure" && <SvgViewer svg={sheets.structure} filename="structural-grid.svg" />}
        {tab === "elev" && (
          <div className="stack">
            <div className="subbar">
              {FACES.map(([f, name]) => (
                <button key={f} className={face === f ? "chip on" : "chip"} onClick={() => setFace(f)}>{name}{f === HOUSE.site.road.side ? " (front)" : ""}</button>
              ))}
            </div>
            <SvgViewer svg={sheets.elev[face]} filename={`elevation-${face}.svg`} />
          </div>
        )}
        {tab === "section" && (
          <div className="stack">
            <div className="subbar">
              {HOUSE.sections.map((s, i) => (
                <button key={s.name} className={sec === i ? "chip on" : "chip"} onClick={() => setSec(i)}>{s.name}–{s.name} · {s.title.split(",")[0]}</button>
              ))}
            </div>
            <SvgViewer svg={sheets.sections[sec]} filename={`section-${HOUSE.sections[sec].name}.svg`} />
          </div>
        )}
        {tab === "notes" && <Notes />}
      </main>
      <footer>{DISCLAIMER}</footer>
    </div>
  );
}
