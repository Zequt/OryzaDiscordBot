const { Client, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { loadCommands } = require("../../handlers/commandHandler");
const { loadEvents } = require("../../handlers/eventHandler");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("reload")
		.setDescription("[BOT DEV ONLY] Reloads a command.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("commands")
				.setDescription("[BOT DEV ONLY] Reload all commands")
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("events")
				.setDescription("[BOT DEV ONLY] Reload all events")
		),

	async execute(interaction, client) {
		const { user } = interaction;

		// Block non-devs
		await client.application.fetch();
		if (user.id !==  await client.application.owner.id) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor("Red")
						.setDescription("This command is only for the bot-developers."),
				],
			});
		} else {
			const sub = interaction.options.getSubcommand();
			const embed = new EmbedBuilder().setTitle("⌨ EXECUTE").setColor("Blue");
			switch (sub) {
				case "commands":
					loadCommands(client);
					interaction.reply({
						embeds: [
							embed.setDescription(
								"♻ Commands has been reloaded successfully."
							),
						],
					});
					console.log(`${user} reloaded commands.`);
					break;
				case "events":
					loadEvents(client);
					interaction.reply({
						embeds: [
							embed.setDescription("♻ Events has been reloaded successfully."),
						],
					});
					console.log(`${user} reloaded commands.`);
					break;
			}
		}
	},
};
