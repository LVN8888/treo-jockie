const { Client } = require("discord.js-selfbot-v13");
const { accounts } = require("./src/config/loadEnv");
const { startAccount } = require("./src/core/start");
const logger = require("./src/core/logger");

if (accounts.length === 0) {
  logger("[WARN] No valid accounts found.");
  process.exit(1);
}

accounts.forEach((acc) => {
  const client = new Client();

  client.on("ready", () => {
    logger(`Bot ${client.user.tag} is ready.`);
    startAccount(client, acc);
  });

  client.login(acc.token).catch(e => logger(`Login failed: ${e.message}`));
});