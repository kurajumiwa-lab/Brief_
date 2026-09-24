import '../ui/storefront.css';
import React, { useEffect, useState } from 'react';
import * as api from '../api/briefApi';
import { GroupDirectory } from './GroupDirectory';

// A genuine anonymous entry point. No membership, invitation, eligibility or
// ledger API is called here. Authentication happens only after leaving discovery.
export function PublicGroupsPage() {
  const [data, setData] = useState<api.GroupDirectory | null>(null);
  const [error, setError] = useState(false);
  const load = async () => { setError(false); const r = await api.getGroupDirectory(); if (r.ok) setData(r.data); else setError(true); };
  useEffect(() => { void load(); }, []);
  return <main className="storefront-room min-h-screen p-5"><div className="max-w-3xl mx-auto space-y-5">
    <header><a className="font-bold underline" href="/">Wairo</a><h1 className="text-3xl font-bold mt-4">Public Groups directory</h1><p className="mt-2">Browse groups that chose to be discoverable. Listing a group does not publish its members, invitations, workspaces or financial records.</p></header>
    <p className="text-sm">Joining requires a signed-in account. Invitation-required groups do not become open through this directory.</p>
    <GroupDirectory data={data} error={error} onRetry={load} busyId={null} onOpen={() => { window.location.href = '/#city/circles'; }} onJoin={() => { window.location.href = '/#city/circles'; }} />
    <a className="block underline font-bold" href="/#city/circles">Sign in / open your Groups</a>
  </div></main>;
}
