const { connectToVoice } = require("../services/voicePipeline");
const { sendVoiceChat } = require("../services/discordSender");
const { sleep } = require("../utils/parsers");
const logger = require("./logger");

async function startAccount(client, acc) {
  let isReconnecting = false;
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

  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      if (!oldState?.guild?.id || oldState.guild.id !== acc.guildId) return;
      if (!oldState?.member?.id || oldState.member.id !== client.user.id) return;

      if (!newState.channelId) {
        await handleReconnect();
      } else if (oldState.channelId !== newState.channelId) {
        logger(`[${client.user.tag}] Switched to ${newState.channel?.name || newState.channelId}.`);
      }
    } catch (err) {
      logger(`[VOICE STATE ERROR] ${client.user?.tag}: ${err.message}`);
    }
  });
}

module.exports = { startAccount };