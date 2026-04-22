const fs = require("fs");
const { VoiceConnectionStatus } = require("@discordjs/voice");
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
  let healthCheckInterval = null;
  let reconnectCheckTimer = null;

  const clearMusicTimer = () => {
    if (musicTimer) {
      clearTimeout(musicTimer);
      musicTimer = null;
    }
  };

  const clearReconnectCheckTimer = () => {
    if (reconnectCheckTimer) {
      clearTimeout(reconnectCheckTimer);
      reconnectCheckTimer = null;
    }
  };

  const getCurrentVoiceChannelId = () => {
    try {
      return client.guilds.cache.get(acc.guildId)?.members?.me?.voice?.channelId || null;
    } catch {
      return null;
    }
  };

  const destroyCurrentConnection = () => {
    try {
      if (currentConnection?.removeAllListeners) {
        currentConnection.removeAllListeners();
      }

      if (currentConnection?.destroy) {
        currentConnection.destroy();
      }
    } catch (err) {
      logger(`[DESTROY ERROR] ${err.message}`);
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
      logger(`[MUSIC ERROR] ${err.message}`);
    }
  };

  const scheduleMusicLoop = () => {
    if (!acc.sendChat) return;

    clearMusicTimer();

    musicTimer = setTimeout(async () => {
      try {
        await runMusicCommands();
      } catch (err) {
        logger(`[MUSIC LOOP ERROR] ${err.message}`);
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

  const handleReconnect = async (reason = "unknown") => {
    if (isReconnecting || isManualDisconnect) return;
    isReconnecting = true;

    clearMusicTimer();
    clearReconnectCheckTimer();
    destroyCurrentConnection();

    let retry = 0;
    const maxRetry = 999999;

    while (retry < maxRetry) {
      try {
        retry++;
        await sleep(10000);

        currentConnection = await connectToVoice(client, acc);
        attachConnectionListeners(currentConnection);

        if (acc.sendChat) {
          await bootstrapMusicLoop();
        }

        isReconnecting = false;
        return;
      } catch (err) {
        if (retry % 10 === 0) {
          logger(`[RECONNECT ${reason}] attempt ${retry}: ${err.message}`);
        }
      }
    }

    isReconnecting = false;
  };

  const scheduleReconnectCheck = (reason = "unknown") => {
    if (isManualDisconnect || isReconnecting) return;

    clearReconnectCheckTimer();

    reconnectCheckTimer = setTimeout(async () => {
      try {
        if (isManualDisconnect || isReconnecting) return;

        const currentChannelId = getCurrentVoiceChannelId();

        // Nếu bot vẫn còn đang ở voice thì không reconnect
        if (currentChannelId) {
          if (String(currentChannelId) !== String(acc.voiceChannelId)) {
            acc.voiceChannelId = currentChannelId;
            saveToEnv(acc.index, "VOICE_CHANNEL_ID", currentChannelId);
          }
          return;
        }

        await handleReconnect(reason);
      } catch (err) {
        logger(`[RECONNECT CHECK ERROR] ${err.message}`);
      }
    }, 3000);
  };

  const attachConnectionListeners = (connection) => {
    if (!connection?.on) return;

    connection.on("error", async () => {
      if (!isManualDisconnect) {
        scheduleReconnectCheck("connection_error");
      }
    });

    connection.on("stateChange", async (_, newState) => {
      try {
        if (isManualDisconnect) return;

        const newStatus = newState?.status;

        if (
          newStatus === VoiceConnectionStatus.Disconnected ||
          newStatus === VoiceConnectionStatus.Destroyed ||
          newStatus === "disconnected" ||
          newStatus === "destroyed"
        ) {
          scheduleReconnectCheck(`state_${newStatus}`);
        }
      } catch (err) {
        logger(`[STATE ERROR] ${err.message}`);
      }
    });
  };

  const startHealthCheck = () => {
    if (healthCheckInterval) clearInterval(healthCheckInterval);

    healthCheckInterval = setInterval(async () => {
      try {
        if (isManualDisconnect || isReconnecting) return;

        const currentChannelId = getCurrentVoiceChannelId();

        if (!currentConnection) {
          await handleReconnect("healthcheck_no_connection");
          return;
        }

        // Chỉ reconnect khi out hẳn
        if (!currentChannelId) {
          await handleReconnect("healthcheck_not_in_voice");
          return;
        }

        // Nếu bị move sang channel khác thì cập nhật lại target channel
        if (String(currentChannelId) !== String(acc.voiceChannelId)) {
          acc.voiceChannelId = currentChannelId;
          saveToEnv(acc.index, "VOICE_CHANNEL_ID", currentChannelId);
        }
      } catch (err) {
        logger(`[HEALTH ERROR] ${err.message}`);
      }
    }, 30000);
  };

  try {
    currentConnection = await connectToVoice(client, acc);
    attachConnectionListeners(currentConnection);
    startHealthCheck();

    if (acc.sendChat) {
      await bootstrapMusicLoop();
    }
  } catch (err) {
    logger(`[START ERROR] ${err.message}`);
    startHealthCheck();
    await handleReconnect("initial_start_failed");
  }

  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      if (!oldState?.guild?.id || oldState.guild.id !== acc.guildId) return;
      if (!oldState?.member?.id || oldState.member.id !== client.user.id) return;

      // Out hẳn khỏi voice
      if (!newState.channelId) {
        if (!isManualDisconnect) {
          scheduleReconnectCheck("voice_left_channel");
        }
        return;
      }

      // Bị move sang channel khác -> không reconnect, chỉ cập nhật channel mới
      if (oldState.channelId !== newState.channelId) {
        acc.voiceChannelId = newState.channelId;
        saveToEnv(acc.index, "VOICE_CHANNEL_ID", newState.channelId);
      }
    } catch (err) {
      logger(`[VOICE STATE ERROR] ${err.message}`);
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
          `\`!playlist <Link>\` ➔ Đổi playlist mới\n\n` +
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
        clearReconnectCheckTimer();

        try {
          isManualDisconnect = true;

          destroyCurrentConnection();
          await sleep(2000);

          currentConnection = await connectToVoice(client, acc);
          attachConnectionListeners(currentConnection);

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
          await handleReconnect("move_channel_failed");
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
    } catch (err) {
      logger(`[COMMAND ERROR] ${err.message}`);
    }
  });
}

module.exports = { startAccount };