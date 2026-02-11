function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function buildConfig() {
  return {
    discord: {
      token: requireEnv("TOKEN"),
      channelId: requireEnv("VOICE_CHANNEL_ID"),
      cookie: process.env.DISCORD_COOKIE || "",
    },
    app: {
      sendEnabled: (process.env.DISCORD_SEND || "0") === "1",
      sendIntervalSec: Number(process.env.SEND_INTERVAL || "2"),
      contentPath: process.env.NOIDUNG_PATH || "noidung.txt",
      debug: (process.env.DEBUG || "0") === "1",
    },
  };
}

module.exports = { buildConfig };
