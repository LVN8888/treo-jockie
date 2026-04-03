const fs = require("fs");
const dotenv = require("dotenv");
const resolveEnvPath = require("./resolveEnvPath");
const { parseBoolean, parseInterval } = require("../utils/parsers");

const path = resolveEnvPath();
const raw = fs.existsSync(path) ? dotenv.parse(fs.readFileSync(path)) : {};

const getIndices = (env) => {
  const indices = Object.keys(env).reduce((acc, key) => {
    const match = key.match(/^TOKEN_(\d+)$/);
    if (match) acc.add(Number(match[1]));
    return acc;
  }, new Set());

  return indices.size > 0 ? Array.from(indices).sort((a, b) => a - b) : [null];
};

const accounts = getIndices(raw).map(index => {
  const suffix = index !== null ? `_${index}` : "";
  
  return {
    index: index ?? "default",
    token: raw[`TOKEN${suffix}`],
    guildId: raw[`GUILD_ID${suffix}`],
    voiceChannelId: raw[`VOICE_CHANNEL_ID${suffix}`],
    sendChat: parseBoolean(raw[`SEND_CHAT${suffix}`], true),
    intervalMs: parseInterval(raw[`INTERVAL${suffix}`], 11 * 60 * 60 * 1000), // Mặc định 11 tiếng
    playlist: raw[`PLAYLIST${suffix}`] || "m!p https://open.spotify.com/playlist/0lBaE5j1bT9nPPRDC4TUkP?si=faf23a5b46844642",
    selfDeaf: parseBoolean(raw[`SELFDEAF${suffix}`], false),
    selfMute: parseBoolean(raw[`SELFMUTE${suffix}`], false),
  };
}).filter(acc => acc.token && acc.guildId);

module.exports = { accounts, raw };