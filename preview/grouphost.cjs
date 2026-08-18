// ---------------------------------------------------------------------------
// CONNECTED-GROUPS HOST
//
// Mounts the extracted <ConnectedGroups> component with test-owned fixtures,
// following the same pattern as the Quests suite.
//
// Why a host rather than the full app: ALL_GROUPS and GROUP_MESSAGES are now
// empty in the product (groups are derived from real server sources), so
// mounting <App/> gives an empty surface with nothing to assert on. The access
// rules themselves -- who may see a group, whose content stays sealed, what
// revocation destroys -- are real logic worth testing, so the fixtures live
// here and the REAL helpers from App.tsx do the work:
//
//     canUserAccessGroup, buildGroupIndex, getUnansweredQuestions,
//     runGroupCommand, formatSourceDate
//
// This host only reproduces the container wiring (state + handlers) that
// App.tsx performs around the component.
// ---------------------------------------------------------------------------

async function bootGroups(opts = {}) {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    { url: 'https://brief.test/', pretendToBeVisual: true });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Node = dom.window.Node;
  global.MouseEvent = dom.window.MouseEvent;
  global.getComputedStyle = dom.window.getComputedStyle;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.open = () => null;

  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react-dom/test-utils');
  const App = require('./src/App.tsx');
  const { ConnectedGroups } = require('./src/components/ConnectedGroups.tsx');

  const { FIXTURE_GROUPS, FIXTURE_GROUP_MESSAGES } = require('./fixtures.cjs');
  const groupsSeed = opts.groups ?? FIXTURE_GROUPS;
  const messages = opts.messages ?? FIXTURE_GROUP_MESSAGES;
  const objects = opts.objects ?? [];

  let toast = null;
  const showToast = (m) => { toast = m; };

  function Host() {
    const [groups, setGroups] = React.useState(groupsSeed);
    const [openGroupId, setOpenGroupId] = React.useState(null);
    const [commandResult, setCommandResult] = React.useState(null);
    const [commandText, setCommandText] = React.useState('');
    const [savedIds, setSavedIds] = React.useState([]);

    // Exactly the derivation App.tsx performs: access is enforced when the
    // index is BUILT, so an unreachable group yields nothing by construction.
    const visibleGroups = groups.filter(App.canUserAccessGroup);
    const groupIndexes = {};
    for (const g of visibleGroups) groupIndexes[g.id] = App.buildGroupIndex(messages, g);
    const openGroup = visibleGroups.find((g) => g.id === openGroupId) ?? null;
    const groupIndex = openGroup ? groupIndexes[openGroup.id] ?? [] : [];
    const unansweredQuestions = App.getUnansweredQuestions(groupIndex);

    const handleRevokeGroup = (id) => {
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, access: 'revoked' } : g)));
      if (openGroupId === id) setOpenGroupId(null);
      showToast("Access revoked. Brief will stop reading this group.");
    };

    const handleSaveGroupEntry = (entry) => {
      const group = visibleGroups.find((g) => g.id === entry.groupId);
      if (!group || !group.permissions?.canRetain) {
        showToast('This group does not allow saving.');
        return;
      }
      setSavedIds((prev) => (prev.includes(entry.id) ? prev : [...prev, entry.id]));
      showToast('Saved to My Layer with its source.');
    };

    const handleViewSource = (entry) => {
      const group = visibleGroups.find((g) => g.id === entry.groupId);
      showToast(`${entry.source.sourceType} in ${group ? group.name : 'this group'} - ` +
        `${App.formatSourceDate(entry.source.timestamp)}`);
    };

    const handleRunCommand = (override) => {
      const raw = (override ?? commandText).trim();
      if (raw === '' || !openGroup) return;
      const normalised = raw.startsWith('/') ? raw : `/ask ${raw}`;
      const result = App.runGroupCommand(normalised, {
        entries: groupIndex, objects, savedObjects: [],
        now: new Date('2026-08-15T00:00:00Z')
      });
      if (!result) { showToast('Unknown command'); setCommandResult(null); return; }
      setCommandResult(result);
    };

    return React.createElement('div', null,
      React.createElement(ConnectedGroups, {
        visibleGroups, groupIndexes, openGroup, setOpenGroupId, groupIndex,
        unansweredQuestions, handleRevokeGroup, handleSaveGroupEntry,
        handleViewSource, commandResult, setCommandResult, commandText,
        setCommandText, getUnansweredQuestions: App.getUnansweredQuestions,
        groupMessages: messages, formatSourceDate: App.formatSourceDate,
        handleRunCommand, setSelectedObjectForDetail: () => {}
      }),
      // Toasts live in App's chrome, not in the component. Mirrored here so
      // assertions about confirmation messages still have something to read.
      toast ? React.createElement('div', { id: 'toast' }, toast) : null
    );
  }

  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(Host)); });

  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body) + ' ' + (toast ?? '');
  const rerender = async () => { await act(async () => { root.render(React.createElement(Host)); }); };
  const click = async (el) => {
    if (!el) throw new Error('click() called with no element -- target not found');
    await act(async () => {
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    // Toast text is held outside React state, so re-render to surface it.
    await rerender();
  };
  const buttons = () => Array.from(document.querySelectorAll('button'));
  const btn = (t) => buttons().find((b) => text(b) === t || text(b).startsWith(t));
  const setVal = async (el, v) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };
  const submit = async (el) => {
    await act(async () => {
      el.closest('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    await rerender();
  };
  const askInput = () => document.querySelector('input[placeholder="Ask something about this group..."]');

  return { dom, act, text, body, click, btn, buttons, setVal, submit, askInput,
           getToast: () => toast };
}

module.exports = { bootGroups };
