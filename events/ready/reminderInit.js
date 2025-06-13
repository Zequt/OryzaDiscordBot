const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        // Initialize reminder system based on MongoDB availability
        if (client.config.mongoURI) {
            const ReminderManagerMongo = require('../../utils/reminderManagerMongo');
            client.reminderManager = new ReminderManagerMongo();
            
            // Try to migrate from JSON file if it exists
            await client.reminderManager.migrateFromJson('./data/reminders.json');
            console.log('Reminder system initialized (MongoDB)');
        } else {
            const ReminderManager = require('../../utils/reminderManager');
            client.reminderManager = new ReminderManager();
            console.warn('⚠️  WARNING: Using JSON file storage for reminders');
            console.warn('⚠️  Consider setting MONGO_URI for better data persistence and performance');
            console.log('Reminder system initialized (JSON file)');
        }
        
        await client.reminderManager.loadReminders();

        // Check for expired reminders on startup and setup timers
        await checkExpiredReminders(client);
        client.reminderManager.setupReminderTimers(client);
    },
};

async function checkExpiredReminders(client) {
    try {
        const expiredReminders = await client.reminderManager.getExpiredReminders();
        
        // Ensure expiredReminders is an array
        const expiredArray = Array.isArray(expiredReminders) ? expiredReminders : [];
        
        if (expiredArray.length === 0) return;

        for (const { userId, reminderId, reminder } of expiredArray) {
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

        await client.reminderManager.removeExpiredReminders(expiredArray);
        console.log(`[remind] ${expiredArray.length}件の期限切れリマインダーを処理しました`);
    } catch (error) {
        console.error('[remind] 期限切れリマインダーチェック中にエラー:', error);
    }
}