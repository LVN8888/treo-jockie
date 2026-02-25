const { Client, GatewayIntentBits } = require("discord.js-selfbot-v13");

async function createDiscordClient(token) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    
    makeCache: Options.cacheWithLimits({
      MessageManager: 0,         // Không lưu tin nhắn vào RAM
      UserManager: 10,           // Chỉ giữ tối đa 10 user gần nhất
      GuildMemberManager: 1,     // Không lưu danh sách thành viên server
      ThreadManager: 0,          // Không lưu thread
      ReactionManager: 0,        // Không lưu reaction
      PresenceManager: 0,        // Không lưu trạng thái online của người khác
    }),
  });

  await client.login(token);
  return client;
}

module.exports = { createDiscordClient };
