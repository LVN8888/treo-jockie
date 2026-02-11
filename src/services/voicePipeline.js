const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const logger = require("../core/logger");

async function connectToVoice(client, acc) {
  try {
    const channel = await client.channels.fetch(acc.voiceChannelId);
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: acc.guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: acc.selfDeaf,
      selfMute: acc.selfMute,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    logger(`[${client.user.tag}] Joinned Voice: ${channel.name}`);
    return connection;
  } catch (err) {
    logger(`[VOICE ERR] ${client.user?.tag}: ${err.message}`);
    return null;
  }
}

module.exports = { connectToVoice };