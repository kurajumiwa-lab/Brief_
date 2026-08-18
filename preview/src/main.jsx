import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { PublicCampaignPage, campaignSlugFromPath } from './App.tsx';

// A shared campaign link opens the public page. Brief has no router, so the
// entry point picks the surface once, at boot.
const slug = campaignSlugFromPath(window.location.pathname);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {slug ? <PublicCampaignPage slug={slug} /> : <App />}
  </React.StrictMode>
);
