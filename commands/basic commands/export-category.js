const { SlashCommandBuilder, Collection, AttachmentBuilder, ChannelType } = require('discord.js');

// 定数
const MAX_FETCH_LIMIT = 100; // Discord APIが一度に取得を許可する最大メッセージ数
const MAX_MESSAGES_PER_CHANNEL = 1000; // チャンネルあたりの最大メッセージ数
const DELAY_BETWEEN_CHANNELS = 500; // チャンネル間の待機時間（ミリ秒）

module.exports = {
    data: new SlashCommandBuilder()
        .setName('export-category')
        .setDescription('指定したカテゴリー内の全チャンネル・フォーラムのメッセージをCSVファイルとしてエクスポートします。')
        .addStringOption(option =>
            option.setName('category_id')
                .setDescription('エクスポートするカテゴリーのID')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('limit_per_channel')
                .setDescription('チャンネルごとのメッセージ数上限（最大1000、デフォルト500）')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(1000)),

    async execute(interaction, client) {
        const categoryId = interaction.options.getString('category_id');
        const limitPerChannel = interaction.options.getInteger('limit_per_channel') || 500;
        const guild = interaction.guild;

        await interaction.deferReply();

        try {
            // カテゴリーを取得
            const category = guild.channels.cache.get(categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) {
                await interaction.editReply({ content: '指定されたカテゴリーIDが見つからないか、カテゴリーチャンネルではありません。' });
                return;
            }

            console.log(`[export-category] カテゴリー "${category.name}" からメッセージをエクスポート開始...`);

            // カテゴリー内のチャンネルを取得
            const channels = category.children.cache.filter(channel => 
                channel.type === ChannelType.GuildText || 
                channel.type === ChannelType.GuildForum ||
                channel.type === ChannelType.GuildNews ||
                channel.type === ChannelType.PublicThread ||
                channel.type === ChannelType.PrivateThread
            );

            if (channels.size === 0) {
                await interaction.editReply({ content: 'カテゴリー内にエクスポート可能なチャンネルが見つかりませんでした。' });
                return;
            }

            console.log(`[export-category] エクスポート対象チャンネル数: ${channels.size}`);

            let allMessages = [];
            let totalMessageCount = 0;
            let processedChannels = 0;

            // 進捗状況を更新
            await interaction.editReply({ 
                content: `カテゴリー "${category.name}" のエクスポートを開始しています...\n進捗: 0/${channels.size} チャンネル` 
            });

            // 各チャンネルからメッセージを取得
            for (const [channelId, channel] of channels) {
                try {
                    console.log(`[export-category] チャンネル "${channel.name}" を処理中...`);
                    
                    // フォーラムチャンネルの場合は、スレッドも処理
                    if (channel.type === ChannelType.GuildForum) {
                        const forumMessages = await processForumChannel(channel, limitPerChannel);
                        allMessages.push(...forumMessages);
                        totalMessageCount += forumMessages.length;
                    } else {
                        // 通常のテキストチャンネル
                        const channelMessages = await fetchChannelMessages(channel, limitPerChannel);
                        allMessages.push(...channelMessages);
                        totalMessageCount += channelMessages.length;
                    }

                    processedChannels++;
                    
                    // 進捗更新（5チャンネルごと、または最後）
                    if (processedChannels % 5 === 0 || processedChannels === channels.size) {
                        await interaction.editReply({ 
                            content: `カテゴリー "${category.name}" のエクスポート中...\n進捗: ${processedChannels}/${channels.size} チャンネル\n取得メッセージ: ${totalMessageCount}件` 
                        });
                    }

                    // レート制限対策
                    if (processedChannels < channels.size) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHANNELS));
                    }

                } catch (error) {
                    console.error(`[export-category] チャンネル "${channel.name}" の処理中にエラー:`, error);
                    // エラーが発生してもスキップして続行
                }
            }

            console.log(`[export-category] 全チャンネル処理完了。総メッセージ数: ${totalMessageCount}`);

            if (allMessages.length === 0) {
                await interaction.editReply({ content: 'エクスポート対象となるメッセージが見つかりませんでした。' });
                return;
            }

            // メッセージを時系列順でソート
            allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            // CSV生成
            const csvContent = generateCategoryCSV(allMessages, category);

            // CSVファイルを添付として送信
            const attachment = new AttachmentBuilder(
                Buffer.from(csvContent, 'utf-8'),
                { 
                    name: `${category.name}_category_messages_${new Date().toISOString().split('T')[0]}.csv`,
                    description: 'カテゴリー内メッセージのエクスポート'
                }
            );

            const summary = `**カテゴリーメッセージエクスポート完了**\n` +
                          `• カテゴリー: ${category.name}\n` +
                          `• 処理チャンネル数: ${processedChannels}\n` +
                          `• 総メッセージ数: ${allMessages.length}件\n` +
                          `• 期間: ${new Date(allMessages[0].createdTimestamp).toLocaleString('ja-JP')} ～ ${new Date(allMessages[allMessages.length - 1].createdTimestamp).toLocaleString('ja-JP')}\n` +
                          `• ファイル形式: CSV`;

            await interaction.editReply({
                content: summary,
                files: [attachment]
            });

        } catch (error) {
            console.error("[export-category] exportCategoryコマンド実行中に予期せぬエラーが発生しました:", error);
            const errorMessage = `コマンド実行中に予期せぬエラーが発生しました: ${error.message}`;
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: errorMessage });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (followUpError) {
                console.error("[export-category] ユーザーへのエラー通知送信に失敗:", followUpError);
            }
        }
    },
};

