import React, { useEffect, useState } from "react";
import {
  User, ShieldCheck, Heart, Store, Package, Users, Coins, Landmark,
  CreditCard, Archive, BookOpen, Globe, Bell, Lock
} from "lucide-react";
import { MenuTile, SectionHeader } from "../../ui/MenuTile";
import * as api from "../../api/briefApi";
import type { AuthedUser, PersonMe, FollowsGroups, MyCommitments, MyPosition, MyReciprocity, Precedent } from "../../api/briefApi";
import type { Space } from "../../api/types";
import type { Subscription, SubscriptionJoin } from "../../api/types";
import { MotionList } from "../../ui/motion/MotionList";
import { MotionStatus } from "../../ui/motion/MotionStatus";
import { EarnSurface } from "./EarnSurface";
import { TableBankingSurface } from "./TableBankingSurface";
import { HowBriefWorks } from "./HowBriefWorks";
import { hrefForDest } from "../../app/surfaces";
import { GuardianNetwork } from "./GuardianNetwork";
import { Marketplace } from "../../components/Marketplace";
import { PositionHero } from "./PositionHero";
import { Vault } from "../../components/vault/Vault";
import { PositionCard } from "../home/PositionCard";
import { CommitmentsCard } from "../home/CommitmentsCard";
import { ReciprocityCard } from "../home/ReciprocityCard";
import { SessionSignIn } from "../../components/SessionSignIn";
import { NotificationCenter } from "../../components/NotificationCenter";

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

// The same key the belt's area chip writes and PlannedWeather reads. The
// privacy screen names this store because it is the one place-specific thing
// this device is allowed to hold.
const PLACE_KEY = "brief.world.place";

function readPlace(): string {
  try { return localStorage.getItem(PLACE_KEY) ?? ""; } catch { return ""; }
}

const KIND_LABELS: Record<string, string> = {
  venue: "Places",
  business: "Businesses",
  publisher: "Publishers",
  organizer: "Organizers",
  community: "Communities"
};

// The grouping of the You surface, in one list so the order, the labels and the
// membership of each group are stated once. Kept as data (not as markup) so the
// suite can assert that no section was silently dropped in a reorganisation:
// every Section below appears exactly once here.
const YOU_GROUPS: Array<{ id: string; label: string; items: Array<{ id: Section; label: string }> }> = [
  {
    id: "identity",
    label: "Identity",
    items: [
      { id: "profile", label: "Profile" },
      { id: "standing", label: "Standing" },
      { id: "following", label: "Following" }
    ]
  },
  {
    id: "business",
    label: "Business",
    items: [
      { id: "selling", label: "Selling" },
      { id: "orders", label: "Orders" },
      { id: "network", label: "Your network" }
    ]
  },
  {
    id: "money",
    label: "Money",
    items: [
      { id: "earn", label: "Earn" },
      { id: "tableBanking", label: "Table Banking" },
      { id: "subscriptions", label: "Subscriptions" },
      { id: "archive", label: "Archive" }
    ]
  },
  {
    id: "about",
    label: "About",
    items: [{ id: "how", label: "How Trace works" }]
  },
  {
    // The drawer's Settings group lands here: three real, small controls —
    // the ones the app can actually answer. Language is honest about being
    // one language; Privacy names what is stored on this device;
    // Notifications opens the real notification centre.
    id: "settings",
    label: "Settings",
    items: [
      { id: "language", label: "Language" },
      { id: "notifications", label: "Notifications" },
      { id: "privacy", label: "Privacy" }
    ]
  }
];

type Section =
  | "profile" | "standing" | "following" | "subscriptions"
  | "earn" | "orders" | "selling" | "archive" | "tableBanking" | "network" | "how"
  | "language" | "notifications" | "privacy";

// The one tile shape across the You tab: a thin-line icon in a 12px tinted
// square, a bold 15px title, a grey 13px description in the app's own words.
// A pill row had a title and nothing else; a tile says what the section holds
// before you go into it.
const SECTION_ICONS: Record<Section, React.ReactNode> = {
  profile: <User className="w-5 h-5" />,
  standing: <ShieldCheck className="w-5 h-5" />,
  following: <Heart className="w-5 h-5" />,
  selling: <Store className="w-5 h-5" />,
  orders: <Package className="w-5 h-5" />,
  network: <Users className="w-5 h-5" />,
  earn: <Coins className="w-5 h-5" />,
  tableBanking: <Landmark className="w-5 h-5" />,
  subscriptions: <CreditCard className="w-5 h-5" />,
  archive: <Archive className="w-5 h-5" />,
  how: <BookOpen className="w-5 h-5" />,
  language: <Globe className="w-5 h-5" />,
  notifications: <Bell className="w-5 h-5" />,
  privacy: <Lock className="w-5 h-5" />
};

