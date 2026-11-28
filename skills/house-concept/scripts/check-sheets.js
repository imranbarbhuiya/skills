// Lists text in the visible SVG sheet that runs outside the sheet's viewBox.
// Run it in the page: paste into the devtools console, or pass it to the browser tool's evaluate.
// Rotated labels can give a false positive; check those by eye.
(() => {
  const out = [];
  for (const svg of document.querySelectorAll("main svg[viewBox]")) {
    const [, , w, h] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    for (const t of svg.querySelectorAll("text")) {
      const b = t.getBBox();
      if (b.x < -1 || b.y < -1 || b.x + b.width > w + 1 || b.y + b.height > h + 1) {
        out.push({ text: t.textContent.slice(0, 60), x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.x + b.width), bottom: Math.round(b.y + b.height), sheet: `${w}×${h}` });
      }
    }
  }
  return out.length ? out : "no text outside the sheet";
})();
