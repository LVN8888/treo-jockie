const { connectToVoice } = require("../services/voicePipeline");
const { sendVoiceChat } = require("../services/discordSender");
const { sleep } = require("../utils/parsers");
const logger = require("./logger");

async function startAccount(client, acc) {
  let isReconnecting = false;
  let musicLoopRunning = false;
  let stopMusicLoop = false;

  const runMusicCommands = async () => {
    if (!acc.sendChat) return;

    try {
      logger(`[${client.user.tag}] Sending music commands...`);
      await sendVoiceChat(client, acc.voiceChannelId, "m!leave");
      await sleep(5000);
      await sendVoiceChat(client, acc.voiceChannelId, "m!p " + acc.playlist);
      await sleep(5000);
      await sendVoiceChat(client, acc.voiceChannelId, "m!lq");
    } catch (err) {
      logger(`[ERROR] Command failed for ${client.user.tag}: ${err.message}`);
    }
  };

  const startMusicLoop = async () => {
    if (!acc.sendChat || musicLoopRunning) return;

    musicLoopRunning = true;
    stopMusicLoop = false;

    while (!stopMusicLoop) {
      await sleep(acc.intervalMs);

      if (stopMusicLoop) break;

      try {
        await runMusicCommands();
      } catch (err) {
        logger(`[MUSIC LOOP ERROR] ${client.user.tag}: ${err.message}`);
      }
    }

    musicLoopRunning = false;
  };

  const stopLoop = () => {
    stopMusicLoop = true;
  };

  const handleReconnect = async () => {
    if (isReconnecting) return;
    isReconnecting = true;

    stopLoop();

    logger(`[${client.user.tag}] Voice disconnected. Reconnecting in 10s...`);

    while (true) {
      try {
        await sleep(10000);
        await connectToVoice(client, acc);

        logger(`[${client.user.tag}] Reconnected successfully.`);

        if (acc.sendChat) {
          await runMusicCommands();
          startMusicLoop();
        }

        break;
      } catch (err) {
        logger(`[RECONNECT FAILED] ${client.user.tag}: ${err.message}`);
      }
    }

    isReconnecting = false;
  };

  try {
    await connectToVoice(client, acc);

    if (acc.sendChat) {
      await runMusicCommands();
      startMusicLoop();
    }
  } catch (err) {
    logger(`[INITIAL START FAILED] ${client.user.tag}: ${err.message}`);
    handleReconnect();
  }

  client.on("voiceStateUpdate", async (oldState, newState) => {
    if (oldState.guild.id !== acc.guildId) return;
    if (oldState.member.id !== client.user.id) return;

    if (!newState.channelId) {
      await handleReconnect();
    } else if (oldState.channelId !== newState.channelId) {
      logger(`[${client.user.tag}] Switched to ${newState.channel?.name}.`);
    }
  });
}

module.exports = { startAccount };