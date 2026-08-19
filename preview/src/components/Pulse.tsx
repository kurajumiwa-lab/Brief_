import React from 'react';
import { TrendingUp, Users } from 'lucide-react';
import { Sparkline } from './SignalBanner';
import {
  isDestinationObject,
  getDestinationState,
  getDestinationVendors
} from '../App';
import type {
  BriefObject,
  PulseSection,
  TownHealth,
  BriefPost,
  Destination,
  MyLayerSection
} from '../App';

/**
 * PULSE -- the information layer.
 *
 * Extracted from App.tsx unchanged in behaviour and styling. Pulse answers
 * "what is worth knowing?" and every item traces back to a real source.
 *
 * The one thing worth knowing about this surface: the civic metrics it renders
 * are derived (see deriveTownHealth in App.tsx). Where a metric cannot be
 * derived from records Brief holds, it reports "Not measured" and says why.
 * There is no numeric default and no seeded activity -- if there is nothing
 * there, Pulse shows nothing.
 */

export interface PulseGroupSignal {
  id: string;
  groupName: string;
  text: string;
  at: string;
}

export interface PulseProps {
  pulseSection: PulseSection;
  townHealth: TownHealth;
  pulseNow: BriefPost[];
  pulseNotices: BriefPost[];
  pulseRecentlyVerified: BriefObject[];
  pulseGroupSignals: PulseGroupSignal[];
  objects: BriefObject[];
  setActiveTab: (d: Destination) => void;
  setMyLayerSection: (s: MyLayerSection) => void;
  setSelectedObjectForDetail: (o: BriefObject | null) => void;
  formatSourceDate: (iso: string) => string;
  selectedLocation: string;
}

