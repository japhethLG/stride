/**
 * RoutesPage — ported from design/project/screens-routes.jsx `RoutesScreen`.
 *
 * Real wiring: `useRoutes({scope})` for the list (the design's `filter` chips map
 * to the backend scope — All=mine+member+public, Mine=mine, Shared=member) and
 * `useInvites()` for the Invitations section with accept/decline. Search + sort
 * happen client-side over the fetched page (sort BaseSheet). The FAB and the
 * empty-state action route to /routes/new.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, Card, Field, Icon, IconBtn, Row, Spinner } from "@/components/primitives";
import { TopBar, SectionHead, Empty, Chip, RouteCard, MiniMap } from "@/components/chrome";
import { BaseSheet } from "@/components/sheets";
import {
  useRoutes,
  type RouteScope,
} from "@/lib/api/routes";
import {
  useInvites,
  useAcceptInvite,
  useDeclineInvite,
} from "@/lib/api/memberships";
import { useUnits } from "@/lib/prefs/store";
import type { RouteDto } from "@/lib/api/types";
import { asNum, asText } from "./_shared";

type FilterKey = "all" | "mine" | "shared";
type SortKey = "updated" | "name" | "distance";

const FILTER_SCOPE: Record<FilterKey, RouteScope | undefined> = {
  all: undefined,
  mine: "mine",
  shared: "member",
};

function distKm(r: RouteDto): number {
  return r.distanceM / 1000;
}

export function RoutesPage() {
  const nav = useNavigate();
  const units = useUnits();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [sortOpen, setSortOpen] = useState(false);

  const routesQ = useRoutes({ scope: FILTER_SCOPE[filter], limit: 50 });
  const invitesQ = useInvites();
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();

  const invites = invitesQ.data?.invites ?? [];

  const list = useMemo(() => {
    let rows = [...(routesQ.data?.routes ?? [])];
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
    if (sort === "name") rows = rows.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "distance") rows = rows.sort((a, b) => b.distanceM - a.distanceM);
    if (sort === "updated")
      rows = rows.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return rows;
  }, [routesQ.data, q, sort]);

  const roleFor = (): "OWNER" | "MEMBER" => (filter === "mine" ? "OWNER" : "MEMBER");

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <TopBar
        title="Routes"
        sub={`${list.length} route${list.length !== 1 ? "s" : ""}`}
        right={<IconBtn name="sort" onClick={() => setSortOpen(true)} />}
      />
      <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
        <Field value={q} onChange={setQ} placeholder="Search routes" icon="search" />
        <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto" }}>
          {(
            [
              ["all", "All"],
              ["mine", "Mine"],
              ["shared", "Shared"],
            ] as [FilterKey, string][]
          ).map(([v, l]) => (
            <Chip key={v} active={filter === v} onClick={() => setFilter(v)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "4px 20px 90px" }}>
        {invites.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionHead title={`Invitations (${invites.length})`} />
            {invites.map((inv) => {
              const fromEmail = asText(inv.invitedEmail) || asText(inv.user?.email);
              return (
                <Card key={inv.id} pad={13} style={{ borderColor: "var(--accent)" }}>
                  <Row gap={11}>
                    <MiniMap size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Route invite</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 1 }}>
                        {fromEmail ? `for ${fromEmail}` : "You have been invited"}
                      </div>
                    </div>
                  </Row>
                  <Row gap={8} style={{ marginTop: 11 }}>
                    <Btn
                      size="sm"
                      full
                      loading={acceptInvite.isPending}
                      onClick={() =>
                        acceptInvite.mutate({ params: { path: { inviteId: inv.id } } })
                      }
                    >
                      Accept
                    </Btn>
                    <Btn
                      size="sm"
                      full
                      variant="secondary"
                      loading={declineInvite.isPending}
                      onClick={() =>
                        declineInvite.mutate({ params: { path: { inviteId: inv.id } } })
                      }
                    >
                      Decline
                    </Btn>
                  </Row>
                </Card>
              );
            })}
          </div>
        )}

        {routesQ.isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Spinner size={26} color="var(--accent)" />
          </div>
        ) : routesQ.isError ? (
          <Empty
            icon="warning"
            title="Couldn't load routes"
            sub={routesQ.error?.message ?? "Something went wrong."}
            action="Retry"
            onAction={() => routesQ.refetch()}
          />
        ) : list.length === 0 ? (
          <Empty
            icon="route"
            title={q ? "No routes match" : "No routes yet"}
            sub={
              q ? "Try a different search." : "Create your first route to start tracking efforts."
            }
            action={q ? undefined : "Create route"}
            onAction={q ? undefined : () => nav("/routes/new")}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map((r) => (
              <RouteCard
                key={r.id}
                units={units}
                onClick={() => nav("/routes/" + r.id)}
                r={{
                  name: r.name,
                  dist: distKm(r),
                  elev: Math.round(asNum(r.elevationGainM)),
                  role: roleFor(),
                  members: 0,
                  isPublic: r.isPublic,
                  liveNow: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => nav("/routes/new")}
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          height: 54,
          padding: "0 22px",
          borderRadius: "var(--r-pill)",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "var(--font-body)",
          fontWeight: 700,
          fontSize: 15.5,
          boxShadow: "0 10px 28px var(--accent-soft), 0 6px 16px rgba(0,0,0,.4)",
          zIndex: 30,
        }}
      >
        <Icon name="plus" size={22} stroke={2.6} />
        New route
      </button>

      <BaseSheet open={sortOpen} onOpenChange={setSortOpen} title="Sort by">
        {(
          [
            ["updated", "Recently updated"],
            ["name", "Name A–Z"],
            ["distance", "Distance"],
          ] as [SortKey, string][]
        ).map(([v, l]) => (
          <Row
            key={v}
            onClick={() => {
              setSort(v);
              setSortOpen(false);
            }}
            pad="14px 4px"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{l}</span>
            {sort === v && <Icon name="check" size={20} color="var(--accent)" />}
          </Row>
        ))}
      </BaseSheet>
    </div>
  );
}
