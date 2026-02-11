const { Client, GatewayIntentBits } = require("discord.js-selfbot-v13");

async function createDiscordClient(token) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  await client.login(token);
  return client;
}

module.exports = { createDiscordClient };
