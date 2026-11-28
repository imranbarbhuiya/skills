import { useEffect, useRef, useState } from "react";

/** Shows an SVG string with wheel-zoom, drag-pan, fit and download. */
export function SvgViewer({ svg, filename }: { svg: string; filename: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const size = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  const w = size ? Number(size[1]) : 1000, h = size ? Number(size[2]) : 800;

  const fit = () => {
    const el = box.current;
    if (!el) return;
    const k = Math.min(el.clientWidth / w, el.clientHeight / h) * 0.98;
    setZ({ k, x: (el.clientWidth - w * k) / 2, y: (el.clientHeight - h * k) / 2 });
  };
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
    // refit whenever the sheet changes
  }, [svg]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomAt = (factor: number, cx: number, cy: number) =>
    setZ((p) => {
      const k = Math.min(8, Math.max(0.15, p.k * factor));
      const f = k / p.k;
      return { k, x: cx - (cx - p.x) * f, y: cy - (cy - p.y) * f };
    });

  useEffect(() => {
    const el = box.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const download = () => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="svgview">
      <div
        ref={box}
        className="svgview-canvas"
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, ox: z.x, oy: z.y }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (d) setZ((p) => ({ ...p, x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y })); }}
        onPointerUp={() => { drag.current = null; }}
        onDoubleClick={fit}
      >
        <div className="svgview-sheet" style={{ width: w, height: h, transform: `translate(${z.x}px, ${z.y}px) scale(${z.k})` }}
          dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <div className="svgview-tools">
        <button onClick={() => { const el = box.current!; zoomAt(1.25, el.clientWidth / 2, el.clientHeight / 2); }}>＋</button>
        <button onClick={() => { const el = box.current!; zoomAt(0.8, el.clientWidth / 2, el.clientHeight / 2); }}>－</button>
        <button onClick={fit}>Fit</button>
        <button onClick={download}>Download SVG</button>
      </div>
    </div>
  );
}
