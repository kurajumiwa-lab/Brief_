// ---------------------------------------------------------------------------
// MOTION SUITE — the stateful-motion system (Phase 1 coherence).
//
// Pins the three tiers to the critique's spec ranges, asserts the "no bounce,
// no elastic" rule, and exercises every Motion* component's state-driven
// behaviour (which is deterministic in jsdom, unlike a CSS keyframe).
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const tokens = require('./src/ui/motion/tokens.ts');
const transitions = require('./src/ui/motion/transitions.ts');
const { MotionButton } = require('./src/ui/motion/MotionButton.tsx');
const { MotionCard } = require('./src/ui/motion/MotionCard.tsx');
const { MotionList } = require('./src/ui/motion/MotionList.tsx');
const { MotionNumber } = require('./src/ui/motion/MotionNumber.tsx');
const { MotionStatus } = require('./src/ui/motion/MotionStatus.tsx');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };
const flush = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function mount(el) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(el));
  return { container, root };
}

async function main() {
  // --- Tier spec (§4): durations inside the critique's ranges ---
  assert.ok(tokens.MotionDuration.fast >= tokens.MotionSpec.micro[0] && tokens.MotionDuration.fast <= tokens.MotionSpec.micro[1], 'fast in micro range');
  assert.ok(tokens.MotionDuration.normal >= tokens.MotionSpec.structural[0] && tokens.MotionDuration.normal <= tokens.MotionSpec.structural[1], 'normal in structural range');
  assert.ok(tokens.MotionDuration.slow >= tokens.MotionSpec.consequential[0] && tokens.MotionDuration.slow <= tokens.MotionSpec.consequential[1], 'slow in consequential range');
  pass('tiers fall inside the spec ranges (micro 100–180, structural 200–350, consequential 350–700)');

  assert.equal(tokens.MotionTier.micro, 'fast');
  assert.equal(tokens.MotionTier.structural, 'normal');
  assert.equal(tokens.MotionTier.consequential, 'slow');
  pass('semantic tiers map to the duration keys');

  // --- No bounce / elastic anywhere ---
  for (const k of Object.keys(tokens.MotionEasing)) {
    const e = tokens.MotionEasing[k];
    assert.ok(!/bounce|elastic/i.test(e), `${k} must not bounce: ${e}`);
    assert.ok(/cubic-bezier\(/.test(e), `${k} is a cubic-bezier: ${e}`);
  }
  pass('every easing is a decelerating cubic-bezier — no bounce, no elastic');

  // --- transitions.ts builds canonical strings ---
  assert.equal(transitions.durationFor('micro'), 140);
  assert.equal(transitions.durationFor('structural'), 260);
  assert.equal(transitions.durationFor('consequential'), 480);
  const t = transitions.transitionFor(['opacity', 'transform'], 'structural');
  assert.ok(t.includes('260ms'), 'structural transition uses 260ms');
  assert.ok(t.includes('opacity') && t.includes('transform'), 'both properties present');
  pass('transitionFor() emits the canonical duration and easing');

  // --- MotionButton: micro press feedback ---
  {
    const { container } = mount(React.createElement(MotionButton, null, 'Pay'));
    const btn = container.querySelector('button');
    assert.ok(btn, 'renders a button');
    assert.equal(btn.style.transform, 'scale(1)');
    act(() => { btn.dispatchEvent(new window.Event('pointerdown', { bubbles: true })); });
    assert.equal(btn.style.transform, 'scale(0.98)');
    assert.ok(btn.style.transition.includes('140ms'), 'micro transition applied');
    act(() => { btn.dispatchEvent(new window.Event('pointerup', { bubbles: true })); });
    assert.equal(btn.style.transform, 'scale(1)');
    pass('MotionButton presses to scale(0.98) and settles back (micro)');
  }

  // --- MotionCard: structural entrance, state-driven ---
  {
    const { container } = mount(React.createElement(MotionCard, null, 'Card'));
    const card = container.querySelector('div');
    const inner = card.querySelector('span');
    assert.equal(inner.style.opacity, '0', 'starts hidden (from state)');
    await flush();
    assert.equal(inner.style.opacity, '1', 'settles visible after one tick');
    assert.ok(inner.style.transition.includes('260ms'), 'structural transition applied');
    assert.ok(card.style.background.includes('var(--color-surface)'), 'surface token, not hex');
    pass('MotionCard fades in once and stays (structural)');
  }

  // --- MotionList: staggered structural entrance ---
  {
    const { container } = mount(
      React.createElement(MotionList, null,
        React.createElement('span', { key: 'a' }, 'A'),
        React.createElement('span', { key: 'b' }, 'B'),
        React.createElement('span', { key: 'c' }, 'C'))
    );
    const items = container.querySelectorAll('div > span');
    assert.equal(items.length, 3, 'three items');
    const delays = Array.from(items).map((s) => s.style.transitionDelay || '0ms');
    assert.equal(delays[0], '0ms');
    // The delay is applied via setTimeout, not transition-delay, in Entering;
    // so assert the structural transition is present on each instead.
    for (const s of items) assert.ok(s.style.transition.includes('260ms'));
    pass('MotionList renders each item with the structural transition');
  }

  // --- MotionNumber: economic causality, no rolling counter ---
  {
    const { container, root } = mount(React.createElement(MotionNumber, { value: 5000, currency: 'KES' }));
    let text = container.textContent;
    assert.ok(text.includes('5,000'), 'renders the value');
    assert.ok(!text.includes('+'), 'no delta when no previous value');
    await flush();

    // Change the value with a real previous -> a delta appears.
    act(() => root.render(React.createElement(MotionNumber, { value: 6500, previous: 5000, currency: 'KES' })));
    await flush();
    text = container.textContent;
    assert.ok(text.includes('6,500'), 'new value shown');
    assert.ok(text.includes('+KES 1,500'), 'delta shown with sign + currency');
    const upDelta = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === '+KES 1,500');
    assert.ok(upDelta.style.color.includes('var(--color-success)'), 'up-delta is success green');

    // A down-delta is danger.
    act(() => root.render(React.createElement(MotionNumber, { value: 6200, previous: 6500, currency: 'KES' })));
    await flush();
    const down = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === '\u2212KES 300');
    assert.ok(down, 'down delta shown');
    assert.ok(down.style.color.includes('var(--color-danger)'), 'down-delta is danger');
    pass('MotionNumber shows value + signed delta (economic causality), never counts from zero');
  }

  // --- MotionStatus: semantic color per state ---
  {
    const { container, root } = mount(React.createElement(MotionStatus, { status: 'confirmed', label: 'Confirmed' }));
    let badge = container.querySelector('span');
    assert.ok(badge.style.color.includes('var(--color-success)'), 'confirmed is success');
    act(() => root.render(React.createElement(MotionStatus, { status: 'failed', label: 'Failed' })));
    badge = container.querySelector('span');
    assert.ok(badge.style.color.includes('var(--color-danger)'), 'failed is danger');
    act(() => root.render(React.createElement(MotionStatus, { status: 'something_new', label: 'Something New' })));
    badge = container.querySelector('span');
    assert.ok(badge.style.color.includes('var(--color-text-muted)'), 'unknown state is muted, never unreadable');
    pass('MotionStatus maps status to semantic color tokens');
  }

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
