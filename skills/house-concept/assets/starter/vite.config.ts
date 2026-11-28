import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained HTML file (JS, CSS, three.js and the sketch SVG all inlined).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: "dist", assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 4000 },
});
