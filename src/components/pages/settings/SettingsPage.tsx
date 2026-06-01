/**
 * SettingsPage (CP5) — ported verbatim from design/project/screens-home.jsx
 * `SettingsScreen`, wired to real state:
 *
 *   - Account row (useMe + useAuth fallback)
 *   - Units segmented + Dark-mode toggle (usePrefs: setUnits / setTheme)
 *   - Device & permissions group (location/keep-screen-on/notifications status)
 *   - Sign out (useAuth.signOut -> /login) and Delete account (toast stub)
 *
 * Visuals (inline-style + tokens) are kept byte-for-byte. Navigation uses
 * react-router; the design's transient `nav('__toast')` confirmations use the
 * local `useToast` hook.
 *
 * TODO(CP6): real permission-status query (location/notifications) and a
 * one-shot "Test GPS" fix should route through a `LocationTracker` adapter
 * capability — `navigator.permissions`/`navigator.geolocation` must not be called
 * directly from a screen (CLAUDE.md §4). Shown as a static "Granted" label and
 * toast stubs for now.
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar, Icon, IconBtn, Row, Segmented, Tag, Toggle, type IconName } from "@/components/primitives";
import { TopBar } from "@/components/chrome";
import { useMe } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePrefs, type Units } from "@/lib/prefs/store";
import { useToast } from "@/lib/useToast";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="eyebrow" style={{ marginBottom: 10, paddingLeft: 4 }}>
        {title}
      </div>
      {/* Card pad={0} equivalent — inline to keep the design's exact frame. */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r)",
          padding: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Item({
  icon,
  label,
  sub,
  right,
  onClick,
  danger,
}: {
  icon: IconName;
  label: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <Row onClick={onClick} gap={13} pad="14px 16px" style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: danger ? "var(--danger-soft)" : "var(--surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={18} color={danger ? "var(--danger)" : "var(--text-2)"} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: danger ? "var(--danger)" : "var(--text)" }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </Row>
  );
}

const chevR: ReactNode = <Icon name="chevR" size={18} color="var(--text-4)" />;

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const me = useMe();
  const toast = useToast();

  const units = usePrefs((s) => s.units);
  const setUnits = usePrefs((s) => s.setUnits);
  const theme = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);

  // TODO(CP6): query real status through the adapter; static default for now.
  const gps: "granted" | "denied" = "granted";

  const displayName =
    (me.data?.displayName as string | null) ??
    user?.displayName ??
    user?.email?.split("@")[0] ??
    "Runner";
  const email = me.data?.email ?? user?.email ?? "";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto" }}>
      <TopBar title="Settings" onBack={() => navigate(-1)} />
      <div style={{ padding: "8px 20px 24px" }}>
        <Group title="Account">
          <Row gap={13} pad="14px 16px" style={{ borderBottom: "1px solid var(--border)" }}>
            <Avatar
              name={displayName}
              src={(me.data?.photoUrl as string | null) ?? user?.photoUrl ?? undefined}
              size={44}
              color="var(--accent)"
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{displayName}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{email}</div>
            </div>
            <IconBtn name="edit" size={36} iconSize={17} onClick={() => toast.show("Edit name")} />
          </Row>
          <Item
            icon="camera"
            label="Change avatar"
            onClick={() => toast.show("Photo picker")}
            right={chevR}
          />
        </Group>

        <Group title="Preferences">
          <Item
            icon="ruler"
            label="Units"
            sub="Distance, pace & elevation"
            right={
              <Segmented
                style={{ width: 150 }}
                options={[
                  { value: "metric", label: "km" },
                  { value: "imperial", label: "mi" },
                ]}
                value={units}
                onChange={(v) => setUnits(v as Units)}
              />
            }
          />
          <Item
            icon="shoe"
            label="Default activity type"
            sub="Run"
            right={chevR}
            onClick={() => toast.show("Activity type")}
          />
          <Item
            icon="eye"
            label="Dark mode"
            right={<Toggle value={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />}
          />
        </Group>

        <Group title="Device & permissions">
          <Item
            icon="gps"
            label="Location"
            sub={gps === "granted" ? "Granted · while using the app" : "Not granted"}
            right={<Tag tone={gps === "granted" ? "live" : "warn"}>{gps === "granted" ? "On" : "Off"}</Tag>}
          />
          <Item
            icon="bolt"
            label="Keep screen on"
            sub="During recording (foreground only)"
            right={<Tag tone="live">Supported</Tag>}
          />
          <Item
            icon="bell"
            label="Notifications"
            sub="Available in the app build"
            right={<Tag>Later</Tag>}
          />
          <Item
            icon="target"
            label="Test GPS"
            sub="Get a one-shot fix"
            onClick={() => toast.show("GPS fix: ±4m · good")}
            right={chevR}
          />
        </Group>

        <Group title="Data">
          <Item
            icon="refresh"
            label="Clear local data"
            sub="Cached routes & unsynced runs"
            onClick={() => toast.show("Local cache cleared")}
            right={chevR}
          />
        </Group>

        <Group title="Account actions">
          <Item icon="signout" label="Sign out" danger onClick={() => void handleSignOut()} />
          <Item icon="trash" label="Delete account" danger onClick={() => toast.show("Are you sure? (demo)")} />
        </Group>

        <div style={{ textAlign: "center", color: "var(--text-4)", fontSize: 12, marginTop: 8 }}>
          Stride · PoC v0.1
        </div>
      </div>
      {toast.node}
    </div>
  );
}
