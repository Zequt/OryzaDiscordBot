const Reminder = require('../models/Reminder');

class ReminderManagerMongo {
    constructor() {
        // No file-based operations needed for MongoDB
    }

    async loadReminders() {
        try {
            const reminderCount = await Reminder.countDocuments();
            console.log(`[ReminderManager] MongoDB: ${reminderCount}件のリマインダーが存在します`);
            
            // Setup timers for existing reminders
            const activeReminders = await Reminder.find({ time: { $gt: new Date() } });
            console.log(`[ReminderManager] ${activeReminders.length}件のアクティブなリマインダーのタイマーを設定します`);
            
            return true;
        } catch (error) {
            console.error('[ReminderManager] MongoDB読み込みエラー:', error);
            return false;
        }
    }

    async getUserReminders(userId) {
        try {
            const reminders = await Reminder.find({ userId: userId, time: { $gt: new Date() } })
                .sort({ time: 1 });
            
            // Convert to Map for compatibility with existing code
            const reminderMap = new Map();
            reminders.forEach(reminder => {
                reminderMap.set(reminder.id, {
                    id: reminder.id,
                    message: reminder.message,
                    time: reminder.time.getTime(),
                    channelId: reminder.channelId,
                    guildId: reminder.guildId,
                    mentionUserId: reminder.mentionUserId
                });
            });
            
            return reminderMap;
        } catch (error) {
            console.error('[ReminderManager] ユーザーリマインダー取得エラー:', error);
            return new Map();
        }
    }

    async addReminder(userId, reminderId, reminder) {
        try {
            const newReminder = new Reminder({
                id: reminderId,
                userId: userId,
                message: reminder.message,
                time: new Date(reminder.time),
                channelId: reminder.channelId,
                guildId: reminder.guildId,
                mentionUserId: reminder.mentionUserId
            });
            
            await newReminder.save();
            console.log(`[ReminderManager] リマインダーを保存しました: ${reminderId}`);
            return true;
        } catch (error) {
            console.error('[ReminderManager] リマインダー保存エラー:', error);
            throw error;
        }
    }

    async deleteReminder(userId, reminderId) {
        try {
            const result = await Reminder.deleteOne({ id: reminderId, userId: userId });
            if (result.deletedCount > 0) {
                console.log(`[ReminderManager] リマインダーを削除しました: ${reminderId}`);
                return true;
            } else {
                console.log(`[ReminderManager] 削除対象のリマインダーが見つかりませんでした: ${reminderId}`);
                return false;
            }
        } catch (error) {
            console.error('[ReminderManager] リマインダー削除エラー:', error);
            throw error;
        }
    }

    async getExpiredReminders() {
        try {
            const now = new Date();
            const expiredReminders = await Reminder.find({ time: { $lte: now } });
            
            return expiredReminders.map(reminder => ({
                userId: reminder.userId,
                reminderId: reminder.id,
                reminder: {
                    id: reminder.id,
                    message: reminder.message,
                    time: reminder.time.getTime(),
                    channelId: reminder.channelId,
                    guildId: reminder.guildId,
                    mentionUserId: reminder.mentionUserId
                }
            }));
        } catch (error) {
            console.error('[ReminderManager] 期限切れリマインダー取得エラー:', error);
            return [];
        }
    }

    async removeExpiredReminders(expiredReminders) {
        try {
            const reminderIds = expiredReminders.map(r => r.reminderId);
            const result = await Reminder.deleteMany({ id: { $in: reminderIds } });
            console.log(`[ReminderManager] ${result.deletedCount}件の期限切れリマインダーを削除しました`);
            return true;
        } catch (error) {
            console.error('[ReminderManager] 期限切れリマインダー削除エラー:', error);
            return false;
        }
    }

    async getTotalReminderCount() {
        try {
            return await Reminder.countDocuments();
        } catch (error) {
            console.error('[ReminderManager] リマインダー数取得エラー:', error);
            return 0;
        }
    }

    async setupReminderTimers(client) {
        try {
            const activeReminders = await Reminder.find({ time: { $gt: new Date() } });
            
            for (const reminder of activeReminders) {
                const delay = reminder.time.getTime() - Date.now();
                if (delay > 0) {
                    setTimeout(async () => {
                        await this.sendReminder(client, reminder.userId, reminder.id);
                    }, delay);
                }
            }
            
            console.log(`[ReminderManager] ${activeReminders.length}件のリマインダータイマーを設定しました`);
        } catch (error) {
            console.error('[ReminderManager] タイマー設定エラー:', error);
        }
    }

    async sendReminder(client, userId, reminderId) {
        try {
            const reminder = await Reminder.findOne({ id: reminderId });
            if (!reminder) {
                console.log(`[ReminderManager] リマインダーが見つかりません: ${reminderId}`);
                return;
            }

            const channel = await client.channels.fetch(reminder.channelId);
            if (!channel) {
                console.warn(`[ReminderManager] チャンネル ${reminder.channelId} が見つかりません`);
                await this.deleteReminder(userId, reminderId);
                return;
            }

            const { EmbedBuilder } = require('discord.js');
            
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🔔 リマインダー')
                .setDescription(reminder.message)
                .addFields({ name: 'リマインダーID', value: reminder.id })
                .setTimestamp()
                .setFooter({ text: `リクエスト者: ${(await client.users.fetch(userId)).username}` });

            await channel.send({ content: `<@${reminder.mentionUserId || userId}>`, embeds: [embed] });
            
            // リマインダーを削除
            await this.deleteReminder(userId, reminderId);
            
        } catch (error) {
            console.error(`[ReminderManager] リマインダー送信エラー (ID: ${reminderId}):`, error);
        }
    }

    // Migration function from JSON to MongoDB
    async migrateFromJson(jsonFilePath) {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            const filePath = path.resolve(jsonFilePath);
            const data = await fs.readFile(filePath, 'utf8');
            const reminderData = JSON.parse(data);
            
            let migratedCount = 0;
            
            for (const [userId, userReminders] of Object.entries(reminderData)) {
                for (const [reminderId, reminder] of Object.entries(userReminders)) {
                    try {
                        // Check if reminder already exists
                        const existingReminder = await Reminder.findOne({ id: reminderId });
                        if (!existingReminder) {
                            await this.addReminder(userId, reminderId, {
                                message: reminder.message,
                                time: reminder.time,
                                channelId: reminder.channelId,
                                guildId: reminder.guildId,
                                mentionUserId: reminder.mentionUserId
                            });
                            migratedCount++;
                        }
                    } catch (error) {
                        console.error(`[ReminderManager] 移行エラー (ID: ${reminderId}):`, error);
                    }
                }
            }
            
            console.log(`[ReminderManager] ${migratedCount}件のリマインダーをMongoDBに移行しました`);
            return migratedCount;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('[ReminderManager] JSONファイルが見つかりません。移行をスキップします。');
                return 0;
            }
            console.error('[ReminderManager] JSON移行エラー:', error);
            return 0;
        }
    }
}

module.exports = ReminderManagerMongo;