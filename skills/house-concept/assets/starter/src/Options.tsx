import { useMemo, useState } from "react";
import { HOUSE, OPTIONS, designAreas, sq } from "./model";
import { sheetPlan } from "./sheets/plan";
import { SvgViewer } from "./SvgViewer";

/** Earlier options: cards on the left, the selected floor plan on the right. The working plan is listed first. */
export function Options() {
  const all = [HOUSE, ...OPTIONS];
  const [id, setId] = useState(OPTIONS[0]?.id ?? HOUSE.id);
  const sheets = useMemo(() => Object.fromEntries(all.map((d) => [d.id, sheetPlan(d, false)])), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="options">
      <aside>
        <div className="opt-intro">
          <b>Options</b>
          <span>The working plan is on the Floor plan tab and in every other view. Earlier options are kept here as they were.</span>
        </div>
        {all.map((d) => {
          const a = designAreas(d);
          return (
            <button key={d.id} className={id === d.id ? "opt on" : "opt"} onClick={() => setId(d.id)}>
              <div className="opt-head"><span>{d.name}</span>{d.badge && <em>{d.badge.toLowerCase()}</em>}</div>
              <div className="opt-tag">{d.tagline}</div>
              <div className="opt-stats">
                <span><b>{sq(a.p1)}</b> sq ft{d.phase2 ? " phase 1" : ""}</span>
                {d.phase2 && <span><b>{sq(a.total)}</b> sq ft with phase 2</span>}
              </div>
            </button>
          );
        })}
      </aside>
      <section>
        <SvgViewer svg={sheets[id]} filename={`option-${id}.svg`} />
      </section>
    </div>
  );
}
