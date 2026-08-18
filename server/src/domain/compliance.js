// ---------------------------------------------------------------------------
// COMPLIANCE GATES
//
// HONEST SCOPE. Some Brief surfaces cannot legally operate without licensing
// and verification that this deployment does not have. Rather than shipping
// them as UI shells that imply they work, each is gated here and reports
// precisely what is missing.
//
// WHY THIS IS A SERVER MODULE AND NOT A UI FLAG.
//
// A disabled button is a suggestion. If real-money contest logic existed
// behind an unlicensed endpoint, hiding the button would still leave the
// endpoint reachable. These gates refuse the REQUEST, so an unlicensed
// deployment cannot take a stake even if the client is modified.
//
// ARENA / REAL-MONEY CONTESTS (Kenya).
//
// Paid-entry contests with cash prizes are regulated gambling under the
// Betting, Lotteries and Gaming Act. Operating requires a BCLB licence, and
// separately: age verification (18+), KYC on participants, responsible-gaming
// controls, and a payment rail that is itself licensed. Brief currently has
// NONE of these. The correct engineering answer is therefore not to build a
// stake mechanism and disable it -- it is to refuse to hold stakes at all,
// and say why.
//
// What Arena CAN legally do without a licence, and does: friendly and ranked
// matches with no entry fee and no prize pool. That is a real product, not a
// placeholder, and it is what remains enabled.
// ---------------------------------------------------------------------------

/**
 * Real-money contest capability. Every field is a genuine precondition, not a
 * feature flag someone can flip to "true" to make the product look finished.
 */
export function arenaMoneyStatus() {
  const licence = process.env.BRIEF_GAMING_LICENCE_ID || null;
  const kyc = process.env.BRIEF_KYC_PROVIDER || null;

  // A licence id alone is not sufficient. Every one of these must hold before
  // Brief may hold a stake, and each is independently checkable.
  const requirements = [
    {
      id: 'gaming_licence',
      label: 'Gambling/gaming licence (BCLB or equivalent)',
      met: Boolean(licence),
      detail: licence ? 'configured' : 'BRIEF_GAMING_LICENCE_ID is not set'
    },
    {
      id: 'age_verification',
      label: 'Verified 18+ age checks on participants',
      met: Boolean(kyc),
      detail: kyc ? 'provider configured' : 'no KYC/age provider configured'
    },
    {
      id: 'kyc',
      label: 'Identity verification for payouts',
      met: Boolean(kyc),
      detail: kyc ? 'provider configured' : 'no KYC provider configured'
    },
    {
      id: 'payment_rail',
      label: 'Licensed payment provider able to hold and disburse stakes',
      // Deliberately reads the same signal the ledger uses. There is one
      // answer to "can Brief move money", not two.
      met: false,
      detail: 'no payment provider is connected'
    },
    {
      id: 'responsible_gaming',
      label: 'Deposit limits, self-exclusion and problem-gambling referral',
      met: false,
      detail: 'not implemented'
    }
  ];

  const unmet = requirements.filter((r) => !r.met);
  return {
    enabled: unmet.length === 0,
    requirements,
    unmet: unmet.map((r) => r.id),
    reason:
      unmet.length === 0
        ? null
        : 'Real-money contests are unavailable: ' +
          unmet.map((r) => r.label).join('; ') +
          '. Free and ranked matches are unaffected.'
  };
}

/**
 * Guard for any route that would hold, pool or disburse a contest stake.
 * Returns null when permitted, or the refusal payload to send.
 */
export function refuseIfUnlicensed() {
  const status = arenaMoneyStatus();
  if (status.enabled) return null;
  return {
    error: status.reason,
    code: 'compliance_gate',
    unmet: status.unmet,
    requirements: status.requirements
  };
}
