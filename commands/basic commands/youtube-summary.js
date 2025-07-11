const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ytdl = require('@distube/ytdl-core');

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
            let videoInfo, videoDetails;
            
            try {
                // タイムアウトを設定（30秒）
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('動画情報の取得がタイムアウトしました')), 30000)
                );
                
                videoInfo = await Promise.race([
                    ytdl.getInfo(url),
                    timeoutPromise
                ]);
                
                console.log(`[youtube-summary] 動画情報取得成功: ${videoInfo.videoDetails?.title || 'タイトル不明'}`);
                videoDetails = videoInfo.videoDetails;
            } catch (infoError) {
                console.error('[youtube-summary] 動画情報取得エラー:', infoError);
                throw new Error(`動画情報の取得に失敗しました: ${infoError.message}`);
            }
            
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
                console.log(`[youtube-summary] 字幕トラック数: ${captionTracks?.length || 0}`);
                
                if (captionTracks) {
                    console.log(`[youtube-summary] 字幕トラック数: ${captionTracks.length}`);
                    captionTracks.forEach((track, index) => {
                        console.log(`[youtube-summary] 字幕トラック ${index}: ${track.languageCode} - ${track.name?.simpleText || '不明'}${track.kind ? ' (' + track.kind + ')' : ''}`);
                    });
                    
                    // 全トラックを順に試す
                    let captionData = '';
                    let selectedTrack = null;
                    for (const track of captionTracks) {
                        try {
                            // 字幕取得にタイムアウトを設定（10秒）
                            const timeoutPromise = new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('字幕取得がタイムアウトしました')), 10000)
                            );
                            
                            const res = await Promise.race([
                                fetch(track.baseUrl),
                                timeoutPromise
                            ]);
                            const data = await res.text();
                            console.log(`[youtube-summary] トラック(${track.languageCode}${track.kind ? ', ' + track.kind : ''}) - データ長: ${data.length}文字`);
                            if (data.length > 0) {
                                captionData = data;
                                selectedTrack = track;
                                break;
                            }
                        } catch (e) {
                            console.error(`[youtube-summary] トラック(${track.languageCode})の取得エラー:`, e);
                        }
                    }
                    if (captionData.length > 0) {
                        console.log(`[youtube-summary] 選択された字幕トラック: ${selectedTrack.languageCode} - ${selectedTrack.name?.simpleText || '不明'}${selectedTrack.kind ? ' (' + selectedTrack.kind + ')' : ''}`);
                        captions = parseCaptions(captionData);
                        console.log(`[youtube-summary] 字幕取得成功: ${captions.length}個の字幕セグメント`);
                        if (captions.length > 0) {
                            console.log(`[youtube-summary] 最初の字幕: ${captions[0].text}`);
                            if (captions.length > 1) {
                                console.log(`[youtube-summary] 2番目の字幕: ${captions[1].text}`);
                            }
                        }
                    } else {
                        throw new Error('全ての字幕トラックでデータが取得できませんでした');
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
            
            // Gemini API呼び出しにタイムアウトを設定（60秒）
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Gemini APIの応答がタイムアウトしました')), 60000)
            );
            
            const result = await Promise.race([
                model.generateContent(prompt),
                timeoutPromise
            ]);
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
            
            let errorMessage = '❌ エラーが発生しました: ';
            
            if (error.message.includes('Could not extract functions')) {
                errorMessage += '動画情報の取得に失敗しました。\n\n**考えられる原因:**\n• 動画が非公開または削除されている\n• 年齢制限がある動画\n• 地域制限がある動画\n• 字幕が利用できない動画\n\n**解決方法:**\n• 公開されている動画を試してください\n• 字幕付きの動画を試してください';
            } else if (error.message.includes('Video unavailable')) {
                errorMessage += 'この動画は利用できません。\n\n**原因:**\n• 動画が削除されている\n• 非公開動画\n• 地域制限';
            } else if (error.message.includes('Sign in')) {
                errorMessage += 'この動画にはログインが必要です。\n\n**原因:**\n• 年齢制限のある動画\n• プライベート動画';
            } else if (error.message.includes('Unknown interaction')) {
                errorMessage += 'インタラクションが期限切れになりました。\n\n**原因:**\n• 処理に時間がかかりすぎました\n• ネットワークの問題\n\n**解決方法:**\n• もう一度コマンドを実行してください';
            } else {
                errorMessage += error.message;
            }
            
            try {
                await interaction.editReply({ 
                    content: errorMessage
                });
            } catch (replyError) {
                console.error('[youtube-summary] エラーレスポンス送信失敗:', replyError);
                // インタラクションが期限切れの場合は新しくメッセージを送信
                if (replyError.code === 10062) {
                    try {
                        await interaction.channel.send({ 
                            content: errorMessage + '\n\n*インタラクションが期限切れのため、新しいメッセージとして送信しました。*'
                        });
                    } catch (sendError) {
                        console.error('[youtube-summary] 新規メッセージ送信も失敗:', sendError);
                    }
                }
            }
        }
    },
};

