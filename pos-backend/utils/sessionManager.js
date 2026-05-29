// utils/sessionManager.js
// In-memory session store with TTL (auto-expires stale sessions).
// To switch to Redis later, only this file needs to change.

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

const sessions = {};

function getSession(phone) {
  const existing = sessions[phone];

  // Auto-clear expired sessions
  if (existing) {
    const age = Date.now() - (existing.lastActivity || 0);
    if (age > SESSION_TTL_MS) {
      console.log(`⏰ Session expired for ${phone} – starting fresh`);
      delete sessions[phone];
    }
  }

  if (!sessions[phone]) {
    sessions[phone] = {
      step: "INICIO",
      items: [],
      orderType: null,
      address: "",
      payment: null,
      pendingItems: null,
      skipParsing: false,
      lastActivity: Date.now(),
      muted: false,
      muteMessageSent: false,
    };
  }

  return sessions[phone];
}

function updateSession(phone, data) {
  sessions[phone] = {
    ...sessions[phone],
    ...data,
    lastActivity: Date.now(), // refresh TTL on every update
  };
}

function clearSession(phone) {
  delete sessions[phone];
}

// Mark a session as muted – bot will ignore all messages until re‑activated
function muteSession(phone) {
  const session = sessions[phone] || getSession(phone);
  session.muted = true;
  session.muteMessageSent = false;   // so we can send a one‑time notice
  // No need to "set" because we directly modified the object reference
}

// Re‑activate a muted session (clear all state)
function unmuteSession(phone) {
  clearSession(phone);   // resets to INICIO, removes muted flag
}

// ---- Periodic cleanup: remove dead sessions every 10 minutes ----
setInterval(() => {
  const now = Date.now();
  let cleared = 0;
  for (const phone of Object.keys(sessions)) {
    if (now - (sessions[phone].lastActivity || 0) > SESSION_TTL_MS) {
      delete sessions[phone];
      cleared++;
    }
  }
  if (cleared > 0) console.log(`🧹 Cleared ${cleared} expired session(s)`);
}, 10 * 60 * 1000);

module.exports = {
  getSession,
  updateSession,
  clearSession,
  muteSession,
  unmuteSession,
};