const { Client, SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("showrunserver")
		.setDescription("[BOT DEV ONLY] shows a list of server uses this bot.")
    ,
    async execute(interaction, client) {
		const { user } = interaction;

		// Block non-devs
		await client.application.fetch();
		
		// 実行者が開発者かどうかチェック
		let isAuthorized = false;
		
		if (client.application.owner && client.application.owner.constructor.name === 'Team') {
			// チーム所有の場合（ownerがTeam）
			const team = client.application.owner;
			isAuthorized = team.members?.some(member => member.user.id === user.id);
		} else if (client.application.owner && client.application.owner.constructor.name === 'User') {
			// 個人所有の場合（ownerがUser）
			isAuthorized = user.id === client.application.owner.id;
		} else if (client.application.team) {
			// 旧形式のチーム所有の場合
			isAuthorized = client.application.team.members?.some(member => member.user.id === user.id);
		}
		
		if (!isAuthorized) {
			return await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor("Red")
						.setDescription("This command is only for the bot-developers."),
				],
			});
		} else {
            // get server list
            const text = client.guilds.cache.map(guild => guild.name).join("\n");
            await interaction.reply({embeds: [new EmbedBuilder()
                    .setTitle("⌨ EXECUTE")
                    .setColor("Blue")
                    .setDescription(text)
            ]});
		}
	},
};
