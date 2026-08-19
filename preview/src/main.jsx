import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { PublicCampaignPage, campaignSlugFromPath } from './App.tsx';
import { LandingPage } from './components/LandingPage';

// A shared campaign link opens the public page. A first-time visitor to the
// root sees the landing page; tapping "Enter Brief" reveals the app and is
// remembered, so returning visitors go straight in.
const slug = campaignSlugFromPath(window.location.pathname);

function Root() {
  const [entered, setEntered] = React.useState<boolean>(() => {
    try { return window.localStorage.getItem('brief_entered') === '1'; } catch { return false; }
  });

  if (slug) return <PublicCampaignPage slug={slug} />;
  if (!entered) {
    return (
      <LandingPage
        onEnter={() => {
          try { window.localStorage.setItem('brief_entered', '1'); } catch { /* private mode */ }
          setEntered(true);
        }}
      />
    );
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
