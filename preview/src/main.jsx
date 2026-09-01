import './index.css';
import './ui/theme.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { PublicCampaignPage, campaignSlugFromPath } from './App.tsx';
import { flushOfflineQueue } from './api/briefApi.ts';

// A shared campaign link opens the public page. Everything else goes straight
// into the app — there is no interstitial landing page.
const slug = campaignSlugFromPath(window.location.pathname);

// OFFLINE QUEUE RECONNECT TRIGGER.
//
// Writes that fail on a dead signal are parked in localStorage (offlineQueue.ts)
// and replayed oldest-first. This is the listener that actually flushes them:
// the moment the browser regains a connection, parked writes send themselves —
// the server's idempotency keys make a replayed write harmless (never a double
// sale). Without this, the queue fills but nothing drains it.
function installOfflineFlush() {
  let flushing = false;
  const flush = async () => {
    if (flushing) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    flushing = true;
    try {
      await flushOfflineQueue();
    } catch {
      /* a failed flush stays queued; the next online event retries */
    } finally {
      flushing = false;
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('online', flush);
    // Returning to the tab (visibilitychange) is another natural moment to
    // drain anything that queued while the phone was asleep or on a dead link.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void flush();
    });
  }
}
installOfflineFlush();

function Root() {
  if (slug) return <PublicCampaignPage slug={slug} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
