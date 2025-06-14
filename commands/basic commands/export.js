const { SlashCommandBuilder, Collection, AttachmentBuilder } = require('discord.js');

// 定数
const MAX_FETCH_LIMIT = 100; // Discord APIが一度に取得を許可する最大メッセージ数
const MAX_MESSAGES_TO_EXPORT = 10000; // 一度にエクスポートする最大メッセージ数

module.exports = {
    data: new SlashCommandBuilder()
        .setName('export')
        .setDescription('チャンネルのメッセージをCSVファイルとしてエクスポートします。')
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('エクスポート開始するメッセージのID（省略すると全メッセージ）')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('エクスポートするメッセージ数の上限（最大10000、デフォルト1000）')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10000)),

    async execute(interaction, client) {
        const messageId = interaction.options.getString('message_id');
        const limit = interaction.options.getInteger('limit') || 1000;
        const channel = interaction.channel;

        await interaction.deferReply();

        try {
            console.log(`[export] チャンネル "${channel.name}" からメッセージをエクスポート開始...`);

            let messagesForExport = new Collection();
            let lastId = null;
            let fetchedCount = 0;

            // 指定されたメッセージIDが存在するか確認（指定されている場合）
            if (messageId) {
                try {
                    await channel.messages.fetch(messageId);
                    console.log(`[export] 開始メッセージID ${messageId} を確認しました`);
                } catch (error) {
                    await interaction.editReply({ content: '指定されたメッセージIDが見つかりません。' });
                    return;
                }
            }

            // メッセージ取得ループ
            while (fetchedCount < limit) {
                const remainingLimit = Math.min(MAX_FETCH_LIMIT, limit - fetchedCount);
                
                const fetchOptions = {
                    limit: remainingLimit,
                };

                if (messageId && !lastId) {
                    // 初回かつ開始IDが指定されている場合
                    fetchOptions.after = messageId;
                } else if (lastId) {
                    // 2回目以降
                    fetchOptions.before = lastId;
                }

                const fetched = await channel.messages.fetch(fetchOptions);

                if (fetched.size === 0) {
                    console.log('[export] これ以上メッセージが見つかりません。');
                    break;
                }

                fetched.forEach(msg => {
                    messagesForExport.set(msg.id, msg);
                });

                fetchedCount += fetched.size;
                lastId = fetched.last().id;

                console.log(`[export] ${fetchedCount} / ${limit} メッセージを取得しました`);

                // レート制限対策で少し待機
                if (fetchedCount < limit && fetched.size === remainingLimit) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            console.log(`[export] メッセージ取得完了。総メッセージ数: ${messagesForExport.size}`);

            if (messagesForExport.size === 0) {
                await interaction.editReply({ content: 'エクスポート対象となるメッセージが見つかりませんでした。' });
                return;
            }

            // メッセージを時系列順（古い→新しい）でソート
            const sortedMessages = messagesForExport.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            // CSV生成
            const csvContent = generateCSV(sortedMessages, channel);

            // CSVファイルを添付として送信
            const attachment = new AttachmentBuilder(
                Buffer.from(csvContent, 'utf-8'),
                { 
                    name: `${channel.name}_messages_${new Date().toISOString().split('T')[0]}.csv`,
                    description: 'チャンネルメッセージのエクスポート'
                }
            );

            const summary = `**メッセージエクスポート完了**\n` +
                          `• チャンネル: ${channel.name}\n` +
                          `• エクスポート件数: ${sortedMessages.size}件\n` +
                          `• 期間: ${new Date(sortedMessages.first().createdTimestamp).toLocaleString('ja-JP')} ～ ${new Date(sortedMessages.last().createdTimestamp).toLocaleString('ja-JP')}\n` +
                          `• ファイル形式: CSV`;

            await interaction.editReply({
                content: summary,
                files: [attachment]
            });

        } catch (error) {
            console.error("[export] exportコマンド実行中に予期せぬエラーが発生しました:", error);
            const errorMessage = `コマンド実行中に予期せぬエラーが発生しました: ${error.message}`;
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: errorMessage });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (followUpError) {
                console.error("[export] ユーザーへのエラー通知送信に失敗:", followUpError);
            }
        }
    },
};

/**
 * メッセージコレクションをCSV形式に変換
 * @param {Collection} messages - ソート済みメッセージコレクション
 * @param {Channel} channel - チャンネルオブジェクト
 * @returns {string} CSV形式の文字列
 */
function generateCSV(messages, channel) {
    // CSVヘッダー
    const headers = [
        'メッセージID',
        'ユーザー名',
        'ユーザーID',
        'ユーザータイプ',
        '投稿日時',
        'メッセージ内容',
        '添付ファイル数',
        '添付ファイルURL',
        'リアクション数',
        'リアクション詳細',
        'リプライ先ID',
        'スレッドID',
        'チャンネル名',
        'チャンネルID'
    ];

    // CSVエスケープ関数
    const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    // ヘッダー行
    let csvContent = headers.map(escapeCSV).join(',') + '\n';

    // データ行
    messages.forEach(msg => {
        const row = [
            msg.id,
            msg.author.username,
            msg.author.id,
            msg.author.bot ? 'Bot' : 'User',
            new Date(msg.createdTimestamp).toISOString(),
            msg.content.replace(/\n/g, '\\n'), // 改行をエスケープ
            msg.attachments.size,
            msg.attachments.map(att => att.url).join(' | '),
            msg.reactions.cache.size,
            msg.reactions.cache.map(reaction => `${reaction.emoji.name}:${reaction.count}`).join(' | '),
            msg.reference?.messageId || '',
            msg.thread?.id || '',
            channel.name,
            channel.id
        ];

        csvContent += row.map(escapeCSV).join(',') + '\n';
    });

    return csvContent;
}