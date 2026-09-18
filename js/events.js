// ── Event handlers ───────────────────────────────────────────
// All event listeners and user interaction handlers.

import { state, save } from './state.js';
import { render } from './render.js';
import { $, normalizePhone, showToast, splitParams } from './utils.js';
import { sendCampaign, watchThread, webhookUrl } from './data.js';

let unwatchThread = null;

/** Follow the thread of whatever valid number is in the composer. */
export function followThread(s) {
  const phone = normalizePhone(s.phone);
  if (phone === s.threadPhone) return;
  if (unwatchThread) { unwatchThread(); unwatchThread = null; }
  s.threadPhone = phone;
  s.thread = [];
  if (phone && s.connected) {
    unwatchThread = watchThread(phone, (rows) => { s.thread = rows; render(s); });
  }
}

function bindField(id, key) {
  $(id).addEventListener('input', () => {
    state[key] = $(id).value;
    state.error = null;
    save(state);
    if (key === 'phone') followThread(state);
    render(state);
  });
}

async function onSend(e) {
  e.preventDefault();
  if (state.sending) return;
  state.sending = true;
  state.error = null;
  state.lastResult = null;
  render(state);
  try {
    state.lastResult = await sendCampaign({
      phone: state.phone,
      name: state.name.trim(),
      campaignName: state.campaign.trim(),
      templateParams: splitParams(state.params),
      source: state.source,
    });
    showToast(state.lastResult.ok ? 'AiSensy accepted the send' : 'AiSensy refused the send');
  } catch (err) {
    state.error = err.message;
    showToast('Not sent');
  } finally {
    state.sending = false;
    render(state);
  }
}

async function onCopyWebhook() {
  const url = webhookUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Webhook URL copied, replace the token placeholder');
  } catch {
    showToast('Copy failed, select the URL by hand');
  }
}

function onUseBot() {
  const bot = state.config?.botNumber;
  if (!bot) return;
  state.phone = bot;
  save(state);
  followThread(state);
  render(state);
}

/** Bind all event listeners. Call once from app.js after render. */
export function bindEvents(s) {
  bindField('phone', 'phone');
  bindField('name', 'name');
  bindField('campaign', 'campaign');
  bindField('params', 'params');
  $('composer').addEventListener('submit', onSend);
  $('copyWebhook').addEventListener('click', onCopyWebhook);
  $('useBot').addEventListener('click', onUseBot);
  followThread(s);
}
