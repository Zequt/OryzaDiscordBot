const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('リマインダーを設定・管理します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('新しいリマインダーを設定します')
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('リマインダーの時間（例: 30m, 2h, 1d）')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('リマインダーのメッセージ')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('設定されているリマインダーの一覧を表示します'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('リマインダーを削除します')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('削除するリマインダーのID')
                        .setRequired(true))),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        switch (subcommand) {
            case 'set':
                await handleSetReminder(interaction, client, userId);
                break;
            case 'list':
                await handleListReminders(interaction, client, userId);
                break;
            case 'delete':
                await handleDeleteReminder(interaction, client, userId);
                break;
        }
    },
};

async function handleSetReminder(interaction, client, userId) {
    const timeStr = interaction.options.getString('time');
    const message = interaction.options.getString('message');

    const milliseconds = parseTimeString(timeStr);
    if (!milliseconds) {
        await interaction.reply({
            content: '無効な時間形式です。例: 30m（30分）, 2h（2時間）, 1d（1日）',
            ephemeral: true
        });
        return;
    }

    if (milliseconds > 7 * 24 * 60 * 60 * 1000) {
        await interaction.reply({
            content: 'リマインダーは最大7日間まで設定できます。',
            ephemeral: true
        });
        return;
    }

    const remindTime = Date.now() + milliseconds;
    const reminderId = Date.now().toString();

    const reminder = {
        id: reminderId,
        message,
        time: remindTime,
        channelId: interaction.channelId,
        guildId: interaction.guildId
    };

    try {
        await client.reminderManager.addReminder(userId, reminderId, reminder);

        setTimeout(async () => {
            await client.reminderManager.sendReminder(client, userId, reminderId);
        }, milliseconds);

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('リマインダーが設定されました')
            .addFields(
                { name: 'メッセージ', value: message },
                { name: '時間', value: `<t:${Math.floor(remindTime / 1000)}:R>` },
                { name: 'ID', value: reminderId }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[remind] リマインダー設定エラー:', error);
        await interaction.reply({
            content: 'リマインダーの設定中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

async function handleListReminders(interaction, client, userId) {
    const userReminders = client.reminderManager.getUserReminders(userId);

    if (!userReminders || userReminders.size === 0) {
        await interaction.reply({
            content: '設定されているリマインダーはありません。',
            ephemeral: true
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('設定中のリマインダー')
        .setTimestamp();

    const sortedReminders = Array.from(userReminders.values())
        .sort((a, b) => a.time - b.time);

    sortedReminders.forEach((reminder, index) => {
        embed.addFields({
            name: `ID: ${reminder.id}`,
            value: `**メッセージ:** ${reminder.message}\n**時間:** <t:${Math.floor(reminder.time / 1000)}:R>`,
            inline: false
        });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDeleteReminder(interaction, client, userId) {
    const reminderId = interaction.options.getInteger('id').toString();
    const userReminders = client.reminderManager.getUserReminders(userId);

    if (!userReminders || !userReminders.has(reminderId)) {
        await interaction.reply({
            content: '指定されたIDのリマインダーが見つかりません。',
            ephemeral: true
        });
        return;
    }

    const reminder = userReminders.get(reminderId);
    
    try {
        await client.reminderManager.deleteReminder(userId, reminderId);

        const embed = new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle('リマインダーが削除されました')
            .addFields(
                { name: 'メッセージ', value: reminder.message },
                { name: 'ID', value: reminderId }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('[remind] リマインダー削除エラー:', error);
        await interaction.reply({
            content: 'リマインダーの削除中にエラーが発生しました。',
            ephemeral: true
        });
    }
}


function parseTimeString(timeStr) {
    const regex = /^(\d+)([smhd])$/i;
    const match = timeStr.match(regex);

    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };

    return value * multipliers[unit];
}