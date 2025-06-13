const { Events } = require('discord.js');
const ReminderManager = require('../../utils/reminderManager');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        // Initialize reminder system
        client.reminderManager = new ReminderManager();
        await client.reminderManager.loadReminders();
        console.log('Reminder system initialized');

        // Check for expired reminders on startup and setup timers
        await checkExpiredReminders(client);
        client.reminderManager.setupReminderTimers(client);
    },
};

async function checkExpiredReminders(client) {
    const expiredReminders = client.reminderManager.getExpiredReminders();
    
    if (expiredReminders.length === 0) return;

    for (const { userId, reminderId, reminder } of expiredReminders) {
        try {
            const channel = await client.channels.fetch(reminder.channelId);
            if (channel) {
                const { EmbedBuilder } = require('discord.js');
                
                const embed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle('🔔 リマインダー（期限切れ）')
                    .setDescription(reminder.message)
                    .addFields({ name: 'リマインダーID', value: reminder.id })
                    .setTimestamp()
                    .setFooter({ text: `リクエスト者: ${(await client.users.fetch(userId)).username}` });

                await channel.send({ content: `<@${userId}>`, embeds: [embed] });
            }
        } catch (error) {
            console.error(`[remind] 期限切れリマインダー送信エラー (ID: ${reminderId}):`, error);
        }
    }

    await client.reminderManager.removeExpiredReminders(expiredReminders);
    console.log(`[remind] ${expiredReminders.length}件の期限切れリマインダーを処理しました`);
}