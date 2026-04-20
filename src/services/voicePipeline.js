const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const logger = require("../core/logger");

async function connectToVoice(client, acc) {
  const channel = await client.channels.fetch(acc.voiceChannelId);

  if (!channel) {
    throw new Error(`Voice channel not found: ${acc.voiceChannelId}`);
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: acc.guildId,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: acc.selfDeaf,
    selfMute: acc.selfMute,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    logger(`[${client.user.tag}] Joined Voice: ${channel.name}`);
    return connection;
  } catch (err) {
    try {
      connection.destroy();
    } catch (_) {}

    logger(`[VOICE ERR] ${client.user?.tag}: ${err.message}`);
    throw err;
  }
}

module.exports = { connectToVoice };