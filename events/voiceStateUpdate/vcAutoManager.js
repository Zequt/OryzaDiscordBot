const { ChannelType, PermissionFlagsBits } = require('discord.js');

// 🎤 Botが作成するVC名のプレフィックス
const BOT_VC_PREFIX = '🎤│VC-';

// ✅ 対象VCを判定：Botが作ったVC以外のすべてのVCが対象
function isWaitingVC(channel) {
  return (
    channel &&
    channel.type === ChannelType.GuildVoice &&
    !channel.name.startsWith(BOT_VC_PREFIX)
  );
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState.guild;

    // ✅ ユーザーがVCに参加した時
    if (!oldState.channel && newState.channel) {
      const waitingChannel = newState.channel;

      if (isWaitingVC(waitingChannel)) {
        const category = waitingChannel.parent;

        // 既に空いてるBot作成VCがあるならそこに移動
        const existingBotVC = guild.channels.cache.find(
          (c) =>
            c.parentId === category?.id &&
            c.type === ChannelType.GuildVoice &&
            c.name.startsWith(BOT_VC_PREFIX) &&
            c.members.size === 0
        );

        if (existingBotVC) {
          await newState.setChannel(existingBotVC);
          return;
        }

        // Bot用VCを新規作成
        const newVC = await guild.channels.create({
          name: `${BOT_VC_PREFIX}${newState.member.displayName}`,
          type: ChannelType.GuildVoice,
          parent: category ?? null,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [PermissionFlagsBits.Connect],
            },
          ],
        });

        // VCに移動させる
        await newState.setChannel(newVC);
      }
    }

    // ✅ VC退出時に自動削除（Botが作ったVCだけ）
    if (oldState.channel && !newState.channel) {
      const oldChannel = oldState.channel;

      if (
        oldChannel.name.startsWith(BOT_VC_PREFIX) &&
        oldChannel.members.size === 0
      ) {
        try {
          await oldChannel.delete('VC自動削除：無人になったため');
        } catch (e) {
          console.error('VC削除に失敗:', e);
        }
      }
    }
  },
};
