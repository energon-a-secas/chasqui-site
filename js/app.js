// ── Entry point ──────────────────────────────────────────────
// Import modules and initialize the app. Keep this file under 50 lines.

import { state, loadSaved } from './state.js';
import { render } from './render.js';
import { bindEvents, followThread } from './events.js';
import { initConvex, watchStatus, watchStats } from './data.js';

async function init() {
  loadSaved(state);
  render(state);
  state.connected = await initConvex();
  if (state.connected) {
    watchStatus((config) => { state.config = config; render(state); });
    watchStats((stats) => { state.stats = stats; render(state); });
  }
  bindEvents(state);
  followThread(state);
  render(state);
}

init();
