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

		console.log('=== APPLICATION DEBUG ===');
		console.log('Owner:', client.application.owner);
		console.log('Team:', client.application.team);
		console.log('Owner type:', typeof client.application.owner);
		if (client.application.owner) {
			console.log('Owner constructor:', client.application.owner.constructor.name);
		}
		console.log('=== END DEBUG ===');

		// Discord.js v14では、ownerがTeamかUserかを判定
		if (client.application.owner && client.application.owner.constructor.name === 'Team') {
			// チーム所有の場合
			const team = client.application.owner;
			embed.addFields({
				name: "Team",
				value: team.name || "Unknown Team",
				inline: false
			});

			if (team.members && team.members.size > 0) {
				const memberList = team.members
					.map(member => `<@${member.user.id}> (${member.user.username || member.user.globalName || 'Unknown'})`)
					.join('\n');
				
				embed.addFields({
					name: `Team Members (${team.members.size})`,
					value: memberList,
					inline: false
				});
			}
		} else if (client.application.owner && client.application.owner.constructor.name === 'User') {
			// 個人所有の場合
			const owner = client.application.owner;
			embed.addFields({
				name: "Owner",
				value: `<@${owner.id}> (${owner.username || owner.globalName || 'Unknown'})`,
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
		let isAuthorized = false;
		
		if (client.application.owner && client.application.owner.constructor.name === 'Team') {
			// チーム所有の場合（ownerがTeam）
			const team = client.application.owner;
			isAuthorized = team.members?.some(member => member.user.id === interaction.user.id);
		} else if (client.application.owner && client.application.owner.constructor.name === 'User') {
			// 個人所有の場合（ownerがUser）
			isAuthorized = interaction.user.id === client.application.owner.id;
		} else if (client.application.team) {
			// 旧形式のチーム所有の場合
			isAuthorized = client.application.team.members?.some(member => member.user.id === interaction.user.id);
		}

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