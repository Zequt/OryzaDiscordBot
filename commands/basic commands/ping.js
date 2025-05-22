// SlashCommandBuilder という部品を discord.js からインポートしています。
// これにより、スラッシュコマンドを簡単に構築できます。
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// 以下の形式にすることで、他のファイルでインポートして使用できるようになります。
module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('ITのあいさつ'),
	execute: async function(interaction, client) {
		await interaction.deferReply();
		const reply = await interaction.fetchReply();
		const ping = reply.createdTimestamp - interaction.createdTimestamp;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle("🏓 Pong!")
			.setDescription(`Client ${ping}ms | WebSocket: ${client.ws.ping}ms`)
		]});
	},
};

// module.exportsの補足
// キー・バリューの連想配列のような形で構成されています。
//
// module.exports = {
//    キー: バリュー,
//    キー: バリュー,
// };
//