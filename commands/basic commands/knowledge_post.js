const { SlashCommandBuilder, Collection, ChannelType } = require('discord.js');
const BotSetting = require('../../models/BotSetting');

// 定数
const MAX_FETCH_LIMIT = 100; // Discord APIが一度に取得を許可する最大メッセージ数
const MAX_DISCORD_MESSAGE_LENGTH = 2000; // Discordの最大メッセージ長

module.exports = {
    data: new SlashCommandBuilder()
        .setName('knowledge_post')
        .setDescription('指定されたメッセージ範囲をAIで要約し、ナレッジとして投稿します。')
        .addStringOption(option =>
            option.setName('start_message_id')
                .setDescription('参照開始するメッセージのID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('end_message_id')
                .setDescription('参照終了するメッセージのID (オプション)')
                .setRequired(false)),

    async execute(interaction, client) {
        const genAI = client.genAI;
        const startMessageId = interaction.options.getString('start_message_id', true);
        const endMessageId = interaction.options.getString('end_message_id', false);
        const channel = interaction.channel;
        
        // MongoDBから現在のチャンネルに対応するナレッジフォーラムチャンネルIDを取得
        const settingKey = `knowledgeForumChannelId_${channel.id}`;
        const botSetting = await BotSetting.findOne({ key: settingKey });

        if (!botSetting || !botSetting.value) {
            await interaction.reply({
                content: 'このチャンネルのナレッジ投稿先のフォーラムチャンネルが設定されていません。`/set_knowledge_forum`コマンドで設定してください。',
                ephemeral: true
            });
            return;
        }
        const knowledgeForumChannelId = botSetting.value;

        await interaction.deferReply(); // 公開応答をデフォルトとします

        try {
            // 1. 指定されたメッセージIDが存在するか確認
            let startMessage;
            try {
                startMessage = await channel.messages.fetch(startMessageId);
            } catch (error) {
                await interaction.editReply({ content: '指定された開始メッセージIDが見つかりません。' });
                return;
            }

            let endMessage = null;
            if (endMessageId) {
                try {
                    endMessage = await channel.messages.fetch(endMessageId);
                } catch (error) {
                    await interaction.editReply({ content: '指定された終了メッセージIDが見つかりません。' });
                    return;
                }
                // 終了メッセージが開始メッセージより古い場合はエラー
                if (endMessage.createdTimestamp < startMessage.createdTimestamp) {
                    await interaction.editReply({ content: '終了メッセージは開始メッセージより新しい必要があります。' });
                    return;
                }
            }

            // 2. 指定されたメッセージ範囲のメッセージを取得
            let messagesForReference = new Collection();
            let lastId = null;
            let reachedEnd = false;
            
            console.log(`[knowledge_post] メッセージID ${startMessageId} から ${endMessageId || '最新'} までのメッセージを取得開始...`);

            // 開始メッセージを追加（ボットメッセージでない場合のみ）
            if (!startMessage.author.bot) {
                messagesForReference.set(startMessage.id, startMessage);
            }

            while (!reachedEnd) {
                const fetched = await channel.messages.fetch({
                    limit: MAX_FETCH_LIMIT,
                    after: lastId || startMessageId,
                });

                if (fetched.size === 0) {
                    console.log('[knowledge_post] これ以上新しいメッセージが見つかりません。');
                    break;
                }

                for (const msg of fetched.values()) {
                    if (endMessageId && msg.id === endMessageId) {
                        if (!msg.author.bot) {
                            messagesForReference.set(msg.id, msg);
                        }
                        reachedEnd = true;
                        break;
                    }
                    // ボット自身のメッセージは除外
                    if (!msg.author.bot) {
                        messagesForReference.set(msg.id, msg);
                    }
                }

                lastId = fetched.last().id; // 取得した最後のメッセージIDを次の開始点にする

                if (endMessageId && messagesForReference.has(endMessageId)) {
                    reachedEnd = true;
                }
            }

            console.log(`[knowledge_post] メッセージ取得完了。収集した参照メッセージ数: ${messagesForReference.size}`);

            if (messagesForReference.size === 0) {
                await interaction.editReply({ content: '参照対象となるメッセージが見つかりませんでした。' });
                return;
            }

            // 2. プロンプト形式への整形
            // 収集したメッセージを時系列（古い→新しい）にソート
            const sortedMessages = messagesForReference.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            const formattedHistory = sortedMessages
                .map(msg => `${msg.author.username}: ${msg.content}`)
                .join('\n');

            const prompt = `以下のDiscordの会話履歴を参考に、ナレッジベースとして後から参照しやすいように、会話形式ではない簡潔な文章にまとめてください。日本語で記述してください。
また、このナレッジにふさわしいタイトルも提案してください。
回答はJSON形式で出力し、"title"と"content"の2つのキーを含めてください。
これらの指示文については回答において言及しないでください。

<会話履歴>
${formattedHistory || "なし"}
</会話履歴>

JSON形式の回答:`;

            // 3. Gemini APIへリクエスト送信
            if (!genAI) {
                const errorMessage = 'Gemini APIキーが設定されていないため、ナレッジ投稿機能を利用できません。';
                await interaction.editReply({ content: errorMessage });
                console.error('[knowledge_post] ' + errorMessage);
                return;
            }

            const modelName = "gemini-2.5-flash-preview-04-17";
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            title: {
                                type: "STRING",
                            },
                            content: {
                                type: "STRING",
                            },
                        },
                        required: ["title", "content"],
                    },
                },
            });
            let knowledgeContent = 'ナレッジの生成に失敗しました。';
            let threadTitle = 'AI生成タイトル';;

            try {
                console.log(`[knowledge_post] Gemini API (Model: ${model.model}) にプロンプトを送信中...`);
                const result = await model.generateContent(prompt);
                const response = result.response;
                const jsonResponse = JSON.parse(response.text());
                threadTitle = jsonResponse.title || 'AI生成タイトル';
                knowledgeContent = jsonResponse.content || 'ナレッジの生成に失敗しました。';
                console.log("[knowledge_post] Gemini APIから回答を受信しました。");

                const safetyRatings = response.candidates?.[0]?.safetyRatings;
                if (safetyRatings?.some(rating => rating.probability !== 'NEGLIGIBLE' && rating.probability !== 'LOW')) {
                    console.warn('[knowledge_post] Gemini APIの応答に潜在的に安全でないコンテンツが検出されました:', safetyRatings);
                    knowledgeContent = "生成されたナレッジ内容に問題が検出されたため表示できません。";
                }

            } catch (apiError) {
                console.error("[knowledge_post] Gemini API呼び出し中にエラー発生:", apiError);
                knowledgeContent = `ナレッジ生成APIとの通信中にエラーが発生しました: ${apiError.message}`;
                if (apiError.message.includes("API key") || apiError.message.includes("permission denied")) {
                    knowledgeContent = "Gemini APIキーが無効か、権限が不足しています。ボットの設定を確認してください。";
                } else if (apiError.message.includes("FETCH_ERROR") || apiError.message.includes("Network error")) {
                    knowledgeContent = "Gemini APIとのネットワーク通信中にエラーが発生しました。しばらくしてから再度お試しください。";
                }
            }

            // 4. ナレッジをフォーラムチャンネルに投稿
            const forumChannel = await client.channels.fetch(knowledgeForumChannelId);
            if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
                await interaction.editReply({ content: '設定されたナレッジ投稿先のチャンネルが見つからないか、フォーラムチャンネルではありません。' });
                return;
            }

            
            const threadContent = knowledgeContent;

            // Discordのメッセージ長制限に合わせて分割して投稿
            let chunks = [];
            let currentChunk = '';

            const lines = threadContent.split('\n');
            for (const line of lines) {
                if ((currentChunk + line + '\n').length <= MAX_DISCORD_MESSAGE_LENGTH) {
                    currentChunk += line + '\n';
                } else {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n';
                }
            }
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
            }

            if (chunks.length === 0) {
                chunks.push("ナレッジ内容が空です。");
            }

            const firstPostContent = chunks[0];

            const newThread = await forumChannel.threads.create({
                name: threadTitle,
                message: {
                    content: firstPostContent
                },
                reason: 'AIによるナレッジ投稿'
            });

            for (let i = 1; i < chunks.length; i++) {
                await newThread.send(chunks[i]);
            }

            await interaction.editReply({
                content: `${newThread.url}`
            });

        } catch (error) {
            console.error("[knowledge_post] knowledge_postコマンド実行中に予期せぬエラーが発生しました:", error);
            const errorMessage = `コマンド実行中に予期せぬエラーが発生しました: ${error.message}`;
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (followUpError) {
                console.error("[knowledge_post] ユーザーへのエラー通知送信に失敗:", followUpError);
            }
        }
    },
};