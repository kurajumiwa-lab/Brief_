#!/usr/bin/env node
// ---------------------------------------------------------------------------
// TELEGRAM SETUP — run once per deployment. Registers the bot end of the
// TG onboarding handshake, through the real Bot API, honestly.
//
//   TELEGRAM_BOT_TOKEN=... BRIEF_PUBLIC_ORIGIN=https://your.host \
//   TELEGRAM_WEBHOOK_SECRET=... node scripts/telegram-setup.mjs
//
// What it does (each step reported; a failure names the reason and the
// script exits non-zero):
//   1. getMe           — proves the token is real, names the bot
//   2. setWebhook      — points updates at <origin>/api/webhooks/telegram
//                        with the secret_token header Telegram will send
//   3. setChatMenuButton — the ⌄ menu button becomes "Brief" (the Mini App)
//   4. setMyCommands   — /start "Open Brief", /help
//   5. getWebhookInfo  — reads back what Telegram now believes
// ---------------------------------------------------------------------------
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ORIGIN = (process.env.BRIEF_PUBLIC_ORIGIN ?? process.env.BRIEF_PUBLIC_BASE ?? '').replace(/\/$/, '');
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const fail = (msg) => { console.error('  FAIL  ' + msg); process.exit(1); };
if (!TOKEN) fail('TELEGRAM_BOT_TOKEN is not set — get one from @BotFather (/newbot).');
if (!ORIGIN) fail('BRIEF_PUBLIC_ORIGIN is not set — the Mini App needs a public https URL.');
if (!SECRET) fail('TELEGRAM_WEBHOOK_SECRET is not set — generate one: `node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'hex\'))"`.');

const api = async (method, params) => {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params ?? {})
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.ok !== false, result: body.result ?? null, error: body.description ?? `HTTP ${res.status}` };
};

const step = async (name, fn) => {
  const out = await fn();
  if (!out.ok) fail(`${name}: ${out.error}`);
  console.log('  OK    ' + name);
  return out.result;
};

console.log('TELEGRAM SETUP\n');

const me = await step('the token is real (getMe)', () => api('getMe'));
console.log(`        bot: @${me.username} (${me.first_name})`);

await step('webhook -> ' + ORIGIN + '/api/webhooks/telegram', () =>
  api('setWebhook', {
    url: `${ORIGIN}/api/webhooks/telegram`,
    secret_token: SECRET,
    allowed_updates: ['message', 'channel_post', 'edited_message', 'edited_channel_post'],
    drop_pending_updates: false
  }));

const menu = await step('menu button -> the Mini App', () =>
  api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Brief', web_app: { url: ORIGIN } } }));
if (!menu) { /* reported by step */ }

await step('commands (/start, /help)', () =>
  api('setMyCommands', { commands: [
    { command: 'start', description: 'Open Brief' },
    { command: 'help', description: 'How Brief works' }
  ] }));

const info = await step('read-back (getWebhookInfo)', () => api('getWebhookInfo'));
console.log(`        webhook now: ${info.url}`);
console.log(`        pending updates: ${info.pending_update_count ?? 0}${info.last_error_message ? ` · LAST ERROR: ${info.last_error_message}` : ' · no errors'}`);

console.log(`
DONE. The handshake is live:
  a person taps START in @${me.username}
    -> the bot answers with one button: "Open Brief"
    -> the Mini App opens at ${ORIGIN}, signed by initData
    -> /api/telegram/init binds them to a Brief account
  Group/channel ingestion rides the same webhook; /api/connectors/telegram/verify
  and scripts/preflight.mjs confirm health at any time.`);
