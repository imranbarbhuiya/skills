import { AREAS, HOUSE, OPTIONS, check, designAreas, sq } from "./model";
import { DISCLAIMER } from "./svg";

/** Notes & cost tab: areas against the brief and earlier options, a cost range, the design notes and open questions. */
export function Notes() {
  const errs = check();
  const { currency: cur, budget, rates, sources } = HOUSE.cost;
  const lakh = (v: number) => (cur === "₹" ? `₹${(v / 1e5).toFixed(1)}L` : `${cur}${Math.round(v).toLocaleString()}`);
  const brief = HOUSE.project.briefArea;
  const pct = (x: number) => (brief ? ` (${x >= brief ? "+" : ""}${Math.round((x / brief - 1) * 100)}%)` : "");
  return (
    <div className="notes">
      <div className="disclaimer">{DISCLAIMER}</div>

      <h2>{HOUSE.name}</h2>
      <p>{HOUSE.tagline}</p>
      <p className="muted">{HOUSE.project.place} · climate: {HOUSE.project.climate} · seismic zone {HOUSE.project.seismicZone}</p>

      <h2>Size and area</h2>
      <table>
        <thead><tr><th></th>{brief ? <th>Brief</th> : null}{OPTIONS.map((o) => <th key={o.id}>{o.name}</th>)}<th>{HOUSE.name}</th></tr></thead>
        <tbody>
          <tr><td>{HOUSE.phase2 ? "Phase 1 built" : "Built"}</td>{brief ? <td>{sq(brief)} sq ft</td> : null}
            {OPTIONS.map((o) => <td key={o.id}>{sq(designAreas(o).p1)} sq ft{pct(designAreas(o).p1)}</td>)}<td><b>{sq(AREAS.p1)} sq ft{pct(AREAS.p1)}</b></td></tr>
          {HOUSE.phase2 && <tr><td>Phase 2</td>{brief ? <td>—</td> : null}{OPTIONS.map((o) => <td key={o.id}>{sq(designAreas(o).p2)} sq ft</td>)}<td>{sq(AREAS.p2)} sq ft</td></tr>}
          <tr><td>Total built</td>{brief ? <td>—</td> : null}{OPTIONS.map((o) => <td key={o.id}>{sq(designAreas(o).total)} sq ft</td>)}<td><b>{sq(AREAS.total)} sq ft</b></td></tr>
        </tbody>
      </table>

      <h2>Cost reality check</h2>
      {budget ? <p>Budget {lakh(budget)} over {sq(AREAS.p1)} sq ft is about {cur}{Math.round(budget / AREAS.p1).toLocaleString("en-IN")}/sq ft for phase 1.</p> : null}
      <table>
        <thead><tr><th>Scenario</th><th>{cur} / sq ft</th><th>Phase 1 · {sq(AREAS.p1)} sq ft</th>{HOUSE.phase2 && <th>Phase 2 · {sq(AREAS.p2)} sq ft</th>}</tr></thead>
        <tbody>
          {rates.map(([n, lo, hi]) => (
            <tr key={n}><td>{n}</td><td>{lo.toLocaleString("en-IN")}–{hi.toLocaleString("en-IN")}</td><td>{lakh(AREAS.p1 * lo)} – {lakh(AREAS.p1 * hi)}</td>
              {HOUSE.phase2 && <td>{lakh(AREAS.p2 * lo)} – {lakh(AREAS.p2 * hi)}</td>}</tr>
          ))}
        </tbody>
      </table>
      <p className="muted">{sources}</p>

      {HOUSE.notesTab.sections.map((sec) => (
        <div key={sec.title}>
          <h2>{sec.title}</h2>
          <ul>{sec.items.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      ))}

      <h2>Questions still open</h2>
      <ol>{HOUSE.notesTab.questions.map((q) => <li key={q}>{q}</li>)}</ol>
      <p className="muted">Model self-check: {errs.length ? errs.join("; ") : "all checks pass ✓"}</p>
    </div>
  );
}
