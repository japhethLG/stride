/**
 * Generate the PWA icon set from public/icon-source.svg using sharp.
 *
 * Outputs (all into public/):
 *   - pwa-192x192.png, pwa-512x512.png   "any" icons (full-bleed dark square)
 *   - maskable-icon-512x512.png          Android maskable: logo inside the 80%
 *                                        safe zone, dark fill to the edges so the
 *                                        circle/squircle mask never clips it.
 *   - apple-touch-icon-180x180.png       iOS home-screen icon (manifest is ignored
 *                                        by iOS, so this <link> in index.html is required).
 *
 * Run: npm run gen:icons
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, "..", "public");
const BG = { r: 9, g: 10, b: 13, alpha: 1 }; // #090A0D

const src = await readFile(resolve(pub, "icon-source.svg"));

const render = (size) =>
  sharp(src, { density: 384 }).resize(size, size, { fit: "contain", background: BG });

// Full-bleed "any" icons + iOS touch icon.
await render(192).png().toFile(resolve(pub, "pwa-192x192.png"));
await render(512).png().toFile(resolve(pub, "pwa-512x512.png"));
await render(180).png().toFile(resolve(pub, "apple-touch-icon-180x180.png"));

// Maskable: render logo at 80% (410px), then pad to 512 with the dark bg.
const inner = 410;
const pad = Math.round((512 - inner) / 2);
const innerBuf = await render(inner).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: BG },
})
  .composite([{ input: innerBuf, top: pad, left: pad }])
  .png()
  .toFile(resolve(pub, "maskable-icon-512x512.png"));

console.log("icons generated:", [
  "pwa-192x192.png",
  "pwa-512x512.png",
  "maskable-icon-512x512.png",
  "apple-touch-icon-180x180.png",
].join(", "));
