const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ytdl = require('ytdl-core');

// 定数
const MAX_DISCORD_MESSAGE_LENGTH = 2000;
const MAX_SUMMARY_LENGTH = 1500; // 要約の最大文字数

module.exports = {
    data: new SlashCommandBuilder()
        .setName('youtube-summary')
        .setDescription('YouTube動画の字幕を取得して構造的に要約します')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('YouTube動画のURL')
                .setRequired(true)),

    async execute(interaction, client) {
        const genAI = client.genAI;
        const url = interaction.options.getString('url', true);

        await interaction.deferReply();

        try {
            // 1. URLの検証
            if (!ytdl.validateURL(url)) {
                await interaction.editReply({ content: '❌ 有効なYouTube URLではありません。' });
                return;
            }

            // 2. 動画情報の取得
            console.log(`[youtube-summary] YouTube動画情報を取得中: ${url}`);
            const videoInfo = await ytdl.getInfo(url);
            const videoDetails = videoInfo.videoDetails;
            
            if (!videoDetails) {
                await interaction.editReply({ content: '❌ 動画情報の取得に失敗しました。' });
                return;
            }

            // 3. 字幕の取得
            console.log(`[youtube-summary] 字幕を取得中...`);
            let captions = null;
            
            try {
                // 利用可能な字幕トラックを取得
                const captionTracks = videoInfo.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                
                if (captionTracks && captionTracks.length > 0) {
                    // 日本語字幕を優先、次に英語字幕を探す
                    let captionTrack = captionTracks.find(track => track.languageCode === 'ja') ||
                                     captionTracks.find(track => track.languageCode === 'en') ||
                                     captionTracks[0];
                    
                    if (captionTrack) {
                        const captionUrl = captionTrack.baseUrl;
                        const response = await fetch(captionUrl);
                        const captionData = await response.text();
                        
                        // XML形式の字幕データをパース
                        captions = parseCaptions(captionData);
                        console.log(`[youtube-summary] 字幕取得成功: ${captions.length}個の字幕セグメント`);
                    }
                }
            } catch (captionError) {
                console.error('[youtube-summary] 字幕取得エラー:', captionError);
            }

            if (!captions || captions.length === 0) {
                await interaction.editReply({ 
                    content: '❌ この動画には字幕が利用できません。字幕付きの動画を試してください。' 
                });
                return;
            }

            // 4. Gemini APIを使用して要約
            if (!genAI) {
                await interaction.editReply({ 
                    content: '❌ Gemini APIキーが設定されていないため、要約機能を利用できません。' 
                });
                return;
            }

            const modelName = "gemini-2.5-flash-preview-04-17";
            const model = genAI.getGenerativeModel({ model: modelName });

            // 字幕テキストを結合
            const subtitleText = captions.map(caption => caption.text).join(' ');
            
            // プロンプトの作成
            const prompt = `
以下のYouTube動画の字幕を構造的に要約してください。

**動画情報:**
- タイトル: ${videoDetails.title}
- チャンネル: ${videoDetails.author?.name || '不明'}
- 長さ: ${Math.floor(videoDetails.lengthSeconds / 60)}分${videoDetails.lengthSeconds % 60}秒

**字幕内容:**
${subtitleText}

**要約の指示:**
1. 動画の主要な内容を簡潔にまとめる
2. 重要なポイントを箇条書きで整理する
3. 動画の構成（導入、本論、結論など）を明示する
4. 専門用語や重要な概念があれば説明する
5. 視聴者にとっての価値や学びを明確にする

**出力形式:**
- 要約（200文字程度）
- 主要ポイント（3-5個）
- 動画の構成
- キーワード・概念
- 視聴者への価値

日本語で回答してください。
            `;

            console.log(`[youtube-summary] Gemini APIに要約リクエスト送信中...`);
            const result = await model.generateContent(prompt);
            const response = result.response;
            let summary = await response.text();

            // 安全性チェック
            const safetyRatings = response.candidates?.[0]?.safetyRatings;
            if (safetyRatings?.some(rating => rating.probability !== 'NEGLIGIBLE' && rating.probability !== 'LOW')) {
                console.warn('[youtube-summary] 安全でないコンテンツが検出されました:', safetyRatings);
                summary = "要約内容に問題が検出されたため表示できません。";
            }

            // 5. 結果の表示
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📺 ${videoDetails.title}`)
                .setURL(url)
                .setDescription(summary.length > MAX_SUMMARY_LENGTH ? 
                    summary.substring(0, MAX_SUMMARY_LENGTH) + '...' : summary)
                .addFields(
                    { name: '📺 チャンネル', value: videoDetails.author?.name || '不明', inline: true },
                    { name: '⏱️ 長さ', value: `${Math.floor(videoDetails.lengthSeconds / 60)}分${videoDetails.lengthSeconds % 60}秒`, inline: true },
                    { name: '📝 字幕セグメント数', value: `${captions.length}個`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'YouTube動画要約' });

            await interaction.editReply({ embeds: [embed] });

            // 長い要約の場合は追加メッセージで送信
            if (summary.length > MAX_SUMMARY_LENGTH) {
                const remainingSummary = summary.substring(MAX_SUMMARY_LENGTH);
                const chunks = splitMessage(remainingSummary);
                
                for (const chunk of chunks) {
                    await interaction.followUp({ content: chunk });
                }
            }

        } catch (error) {
            console.error('[youtube-summary] エラー:', error);
            await interaction.editReply({ 
                content: `❌ エラーが発生しました: ${error.message}` 
            });
        }
    },
};

// 字幕データをパースする関数
function parseCaptions(xmlData) {
    const captions = [];
    const textRegex = /<text[^>]*>([^<]+)<\/text>/g;
    let match;
    
    while ((match = textRegex.exec(xmlData)) !== null) {
        captions.push({
            text: match[1].trim()
        });
    }
    
    return captions;
}

// メッセージを分割する関数
function splitMessage(text, maxLength = MAX_DISCORD_MESSAGE_LENGTH) {
    const chunks = [];
    let currentChunk = '';
    
    const sentences = text.split(/(?<=[。！？\n])/);
    
    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length <= maxLength) {
            currentChunk += sentence;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
} 