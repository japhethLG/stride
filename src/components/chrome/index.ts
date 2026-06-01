/**
 * Chrome barrel (CP4) — app chrome ported verbatim from
 * design/project/stride-chrome.jsx (+ the faux-map thumbnail from
 * stride-map.jsx). Screen code (CP5) imports from here:
 *
 *   import { TopBar, ActivityRow, RouteCard } from "@/components/chrome";
 */
export { TopBar, type TopBarProps } from "./TopBar";
export { BottomNav, TABS } from "./BottomNav";
export { Toast, type ToastProps } from "./Toast";
export { SectionHead, type SectionHeadProps } from "./SectionHead";
export { Empty, type EmptyProps } from "./Empty";
export { Chip, type ChipProps } from "./Chip";
export { StatusPill, type StatusPillProps, type StatusPillTone } from "./StatusPill";
export { Metric, type MetricProps } from "./Metric";
export { MiniMap, FauxMap, type MiniMapProps, type FauxMapProps } from "./MiniMap";
export {
  ActivityRow,
  TYPE_TONE,
  type ActivityRowProps,
  type ActivityRowData,
  type ActivityType,
} from "./ActivityRow";
export {
  RouteCard,
  type RouteCardProps,
  type RouteCardData,
  type RouteRole,
} from "./RouteCard";
export {
  mulberry32,
  buildStreets,
  type FauxMapStyle,
  type FauxStreets,
  type FauxBlob,
} from "./fauxMap";
