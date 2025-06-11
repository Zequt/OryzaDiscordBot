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
		
		// チームアプリケーションかどうかをチェック
		const isAuthorized = client.application.owner 
			? user.id === client.application.owner.id  // 個人所有の場合
			: client.application.team?.members.some(member => member.user.id === user.id); // チーム所有の場合
		
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