// 字幕データをパースする関数
function parseCaptions(xmlData) {
    const captions = [];
    
    console.log(`[youtube-summary] 字幕パース開始 - データ長: ${xmlData.length}文字`);
    
    // パターン1: 標準的なYouTube字幕フォーマット
    const textPattern1 = /<text[^>]*dur="([^"]*)"[^>]*>([^<]*)<\/text>/g;
    let match;
    
    while ((match = textPattern1.exec(xmlData)) !== null) {
        const duration = parseFloat(match[1]);
        const text = match[2].trim();
        
        if (text && duration > 0) {
            captions.push({
                duration: duration,
                text: text
            });
        }
    }
    
    console.log(`[youtube-summary] パターン1結果: ${captions.length}個の字幕`);
    
    // パターン1が失敗した場合、パターン2を試す
    if (captions.length === 0) {
        console.log('[youtube-summary] パターン1失敗、パターン2を試行');
        
        // パターン2: より柔軟なパターン
        const textPattern2 = /<text[^>]*>([^<]*)<\/text>/g;
        while ((match = textPattern2.exec(xmlData)) !== null) {
            const text = match[1].trim();
            if (text) {
                captions.push({
                    duration: 3.0, // デフォルト値
                    text: text
                });
            }
        }
        
        console.log(`[youtube-summary] パターン2結果: ${captions.length}個の字幕`);
    }
    
    // パターン2も失敗した場合、パターン3を試す
    if (captions.length === 0) {
        console.log('[youtube-summary] パターン2失敗、パターン3を試行');
        console.log(`[youtube-summary] XMLデータの先頭200文字: ${xmlData.substring(0, 200)}`);
        
        // パターン3: より広範囲のパターン
        const textPattern3 = /<[^>]*>([^<]*)<\/[^>]*>/g;
        while ((match = textPattern3.exec(xmlData)) !== null) {
            const text = match[1].trim();
            // 空でなく、HTMLタグでない場合のみ追加
            if (text && !text.startsWith('<') && text.length > 1) {
                captions.push({
                    duration: 3.0, // デフォルト値
                    text: text
                });
            }
        }
        
        console.log(`[youtube-summary] パターン3結果: ${captions.length}個の字幕`);
    }
    
    // すべてのパターンが失敗した場合、生データを解析
    if (captions.length === 0) {
        console.log('[youtube-summary] すべてのパターン失敗、生データ解析を試行');
        
        // XMLデータから直接テキストを抽出
        const cleanText = xmlData
            .replace(/<[^>]*>/g, ' ') // HTMLタグを削除
            .replace(/\s+/g, ' ') // 複数の空白を単一の空白に
            .trim();
        
        if (cleanText.length > 10) { // 最低10文字以上ある場合
            // 文章を分割して字幕として扱う
            const sentences = cleanText.split(/[.!?。！？]/).filter(s => s.trim().length > 5);
            
            sentences.forEach(sentence => {
                const trimmed = sentence.trim();
                if (trimmed.length > 0) {
                    captions.push({
                        duration: 3.0,
                        text: trimmed
                    });
                }
            });
            
            console.log(`[youtube-summary] 生データ解析結果: ${captions.length}個の字幕`);
        }
    }
    
    console.log(`[youtube-summary] 最終字幕数: ${captions.length}個`);
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