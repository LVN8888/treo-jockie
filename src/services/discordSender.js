const logger = require("../core/logger");

async function sendVoiceChat(client, channelId, content) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return logger(`[ERROR] Channel not found ${channelId}`);
    
    await channel.send(content);
    logger(`[${client.user.tag}] Send command successfully: ${content}`);
  } catch (e) {
    logger(`[ERROR] Error while sending message (${client.user.tag}): ${e.message}`);
  }
}

module.exports = { sendVoiceChat };