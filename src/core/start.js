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
    logger(`[ENV ERROR] ${err.message}`);
    return false;
  }
}

async function startAccount(client, acc) {
  let isReconnecting = false;
  let isManualDisconnect = false;
  let musicTimer = null;
  let currentConnection = null;
  let watchdogTimer = null; // Khai báo thêm timer cho Watchdog

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
      await sendVoiceChat(client, acc.voiceChannelId, "m!leave");
      await sleep(5000);
      await sendVoiceChat(client, acc.voiceChannelId, `m!p ${acc.playlist}`);
      await sleep(5000);
      await sendVoiceChat(client, acc.voiceChannelId, "m!lq");
    } catch (err) {
      logger(`[MUSIC ERROR] ${client.user.tag}: ${err.message}`);
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
    if (isReconnecting || isManualDisconnect) return;
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
    await handleReconnect();
  }

  // ==========================================
  // WATCHDOG: GIÁM SÁT KẾT NỐI MỖI 2 PHÚT
  // ==========================================
  watchdogTimer = setInterval(async () => {
    try {
      const guild = client.guilds.cache.get(acc.guildId);
      if (!guild) return;

      const botMember = guild.members.cache.get(client.user.id);
      
      // Kiểm tra nếu Bot không ở trong kênh voice VÀ không trong quá trình chủ động ngắt/kết nối lại
      if (!botMember?.voice.channelId && !isReconnecting && !isManualDisconnect) {
        logger(`[WATCHDOG - ${client.user.tag}] Phát hiện bot kẹt/rớt Voice! Đang tự động kích hoạt reconnect...`);
        await handleReconnect();
      }
    } catch (err) {
      logger(`[WATCHDOG ERROR - ${client.user.tag}] ${err.message}`);
    }
  }, 120000); // 120000ms = 2 phút

  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      if (!oldState?.guild?.id || oldState.guild.id !== acc.guildId) return;
      if (!oldState?.member?.id || oldState.member.id !== client.user.id) return;

      if (!newState.channelId) {
        await handleReconnect();
      } else if (oldState.channelId !== newState.channelId) {
        logger(
          `[${client.user.tag}] Moved: ${oldState.channel?.name || oldState.channelId || "none"} -> ${newState.channel?.name || newState.channelId}`
        );
      }
    } catch (err) {
      logger(`[VOICE STATE ERROR] ${client.user?.tag}: ${err.message}`);
    }
  });

  client.on("messageCreate", async (message) => {
    try {
      if (!message.author || message.author.id !== client.user.id) return;
      if (message.guildId !== acc.guildId) return;

      const args = message.content.trim().split(/ +/);
      const command = args.shift()?.toLowerCase();

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
          `\`!channel <ID_KÊNH>\` ➔ Đổi channel treo (sẽ tự động gọi bot Jockie theo nếu Auto Music đang BẬT)\n` +
          `\`!playlist <Link>\` ➔ Đổi playlist mới\n` +
          `\`!reconnect\` ➔ Reconnect lại Voice channel\n` +
          `\`!thoitiet <Địa_điểm>\` ➔ Xem thời tiết tại địa điểm (VD: \`!thoitiet Hồ Chí Minh\`)\n` +
          `⚠️ **Lưu ý**: *Nếu muốn bật/tắt Auto Music thì sử dụng lệnh trước khi đổi channel treo để tránh lỗi treo.*`;

        await message.reply(menuText).catch(() => {});
      }

      else if (command === "!music") {
        const action = args[0]?.toLowerCase();

        if (action === "on") {
          if (acc.sendChat) {
            return message.reply("⚠️ Music đang BẬT sẵn rồi!").catch(() => {});
          }

          acc.sendChat = true;
          saveToEnv(acc.index, "SEND_CHAT", "ON");
          await bootstrapMusicLoop();
          await message.reply("🟢 Đã **BẬT** tự động gửi lệnh phát nhạc.").catch(() => {});
        }

        else if (action === "off") {
          if (!acc.sendChat) {
            return message.reply("⚠️ Music đang TẮT sẵn rồi!").catch(() => {});
          }

          acc.sendChat = false;
          saveToEnv(acc.index, "SEND_CHAT", "OFF");
          clearMusicTimer();
          await message.reply("🔴 Đã **TẮT** tự động gửi lệnh phát nhạc.").catch(() => {});
        }
      }

      else if (command === "!channel") {
        const newChannelId = args[0];

        if (!newChannelId || isNaN(newChannelId)) {
          return message
            .reply("⚠️ Lỗi: ID kênh không hợp lệ. VD: `!channel 12345...`")
            .catch(() => {});
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

          isManualDisconnect = false;

          if (acc.sendChat) {
            await sleep(3000);
            await sendVoiceChat(client, acc.voiceChannelId, "m!join");
            await sleep(3000);
            await bootstrapMusicLoop();
          }
        } catch (err) {
          isManualDisconnect = false;
          logger(`[CHANNEL ERROR] ${err.message}`);
          await handleReconnect();
        }
      }

      else if (command === "!playlist") {
        const newPlaylist = args.join(" ");

        if (!newPlaylist) {
          return message
            .reply("⚠️ Lỗi: Bạn chưa nhập link playlist. VD: `!playlist https://...`")
            .catch(() => {});
        }

        acc.playlist = newPlaylist;
        saveToEnv(acc.index, "PLAYLIST", newPlaylist);

        await message.reply(`🎵 Đã đổi playlist thành: \`${newPlaylist}\`.`).catch(() => {});

        if (acc.sendChat) {
          clearMusicTimer();
          await bootstrapMusicLoop();
        }
      }

      else if (command === "!thoitiet") {
        const location = args.join(" ") || "Ho Chi Minh"; 
        
        let waitingMsg;
        try {
          waitingMsg = await message.reply(`⏳ Đang dò trạm khí tượng tại \`${location}\`...`);
        } catch (err) {
          return; 
        }

        try {
          const response = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=4`);
          if (!response.ok) throw new Error("Không tìm thấy địa điểm");
          
          let weatherData = await response.text();
          weatherData = weatherData.trim();
          const parts = weatherData.split(":");
          if (parts.length > 1) {
            parts[0] = parts[0]
              .split(" ")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");
          
            weatherData = parts.join(":");
          }
          
          await waitingMsg.edit(`🌤️ **Thông tin thời tiết:**\n> \`${weatherData}\``).catch(() => {});
        } catch (err) {
          logger(`[WEATHER ERROR] ${err.message}`);
          await waitingMsg.edit(`⚠️ Không tìm thấy thời tiết cho \`${location}\`. Thử kiểm tra lại tên nhé!`).catch(() => {});
        }
      }
      else if (command === "!reconnect") {
        let notiMsg;
        try {
          notiMsg = await message.reply("🔄 Đang reconnect lại Voice channel...").catch(() => {});
          isManualDisconnect = true; 
        
          await handleReconnect();
          isManualDisconnect = false;

          if (notiMsg) {
            await notiMsg.edit("✅ Đã kết nối lại Voice thành công!").catch(() => {});
          }

        } catch (err) {
          logger(`[RECONNECT COMMAND ERROR] ${err.message}`);
          isManualDisconnect = false; 
          
          if (notiMsg) {
            await notiMsg.edit("⚠️ Có lỗi xảy ra khi reconnect, vui lòng kiểm tra log!").catch(() => {});
          }
        }
      }

    } catch (err) {
      logger(`[COMMAND ERROR] ${err.message}`);
    }
  });
}

module.exports = { startAccount };