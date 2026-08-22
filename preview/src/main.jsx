import './index.css';
import './ui/theme.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { PublicCampaignPage, campaignSlugFromPath } from './App.tsx';

// A shared campaign link opens the public page. Everything else goes straight
// into the app — there is no interstitial landing page.
const slug = campaignSlugFromPath(window.location.pathname);

function Root() {
  if (slug) return <PublicCampaignPage slug={slug} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
