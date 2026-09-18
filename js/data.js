// ── Convex client layer ──────────────────────────────────────
// One reactive client. The deployment URL is public (a Convex URL is not a
// secret); the AiSensy key lives only in the deployment's environment and is
// read by convex/aisensy.ts. Function names are strings at runtime, so there is
// no build step.

/** Filled by `npx convex dev --once`, which writes it to .env.local; copy it here. */
export const CONVEX_URL = 'https://deafening-chameleon-255.convex.cloud';

/** Pinned to this project's convex dependency in package.json. */
const CONVEX_CLIENT = 'https://esm.sh/convex@1.43.0/browser';

const FN = {
  status: 'config:status',
  stats: 'messages:stats',
  thread: 'messages:thread',
  send: 'aisensy:send',
};

let client = null;

/** Connect. Returns false when the SDK could not load; the page still renders. */
export async function initConvex() {
  if (client) return true;
  if (!CONVEX_URL || CONVEX_URL.includes('PENDING')) return false;
  try {
    const mod = await import(CONVEX_CLIENT);
    client = new mod.ConvexClient(CONVEX_URL);
    return true;
  } catch (e) {
    console.warn('Chasqui: Convex SDK load failed:', e.message);
    return false;
  }
}

function need() {
  if (!client) throw new Error('Backend not connected. Set CONVEX_URL in js/data.js.');
  return client;
}

/** Subscribe to a query; returns an unsubscribe function. */
function watch(name, args, cb) {
  return need().onUpdate(name, args, cb, (err) => console.warn(`Chasqui: ${name} failed`, err));
}

export function watchStatus(cb) { return watch(FN.status, {}, cb); }
export function watchStats(cb) { return watch(FN.stats, {}, cb); }
export function watchThread(phone, cb) { return watch(FN.thread, { phone }, cb); }

/** Trigger the campaign. Throws with a readable message on refusal. */
export async function sendCampaign({ phone, name, campaignName, templateParams, source }) {
  try {
    return await need().action(FN.send, { phone, name, campaignName, templateParams, source });
  } catch (err) {
    // ConvexError carries its message in .data; anything else is a transport failure.
    const msg = (err && typeof err.data === 'string' && err.data) || err?.message || String(err);
    throw new Error(msg.replace(/^\[CONVEX [^\]]*\]\s*/, '').replace(/^Uncaught ConvexError:\s*/, ''));
  }
}

/** The deployment's HTTP actions live on .convex.site, not .convex.cloud. */
export function webhookUrl() {
  if (!CONVEX_URL || CONVEX_URL.includes('PENDING')) return '';
  return CONVEX_URL.replace('.convex.cloud', '.convex.site') + '/aisensy/webhook?token=<AISENSY_WEBHOOK_TOKEN>';
}