export function Pulse({
  pulseSection,
  townHealth,
  pulseNow,
  pulseNotices,
  pulseRecentlyVerified,
  pulseGroupSignals,
  objects,
  setActiveTab,
  setMyLayerSection,
  setSelectedObjectForDetail,
  formatSourceDate,
  selectedLocation
}: PulseProps) {
  return (
    <section className="space-y-5">
      {/* PULSE. The information layer: what is fresh, what is local,
          what the user's own groups are surfacing, and what the numbers
          say. Deliberately not framed as an assistant -- no chat, no
          model branding, no "AI" language. It answers "what is worth
          knowing?", and every item traces back to a real source. */}
      <div className="bg-[#10141C] border border-[#232A38] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-[#43D17A]" />
          <span className="text-[10px] text-[#43D17A]">
            Pulse
          </span>
        </div>

        <h2 className="text-xl font-extrabold">
          What's changing around you.
        </h2>

        <p className="text-xs text-[#43D17A] mt-1">
          {pulseSection === 'now'
            ? 'The most recent things people have reported.'
            : pulseSection === 'local'
            ? 'Notices and updates about this area.'
            : pulseSection === 'groups'
            ? 'What the groups you are in are surfacing.'
            : 'How complete and current the local information layer is.'}
        </p>
      </div>

      {/* NOW. Freshest first. */}
      {pulseSection === 'now' && (
        <div className="space-y-2">
          {/* Network activity — a live readout (§7.5): the moving line is the
              one ambient element Pulse is allowed beyond a pulse dot. */}
          <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-3">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#4B5162]">
                Network activity
              </p>
              <span className="font-mono-live text-[11px] text-[#4FB0C6]">
                {objects.length} tracked
              </span>
            </div>
            <Sparkline
              points="0,30 10,26 20,28 30,18 40,22 50,12 60,16 70,8 80,12 90,5 100,9"
              accent="var(--today)"
            />
          </div>
          {pulseNow.length === 0 && (
            <p className="text-xs text-[#8A93A6]">
              Nothing new has been reported yet today.
            </p>
          )}
          {pulseNow.map((post) => {
            const related = post.relatedObjectId
              ? objects.find((obj) => obj.id === post.relatedObjectId)
              : undefined;
            return (
              <div
                key={post.id}
                className="bg-[#10141C] border border-[#232A38] rounded-2xl p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-extrabold text-[#43D17A]">
                    {post.kind}
                  </span>
                  <span className="text-[9px] text-[#4B5162]">
                    {formatSourceDate(post.publishedAt)}
                  </span>
                  {post.isPromoted && (
                    <span className="text-[9px] font-extrabold text-[#E8A33D]">
                      Promoted{post.promotedBy ? ` - ${post.promotedBy}` : ''}
                    </span>
                  )}
                </div>

                <p className="text-sm font-extrabold text-[#F3F1E7] mt-1">
                  {post.title}
                </p>

                <p className="text-[11px] text-[#8A93A6] mt-1 leading-snug">
                  {post.body}
                </p>

                <p className="text-[9px] text-[#4B5162] mt-2">
                  Reported by {post.authorName}
                  {post.authorIsVerified ? ' (verified)' : ''}
                </p>

                {/* Exploration happens through relationships, not new
                    categories: Pulse hands you back to the object. */}
                {related && (
                  <button
                    onClick={() => setSelectedObjectForDetail(related)}
                    className="text-[10px] font-extrabold text-[#43D17A] mt-2 cursor-pointer"
                  >
                    Open {related.title}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LOCAL. Notices and news tied to this place, plus destinations
          that are genuinely on today -- Pulse answers "what is worth
          knowing", and something happening a kilometre away qualifies. */}
      {pulseSection === 'local' && (
        <div className="space-y-2">
          <p className="text-[10px] text-[#4B5162]">
            {selectedLocation}
          </p>

          {(() => {
            const live = objects.filter((obj) => {
              if (!isDestinationObject(obj)) return false;
              const state = getDestinationState(obj);
              return state === 'live' || state === 'today';
            });
            if (live.length === 0) return null;
            return (
              <div className="bg-[#10141C] border border-[#232A38] rounded-2xl p-4">
                <p className="text-[9px] font-extrabold text-[#43D17A]">
                  On today
                </p>
                <div className="mt-2 space-y-1.5">
                  {live.map((obj) => {
                    const vendors = getDestinationVendors(obj, objects);
                    return (
                      <button
                        key={obj.id}
                        onClick={() => setSelectedObjectForDetail(obj)}
                        className="w-full text-left cursor-pointer"
                      >
                        <span className="block text-xs text-[#F3F1E7]">
                          {obj.title}
                        </span>
                        <span className="block text-[9px] text-[#4B5162]">
                          {obj.locationName}
                          {vendors.length > 0
                            ? ` - ${vendors.length} vendor${
                                vendors.length === 1 ? '' : 's'
                              }`
                            : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {pulseNotices.length === 0 && (
            <p className="text-xs text-[#8A93A6]">
              No notices for this area right now.
            </p>
          )}
          {pulseNotices.map((post) => (
            <div
              key={post.id}
              className="bg-[#10141C] border border-[#232A38] rounded-2xl p-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-extrabold text-[#43D17A]">
                  {post.kind}
                </span>
                <span className="text-[9px] text-[#4B5162]">
                  {formatSourceDate(post.publishedAt)}
                </span>
              </div>
              <p className="text-sm font-extrabold text-[#F3F1E7] mt-1">
                {post.title}
              </p>
              <p className="text-[11px] text-[#8A93A6] mt-1 leading-snug">
                {post.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* GROUPS. Only groups the user already belongs to. Brief has not
          joined, posted to, or claimed ownership of any of them. */}
      {pulseSection === 'groups' && (
        <div className="space-y-2">
          {pulseGroupSignals.length === 0 && (
            <p className="text-xs text-[#8A93A6]">
              Nothing recent from your groups. Brief only reads groups you
              have connected yourself.
            </p>
          )}
          {pulseGroupSignals.map((sig) => (
            <div
              key={sig.id}
              className="bg-[#10141C] border border-[#232A38] rounded-2xl p-4"
            >
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-[#43D17A] shrink-0" />
                <p className="text-xs font-extrabold text-[#F3F1E7]">
                  {sig.groupName}
                </p>
              </div>
              <p className="text-[11px] text-[#8A93A6] mt-1 leading-snug">
                {sig.text}
              </p>
              <p className="text-[9px] text-[#4B5162] mt-1">
                Shared in this group on {formatSourceDate(sig.at)}. Brief has
                not posted anything.
              </p>
            </div>
          ))}
          {pulseGroupSignals.length > 0 && (
            <button
              onClick={() => {
                setActiveTab('mylayer');
                setMyLayerSection('groups');
              }}
              className="text-[10px] font-extrabold text-[#43D17A] cursor-pointer"
            >
              Manage your groups
            </button>
          )}
        </div>
      )}

      {/* SIGNALS. The measured state of the information layer. */}
      {pulseSection === 'signals' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {townHealth.metrics.map((metric) => (
              <div
                key={metric.label}
                className="bg-[#10141C] border border-[#232A38] rounded-2xl p-4"
              >
                <p className="text-[10px] text-[#8A93A6]">
                  {metric.label}
                </p>

                {metric.available ? (
                  <>
                    <p className="text-2xl font-extrabold text-[#43D17A] mt-1">
                      {metric.value}{metric.unit ?? ''}
                    </p>
                    <p className="text-[10px] text-[#43D17A] mt-1">
                      {metric.caption}
                    </p>
                  </>
                ) : (
                  <>
                    {/* No records -> no number. Brief says so plainly
                        instead of printing a confident-looking zero. */}
                    <p className="text-sm font-extrabold text-[#4B5162] mt-1">
                      Not measured
                    </p>
                    <p className="text-[10px] text-[#8A93A6] mt-1">
                      {metric.reason}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="bg-[#10141C] border border-[#232A38] rounded-2xl p-5">
            {townHealth.infoFreshnessPct !== null ? (
              <p className="text-sm font-bold">
                {townHealth.infoFreshnessPct}% of the local information layer
                is currently marked fresh.
              </p>
            ) : (
              <p className="text-sm font-bold text-[#43D17A]">
                Freshness cannot be measured yet.
              </p>
            )}
            <p className="text-xs text-[#8A93A6] mt-1">
              Freshness falls as things go unchecked. It rises when someone
              verifies a place, closes a question or corrects a listing.
            </p>
          </div>

          {pulseRecentlyVerified.length > 0 && (
            <div>
              <h3 className="text-[11px] font-extrabold text-[#4B5162] mb-2">
                Recently verified
              </h3>
              <div className="space-y-2">
                {pulseRecentlyVerified.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedObjectForDetail(obj)}
                    className="w-full text-left bg-[#10141C] border border-[#232A38] rounded-2xl p-3 cursor-pointer"
                  >
                    <p className="text-xs text-[#F3F1E7]">{obj.title}</p>
                    <p className="text-[9px] text-[#4B5162] mt-0.5">
                      {obj.category} - verified{' '}
                      {obj.lastVerifiedAt
                        ? formatSourceDate(obj.lastVerifiedAt)
                        : 'recently'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
