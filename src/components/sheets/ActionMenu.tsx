/**
 * ActionMenu — a small dark popover menu anchored to a trigger (e.g. a kebab
 * IconBtn). Renders a full-screen invisible scrim that closes on outside-tap,
 * plus an absolutely-positioned action list in the design's surface/border
 * tokens. Each item is a label + optional icon, with an optional `tone` to
 * render destructive actions (Delete) in the danger colour.
 *
 * Visuals follow the same inline-style + CSS-token approach as the other
 * primitives/sheets (no Tailwind). Position is given by the caller via `anchor`
 * (absolute coords relative to the nearest positioned ancestor); the menu pins
 * itself to the top-right by default which suits a kebab in a header row.
 */
import { Icon, type IconName } from "@/components/primitives";

export interface ActionMenuItem {
  label: string;
  icon?: IconName;
  tone?: "default" | "danger";
  onSelect: () => void;
}

export interface ActionMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ActionMenuItem[];
  /** Absolute offsets (px) for the menu, relative to the positioned ancestor. */
  anchor?: { top?: number; right?: number; left?: number; bottom?: number };
  /** Menu min-width in px. */
  width?: number;
}

export function ActionMenu({
  open,
  onOpenChange,
  items,
  anchor = { top: 56, right: 14 },
  width = 188,
}: ActionMenuProps) {
  if (!open) return null;
  const close = () => onOpenChange(false);
  return (
    <>
      {/* outside-tap scrim (invisible, covers the screen) */}
      <div
        onClick={close}
        style={{ position: "fixed", inset: 0, zIndex: 40 }}
      />
      <div
        role="menu"
        style={{
          position: "absolute",
          top: anchor.top,
          right: anchor.right,
          left: anchor.left,
          bottom: anchor.bottom,
          zIndex: 41,
          minWidth: width,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          boxShadow: "0 12px 32px rgba(0,0,0,.45)",
          overflow: "hidden",
          padding: 6,
        }}
      >
        {items.map((it, i) => {
          const danger = it.tone === "danger";
          return (
            <button
              key={i}
              role="menuitem"
              type="button"
              onClick={() => {
                close();
                it.onSelect();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                height: 44,
                padding: "0 12px",
                border: "none",
                borderRadius: "var(--r-xs, 10px)",
                cursor: "pointer",
                background: "transparent",
                color: danger ? "var(--danger)" : "var(--text)",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              {it.icon && (
                <Icon name={it.icon} size={18} color={danger ? "var(--danger)" : "var(--text-2)"} />
              )}
              {it.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
