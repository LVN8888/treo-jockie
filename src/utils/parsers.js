module.exports = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  parseBoolean: (val, def) => {
    if (val === undefined || val === null || val === "") return def;
    const n = String(val).trim().toLowerCase();
    return ["true", "1", "yes", "on"].includes(n);
  },
  parseInterval: (val, def) => {
    if (!val) return def;
    try {
      const result = Function(`"use strict"; return (${val});`)();
      return Number.isFinite(result) ? result : def;
    } catch { return def; }
  }
};