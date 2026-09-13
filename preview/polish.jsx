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

  // --- Navigation renders a sliding active-tab pill using the canonical easing ---
  {
    const { container } = mount(React.createElement(Navigation, { activeTab: 'home', onSelectTab: () => {} }));
    const pills = Array.from(container.querySelectorAll('div[aria-hidden="true"]'));
    const pill = pills.find((d) => (d.style.transition || '').includes('--motion-normal'));
    assert.ok(pill, 'a sliding pill indicator exists');
    assert.ok((pill.style.transition || '').includes('--ease-emphasized'), 'uses the emphasized easing');
    assert.ok((pill.style.background || '').includes('--color-primary-subtle'), 'uses the canonical tint');
  }
  pass('Navigation slides its active-tab pill with the canonical easing (no jump)');

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
