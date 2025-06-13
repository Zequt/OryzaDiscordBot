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
                        .setDescription('リマインダーの時間（例: 30m, 1d3h50m, 14:30, 6:13:14:30）')
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

    const result = parseTimeString(timeStr);
    if (!result) {
        await interaction.reply({
            content: '無効な時間形式です。例: 30m（30分）, 1d3h50m（組み合わせ）, 14:30（時刻指定）, 6:13:14:30（日付時刻指定）',
            ephemeral: true
        });
        return;
    }

    const { milliseconds, isAbsoluteTime } = result;

    let remindTime;
    if (isAbsoluteTime) {
        remindTime = milliseconds;
        const delay = remindTime - Date.now();
        if (delay <= 0) {
            await interaction.reply({
                content: '指定された時刻は既に過ぎています。',
                ephemeral: true
            });
            return;
        }
        if (delay > 7 * 24 * 60 * 60 * 1000) {
            await interaction.reply({
                content: 'リマインダーは最大7日間まで設定できます。',
                ephemeral: true
            });
            return;
        }
    } else {
        if (milliseconds > 7 * 24 * 60 * 60 * 1000) {
            await interaction.reply({
                content: 'リマインダーは最大7日間まで設定できます。',
                ephemeral: true
            });
            return;
        }
        remindTime = Date.now() + milliseconds;
    }
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

        const delay = isAbsoluteTime ? remindTime - Date.now() : milliseconds;
        setTimeout(async () => {
            await client.reminderManager.sendReminder(client, userId, reminderId);
        }, delay);

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
    try {
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
    } catch (error) {
        console.error('[remind] リマインダー一覧表示エラー:', error);
        await interaction.reply({
            content: 'リマインダーの一覧表示中にエラーが発生しました。',
            ephemeral: true
        });
    }
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
    // 日付+時刻指定パターン (M:D:HH:MM)
    const dateTimeRegex = /^(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{2})$/;
    const dateTimeMatch = timeStr.match(dateTimeRegex);
    
    if (dateTimeMatch) {
        const month = parseInt(dateTimeMatch[1]);
        const day = parseInt(dateTimeMatch[2]);
        const hours = parseInt(dateTimeMatch[3]);
        const minutes = parseInt(dateTimeMatch[4]);
        
        // バリデーション
        if (month < 1 || month > 12 || day < 1 || day > 31 || 
            hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
        }
        
        const now = new Date();
        const targetTime = new Date(now.getFullYear(), month - 1, day, hours, minutes, 0, 0);
        
        // 指定日時が過去の場合は翌年に設定
        if (targetTime <= now) {
            targetTime.setFullYear(targetTime.getFullYear() + 1);
        }
        
        // 月末日チェック
        if (targetTime.getMonth() !== month - 1) {
            return null; // 無効な日付（例：2月31日）
        }
        
        return {
            milliseconds: targetTime.getTime(),
            isAbsoluteTime: true
        };
    }
    
    // 時刻指定パターン (HH:MM)
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    const timeMatch = timeStr.match(timeRegex);
    
    if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
        }
        
        const now = new Date();
        const targetTime = new Date();
        targetTime.setHours(hours, minutes, 0, 0);
        
        // 指定時刻が現在時刻より前の場合、翌日に設定
        if (targetTime <= now) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
        
        return {
            milliseconds: targetTime.getTime(),
            isAbsoluteTime: true
        };
    }
    
    // 時間組み合わせパターン (1d3h50m, 2h30m, etc.)
    const combinedRegex = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;
    const combinedMatch = timeStr.match(combinedRegex);
    
    if (combinedMatch && combinedMatch[0] === timeStr) {
        const days = parseInt(combinedMatch[1]) || 0;
        const hours = parseInt(combinedMatch[2]) || 0;
        const minutes = parseInt(combinedMatch[3]) || 0;
        const seconds = parseInt(combinedMatch[4]) || 0;
        
        // 全部0の場合は無効
        if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
            return null;
        }
        
        const totalMilliseconds = 
            (days * 24 * 60 * 60 * 1000) +
            (hours * 60 * 60 * 1000) +
            (minutes * 60 * 1000) +
            (seconds * 1000);
        
        return {
            milliseconds: totalMilliseconds,
            isAbsoluteTime: false
        };
    }
    
    // 単一の相対時間パターン (30m, 2h, etc.)
    const relativeRegex = /^(\d+)([smhd])$/i;
    const relativeMatch = timeStr.match(relativeRegex);

    if (!relativeMatch) return null;

    const value = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();

    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };

    return {
        milliseconds: value * multipliers[unit],
        isAbsoluteTime: false
    };
}