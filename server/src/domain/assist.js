// ---------------------------------------------------------------------------
// AI ASSISTANT SEAM (home-feed master build §27)
//
// The editorial pipeline can be AI-assisted: topic clustering, summaries,
// headline suggestions, tagging, image-search-query generation. This file is
// the PROVIDER ABSTRACTION for that — it mirrors the payment and outbound
// seams exactly:
//
//   * a provider exposes isConfigured() and status()
//   * the registry is empty until a real, credentialed provider is registered
//   * every call FAILS CLOSED when unconfigured, naming what is missing
//
// It deliberately does NOT pretend an AI is connected, and it NEVER auto-
// publishes. AI output is a suggestion an editor reviews; a draft it produces
// is created as status 'draft' and carries source + provenance, never trusted
// as a published fact.
//
// The rule that never changes: no AI output becomes a published Tea article
// without an editor's explicit publish action.
// ---------------------------------------------------------------------------

export const AI_PROVIDERS = {};

export function providerStatus() {
  const providers = Object.fromEntries(
    Object.entries(AI_PROVIDERS).map(([k, v]) => [k, v.status()])
  );
  const configured = Object.values(AI_PROVIDERS).filter((p) => p.isConfigured()).length;
  return {
    configured: configured > 0,
    count: Object.keys(AI_PROVIDERS).length,
    providers,
    reason: configured === 0
      ? 'No AI provider is configured. AI-assisted drafting is unavailable; ' +
        'articles are written by editors and published by an explicit, ' +
        'authenticated action.'
      : null
  };
}

/**
 * Ask the configured assistant to help with an editorial task (cluster,
 * summarise, suggest headlines, tag, suggest an image query). Returns a
 * fail-closed refusal when no provider is configured — the caller always
 * falls back to the editor's own input, never to a fabricated suggestion.
 */
export async function assist(task, input, { fetchImpl = fetch } = {}) {
  const names = Object.keys(AI_PROVIDERS);
  if (names.length === 0) {
    return { ok: false, reason: 'no_provider', task };
  }
  for (const name of names) {
    const p = AI_PROVIDERS[name];
    if (p.isConfigured()) {
      return p.assist({ task, input, fetchImpl });
    }
  }
  return { ok: false, reason: 'no_configured_provider', task };
}
