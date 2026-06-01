/**
 * Procedural faux-map generator (CP4) — ported verbatim from
 * design/project/stride-map.jsx (`mulberry32` + `buildStreets`).
 *
 * This powers the small static route thumbnails (`MiniMap`) in list rows. The
 * full interactive map is the MapLibre `MapView` primitive
 * (src/components/map/MapView.tsx) — the faux renderer is intentionally kept for
 * cheap thumbnails (no GL context per row). Route geometry is the design's 0..100
 * viewBox SVG path strings.
 */

export type FauxMapStyle = "streets" | "terrain" | "minimal";

export interface FauxBlob {
  kind: "water" | "park";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
}

export interface FauxStreets {
  roads: string[];
  minor: string[];
  blobs: FauxBlob[];
}

/** Deterministic RNG (verbatim from the design). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a procedural street network in 0..100 space (verbatim from the design). */
export function buildStreets(seed: number, style: FauxMapStyle): FauxStreets {
  const rnd = mulberry32(seed * 2654435761);
  const roads: string[] = [];
  const minor: string[] = [];
  const blobs: FauxBlob[] = [];

  const blobCount = style === "minimal" ? 0 : 2;
  for (let i = 0; i < blobCount; i++) {
    const kind: FauxBlob["kind"] =
      i === 0 ? "water" : style === "terrain" ? "park" : rnd() > 0.5 ? "park" : "water";
    blobs.push({
      kind,
      cx: 8 + rnd() * 84,
      cy: 8 + rnd() * 84,
      rx: 14 + rnd() * 20,
      ry: 12 + rnd() * 16,
      rot: rnd() * 60 - 30,
    });
  }

  const jit = () => (rnd() - 0.5) * 16;
  for (let i = 0; i < 2; i++) {
    const y = 22 + i * 34 + jit();
    roads.push(`M -6 ${y + jit() * 0.4} L 40 ${y} L 70 ${y + jit() * 0.5} L 106 ${y + jit() * 0.4}`);
    const x = 24 + i * 38 + jit();
    roads.push(`M ${x + jit() * 0.4} -6 L ${x} 42 L ${x + jit() * 0.5} 70 L ${x + jit() * 0.4} 106`);
  }
  roads.push(`M -6 ${10 + rnd() * 20} L 50 ${45 + jit()} L 106 ${75 + rnd() * 18}`);

  const n = style === "minimal" ? 5 : 11;
  for (let i = 0; i < n; i++) {
    if (rnd() > 0.5) {
      const y = rnd() * 100;
      minor.push(`M -6 ${y} L 106 ${y + jit() * 0.6}`);
    } else {
      const x = rnd() * 100;
      minor.push(`M ${x} -6 L ${x + jit() * 0.6} 106`);
    }
  }
  return { roads, minor, blobs };
}
