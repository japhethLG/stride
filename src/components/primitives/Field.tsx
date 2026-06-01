/**
 * Field — labelled text input with leading icon / trailing slot / error (ported
 * verbatim from design/project/stride-ui.jsx `Field`). Controlled: pass `value`
 * + `onChange`.
 */
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface FieldProps {
  label?: ReactNode;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  icon?: IconName;
  trailing?: ReactNode;
  error?: ReactNode;
  onFocus?: () => void;
  autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  icon,
  trailing,
  error,
  onFocus,
  autoFocus,
  inputMode,
}: FieldProps) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      {label && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 7 }}>
          {label}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 52,
          padding: "0 14px",
          background: "var(--surface-2)",
          borderRadius: "var(--r-sm)",
          border: `1.5px solid ${error ? "var(--danger)" : focus ? "var(--accent)" : "var(--border)"}`,
          transition: "border-color var(--dur)",
        }}
      >
        {icon && <Icon name={icon} size={19} color="var(--text-3)" />}
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          type={type}
          placeholder={placeholder}
          autoFocus={autoFocus}
          inputMode={inputMode}
          onFocus={() => {
            setFocus(true);
            onFocus?.();
          }}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            background: "none",
            border: "none",
            outline: "none",
            color: "var(--text)",
            fontFamily: "var(--font-body)",
            fontSize: 16,
            fontWeight: 500,
          }}
        />
        {trailing}
      </div>
      {error && (
        <div style={{ fontSize: 12.5, color: "var(--danger)", marginTop: 6, fontWeight: 500 }}>
          {error}
        </div>
      )}
    </div>
  );
}
