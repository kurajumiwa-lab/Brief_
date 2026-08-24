import React from 'react';
import { Zap, Play, Plus } from 'lucide-react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// CREATOR COCKPIT — the working area for creating & analysing streams.
//
// This is the "magic of the whole system": the automation engine surfaced as a
// real tool, not a buried setting. A creator sees their workflows (trigger →
// condition → action over the signal log), what has fired, and builds new ones.
//
// Honesty: the trigger list is the REAL signal types the server emits; a blast
// action reports its honest result (no provider = failed, not "sent").
// ---------------------------------------------------------------------------

const TRIGGERS = [
  '*', 'member_joined', 'object_saved', 'object_viewed', 'object_confirmed',
  'campaign_published', 'campaign_shared', 'campaign_registered', 'campaign_checkin',
  'order_placed', 'order_paid', 'order_settled', 'order_fulfilled',
  'arena_challenge_accepted', 'arena_result_confirmed', 'vendor_created',
  'listing_published', 'auction_closed', 'circle_created',
  'advertiser_campaign_submitted', 'advertiser_campaign_funded',
  'creator_match_proposed', 'creator_match_accepted', 'campaign_fulfilment_verified',
  'tracked_asset_clicked', 'waitlist_offered', 'advertiser_campaign_expired'
];

const ACTION_TYPES = ['notify', 'tag', 'blast'];
const CONDITION_OPS = ['eq', 'ne', 'contains', 'exists'];
const CONDITION_FIELDS = ['actorId', 'type', 'objectId', 'circleId'];

interface Workflow {
  id: string;
  name: string;
  trigger: string;
  conditions: { field: string; op: string; value: string | null }[];
  actions: { type: string; [k: string]: any }[];
  enabled: boolean;
}

