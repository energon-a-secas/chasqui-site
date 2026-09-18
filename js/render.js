// ── DOM rendering ────────────────────────────────────────────
// All functions that create or update DOM elements.

import { $, escHtml, fmtTime, normalizePhone } from './utils.js';
import { webhookUrl } from './data.js';

const BOT_FALLBACK = '+15553310925';

/** Main render function: rebuilds the UI from state. */
export function render(s) {
  renderComposer(s);
  renderWindowHeader(s);
  renderThread(s);
  renderWiring(s);
  renderChatLink(s);
}

function renderComposer(s) {
  if ($('phone').value !== s.phone) $('phone').value = s.phone;
  if ($('name').value !== s.name) $('name').value = s.name;
  if ($('campaign').value !== s.campaign) $('campaign').value = s.campaign;
  if ($('params').value !== s.params) $('params').value = s.params;

  const list = $('campaignList');
  const known = s.config?.campaigns ?? [];
  list.innerHTML = known.map((c) => `<option value="${escHtml(c)}"></option>`).join('');

  const valid = Boolean(normalizePhone(s.phone)) && s.name.trim() && s.campaign.trim();
  $('sendBtn').disabled = !valid || s.sending || !s.connected;
  $('sendBtn').textContent = s.sending ? 'Sending…' : 'Send via AiSensy';

  const hint = $('phoneHint');
  if (!s.phone) hint.textContent = 'With country code. The relay refuses a number without one.';
  else if (!normalizePhone(s.phone)) hint.textContent = 'Needs a + and a country code, like +54 9 11 1234 5678.';
  else hint.textContent = `Will send to ${normalizePhone(s.phone)}`;
}

function renderWindowHeader(s) {
  const bot = s.config?.botNumber || BOT_FALLBACK;
  $('botNumber').textContent = bot;
  const dot = $('connDot');
  const label = $('connLabel');
  if (!s.connected) {
    dot.dataset.state = 'off';
    label.textContent = 'backend not connected';
  } else if (s.config && !s.config.keyConfigured) {
    dot.dataset.state = 'warn';
    label.textContent = 'live, no API key on the deployment';
  } else {
    dot.dataset.state = 'on';
    label.textContent = 'live';
  }
}

function renderThread(s) {
  const el = $('thread');
  const phone = normalizePhone(s.phone);
  if (!phone) {
    el.innerHTML = `<div class="thread__empty">Type a number with its country code and the relay shows that number's thread here, live.</div>`;
    return;
  }
  if (!s.connected) {
    el.innerHTML = `<div class="thread__empty">The backend is not connected, so there is no thread to show.</div>`;
    return;
  }
  if (!s.thread.length) {
    el.innerHTML = `<div class="thread__empty">Nothing relayed to ${escHtml(phone)} yet. Sends, refusals and webhook events will appear here as they happen.</div>`;
    return;
  }
  el.innerHTML = s.thread.map(bubble).join('');
  el.scrollTop = el.scrollHeight;
}

function bubble(m) {
  const side = m.direction === 'in' ? 'in' : 'out';
  const tone = m.status === 'rejected' ? 'bad' : m.status === 'accepted' || m.status === 'received' ? 'ok' : 'wait';
  const meta = [m.campaign ? `campaign ${escHtml(m.campaign)}` : null, escHtml(m.status), fmtTime(m.at)].filter(Boolean).join(' · ');
  const params = m.params?.length
    ? `<ol class="bubble__params">${m.params.map((p) => `<li>${escHtml(p)}</li>`).join('')}</ol>`
    : '';
  const detail = m.detail
    ? `<details class="bubble__detail"><summary>provider response</summary><pre>${escHtml(m.detail)}</pre></details>`
    : '';
  return `
    <article class="bubble bubble--${side}" data-tone="${tone}">
      <div class="bubble__text">${escHtml(m.text)}</div>
      ${params}
      ${detail}
      <div class="bubble__meta">${meta}</div>
    </article>`;
}

function renderWiring(s) {
  const c = s.config;
  const rows = [
    ['Backend', s.connected ? 'connected' : 'not connected', s.connected ? 'ok' : 'bad'],
    ['AiSensy API key', c ? (c.keyConfigured ? 'set on the deployment' : 'missing') : '…', c?.keyConfigured ? 'ok' : 'bad'],
    ['Webhook token', c ? (c.webhookConfigured ? 'set' : 'not set, inbound disabled') : '…', c?.webhookConfigured ? 'ok' : 'warn'],
    ['Campaigns', c ? (c.campaigns.length ? c.campaigns.join(', ') : 'any name accepted') : '…', c?.campaigns?.length ? 'ok' : 'warn'],
    ['Destination allowlist', c ? (c.allowlistSize ? `${c.allowlistSize} number(s)` : 'open, rate limited') : '…', c?.allowlistSize ? 'ok' : 'warn'],
  ];
  $('wiring').innerHTML = rows.map(([k, v, tone]) => `
    <div class="kv" data-tone="${tone}"><dt>${escHtml(k)}</dt><dd>${escHtml(v)}</dd></div>`).join('');

  const st = s.stats;
  $('stats').textContent = st
    ? `${st.contacts} contact(s) · ${st.out} send(s), ${st.accepted} accepted · ${st.inbound} inbound event(s)`
    : '';

  const url = webhookUrl();
  $('webhookUrl').textContent = url || 'available once CONVEX_URL is set';
  $('copyWebhook').disabled = !url;

  const last = s.lastResult;
  const box = $('lastResult');
  if (!last && !s.error) { box.hidden = true; return; }
  box.hidden = false;
  box.dataset.tone = s.error ? 'bad' : last.ok ? 'ok' : 'bad';
  box.innerHTML = s.error
    ? `<strong>Refused before reaching AiSensy.</strong> ${escHtml(s.error)}`
    : `<strong>${last.ok ? 'Accepted.' : 'Refused by AiSensy.'}</strong> ${escHtml(last.text)}`
      + (last.detail ? `<pre>${escHtml(last.detail)}</pre>` : '');
}

function renderChatLink(s) {
  const bot = (s.config?.botNumber || BOT_FALLBACK).replace(/\D/g, '');
  const text = encodeURIComponent('Hola Chasqui');
  const href = `https://wa.me/${bot}?text=${text}`;
  for (const a of document.querySelectorAll('[data-chat-link]')) a.href = href;
}
