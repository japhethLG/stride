/**
 * RouteMembersPage — ported from design/project/screens-routes.jsx
 * `MembersScreen`.
 *
 * Real wiring: `useRouteMembers(id)` lists memberships (owner/joined/pending/
 * declined). `useInviteMember(id)` (routeId bound) sends an email invite via the
 * BaseSheet; `useRemoveMember(id)` removes a member. The route name in the
 * subtitle comes from `useRoute(id)`.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Btn, Card, Field, IconBtn, Row, Spinner, Tag } from "@/components/primitives";
import { TopBar, Empty } from "@/components/chrome";
import { BaseSheet } from "@/components/sheets";
import { useRoute } from "@/lib/api/routes";
import { useRouteMembers, useInviteMember, useRemoveMember } from "@/lib/api/memberships";
import { asText, userLabel } from "./_shared";
import type { RouteMembershipDto } from "@/lib/api/types";

const ORDER: Record<string, number> = { JOINED: 1, INVITED: 2, DECLINED: 3 };

function StatusTag({ s }: { s: RouteMembershipDto["status"] }) {
  if (s === "JOINED") return <Tag tone="live">Joined</Tag>;
  if (s === "INVITED") return <Tag tone="warn">Pending</Tag>;
  return <Tag>Declined</Tag>;
}

export function RouteMembersPage() {
  const nav = useNavigate();
  const { id = "" } = useParams<{ id: string }>();

  const routeQ = useRoute(id);
  const membersQ = useRouteMembers(id);
  const inviteMember = useInviteMember(id);
  const removeMember = useRemoveMember(id);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");

  const members = membersQ.data?.members ?? [];
  const sorted = useMemo(
    () =>
      [...members].sort(
        (a, b) =>
          (a.role === "OWNER" ? 0 : ORDER[a.status] ?? 9) -
          (b.role === "OWNER" ? 0 : ORDER[b.status] ?? 9),
      ),
    [members],
  );
  const counts = {
    joined: members.filter((m) => m.status === "JOINED").length,
    pending: members.filter((m) => m.status === "INVITED").length,
  };

  const validEmail = /.+@.+\..+/.test(email);

  const sendInvite = async () => {
    if (!validEmail) return;
    try {
      await inviteMember.mutateAsync({ email });
      setInviteOpen(false);
      setEmail("");
    } catch {
      /* error surfaced inside the sheet */
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <TopBar
        title="Members"
        sub={`${asText(routeQ.data?.name) || "Route"} · ${counts.joined} joined, ${counts.pending} pending`}
        onBack={() => nav(-1)}
      />
      <div style={{ flex: 1, overflow: "auto", padding: "4px 20px 100px" }}>
        {membersQ.isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Spinner size={26} color="var(--accent)" />
          </div>
        ) : membersQ.isError ? (
          <Empty
            icon="warning"
            title="Couldn't load members"
            sub={membersQ.error?.message ?? "Something went wrong."}
            action="Retry"
            onAction={() => membersQ.refetch()}
          />
        ) : sorted.length === 0 ? (
          <Empty icon="users" title="No members yet" sub="Invite people to share this route." />
        ) : (
          <Card pad={0}>
            {sorted.map((m, i) => {
              const label = userLabel(m.user);
              const email = asText(m.user?.email) || asText(m.invitedEmail);
              return (
                <Row
                  key={m.id}
                  gap={12}
                  pad="12px 14px"
                  style={{
                    borderBottom: i === sorted.length - 1 ? "none" : "1px solid var(--border)",
                    opacity: m.status === "DECLINED" ? 0.55 : 1,
                  }}
                >
                  <Avatar name={label} src={asText(m.user?.photoUrl) || undefined} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Row gap={6}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{label}</span>
                      {m.role === "OWNER" && (
                        <Tag tone="accent" size="sm">
                          Owner
                        </Tag>
                      )}
                    </Row>
                    {email && (
                      <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 1 }}>{email}</div>
                    )}
                  </div>
                  {m.role === "OWNER" ? (
                    <Tag tone="accent">Owner</Tag>
                  ) : (
                    <>
                      <StatusTag s={m.status} />
                      <IconBtn
                        name="trash"
                        size={34}
                        iconSize={17}
                        onClick={() => {
                          if (m.userId) removeMember.mutate({ userId: m.userId });
                        }}
                      />
                    </>
                  )}
                </Row>
              );
            })}
          </Card>
        )}
        <p
          style={{
            color: "var(--text-3)",
            fontSize: 12.5,
            textAlign: "center",
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          Members can see the route, the live tracking, and the leaderboard.
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "14px 20px 18px",
          background: "linear-gradient(180deg, transparent, var(--bg) 30%)",
        }}
      >
        <Btn full size="lg" icon="plus" onClick={() => setInviteOpen(true)}>
          Invite people
        </Btn>
      </div>

      <BaseSheet open={inviteOpen} onOpenChange={setInviteOpen} title="Invite by email">
        <Field
          label="Email address"
          value={email}
          onChange={setEmail}
          placeholder="friend@email.com"
          icon="mail"
          inputMode="email"
          autoFocus
        />
        {inviteMember.isError && (
          <div style={{ fontSize: 12.5, color: "var(--danger)", marginTop: 10, fontWeight: 600 }}>
            {inviteMember.error?.message ?? "Couldn't send invite."}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Btn full size="lg" disabled={!validEmail} loading={inviteMember.isPending} onClick={sendInvite}>
            Send invite
          </Btn>
        </div>
      </BaseSheet>
    </div>
  );
}
