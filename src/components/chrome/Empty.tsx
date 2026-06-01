/**
 * Empty — empty-state block with icon, title, sub, optional action (ported
 * verbatim from design/project/stride-chrome.jsx `Empty`).
 */
import type { ReactNode } from "react";
import { Btn, Icon, type IconName } from "@/components/primitives";

export interface EmptyProps {
  icon: IconName;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
}

export function Empty({ icon, title, sub, action, onAction }: EmptyProps) {
  return (
    <div style={{ textAlign: "center", padding: "28px 20px" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Icon name={icon} size={26} color="var(--text-3)" />
      </div>
      <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
      {sub && (
        <div
          style={{
            color: "var(--text-2)",
            fontSize: 13.5,
            marginTop: 5,
            maxWidth: 240,
            marginInline: "auto",
            lineHeight: 1.4,
          }}
        >
          {sub}
        </div>
      )}
      {action && (
        <div style={{ marginTop: 16 }}>
          <Btn size="sm" variant="secondary" onClick={onAction} icon="plus">
            {action}
          </Btn>
        </div>
      )}
    </div>
  );
}
