/**
 * Toggle — on/off switch (ported verbatim from design/project/stride-ui.jsx
 * `Toggle`).
 */
export interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 48,
        height: 28,
        borderRadius: "var(--r-pill)",
        border: "none",
        cursor: "pointer",
        flexShrink: 0,
        background: value ? "var(--accent)" : "var(--surface-3)",
        position: "relative",
        transition: "background var(--dur)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: value ? 23 : 3,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#fff",
          transition: "left var(--dur) var(--ease)",
          boxShadow: "0 1px 3px rgba(0,0,0,.3)",
        }}
      />
    </button>
  );
}
