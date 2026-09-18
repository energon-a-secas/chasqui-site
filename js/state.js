// ── State management ─────────────────────────────────────────
// Shared mutable state object. Only the composer fields are persisted, so a
// reload keeps the number the visitor is testing with and nothing else.

const STORAGE_KEY = 'chasqui-state';
const PERSISTED = ['phone', 'name', 'campaign', 'params', 'source'];

export const state = {
  // Composer (persisted)
  phone: '',
  name: '',
  campaign: '',
  params: '',
  source: 'chasqui.neorgon.com',

  // Live data (not persisted)
  connected: false,      // Convex client reached the deployment
  config: null,          // config:status result
  stats: null,           // messages:stats result
  thread: [],            // messages:thread rows for state.phone
  threadPhone: null,     // the normalised number the thread subscription follows
  sending: false,
  lastResult: null,      // { ok, status, text, detail } from the last send
  error: null,
};

/** Load saved composer fields from localStorage. */
export function loadSaved(s) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const k of PERSISTED) if (typeof saved[k] === 'string') s[k] = saved[k];
  } catch { /* ignore corrupted data */ }
}

/** Persist the composer fields. */
export function save(s) {
  try {
    const out = {};
    for (const k of PERSISTED) out[k] = s[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch { /* quota exceeded or private browsing */ }
}
