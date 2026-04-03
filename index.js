const { createDiscordClient } = require("./src/core/discordClient");
const { accounts } = require("./src/config/loadEnv");
const { startAccount } = require("./src/core/start");
const logger = require("./src/core/logger");

if (!accounts || accounts.length === 0) {
  logger("[WARN] No valid accounts found in .env. Exiting...");
  process.exit(1);
}

async function initBot() {
  for (const acc of accounts) {
    try {
      const client = await createDiscordClient(acc.token);

      client.on("ready", () => {
        logger(`[READY] Bot ${client.user.tag} is online.`);
        startAccount(client, acc);
      });

      if (accounts.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      logger(`[LOGIN ERR] Failed to login account index ${acc.index}: ${error.message}`);
    }
  }
}

initBot();

process.on("unhandledRejection", (reason) => {
  logger(`[ANTI-CRASH] Unhandled Rejection: ${reason}`);
});

process.on("uncaughtException", (err) => {
  logger(`[ANTI-CRASH] Uncaught Exception: ${err.message}`);
});

process.on("uncaughtExceptionMonitor", (err) => {
  logger(`[ANTI-CRASH] Exception Monitor: ${err.message}`);
});