// ---------------------------------------------------------------------------
// MOTION POLISH — the skeleton primitive and the sliding nav indicator. These
// are the two genuinely-missing layers the motion critique asked for (the rest
// of the motion system — tokens, tiers, easings, MotionButton/List/Number —
// already exists and is covered by motion.jsx).
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
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { Skeleton, CardSkeleton } = require('./src/components/ui/Skeleton.tsx');
const { EmptyState } = require('./src/components/ui/EmptyState.tsx');
const { Presence } = require('./src/ui/motion/Presence.tsx');
const { Navigation } = require('./src/app/Navigation.tsx');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}

async function main() {
  // --- Skeleton renders the canonical pulse class over the elevated surface ---
  {
    const { container } = mount(React.createElement(Skeleton, { className: 'h-4 w-3/4' }));
    const el = container.querySelector('.brief-skeleton');
    assert.ok(el, 'renders the .brief-skeleton class');
    assert.ok(el.getAttribute('aria-hidden') === 'true', 'decorative (aria-hidden)');
  }
  pass('Skeleton renders the canonical pulse placeholder, decorative to screen readers');

  // --- CardSkeleton gives the shape of the content about to arrive ---
  {
    const { container } = mount(React.createElement(CardSkeleton, null));
    assert.equal(container.querySelectorAll('.brief-skeleton').length, 3, 'three placeholder lines');
    assert.ok(container.querySelector('.border'), 'card frame');
  }
  pass('CardSkeleton shows the shape of content (title/sub/body), not a void');

  // --- The bar is a floor, not a pill: anchored to the bottom edge, solid,
  //     with a state marker that never relies on colour alone. The old sliding
  //     pill dock is gone; the reorg's bar is the surface itself. ---
  {
    const { container } = mount(React.createElement(Navigation, { activeTab: 'home', onSelectTab: () => {} }));
    const bar = container.querySelector('nav[aria-label="Primary"]');
    assert.ok(bar, 'the mobile bar exists');
    // jsdom has no layout engine, so the geometry is asserted on the classes
    // that produce it: fixed + bottom-0 + an explicit 56px inline height.
    assert.ok(bar.className.includes('fixed'), 'the bar is fixed, not floating');
    assert.ok(bar.className.includes('bottom-0'), 'the bar is anchored to the bottom edge');
    assert.equal(bar.style.height, '56px', 'the bar is a 56px floor');
    // The active door is marked by a bar under the label — a shape, so it
    // survives a colour-blind reader — not by a sliding pill.
    const marker = Array.from(bar.querySelectorAll('span[aria-hidden="true"]'))
      .find((s) => (s.style.background || '').includes('--color-primary'));
    assert.ok(marker, 'the active door carries a shape marker');
    // And there is no floating pill anywhere in the bar's subtree.
    const floating = Array.from(container.querySelectorAll('div[aria-hidden="true"]'))
      .find((d) => (d.style.transition || '').includes('--motion-normal'));
    assert.equal(floating, undefined, 'no sliding pill indicator remains');
  }
  pass('The bar is an anchored 56px floor with a shape marker, no floating pill');

  // --- EmptyState renders a headline, an honest description and an action ---
  {
    const { container } = mount(React.createElement(EmptyState, {
      title: 'Sign in to see your Circles',
      description: 'Create an account to see your groups.',
      action: React.createElement('button', null, 'Sign in')
    }));
    const t = (container.textContent || '').replace(/\s+/g, ' ').trim();
    assert.ok(t.includes('Sign in to see your Circles'), 'headline');
    assert.ok(t.includes('Create an account'), 'description');
    assert.ok(t.includes('Sign in'), 'action');
  }
  pass('EmptyState renders a headline, description and action (no raw error string)');

  // --- Presence keeps its child mounted through an exit, then unmounts ---
  {
    const { container, root } = mount(React.createElement(Presence, { open: true }, React.createElement('div', { id: 'inner' }, 'content')));
    assert.ok(container.querySelector('#inner'), 'renders when open');
    // Close: the child should STILL be mounted (exiting), then unmount after the beat.
    act(() => root.render(React.createElement(Presence, { open: false }, React.createElement('div', { id: 'inner' }, 'content'))));
    assert.ok(container.querySelector('#inner'), 'deferred unmount — the child lingers for the exit');
  }
  pass('Presence defers unmount so a section exits instead of teleporting away');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
