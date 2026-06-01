/**
 * Primitives barrel (CP4) — the design-system primitives ported verbatim from
 * design/project/stride-ui.jsx. Screen code (CP5) imports from here:
 *
 *   import { Btn, Card, Field, Icon } from "@/components/primitives";
 *
 * Approved CP4 deviation: inline-style + CSS-token visuals (NOT Tailwind), and
 * icons come from this `Icon` (NOT lucide-react).
 */
export { Icon, ICON_PATHS, type IconName, type IconProps } from "./Icon";
export { Spinner, type SpinnerProps } from "./Spinner";
export { Btn, type BtnProps, type BtnVariant, type BtnSize } from "./Btn";
export { IconBtn, type IconBtnProps } from "./IconBtn";
export { Tag, type TagProps, type TagTone, type TagSize } from "./Tag";
export { Avatar, type AvatarProps } from "./Avatar";
export { Card, type CardProps } from "./Card";
export {
  StatBlock,
  type StatBlockProps,
  type StatBlockSize,
  type StatBlockAlign,
} from "./StatBlock";
export { Segmented, type SegmentedProps, type SegmentedOption } from "./Segmented";
export { Field, type FieldProps } from "./Field";
export { Toggle, type ToggleProps } from "./Toggle";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export { Row, type RowProps } from "./Row";
export { StrideMark, Wordmark, type StrideMarkProps, type WordmarkProps } from "./Wordmark";
