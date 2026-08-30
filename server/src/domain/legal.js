// ---------------------------------------------------------------------------
// LEGAL — the two documents a real deployment owes its members.
//
// Written to match what the product ACTUALLY does (checked against the code,
// not aspiration): points are not money; fees are paid through a manual
// Pochi flow confirmed by an operator; WhatsApp shops are member-run and
// Brief is not a party to those transactions; real-money arena stakes stay
// off without a licence; verification stores no identity documents; the
// store is a JSON file on the deployment's own disk.
//
// Served as text so any surface (app, email, screenshot) can show it. The
// `version` + `effective` fields make "which terms did I agree to" a question
// with a real answer.
// ---------------------------------------------------------------------------

const EFFECTIVE = '2026-08-30';
const VERSION = 1;

export const TERMS = {
  slug: 'terms',
  title: 'Terms of Service',
  version: VERSION,
  effective: EFFECTIVE,
  body: `These terms govern your use of this Brief deployment, run by its operator ("we"). Brief is a local discovery, records and commerce toolkit. By creating an account you accept them.

1. What Brief is — and is not
Brief helps people discover what is happening around them, keep records of what matters to them, run groups, play free games in the Arena, and sell through tools such as the WhatsApp shop builder. Brief is software. It is not a bank, a lender, an insurer, a betting operator or a courier.

2. Points are not money
Arena XP and Arena Coins, referral points and any similar scores are POINTS. They buy nothing, cash out to nothing, are non-transferable, and carry no monetary value. We may adjust how they are earned or displayed.

3. Paying for services
Paid services (for example the monthly WhatsApp shop service) are paid to the operator's Pochi la Biashara number or another stated channel. Payment is confirmed manually: you submit your M-Pesa confirmation code and an operator verifies it before the service activates. A service never activates on an unconfirmed code. Fees are for the service stated; they are refundable at the operator's discretion if the service cannot be delivered.

4. The WhatsApp shop
The shop builder produces a price list and a link; the selling happens in WhatsApp, between you and your customers. You are the seller. Brief is not a party to those transactions, does not hold buyer money, and does not mediate disputes except by suspending tools that are misused.

5. Games and stakes
Arena games are free to play. Real-money staking is DISABLED unless this deployment carries a gaming licence, and every money-adjacent door refuses with a stated reason when it is not licensed. Where stakes are legally available, they are governed by the compliance rules published in the app at that time.

6. Your conduct
Do not use Brief to defraud, harass or impersonate; to sell what you may not lawfully sell; to run pyramid-style recruitment (referral rewards here are deliberately one level deep and paid only from real revenue); or to abuse the service's infrastructure. We may suspend an account that does — suspension takes effect immediately and is recorded with a reason.

7. Records and honesty
Brief deliberately avoids inventing data. Totals, ratings and standings are derived from recorded events. Where a surface is not configured (payments, WhatsApp sending, and so on) it says so. Do not rely on Brief as your only record of anything.

8. Availability and changes
The service is provided "as is", without warranty. We may change these terms; the version and date at the top will change with them. Continued use after a change accepts it.

9. Law
These terms are governed by the laws of the Republic of Kenya.`
};

export const PRIVACY = {
  slug: 'privacy',
  title: 'Privacy Notice',
  version: VERSION,
  effective: EFFECTIVE,
  body: `This notice explains what this Brief deployment collects and why, in line with the Kenya Data Protection Act, 2019. The data controller is the operator of this deployment.

1. What we collect
- Account: your handle, display name, and (if you sign in that way) a Google identifier. Passwords are stored only as salted hashes; session tokens only as fingerprints.
- What you put in: objects and captures you save, group activity, shops and price lists, sales you log in the book, Arena plays and their results, and the activation events that describe how you moved through onboarding.
- Money-adjacent records: for service fees, the M-Pesa confirmation code and amount, kept as a record of a payment an operator verified. For payouts, a record of money sent. Brief holds no card data and no bank credentials.
- Messages, only if a connector (Telegram, WhatsApp) is configured — and only what the product needs to function.

2. What we deliberately do NOT collect
No identity documents are stored. Verification works through providers and stores only the outcome (pending / approved / refused). No location tracking: only the city or place you pick yourself. No advertising cookies, no cross-site trackers.

3. Why we process
To operate the service you asked for: your account, your records, the groups you belong to, the games you play, the shops you run, and the fees you pay. Aggregate, non-identifying counts may be used to run and improve the deployment.

4. Where it lives
In this deployment's own data store, on its own disk. If connectors are configured, those providers process what they must to deliver their service. Brief sells your data to no one.

5. How long
Until you ask us to delete it, or the deployment is decommissioned. Backups (snapshots of the store) are kept for recovery and follow the same rules.

6. Your rights
You may ask to access, correct, export or erase your personal data, or object to a specific processing, by contacting the operator. In-app, your own rows (objects, captures, shops, sales you logged) are yours to read. Erasure removes what is legally removable; ledger and audit records of money and operator actions are retained to the extent the law requires.

7. Contact
The operator of this deployment, at the address published with it.`
};

const BY_SLUG = { terms: TERMS, privacy: PRIVACY };

export function legalDoc(slug) {
  return BY_SLUG[slug] ?? null;
}

export function legalIndex() {
  return { docs: [TERMS, PRIVACY].map((d) => ({ slug: d.slug, title: d.title, version: d.version, effective: d.effective })) };
}
