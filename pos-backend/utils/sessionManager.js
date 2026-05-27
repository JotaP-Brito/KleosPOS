const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: "INICIO", items: [], delivery: false, address: "", payment: "" };
  }
  return sessions[phone];
}

function updateSession(phone, data) {
  sessions[phone] = { ...sessions[phone], ...data };
}

function clearSession(phone) {
  delete sessions[phone];
}

module.exports = { getSession, updateSession, clearSession };