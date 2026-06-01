/**
 * IconBtn — circular icon button (ported verbatim from
 * design/project/stride-ui.jsx `IconBtn`). Supports an `active` state and an
 * optional `badge` (e.g. unread count).
 */
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface IconBtnProps {
  name: IconName;
  onClick?: () => void;
  size?: number;
  iconSize?: number;
  active?: boolean;
  style?: CSSProperties;
  color?: string;
  badge?: ReactNode;
}

export function IconBtn({
  name,
  onClick,
  size = 40,
  iconSize = 21,
  active,
  style,
  color,
  badge,
}: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--r-pill)",
        position: "relative",
        background: active ? "var(--accent-soft)" : "var(--surface-2)",
        border: "1px solid var(--border)",
        color: color || (active ? "var(--accent)" : "var(--text)"),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background var(--dur)",
        flexShrink: 0,
        ...style,
      }}
    >
      <Icon name={name} size={iconSize} stroke={2} />
      {badge ? (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 8,
            background: "var(--accent)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid var(--bg)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