export function CreatorCockpit() {
  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [runs, setRuns] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<{ totalRuns: number } | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready'>('loading');

  // builder form
  const [name, setName] = React.useState('');
  const [trigger, setTrigger] = React.useState('member_joined');
  const [actionType, setActionType] = React.useState('notify');
  const [actionTitle, setActionTitle] = React.useState('');
  const [actionBody, setActionBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await briefApi.getWorkflows();
    if (res.ok) {
      setWorkflows(res.data.workflows as Workflow[]);
      setRuns(res.data.runs as any[]);
      setStats(res.data.stats);
    }
    setState('ready');
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const buildAction = () => {
    if (actionType === 'notify') return { type: 'notify', title: actionTitle || name || 'Update', body: actionBody || null };
    if (actionType === 'tag') return { type: 'tag', tag: actionTitle || 'Interested' };
    if (actionType === 'blast') return { type: 'blast', channel: 'whatsapp', to: '', text: actionBody || actionTitle };
    return { type: 'notify', title: name };
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await briefApi.createWorkflow({ name, trigger, actions: [buildAction()] });
    setBusy(false);
    setName(''); setActionTitle(''); setActionBody('');
    await load();
  };

  const toggle = async (w: Workflow) => {
    await briefApi.updateWorkflow(w.id, { enabled: !w.enabled });
    await load();
  };

  const sweep = async () => {
    await briefApi.runWorkflowSweep();
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-[#F3F1E7]">Creator Cockpit</h2>
          <p className="text-[10px] text-[#8A93A6]">
            Automate your streams: when something happens, do something. {stats ? `${stats.totalRuns} run${stats.totalRuns === 1 ? '' : 's'} so far.` : ''}
          </p>
        </div>
        <button onClick={() => void sweep()} className="flex items-center gap-1 rounded-full border border-[#232A38] px-3 py-1.5 text-[11px] font-bold text-[#43D17A] cursor-pointer">
          <Play className="h-3 w-3" /> Run now
        </button>
      </div>

      {/* Builder */}
      <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-4 space-y-3">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#43D17A]">
          <Zap className="h-3.5 w-3.5" /> New automation
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Welcome new members)"
          className="w-full rounded-lg border border-[#232A38] bg-[#090B10] px-3 py-2 text-[13px] text-[#F3F1E7] outline-none focus:border-[#43D17A]"
        />
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[#8A93A6]">When</span>
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="rounded-lg border border-[#232A38] bg-[#090B10] px-2 py-1.5 text-[#F3F1E7]">
              {TRIGGERS.map((t) => <option key={t} value={t}>{t === '*' ? 'Anything happens' : t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#8A93A6]">do</span>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="rounded-lg border border-[#232A38] bg-[#090B10] px-2 py-1.5 text-[#F3F1E7]">
              {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {actionType === 'tag' ? (
          <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="Tag (e.g. Outdoor enthusiast)" className="w-full rounded-lg border border-[#232A38] bg-[#090B10] px-3 py-2 text-[12px] text-[#F3F1E7] outline-none focus:border-[#43D17A]" />
        ) : actionType === 'blast' ? (
          <input value={actionBody} onChange={(e) => setActionBody(e.target.value)} placeholder="Message text" className="w-full rounded-lg border border-[#232A38] bg-[#090B10] px-3 py-2 text-[12px] text-[#F3F1E7] outline-none focus:border-[#43D17A]" />
        ) : (
          <>
            <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="Notification title" className="w-full rounded-lg border border-[#232A38] bg-[#090B10] px-3 py-2 text-[12px] text-[#F3F1E7] outline-none focus:border-[#43D17A]" />
            <input value={actionBody} onChange={(e) => setActionBody(e.target.value)} placeholder="Notification body (optional)" className="w-full rounded-lg border border-[#232A38] bg-[#090B10] px-3 py-2 text-[12px] text-[#F3F1E7] outline-none focus:border-[#43D17A]" />
          </>
        )}
        <button onClick={() => void create()} disabled={busy || !name.trim()} className="flex items-center gap-1.5 rounded-full bg-[#43D17A] px-4 py-2 text-[12px] font-bold text-[#090B10] disabled:opacity-40 cursor-pointer">
          <Plus className="h-3.5 w-3.5" /> Create automation
        </button>
      </div>

      {/* Workflow list */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#43D17A]">Your automations ({workflows.length})</p>
        {state === 'loading' && <p className="text-xs text-[#8A93A6]">Loading…</p>}
        {state === 'ready' && workflows.length === 0 && (
          <p className="text-xs text-[#8A93A6]">No automations yet. Create one above.</p>
        )}
        {workflows.map((w) => (
          <div key={w.id} className="flex items-center gap-3 rounded-xl border border-[#232A38] bg-[#10141C] p-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#F3F1E7] truncate">{w.name}</p>
              <p className="text-[10px] text-[#8A93A6]">
                when <span className="text-[#43D17A]">{w.trigger === '*' ? 'anything' : w.trigger}</span> → {w.actions.map((a) => a.type).join(', ')}
              </p>
            </div>
            <button
              onClick={() => void toggle(w)}
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold cursor-pointer ${w.enabled ? 'bg-[#43D17A] text-[#090B10]' : 'bg-[#10141C] text-[#8A93A6] border border-[#232A38]'}`}
            >
              {w.enabled ? 'On' : 'Off'}
            </button>
          </div>
        ))}
      </div>

      {/* Recent runs */}
      {runs.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4B5162]">Recent activity</p>
          {runs.slice(0, 8).map((r) => (
            <div key={r.id} className="rounded-lg border border-[#232A38] bg-[#10141C] px-3 py-2 text-[10px] text-[#8A93A6]">
              <span className="text-[#43D17A]">{r.signalType}</span>
              {' → '}{r.results.map((x: any) => `${x.action}${x.ok ? ' ✓' : ' ✗'}`).join(', ')}
              <span className="float-right text-[#4B5162]">{new Date(r.at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CreatorCockpit;
