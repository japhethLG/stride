/**
 * Runtime dark recolor for the OpenFreeMap Liberty vector style.
 *
 * Liberty ships as a light style and OpenFreeMap has no official dark variant
 * yet, so we walk the loaded style's layers once on `load` and repaint them
 * toward the design's `--map-*` tokens. It's a heuristic tint keyed off layer id
 * substrings (the OpenMapTiles schema Liberty is built on uses stable-ish ids),
 * not a hand-authored dark style — good enough to match the design's mood for
 * the PoC. Replace with a real dark style.json when one is available.
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import { MAP_DARK_COLORS as C } from "./style";

function setPaint(
  map: MapLibreMap,
  id: string,
  prop: string,
  value: string | number,
): void {
  try {
    // setPaintProperty throws if the property is invalid for the layer type;
    // we only call it for matching layer types, but guard regardless.
    map.setPaintProperty(id, prop as never, value as never);
  } catch {
    /* layer doesn't support this paint prop — skip */
  }
}

/** Repaint the live style's basemap layers toward the dark token palette. */
export function applyDarkTheme(map: MapLibreMap): void {
  const style = map.getStyle();
  if (!style?.layers) return;

  map.setPaintProperty("background", "background-color", C.background as never);

  for (const layer of style.layers) {
    const id = layer.id;
    const type = layer.type;

    if (type === "background") {
      setPaint(map, id, "background-color", C.background);
      continue;
    }

    if (type === "fill") {
      if (/water|ocean|river|lake/.test(id)) setPaint(map, id, "fill-color", C.water);
      else if (/park|wood|forest|grass|green|landcover|landuse/.test(id))
        setPaint(map, id, "fill-color", C.park);
      else if (/building/.test(id)) setPaint(map, id, "fill-color", C.land);
      else setPaint(map, id, "fill-color", C.land);
      setPaint(map, id, "fill-outline-color", C.background);
      continue;
    }

    if (type === "line") {
      if (/water|river|stream|canal/.test(id)) setPaint(map, id, "line-color", C.water);
      else if (/motorway|trunk|primary|major/.test(id))
        setPaint(map, id, "line-color", C.roadMajor);
      else if (/road|street|transportation|highway|bridge|tunnel|path|rail/.test(id))
        setPaint(map, id, "line-color", C.road);
      else setPaint(map, id, "line-color", C.road);
      continue;
    }

    if (type === "symbol") {
      setPaint(map, id, "text-color", C.label);
      setPaint(map, id, "text-halo-color", C.labelHalo);
      setPaint(map, id, "text-halo-width", 1.2);
      continue;
    }

    if (type === "fill-extrusion") {
      setPaint(map, id, "fill-extrusion-color", C.land);
    }
  }
}
