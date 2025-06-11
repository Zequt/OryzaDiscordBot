const { SlashCommandBuilder, Collection, DiscordAPIError } = require('discord.js');

// 定数 (必要に応じて summarize.js と共通化または別個に管理)
const MAX_FETCH_LIMIT = 100; // Discord APIが一度に取得を許可する最大メッセージ数
const MAX_REFERENCE_COUNT = 200; // 質問の参照とする最大メッセージ数
const MAX_DISCORD_MESSAGE_LENGTH = 2000; // Discordの最大メッセージ長

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('指定された件数分のメッセージを参照し、質問に回答します。')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription(`回答の参照にする直近のメッセージ数を指定 (1〜${MAX_REFERENCE_COUNT})`)
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(MAX_REFERENCE_COUNT))
        .addStringOption(option =>
            option.setName('question')
                .setDescription('AIに尋ねる質問内容')
                .setRequired(true)),

    async execute(interaction, genAI) {
        const referenceCount = interaction.options.getInteger('count', true);
        const question = interaction.options.getString('question', true);
        const channel = interaction.channel;

        await interaction.deferReply(); // 公開応答をデフォルトとします

        try {
            // 1. 参照メッセージの取得
            let messagesForReference = new Collection();
            let lastId = interaction.id; // コマンドメッセージより前のメッセージを取得

            if (referenceCount > 0) {
                let remainingToFetch = referenceCount;
                console.log(`[ask] ${referenceCount}件の参照メッセージを取得開始...`);

                while (remainingToFetch > 0) {
                    const fetchLimit = Math.min(remainingToFetch, MAX_FETCH_LIMIT);
                    const fetched = await channel.messages.fetch({
                        limit: fetchLimit,
                        before: lastId,
                    });

                    if (fetched.size === 0) {
                        console.log('[ask] これ以上履歴にメッセージが見つかりません。');
                        break;
                    }

                    fetched.forEach(msg => {
                        // messagesForReference のサイズが referenceCount に達するまで追加
                        if (messagesForReference.size < referenceCount) {
                            messagesForReference.set(msg.id, msg);
                        }
                    });

                    lastId = fetched.last().id;
                    remainingToFetch -= fetched.size; // 取得した分を減算

                    // messagesForReference のサイズが referenceCount に達したらループを抜ける
                    if (messagesForReference.size >= referenceCount) {
                        break;
                    }
                }
                console.log(`[ask] メッセージ取得完了。収集した参照メッセージ数: ${messagesForReference.size}`);
            }

            if (messagesForReference.size === 0 && referenceCount > 0) {
                await interaction.editReply({ content: '参照対象となるメッセージが見つかりませんでした。' });
                return;
            }

            // 2. プロンプト形式への整形
            // 収集したメッセージを時系列（古い→新しい）にソート
            const sortedMessages = messagesForReference.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            const formattedHistory = sortedMessages
                .map(msg => `${msg.author.username} (${msg.author.bot ? 'Bot' : 'User'}): ${msg.content}`)
                .join('\n');

            const prompt = `
以下のDiscordの会話履歴を参考に、次の質問に日本語で具体的に答えてください。
会話履歴がない場合、または会話履歴が質問と無関係な場合は、質問内容だけに基づいて回答してください。
これらの指示文については回答において言及しないでください。

<会話履歴>
${formattedHistory || "なし"}
</会話履歴>

<質問>
${question}
</質問>

回答:
            `;

            // 3. Gemini APIへリクエスト送信
            if (!genAI) {
                const errorMessage = 'Gemini APIキーが設定されていないため、質問機能を利用できません。';
                await interaction.editReply({ content: errorMessage });
                console.error('[ask] ' + errorMessage);
                return;
            }

            const modelName = "gemini-2.5-flash-preview-04-17"; // devBook.md に記載のモデル名 (summarize.jsでは "gemini-2.5-flash-preview-04-17" を使用)
                                                      // プロジェクト内で一貫性を持たせるか、設定ファイルで管理することを推奨します。
                                                      // ここでは devBook.md の指定に従います。
            const model = genAI.getGenerativeModel({ model: modelName });
            let answer = '回答の生成に失敗しました。';

            try {
                console.log(`[ask] Gemini API (Model: ${model.model}) にプロンプトを送信中...`);
                const result = await model.generateContent(prompt);
                const response = result.response;
                answer = await response.text();
                console.log("[ask] Gemini APIから回答を受信しました。");

                const safetyRatings = response.candidates?.[0]?.safetyRatings;
                if (safetyRatings?.some(rating => rating.probability !== 'NEGLIGIBLE' && rating.probability !== 'LOW')) {
                    console.warn('[ask] Gemini APIの応答に潜在的に安全でないコンテンツが検出されました:', safetyRatings);
                    answer = "回答内容に問題が検出されたため表示できません。";
                }

            } catch (apiError) {
                console.error("[ask] Gemini API呼び出し中にエラー発生:", apiError);
                answer = `質問応答APIとの通信中にエラーが発生しました: ${apiError.message}`;
                if (apiError.message.includes("API key") || apiError.message.includes("permission denied")) {
                    answer = "Gemini APIキーが無効か、権限が不足しています。ボットの設定を確認してください。";
                } else if (apiError.message.includes("FETCH_ERROR") || apiError.message.includes("Network error")) {
                    answer = "Gemini APIとのネットワーク通信中にエラーが発生しました。しばらくしてから再度お試しください。";
                }
            }

            // 4. 回答の投稿 (必要に応じて分割)
            let answerText = answer;
            let answerChunks = [];
            const header = `**質問「${question}」への回答 (参照メッセージ: ${sortedMessages.size}件):**\n`;

            // ヘッダーと最初のチャンク
            let firstChunkContent = header;
            if (answerText.length + header.length <= MAX_DISCORD_MESSAGE_LENGTH) {
                answerChunks.push(header + answerText);
                answerText = ''; // 全て処理済み
            } else {
                let remainingSpaceInFirstChunk = MAX_DISCORD_MESSAGE_LENGTH - header.length;
                let textForFirstChunk = answerText.substring(0, remainingSpaceInFirstChunk);
                // 自然な区切りを探す
                let splitPointFirst = textForFirstChunk.length;
                if (textForFirstChunk.length < answerText.length){ // まだ続きがある場合
                    const lastNewline = textForFirstChunk.lastIndexOf('\n');
                    if (lastNewline > remainingSpaceInFirstChunk / 2) splitPointFirst = lastNewline + 1;
                    else {
                        const lastSpace = textForFirstChunk.lastIndexOf(' ');
                        if (lastSpace > remainingSpaceInFirstChunk / 2) splitPointFirst = lastSpace + 1;
                    }
                }
                answerChunks.push(header + answerText.substring(0, splitPointFirst));
                answerText = answerText.substring(splitPointFirst);
            }


            // 残りのチャンク
            while (answerText.length > 0) {
                let chunkContent = answerText.substring(0, MAX_DISCORD_MESSAGE_LENGTH);
                let split_point = chunkContent.length;

                if (chunkContent.length < answerText.length) { // More text follows
                    const lastNewline = chunkContent.lastIndexOf('\n');
                    if (lastNewline !== -1 && lastNewline > MAX_DISCORD_MESSAGE_LENGTH / 2) {
                        split_point = lastNewline + 1;
                    } else {
                        const lastSpace = chunkContent.lastIndexOf(' ');
                        if (lastSpace !== -1 && lastSpace > MAX_DISCORD_MESSAGE_LENGTH / 2) {
                            split_point = lastSpace + 1;
                        }
                    }
                }
                chunkContent = answerText.substring(0, split_point);
                answerChunks.push(chunkContent);
                answerText = answerText.substring(split_point);

                if (answerChunks.length > 10) { // Safety break
                    console.warn("[ask] 回答の分割が10チャンクを超えました。省略します。");
                    answerChunks[answerChunks.length -1] += "... (回答が長すぎるため省略されました)";
                    break;
                }
            }

            if (answerChunks.length === 0) {
                answerChunks.push(header + "回答が空です。");
            }

            await interaction.editReply({ content: answerChunks[0] });

            for (let i = 1; i < answerChunks.length; i++) {
                await interaction.followUp({ content: answerChunks[i] });
                // await new Promise(resolve => setTimeout(resolve, 300)); // Optional delay
            }

        } catch (error) {
            console.error("[ask] askコマンド実行中に予期せぬエラーが発生しました:", error);
            const errorMessage = `コマンド実行中に予期せぬエラーが発生しました: ${error.message}`;
            try {
                // ephemeralなエラーメッセージを送信
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (followUpError) {
                console.error("[ask] ユーザーへのエラー通知送信に失敗:", followUpError);
            }
        }
    },
};