const fs = require('fs').promises;
const path = require('path');

class ReminderManager {
    constructor() {
        this.filePath = path.join(__dirname, '..', 'data', 'reminders.json');
        this.reminders = new Map();
    }

    async loadReminders() {
        try {
            await this.ensureDataDirectory();
            const data = await fs.readFile(this.filePath, 'utf8');
            const reminderData = JSON.parse(data);
            
            this.reminders.clear();
            for (const [userId, userReminders] of Object.entries(reminderData)) {
                const userReminderMap = new Map();
                for (const [reminderId, reminder] of Object.entries(userReminders)) {
                    userReminderMap.set(reminderId, reminder);
                }
                this.reminders.set(userId, userReminderMap);
            }
            
            console.log(`[ReminderManager] ${this.getTotalReminderCount()}件のリマインダーを読み込みました`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('[ReminderManager] リマインダーファイルが見つかりません。新規作成します。');
                await this.saveReminders();
            } else {
                console.error('[ReminderManager] リマインダー読み込みエラー:', error);
            }
        }
    }

    async saveReminders() {
        try {
            await this.ensureDataDirectory();
            
            const reminderData = {};
            for (const [userId, userReminders] of this.reminders) {
                const userReminderObj = {};
                for (const [reminderId, reminder] of userReminders) {
                    userReminderObj[reminderId] = reminder;
                }
                reminderData[userId] = userReminderObj;
            }
            
            await fs.writeFile(this.filePath, JSON.stringify(reminderData, null, 2), 'utf8');
            console.log(`[ReminderManager] ${this.getTotalReminderCount()}件のリマインダーを保存しました`);
        } catch (error) {
            console.error('[ReminderManager] リマインダー保存エラー:', error);
            throw error;
        }
    }

    async ensureDataDirectory() {
        const dataDir = path.dirname(this.filePath);
        try {
            await fs.access(dataDir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dataDir, { recursive: true });
                console.log('[ReminderManager] dataディレクトリを作成しました');
            }
        }
    }

    getUserReminders(userId) {
        if (!this.reminders.has(userId)) {
            this.reminders.set(userId, new Map());
        }
        return this.reminders.get(userId);
    }

    async addReminder(userId, reminderId, reminder) {
        const userReminders = this.getUserReminders(userId);
        userReminders.set(reminderId, reminder);
        await this.saveReminders();
    }

    async deleteReminder(userId, reminderId) {
        const userReminders = this.reminders.get(userId);
        if (userReminders) {
            userReminders.delete(reminderId);
            if (userReminders.size === 0) {
                this.reminders.delete(userId);
            }
            await this.saveReminders();
            return true;
        }
        return false;
    }

    getExpiredReminders() {
        const now = Date.now();
        const expiredReminders = [];

        for (const [userId, userReminders] of this.reminders) {
            for (const [reminderId, reminder] of userReminders) {
                if (reminder.time <= now) {
                    expiredReminders.push({ userId, reminderId, reminder });
                }
            }
        }

        return expiredReminders;
    }

    async removeExpiredReminders(expiredReminders) {
        let needsSave = false;

        for (const { userId, reminderId } of expiredReminders) {
            const userReminders = this.reminders.get(userId);
            if (userReminders) {
                userReminders.delete(reminderId);
                if (userReminders.size === 0) {
                    this.reminders.delete(userId);
                }
                needsSave = true;
            }
        }

        if (needsSave) {
            await this.saveReminders();
        }
    }

    getTotalReminderCount() {
        let count = 0;
        for (const userReminders of this.reminders.values()) {
            count += userReminders.size;
        }
        return count;
    }

    setupReminderTimers(client) {
        for (const [userId, userReminders] of this.reminders) {
            for (const [reminderId, reminder] of userReminders) {
                const delay = reminder.time - Date.now();
                if (delay > 0) {
                    setTimeout(async () => {
                        await this.sendReminder(client, userId, reminderId);
                    }, delay);
                }
            }
        }
    }

    async sendReminder(client, userId, reminderId) {
        const userReminders = this.reminders.get(userId);
        if (!userReminders || !userReminders.has(reminderId)) {
            return;
        }

        const reminder = userReminders.get(reminderId);
        
        try {
            const channel = await client.channels.fetch(reminder.channelId);
            if (!channel) {
                console.warn(`[ReminderManager] チャンネル ${reminder.channelId} が見つかりません`);
                return;
            }

            const { EmbedBuilder } = require('discord.js');
            
            let mentionUserId = reminder.mentionUserId || userId;
            
            try {
                await client.users.fetch(mentionUserId);
            } catch (error) {
                console.warn(`[ReminderManager] メンション対象ユーザー ${mentionUserId} が見つかりません。作成者にフォールバック。`);
                mentionUserId = userId;
            }
            
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🔔 リマインダー')
                .setDescription(reminder.message)
                .addFields({ name: 'リマインダーID', value: reminder.id })
                .setTimestamp()
                .setFooter({ text: `リクエスト者: ${(await client.users.fetch(userId)).username}` });

            await channel.send({ content: `<@${mentionUserId}>`, embeds: [embed] });
            
            // リマインダーを削除
            await this.deleteReminder(userId, reminderId);
            
        } catch (error) {
            console.error(`[ReminderManager] リマインダー送信エラー (ID: ${reminderId}):`, error);
        }
    }
}

module.exports = ReminderManager;