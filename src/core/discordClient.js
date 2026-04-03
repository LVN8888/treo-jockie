const { Client, GatewayIntentBits, Options } = require("discord.js-selfbot-v13");

async function createDiscordClient(token) {
  const client = new Client({
    // Khai báo các intents cần thiết cho bot hoạt động và vào voice
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages, 
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates // Rất quan trọng để theo dõi trạng thái Voice
    ],
    
    // TỐI ƯU HOÁ CACHE CỰC ĐẠI - Ép không cho lưu dữ liệu thừa vào RAM
    makeCache: Options.cacheWithLimits({
      MessageManager: 0,         // Không lưu tin nhắn
      UserManager: 10,           // Chỉ giữ tối đa 10 user gần nhất
      GuildMemberManager: 0,     // Không lưu danh sách thành viên
      ThreadManager: 0,          // Không lưu thread
      ReactionManager: 0,        // Không lưu reaction
      PresenceManager: 0,        // Không lưu trạng thái online/offline
      GuildMessageManager: 0,    // Không lưu tin nhắn của server
      VoiceStateManager: 10,     // Giữ lại 1 chút để event voice hoạt động ổn định
    }),

    // SWEEPERS: Chủ động quét và dọn rác bộ nhớ mỗi giờ (3600s)
    sweepers: {
      ...Options.DefaultMakeCacheSettings,
      messages: { interval: 3600, lifetime: 1800 },
      users: { 
        interval: 3600, 
        filter: () => (user) => user.id !== client.user?.id // Không xoá cache của chính bản thân bot
      },
    }
  });

  await client.login(token);
  return client;
}

// Xuất hàm ra để index.js có thể gọi được
module.exports = { createDiscordClient };