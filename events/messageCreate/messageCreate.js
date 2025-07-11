const { Events, EmbedBuilder } = require('discord.js');
const ytdl = require('@distube/ytdl-core');

// YouTube URLの正規表現パターン
const YOUTUBE_URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {
        // ボット自身のメッセージは無視
        if (message.author.bot) return;

        // YouTube URLを検出
        const match = message.content.match(YOUTUBE_URL_PATTERN);
        if (!match) return;

        const videoId = match[1];
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        try {
            // 動画情報を取得
            console.log(`[messageCreate] YouTube動画を検出: ${url}`);
            const videoInfo = await ytdl.getInfo(url);
            const videoDetails = videoInfo.videoDetails;

            if (!videoDetails) {
                console.log('[messageCreate] 動画情報の取得に失敗');
                return;
            }

            // 字幕の存在を確認
            const captionTracks = videoInfo.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (!captionTracks || captionTracks.length === 0) {
                console.log('[messageCreate] 字幕が利用できません');
                return;
            }

            // 自動要約の提案メッセージを送信
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('📺 YouTube動画を検出しました')
                .setDescription(`**${videoDetails.title}**`)
                .addFields(
                    { name: '📺 チャンネル', value: videoDetails.author?.name || '不明', inline: true },
                    { name: '⏱️ 長さ', value: `${Math.floor(videoDetails.lengthSeconds / 60)}分${videoDetails.lengthSeconds % 60}秒`, inline: true },
                    { name: '📝 字幕', value: '利用可能', inline: true }
                )
                .addFields({
                    name: '🤖 自動要約',
                    value: '`/youtube-summary`コマンドを使用して動画の内容を要約できます！',
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: 'YouTube動画検出' });

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[messageCreate] YouTube動画処理エラー:', error);
        }
    },
}; 