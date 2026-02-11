const { connectToVoice } = require("../services/voicePipeline");
const { sendVoiceChat } = require("../services/discordSender");
const { sleep } = require("../utils/parsers");
const logger = require("./logger");

async function startAccount(client, acc) {
  // Flag to prevent overlapping reconnection attempts
  let isReconnecting = false;

  // --- FUNCTION TO EXECUTE MUSIC COMMANDS ---
  const runMusicCommands = async () => {
    if (!acc.sendChat) return;
    try {
      logger(`[${client.user.tag}] Sending music commands...`);
      await sendVoiceChat(client, acc.voiceChannelId, "m!leave");
      await sleep(10000);
      await sendVoiceChat(client, acc.voiceChannelId, acc.playlist);
      await sleep(10000);
      await sendVoiceChat(client, acc.voiceChannelId, "m!lq");
    } catch (err) {
      logger(`[ERROR] Could not send commands for ${client.user.tag}: ${err.message}`);
    }
  };

  // --- RECONNECTION LOGIC ---
  const handleReconnect = async () => {
    if (isReconnecting) return;
    isReconnecting = true;

    logger(`[${client.user.tag}] Voice disconnection detected. Reconnecting in 10s...`);
    
    try {
      await sleep(10000); // 10s cooldown to avoid Discord spam triggers
      await connectToVoice(client, acc);
      await runMusicCommands();
    } catch (err) {
      logger(`[RECONNECT FAILED] ${client.user.tag}: ${err.message}`);
    } finally {
      isReconnecting = false;
    }
  };

  // 1. INITIAL STARTUP
  try {
    await connectToVoice(client, acc);
    if (acc.sendChat) {
      await runMusicCommands();
      // Maintain the periodic command cycle (e.g., every 11 hours)
      setInterval(runMusicCommands, acc.intervalMs);
    }
  } catch (err) {
    logger(`[INITIAL START FAILED] ${client.user.tag}: ${err.message}`);
  }

  // 2. LISTEN FOR VOICE STATE CHANGES (The "Auto-Joiner")
  client.on("voiceStateUpdate", async (oldState, newState) => {
    // Check if the member is the current account and the new channel is null (disconnected)
    if (oldState.member.id === client.user.id && !newState.channelId) {
      await handleReconnect();
    }
  });
}

module.exports = { startAccount };