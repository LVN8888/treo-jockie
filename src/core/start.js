const { connectToVoice } = require("../services/voicePipeline");
const { sendVoiceChat } = require("../services/discordSender");
const { sleep } = require("../utils/parsers");
const logger = require("./logger");

async function startAccount(client, acc) {
  let isReconnecting = false;
  let musicInterval = null; 

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

  const handleReconnect = async () => {
    if (isReconnecting) return;
    isReconnecting = true;
    
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }

    logger(`[${client.user.tag}] Fully disconnected from voice. Reconnecting in 5s...`);
    
    try {
      await sleep(5000);
      await connectToVoice(client, acc);
      
      if (acc.sendChat) {
        await runMusicCommands();
        musicInterval = setInterval(runMusicCommands, acc.intervalMs);
      }
    } catch (err) {
      logger(`[RECONNECT FAILED] ${client.user.tag}: ${err.message}`);
    } finally {
      isReconnecting = false;
    }
  };

  try {

    await connectToVoice(client, acc);
    
    if (acc.sendChat) {
      await runMusicCommands();
      musicInterval = setInterval(runMusicCommands, acc.intervalMs);
    }
  } catch (err) {
    logger(`[INITIAL START FAILED] ${client.user.tag}: ${err.message}`);
  }

  client.on("voiceStateUpdate", async (oldState, newState) => {
    if (oldState.guild.id !== acc.guildId) return;
    
    if (oldState.member.id === client.user.id) {
      if (!newState.channelId) {
        await handleReconnect();
      } else if (oldState.channelId !== newState.channelId) {
        logger(`[${client.user.tag}] Moved to a different channel (${newState.channel.name}). Staying put.`);
      }
    }
  });
}

module.exports = { startAccount };