const { SlashCommandBuilder, ChannelType } = require('discord.js');
const BotSetting = require('../../models/BotSetting');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set_knowledge_forum')
        .setDescription('ナレッジ投稿先のフォーラムチャンネルを設定します。')
        .addChannelOption(option =>
            option.setName('forum_channel')
                .setDescription('ナレッジを投稿するフォーラムチャンネル')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildForum)),

    async execute(interaction, client) {
        const forumChannel = interaction.options.getChannel('forum_channel');

        try {
            // MongoDBに設定を保存または更新
            const settingKey = `knowledgeForumChannelId_${interaction.channel.id}`;
            await BotSetting.findOneAndUpdate(
                { key: settingKey },
                { value: forumChannel.id },
                { upsert: true, new: true }
            );

            await interaction.reply({
                content: `ナレッジ投稿先のフォーラムチャンネルを **${forumChannel.name}** に設定しました。`,
                ephemeral: true
            });
        } catch (error) {
            console.error('[set_knowledge_forum] 設定の保存中にエラーが発生しました:', error);
            await interaction.reply({
                content: 'ナレッジ投稿先のフォーラムチャンネルの設定中にエラーが発生しました。' + error.message,
                ephemeral: true
            });
        }
    },
};