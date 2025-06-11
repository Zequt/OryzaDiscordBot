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
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("guild")
				.setDescription("[BOT DEV ONLY] Refresh guild commands")
		),

	async execute(interaction, client) {
		const { user } = interaction;

		// Block non-devs
		await client.application.fetch();
		
		console.log('=== DETAILED DEBUG INFO ===');
		console.log(`User ID: ${user.id}`);
		console.log(`Application Owner:`, client.application.owner);
		console.log(`Application Team:`, client.application.team);
		
		if (client.application.team) {
			console.log(`Team Members:`, client.application.team.members);
			client.application.team.members.forEach((member, index) => {
				console.log(`Member ${index}:`, member.user.id, member.user.username);
			});
		}
		
		// チームアプリケーションかどうかをチェック
		const isAuthorized = client.application.owner 
			? user.id === client.application.owner.id  // 個人所有の場合
			: client.application.team?.members.some(member => member.user.id === user.id); // チーム所有の場合
		
		console.log(`Is Authorized: ${isAuthorized}`);
		console.log('=== END DEBUG INFO ===');
		
		if (!isAuthorized) {
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
					console.log(`${user} reloaded events.`);
					break;
				case "guild":
					try {
						// 現在のギルドのコマンドをリフレッシュ
						const guild = interaction.guild;
						if (!guild) {
							return interaction.reply({
								embeds: [
									new EmbedBuilder()
										.setColor("Red")
										.setDescription("This command can only be used in a guild."),
								],
							});
						}
						
						// 現在登録されているコマンドを取得
						const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
						
						// ギルドコマンドを設定
						await guild.commands.set(commands);
						
						interaction.reply({
							embeds: [
								embed.setDescription(`♻ Guild commands refreshed successfully for ${guild.name}.`),
							],
						});
						console.log(`${user} refreshed guild commands for ${guild.name}.`);
					} catch (error) {
						console.error('Error refreshing guild commands:', error);
						interaction.reply({
							embeds: [
								new EmbedBuilder()
									.setColor("Red")
									.setDescription("❌ Failed to refresh guild commands."),
							],
						});
					}
					break;
			}
		}
	},
};
