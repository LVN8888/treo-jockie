const fs = require("fs");
const { connectToVoice } = require("../services/voicePipeline");
const { sendVoiceChat } = require("../services/discordSender");
const { sleep } = require("../utils/parsers");
const logger = require("./logger");
const resolveEnvPath = require("../config/resolveEnvPath");

function saveToEnv(accIndex, baseKey, newValue) {
  try {
    const envPath = resolveEnvPath();
    if (!fs.existsSync(envPath)) return false;

    let envContent = fs.readFileSync(envPath, "utf8");
    const suffix = accIndex !== "default" ? `_${accIndex}` : "";
    const fullKey = `${baseKey}${suffix}`;

    const regex = new RegExp(`^${fullKey}=.*$`, "m");

    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${fullKey}=${newValue}`);
    } else {
      envContent += `\n${fullKey}=${newValue}`;
    }

    fs.writeFileSync(envPath, envContent, "utf8");
    return true;
  } catch (err) {
    logger(`[ERROR WRITING ENV FILE]: ${err.message}`);
    return false;
  }
}

async function startAccount(client, acc) {
  let isReconnecting = false;
  let isManualDisconnect = false; // FLAG: Chặn auto-reconnect khi đổi kênh
  let musicTimer = null;
  let currentConnection = null;

  const clearMusicTimer = () => {
    if (musicTimer) {
      clearTimeout(musicTimer);
      musicTimer = null;
    }
  };

  const destroyCurrentConnection = () => {
    try {
      if (currentConnection && typeof currentConnection.destroy === "function") {
        currentConnection.destroy();
      }
    } catch (err) {
      logger(`[DESTROY CONNECTION ERROR] ${client.user?.tag}: ${err.message}`);
    } finally {
      currentConnection = null;
    }
  };

  const runMusicCommands = async () => {
    if (!acc.sendChat) return;

    try {
      logger(`[${client.user.tag}] Sending music commands...`);
      await sendVoiceChat(client, acc.voiceChannelId, "m!leave");
      await sleep(5000);
      await sendVoiceChat(client, acc.voiceChannelId, `m!p ${acc.playlist}`);
      await sleep(5000);
      await sendVoiceChat(client, acc.voiceChannelId, "m!lq");
    } catch (err) {
      logger(`[ERROR] Command failed for ${client.user.tag}: ${err.message}`);
    }
  };

  const scheduleMusicLoop = () => {
    if (!acc.sendChat) return;

    clearMusicTimer();

    musicTimer = setTimeout(async () => {
      try {
        await runMusicCommands();
      } catch (err) {
        logger(`[MUSIC LOOP ERROR] ${client.user.tag}: ${err.message}`);
      } finally {
        scheduleMusicLoop();
      }
    }, acc.intervalMs);
  };

  const bootstrapMusicLoop = async () => {
    if (!acc.sendChat) return;
    await runMusicCommands();
    scheduleMusicLoop();
  };

  const handleReconnect = async () => {
    if (isReconnecting) return;
    isReconnecting = true;

    clearMusicTimer();
    destroyCurrentConnection();

    logger(`[${client.user.tag}] Voice disconnected. Reconnecting in 10s...`);

    while (true) {
      try {
        await sleep(10000);
        currentConnection = await connectToVoice(client, acc);
        logger(`[${client.user.tag}] Reconnected successfully.`);

        if (acc.sendChat) {
          await bootstrapMusicLoop();
        }
        break;
      } catch (err) {
        logger(`[RECONNECT FAILED] ${client.user.tag}: ${err.message}`);
      }
    }

    isReconnecting = false;
  };

  try {
    currentConnection = await connectToVoice(client, acc);
    if (acc.sendChat) {
      await bootstrapMusicLoop();
    }
  } catch (err) {
    logger(`[INITIAL START FAILED] ${client.user.tag}: ${err.message}`);
    handleReconnect();
  }

  // --- SỰ KIỆN VOICE UPDATE ---
  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      if (!oldState?.guild?.id || oldState.guild.id !== acc.guildId) return;
      if (!oldState?.member?.id || oldState.member.id !== client.user.id) return;

      if (!newState.channelId) {

        if (!isManualDisconnect) {
          await handleReconnect();
        }
      } else if (oldState.channelId !== newState.channelId) {
        logger(`[${client.user.tag}] Switched to ${newState.channel?.name || newState.channelId}.`);
      }
    } catch (err) {
      logger(`[VOICE STATE ERROR] ${client.user?.tag}: ${err.message}`);
    }
  });

  // --- MENU ---
  client.on("messageCreate", async (message) => {
    try {
      if (!message.author || message.author.id !== client.user.id) return;
      if (message.guildId !== acc.guildId) return;

      const args = message.content.trim().split(/ +/);
      const command = args.shift().toLowerCase();

      // --- LỆNH !MENU ---
      if (command === "!menu") {
        const statusMusic = acc.sendChat ? "🟢 **BẬT**" : "🔴 **TẮT**";
        
        const menuText = 
          `**━━━ 🎛️ MENU BOT TREO JOCKIE 🎛️ ━━━**\n` +
          `👤 **Tài khoản:** \`${client.user.username}\`\n\n` +
          `📊 **TRẠNG THÁI HIỆN TẠI:**\n` +
          `> 📻 **Auto Music:** ${statusMusic}\n` +
          `> 🔊 **Kênh Voice:** <#${acc.voiceChannelId}>\n` +
          `> 🎶 **Playlist:** \`${acc.playlist}\`\n\n` +
          `🛠️ **DANH SÁCH LỆNH:**\n` +
          `\`!music on\` / \`off\` ➔ Bật/tắt vòng lặp nhạc\n` +
          `\`!channel <ID_KÊNH>\` ➔ Đổi channel Voice (sẽ tự động gọi bot Jockie theo nếu Auto Music đang BẬT)\n` +
          `\`!playlist <Link>\` ➔ Đổi playlist mới\n\n` +
          `*Lưu ý: Bật/tắt nhạc trước khi đổi channel để tránh lỗi.*`;
        
        await message.reply(menuText).catch(() => {});
      }

      // --- LỆNH BẬT/TẮT MUSIC ---
      else if (command === "!music") {
        const action = args[0]?.toLowerCase();
        
        if (action === "on") {
          if (acc.sendChat) return message.reply("⚠️ Music đang BẬT sẵn rồi!").catch(() => {});
          
          acc.sendChat = true;
          saveToEnv(acc.index, "SEND_CHAT", "ON"); 
          
          await bootstrapMusicLoop();
          await message.reply("🟢 Đã **BẬT** tự động gửi lệnh phát nhạc.").catch(() => {});
        } 
        else if (action === "off") {
          if (!acc.sendChat) return message.reply("⚠️ Music đang TẮT sẵn rồi!").catch(() => {});
          
          acc.sendChat = false;
          saveToEnv(acc.index, "SEND_CHAT", "OFF"); 
          
          clearMusicTimer();
          await message.reply("🔴 Đã **TẮT** tự động gửi lệnh phát nhạc.").catch(() => {});
        }
      }

      // --- LỆNH CHUYỂN KÊNH VOICE ---
      else if (command === "!channel") {
        const newChannelId = args[0];
        if (!newChannelId || isNaN(newChannelId)) {
          return message.reply("⚠️ Lỗi: ID kênh không hợp lệ. VD: `!channel 12345...`").catch(() => {});
        }

        acc.voiceChannelId = newChannelId;
        saveToEnv(acc.index, "VOICE_CHANNEL_ID", newChannelId);

        await message.reply(`🔄 Đang chuyển sang kênh: <#${newChannelId}>.`).catch(() => {});
        
        clearMusicTimer();

        try {
          isManualDisconnect = true; 

          destroyCurrentConnection();
          await sleep(2000);
          
          currentConnection = await connectToVoice(client, acc);
          logger(`[${client.user.tag}] Move successful to channel ${newChannelId}.`);

          isManualDisconnect = false; 
          if (acc.sendChat) {
            logger(`[${client.user.tag}] Auto music is ON. Sending m!join first...`);
            
            await sleep(3000);
            await sendVoiceChat(client, acc.voiceChannelId, "m!join");
            
            await sleep(3000);
            await bootstrapMusicLoop();
          }
        } catch (err) {
          isManualDisconnect = false; 
          logger(`[ERROR MOVE CHANNEL] ${client.user?.tag}: ${err.message}`);
          await handleReconnect();
        }
      }

      // --- LỆNH ĐỔI PLAYLIST ---
      else if (command === "!playlist") {
        const newPlaylist = args.join(" ");
        if (!newPlaylist) {
          return message.reply("⚠️ Lỗi: Bạn chưa nhập link playlist. VD: `!playlist https://...`").catch(() => {});
        }

        acc.playlist = newPlaylist;
        saveToEnv(acc.index, "PLAYLIST", newPlaylist); 

        await message.reply(`🎵 Đã đổi playlist thành: \`${newPlaylist}\`.`).catch(() => {});
        
        if (acc.sendChat) {
          clearMusicTimer();
          await bootstrapMusicLoop(); 
        }
      }

    } catch (err) {
      logger(`[MESSAGE COMMAND ERROR] ${client.user?.tag}: ${err.message}`);
    }
  });
}

module.exports = { startAccount };