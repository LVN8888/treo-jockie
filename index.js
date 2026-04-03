const { Client } = require("discord.js-selfbot-v13");
const { accounts } = require("./src/config/loadEnv");
const { startAccount } = require("./src/core/start");
const logger = require("./src/core/logger");

if (!accounts || accounts.length === 0) {
  logger("[WARN] No valid accounts found in .env.");
  process.exit(1);
}

async function initBot() {
  for (const acc of accounts) {
    try {

      const client = new Client();

      setInterval(() => {
        try {
          client.channels.cache.forEach(channel => {
            if (channel.messages && channel.messages.cache) channel.messages.cache.clear();
          });
          if (client.users && client.users.cache) {
             client.users.cache.sweep(user => user.id !== client.user?.id);
          }
          client.guilds.cache.forEach(guild => {
            if (guild.members && guild.members.cache) {
              guild.members.cache.sweep(member => member.id !== client.user?.id);
            }
          });
        } catch (err) {
          logger(`[CACHE CLEAR ERROR] ${client.user?.tag || 'Unknown'}: ${err.message}`); 
        }
      }, 10 * 60 * 1000); 

      client.on("ready", () => {
        logger(`Bot ${client.user.tag} is ready.`);
        startAccount(client, acc);
      });

      await client.login(acc.token);
    } catch (error) {
      logger(`Login failed for account ${acc.index}: ${error.message}`);
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