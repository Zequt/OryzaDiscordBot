const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("developers")
		.setDescription("Show bot developers and team information"),

	async execute(interaction, client) {
		await client.application.fetch();

		const embed = new EmbedBuilder()
			.setTitle("🔧 Bot Developer Information")
			.setColor("Blue")
			.setTimestamp();

		if (client.application.owner) {
			// 個人所有の場合
			embed.addFields({
				name: "Owner",
				value: `<@${client.application.owner.id}> (${client.application.owner.username})`,
				inline: false
			});
		} else if (client.application.team) {
			// チーム所有の場合
			embed.addFields({
				name: "Team",
				value: client.application.team.name || "Unknown Team",
				inline: false
			});

			if (client.application.team.members && client.application.team.members.size > 0) {
				const memberList = client.application.team.members
					.map(member => `<@${member.user.id}> (${member.user.username})`)
					.join('\n');
				
				embed.addFields({
					name: `Team Members (${client.application.team.members.size})`,
					value: memberList,
					inline: false
				});
			}
		}

		// 実行者が開発者かどうかチェック
		const isAuthorized = client.application.owner 
			? interaction.user.id === client.application.owner.id  // 個人所有の場合
			: client.application.team?.members.some(member => member.user.id === interaction.user.id); // チーム所有の場合

		embed.addFields({
			name: "Your Access",
			value: `${isAuthorized ? '✅ You have developer access' : '❌ You do not have developer access'}\nUser ID: ${interaction.user.id}`,
			inline: false
		});

		await interaction.reply({
			embeds: [embed]
		});

		console.log(`${interaction.user.username} checked developer information.`);
	},
};