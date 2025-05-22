//
// TEMPLATES FOR THE INTERACTION EVENTS
//

const { Events } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction, client) {
		//slash command
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction, client);
			} catch (error) {
				console.error(`Error executing ${interaction.commandName}`);
				console.error(error);
			}
		//button event
		} else if (interaction.isButton()) {
			// respond to the button
		//idk
		} else if (interaction.isStringSelectMenu()) {
			// respond to the select menu
		} else {
			
		}
	},
};