const SECTION_SUBS: Record<Section, string> = {
  profile: "Who you are on this device",
  standing: "What you owe, what is owed you",
  following: "Places and people you follow",
  selling: "Your offers, quotes and shop",
  orders: "What you bought, what you sold",
  network: "Guardians and programs around you",
  earn: "Your money, the real way",
  tableBanking: "Shared pots, kept in the open",
  subscriptions: "Paid plans you have joined",
  archive: "Records you keep for yourself",
  how: "How a row becomes trust",
  language: "One language, said plainly",
  notifications: "The real bell for this device",
  privacy: "What this device keeps, and how to clear it"
};

export function YouSurface({
  onOpenEntity,
  onRequireAuth,
  initialSection
}: {
  onOpenEntity: (entityId: string) => void;
  onRequireAuth: () => void;
  /** Deep link from the ⓘ on Home: the audit screen is a tab, not a footnote. */
  initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection ?? "profile");
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [me, setMe] = useState<AuthedUser | null>(null);
  const [person, setPerson] = useState<PersonMe | null>(null);
  const [provenance, setProvenance] = useState<string | null>(null);
  const [follows, setFollows] = useState<FollowsGroups | null>(null);
  const [plans, setPlans] = useState<Subscription[] | null>(null);
  const [myPlans, setMyPlans] = useState<Subscription[] | null>(null);
  const [notice, setNotice] = useState<string>("");
  // Read once for the privacy screen's "what this device keeps" line.
  const [place, setPlace] = useState<string>(readPlace);
  // The position reads. Fetched here, once, and handed to every surface that
  // renders them so the hero and the detail cards can never disagree.
  const [position, setPosition] = useState<MyPosition | null>(null);
  const [commitments, setCommitments] = useState<MyCommitments | null>(null);
  const [reciprocity, setReciprocity] = useState<MyReciprocity | null>(null);
  const [precedent, setPrecedent] = useState<Precedent | null>(null);
  const [mySpaces, setMySpaces] = useState<Space[]>([]);
  const [positionDenied, setPositionDenied] = useState<boolean>(false);
  const [positionAttempt, setPositionAttempt] = useState(0);
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

  // The dossier read: five derived endpoints, one pass, no refetch storm.
  useEffect(() => {
    let live = true;
    void Promise.all([
      api.getMyPosition(),
      api.getMyCommitments(),
      api.getMyReciprocity(),
      api.getPrecedent(),
      api.listMySpaces()
    ]).then(([pos, cmt, rec, pre, sp]) => {
      if (!live) return;
      setPositionDenied(!pos.ok && pos.status === 401);
      setPosition(pos.ok ? pos.data : null);
      setCommitments(cmt.ok ? cmt.data : null);
      setReciprocity(rec.ok ? rec.data : null);
      setPrecedent(pre.ok ? pre.data : null);
      setMySpaces(sp.ok && sp.data?.spaces ? sp.data.spaces : []);
    });
    return () => { live = false; };
  }, [positionAttempt]);

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


  if (loading) {
    return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Reading your profile…</p>;
  }

  if (signedOut) {
    // A dead end, not a gate. This panel used to say "Sign in to see your
    // profile" with no way to do it — no field, no button, nothing to click —
    // so a signed-out member on #you could only read the sentence and leave.
    // The form is the one the Requests workspace already uses: handle +
    // password, and a real "create account" toggle, because a fresh deployment
    // has no account to sign in to yet.
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Your identity, follows and subscriptions are yours alone — they are on
          this device only once you are signed in.
        </p>
        <SessionSignIn onSignedIn={load} title="Sign in to see your profile" />
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

      {/* Four labelled groups, the same tile in every one of them.
          Nothing was deleted on the way and nothing was renamed — Subscriptions
          stays because those rows are real paid plans, and "Archive" stays
          because a member must be able to find what they closed. The pills
          became tiles: a title plus the one grey line that says what the
          section holds, under a small grey uppercase mono header. */}
      <div className="mt-4 space-y-3">
        {YOU_GROUPS.map((group) => (
          <div key={group.id}>
            <SectionHeader>{group.label}</SectionHeader>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {group.items.map((item) => (
                <MenuTile
                  key={item.id}
                  icon={SECTION_ICONS[item.id]}
                  title={item.label}
                  description={SECTION_SUBS[item.id]}
                  active={section === item.id}
                  testId={item.id}
                  onClick={() => { setSection(item.id); setNotice(""); }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {notice && (
        <p className="text-xs mt-3" style={{ color: "var(--color-text-muted)" }} role="status">{notice}</p>
      )}

      {section === "profile" && (
        <div className="mt-4 space-y-3">
          {/* POSITION FIRST — the shape of a rating hero, with the rating
              removed: what is expiring, what is owed, how your spaces read,
              what you defended. Numbers and rows, never a score. */}
          <PositionHero
            position={position}
            commitments={commitments}
            reciprocity={reciprocity}
            spaces={mySpaces}
            precedent={precedent}
            denied={positionDenied}
            onRetry={() => setPositionAttempt((a) => a + 1)}
          />

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
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{k}</p>
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
                          <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
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

      {/* ── STANDING — where a member defends their position. Every figure is
             derived from their own rows at read time; there is no rank, no
             tier, no score and nothing stored, so there is nothing to decay
             into a lie. ── */}
      {/* ARCHIVE — the filing cabinet at home. Records and receipts you keep
          for yourself, which is why it sits in You and not in a public gallery
          or a business workspace. */}
      {section === "archive" && (
        <div className="mt-4 space-y-3">
          <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            Restricted records and drops you hold or have been granted. An archive is read slowly and kept — it is
            not something to browse between posters.
          </p>
          <Vault />
        </div>
      )}

      {section === "standing" && (
        <div className="mt-4 space-y-3">
          <PositionCard position={position} />
          <CommitmentsCard commitments={commitments} />
          <ReciprocityCard reciprocity={reciprocity} />
          <p className="text-[12px] leading-snug" style={{ color: "var(--color-text-muted)" }}>
            Nothing here is a score. Each line is a count over rows you could read yourself — a quote you
            sent, an order you owe, a favour that went unreturned — and a line is shown only while its row
            still exists.
          </p>
        </div>
      )}

      {/* ── ORDERS / SELLING — the personal halves of commerce, moved off the
             browse screen. Same Marketplace rails, same server-authoritative
             money; only the address changed. ── */}
      {section === "orders" && (
        <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <Marketplace initialSection="orders" />
        </div>
      )}

      {section === "selling" && (
        <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <Marketplace initialSection="selling" />
        </div>
      )}

      {section === "earn" && (
        <EarnSurface onRequireAuth={onRequireAuth} />
      )}

      {section === "network" && <GuardianNetwork />}
      {section === "how" && <HowBriefWorks />}

      {section === "tableBanking" && (
        <TableBankingSurface onRequireAuth={onRequireAuth} />
      )}

      {/* ── SETTINGS — the three controls the drawer's Settings group names.
          Each one answers what it claims; none of them switches nothing. ── */}
      {section === "language" && (
        <div className="mt-4 space-y-3">
          <div className="p-4 rounded-2xl" style={{ background: "var(--color-surface)", boxShadow: "inset 0 0 0 1px var(--brief-line)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>English</p>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              The app speaks one language. A selector that switched nothing would be a control advertising a
              choice the product does not make, so there is no selector — there is this line instead. A second
              language lands here when the translations are maintained, not before.
            </p>
          </div>
        </div>
      )}

      {section === "notifications" && (
        <div className="mt-4 space-y-3">
          <NotificationCenter
            authed={!signedOut}
            onClose={() => setSection("profile")}
            /* A tap goes where the notification says. Dests this shell has no
               surface for open nothing, rather than landing on a screen that
               looks like the one that was promised. */
            onOpen={(n: any) => {
              const href = hrefForDest(n?.dest);
              if (href && typeof window !== "undefined") window.location.hash = href;
            }}
          />
        </div>
      )}

      {section === "privacy" && (
        <div className="mt-4 space-y-3">
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            What this device keeps, and how to take it back. Nothing here is a
            toggle that pretends: each row is a real store on this browser, and
            each control acts on it.
          </p>
          <div className="p-4 rounded-2xl space-y-2" style={{ background: "var(--color-surface)", boxShadow: "inset 0 0 0 1px var(--brief-line)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Your area</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Stored only to read the forecast. {place ? `Set to “${place}”.` : "Not set."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  try { localStorage.removeItem(PLACE_KEY); } catch { /* a locked-down browser keeps its secret */ }
                  setPlace("");
                  setNotice("The area is cleared from this device.");
                }}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="p-4 rounded-2xl space-y-2" style={{ background: "var(--color-surface)", boxShadow: "inset 0 0 0 1px var(--brief-line)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Offline queue</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {api.offlineQueueDepth() === 0
                    ? "Nothing is parked — every write reached the server."
                    : `${api.offlineQueueDepth()} write${api.offlineQueueDepth() === 1 ? "" : "s"} waiting for signal; they send themselves when it returns.`}
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl space-y-2" style={{ background: "var(--color-surface)", boxShadow: "inset 0 0 0 1px var(--brief-line)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Sign out</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Ends the session on this device. Rows you wrote stay on the server, where they belong.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { void signOut(); }}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                style={{ background: "var(--color-danger, #B3261E)", color: "#fff" }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
