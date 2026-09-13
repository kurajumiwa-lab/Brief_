import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import type { AuthedUser, PersonMe, FollowsGroups } from "../../api/briefApi";
import type { Subscription, SubscriptionJoin } from "../../api/types";
import { MotionList } from "../../ui/motion/MotionList";
import { MotionStatus } from "../../ui/motion/MotionStatus";
import { EarnSurface } from "./EarnSurface";
import { TableBankingSurface } from "./TableBankingSurface";

// ---------------------------------------------------------------------------
// YOU — the member's own profile, follows and subscriptions (Phase 3).
//
// The surface the production shell was missing: a person can see WHO they are
// (handle, standing, provenance), WHOM they follow (entities, with unfollow),
// and WHICH creators they subscribe to (paid plans, joined honestly).
//
// Two honest rails for "follow a creator", never collapsed into one button:
//   * FOLLOW an ENTITY (venue/business/publisher/organizer/community) — free,
//     via /api/entities/:id/follow.
//   * SUBSCRIBE to a creator's paid PLAN — via /api/subscriptions/:id/subscribe,
//     which records the membership but is honest that no money moved while no
//     payment provider is connected ("recorded, not charged").
//
// Everything is read from real server rows; a signed-out caller gets the
// signed-out state, and an empty list is shown as empty, never fabricated.
// ---------------------------------------------------------------------------

const KIND_LABELS: Record<string, string> = {
  venue: "Places",
  business: "Businesses",
  publisher: "Publishers",
  organizer: "Organizers",
  community: "Communities"
};

type Section = "profile" | "following" | "subscriptions" | "earn" | "tableBanking";