/**
 * チャンネルからメッセージを取得
 * @param {Channel} channel - 対象チャンネル
 * @param {number} limit - 取得上限数
 * @returns {Array} メッセージ配列
 */
async function fetchChannelMessages(channel, limit) {
    const messages = [];
    let lastId = null;
    let fetchedCount = 0;

    try {
        while (fetchedCount < limit) {
            const remainingLimit = Math.min(MAX_FETCH_LIMIT, limit - fetchedCount);
            
            const fetchOptions = {
                limit: remainingLimit,
            };

            if (lastId) {
                fetchOptions.before = lastId;
            }

            const fetched = await channel.messages.fetch(fetchOptions);

            if (fetched.size === 0) {
                break;
            }

            fetched.forEach(msg => {
                messages.push({
                    ...msg,
                    channelName: channel.name,
                    channelId: channel.id,
                    channelType: channel.type,
                    categoryName: channel.parent?.name || 'なし',
                    isThread: false,
                    threadName: null
                });
            });

            fetchedCount += fetched.size;
            lastId = fetched.last().id;

            // 短い待機時間
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (error) {
        console.error(`チャンネル "${channel.name}" のメッセージ取得エラー:`, error);
    }

    return messages;
}

/**
 * フォーラムチャンネルとそのスレッドからメッセージを取得
 * @param {Channel} forumChannel - フォーラムチャンネル
 * @param {number} limitPerChannel - チャンネルあたりの取得上限数
 * @returns {Array} メッセージ配列
 */
async function processForumChannel(forumChannel, limitPerChannel) {
    const allMessages = [];

    try {
        // フォーラム内のスレッドを取得
        const threads = await forumChannel.threads.fetchActive();
        const archivedThreads = await forumChannel.threads.fetchArchived();
        
        // アクティブとアーカイブ済みのスレッドを統合
        const allThreads = new Collection([...threads.threads, ...archivedThreads.threads]);

        console.log(`[export-category] フォーラム "${forumChannel.name}" 内のスレッド数: ${allThreads.size}`);

        // 各スレッドからメッセージを取得
        for (const [threadId, thread] of allThreads) {
            try {
                const threadMessages = await fetchChannelMessages(thread, Math.floor(limitPerChannel / Math.max(allThreads.size, 1)));
                
                // スレッド情報を追加
                threadMessages.forEach(msg => {
                    msg.channelName = forumChannel.name;
                    msg.channelId = forumChannel.id;
                    msg.channelType = forumChannel.type;
                    msg.categoryName = forumChannel.parent?.name || 'なし';
                    msg.isThread = true;
                    msg.threadName = thread.name;
                    msg.threadId = thread.id;
                });

                allMessages.push(...threadMessages);
            } catch (error) {
                console.error(`スレッド "${thread.name}" の処理エラー:`, error);
            }
        }
    } catch (error) {
        console.error(`フォーラムチャンネル "${forumChannel.name}" の処理エラー:`, error);
    }

    return allMessages;
}

/**
 * カテゴリー内メッセージをCSV形式に変換
 * @param {Array} messages - メッセージ配列
 * @param {Channel} category - カテゴリーチャンネル
 * @returns {string} CSV形式の文字列
 */
function generateCategoryCSV(messages, category) {
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
        'カテゴリー名',
        'チャンネル名',
        'チャンネルID',
        'チャンネルタイプ',
        'スレッドフラグ',
        'スレッド名',
        'スレッドID'
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
            msg.categoryName,
            msg.channelName,
            msg.channelId,
            getChannelTypeName(msg.channelType),
            msg.isThread ? 'YES' : 'NO',
            msg.threadName || '',
            msg.threadId || ''
        ];

        csvContent += row.map(escapeCSV).join(',') + '\n';
    });

    return csvContent;
}

/**
 * チャンネルタイプを日本語名に変換
 * @param {number} channelType - チャンネルタイプ
 * @returns {string} 日本語のチャンネルタイプ名
 */
function getChannelTypeName(channelType) {
    switch (channelType) {
        case ChannelType.GuildText: return 'テキストチャンネル';
        case ChannelType.GuildForum: return 'フォーラムチャンネル';
        case ChannelType.GuildNews: return 'アナウンスチャンネル';
        case ChannelType.PublicThread: return 'パブリックスレッド';
        case ChannelType.PrivateThread: return 'プライベートスレッド';
        default: return 'その他';
    }
}