export function YouSurface({
  onOpenEntity,
  onRequireAuth
}: {
  onOpenEntity: (entityId: string) => void;
  onRequireAuth: () => void;
}) {
  const [section, setSection] = useState<Section>("profile");
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [me, setMe] = useState<AuthedUser | null>(null);
  const [person, setPerson] = useState<PersonMe | null>(null);
  const [provenance, setProvenance] = useState<string | null>(null);
  const [follows, setFollows] = useState<FollowsGroups | null>(null);
  const [plans, setPlans] = useState<Subscription[] | null>(null);
  const [myPlans, setMyPlans] = useState<Subscription[] | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const [who, per, acq] = await Promise.all([
      api.whoAmI(),
      api.getPersonMe(),
      api.getMyAcquisition()
    ]);
    setLoading(false);
    if (!who.ok && who.status === 401) {
      setSignedOut(true);
      return;
    }
    setSignedOut(false);
    setMe(who.ok ? who.data : null);
    setPerson(per.ok ? per.data : null);
    if (acq.ok && acq.data.acquisition) {
      const a = acq.data.acquisition;
      const parts = [a.partnerName ?? a.partnerKey, a.cohortName ?? a.cohortKey, a.channel ? `via ${a.channel}` : ""]
        .filter(Boolean);
      setProvenance(parts.length ? parts.join(" · ") : null);
    } else {
      setProvenance(null);
    }
  };

  const loadFollowing = async () => {
    const res = await api.getMyFollows();
    if (res.ok) setFollows(res.data);
  };
  const loadPlans = async () => {
    const [pub, mine] = await Promise.all([api.browseSubscriptions(), api.getMySubscriptions()]);
    if (pub.ok) setPlans(pub.data);
    if (mine.ok) setMyPlans(mine.data);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (section === "following") void loadFollowing();
    if (section === "subscriptions") void loadPlans();
  }, [section]);

  const unfollow = async (id: string, name: string) => {
    setBusy((p) => ({ ...p, [`u:${id}`]: true }));
    const res = await api.unfollowEntity(id);
    setBusy((p) => ({ ...p, [`u:${id}`]: false }));
    if (res.ok) {
      setNotice(`Unfollowed ${name}.`);
      void loadFollowing();
    } else {
      setNotice(res.error ?? "Could not unfollow.");
    }
  };

  const subscribe = async (plan: Subscription) => {
    setBusy((p) => ({ ...p, [`s:${plan.id}`]: true }));
    const res = await api.subscribeToPlan(plan.id);
    setBusy((p) => ({ ...p, [`s:${plan.id}`]: false }));
    if (res.ok) {
      const j: SubscriptionJoin = res.data;
      setNotice(j.charged ? `Subscribed to ${plan.title}.` : `Joined ${plan.title} — recorded, not charged (no payment provider).`);
      void loadPlans();
    } else if (res.status === 401) {
      onRequireAuth();
    } else {
      setNotice(res.error ?? "Could not subscribe.");
    }
  };

  const signOut = async () => {
    await api.logout();
    setMe(null);
    setPerson(null);
    setSignedOut(true);
  };

  const tab = (id: Section, label: string) => (
    <button
      type="button"
      onClick={() => { setSection(id); setNotice(""); }}
      className="rounded-full px-4 py-2 text-xs font-bold"
      style={{
        background: section === id ? "var(--color-primary)" : "var(--color-surface-elevated)",
        color: section === id ? "var(--accent-ink)" : "var(--color-text)"
      }}
    >
      {label}
    </button>
  );

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Reading your profile…</p>;
  }

  if (signedOut) {
    return (
      <div
        className="mt-6 rounded-2xl border border-dashed p-8 text-center"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <h2 className="text-lg font-black" style={{ color: "var(--color-text)" }}>Sign in to see your profile</h2>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          Your identity, follows and subscriptions are yours alone.
        </p>
      </div>
    );
  }

  return (
    <section className="max-w-3xl mx-auto" aria-label="You">
      <div>
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>Your account</span>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1" style={{ color: "var(--color-text)" }}>
          {me?.displayName ?? me?.handle ?? "You"}
        </h1>
        {me?.handle && <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>@{me.handle}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tab("profile", "Profile")}
        {tab("following", "Following")}
        {tab("subscriptions", "Subscriptions")}
        {tab("earn", "Earn")}
        {tab("tableBanking", "Table Banking")}
      </div>

      {notice && (
        <p className="text-xs mt-3" style={{ color: "var(--color-text-muted)" }} role="status">{notice}</p>
      )}

      {section === "profile" && (
        <div className="mt-4 space-y-3">
          {/* Standing — derived from real rows */}
          {person?.standing && (
            <div
              className="rounded-2xl p-5 grid grid-cols-4 gap-3"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
            >
              {[
                ["hosted", person.standing.hosted],
                ["bought", person.standing.bought],
                ["arrived", person.standing.arrived],
                ["registered", person.standing.registered]
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-2xl font-black" style={{ color: "var(--color-text)" }}>{v}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{k}</p>
                </div>
              ))}
            </div>
          )}

          {/* Provenance — how you arrived, honest null when none */}
          {provenance && (
            <div className="rounded-2xl p-4" style={{ background: "var(--color-surface-elevated)" }}>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>You came through</p>
              <p className="text-sm mt-1" style={{ color: "var(--color-text)" }}>{provenance}</p>
            </div>
          )}

          <button
            type="button"
            onClick={signOut}
            className="rounded-full px-4 py-2 text-xs font-bold"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-danger)" }}
          >
            Sign out
          </button>
        </div>
      )}

      {section === "following" && (
        <div className="mt-4">
          {follows === null ? (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Reading your follows…</p>
          ) : follows.total === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              You are not following anyone yet. Open an entity and follow it.
            </p>
          ) : (
            <MotionList className="space-y-3" stagger={30}>
              {Object.keys(follows.groups).map((kind) => {
                const rows = follows.groups[kind] ?? [];
                if (rows.length === 0) return null;
                return (
                  <div key={kind}>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                      {KIND_LABELS[kind] ?? kind}
                    </p>
                    {rows.map((row) => (
                      <div
                        key={row.id}
                        className="mt-1.5 rounded-xl px-3 py-2 flex items-center justify-between"
                        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenEntity(row.id)}
                          className="text-left min-w-0 flex-1"
                        >
                          <p className="text-sm font-bold truncate" style={{ color: "var(--color-text)" }}>{row.name}</p>
                          <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                            {row.objectCount} item{row.objectCount === 1 ? "" : "s"}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => unfollow(row.id, row.name)}
                          disabled={busy[`u:${row.id}`]}
                          className="rounded-full px-3 py-1.5 text-xs font-bold shrink-0 ml-2"
                          style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
                        >
                          Unfollow
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </MotionList>
          )}
        </div>
      )}

      {section === "subscriptions" && (
        <div className="mt-4 space-y-6">
          <div>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Plans to join</p>
            {plans === null ? (
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reading plans…</p>
            ) : plans.length === 0 ? (
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>No public plans yet.</p>
            ) : (
              <MotionList className="space-y-2 mt-2" stagger={30}>
                {plans.map((plan) => (
                  <div key={plan.id} className="rounded-xl p-3" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{plan.title}</p>
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          KES {plan.price} / {plan.interval} · {plan.subscriberCount} member{plan.subscriberCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <MotionStatus status={plan.viewerIsSubscriber ? "active" : "pending"} label={plan.viewerIsSubscriber ? "Joined" : "Join"} tier="micro" />
                    </div>
                    {plan.description && <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{plan.description}</p>}
                    {!plan.viewerIsSubscriber && (
                      <button
                        type="button"
                        onClick={() => subscribe(plan)}
                        disabled={busy[`s:${plan.id}`]}
                        className="mt-2 rounded-full px-3 py-1.5 text-xs font-bold"
                        style={{ background: "var(--color-primary)", color: "var(--accent-ink)" }}
                      >
                        {busy[`s:${plan.id}`] ? "Joining…" : "Subscribe"}
                      </button>
                    )}
                  </div>
                ))}
              </MotionList>
            )}
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Your published plans</p>
            {myPlans === null ? (
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reading your plans…</p>
            ) : myPlans.length === 0 ? (
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>You have not published any plans.</p>
            ) : (
              myPlans.map((plan) => (
                <div key={plan.id} className="mt-2 rounded-xl p-3" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
                  <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{plan.title}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    KES {plan.price} / {plan.interval} · {plan.subscriberCount} member{plan.subscriberCount === 1 ? "" : "s"} · {plan.status}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === "earn" && (
        <EarnSurface onRequireAuth={onRequireAuth} />
      )}

      {section === "tableBanking" && (
        <TableBankingSurface onRequireAuth={onRequireAuth} />
      )}
    </section>
  );
}
