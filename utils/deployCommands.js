const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

async function deployCommands(client) {
    try {
        const commands = [];
        
        // Grab all the command files from the commands directory
        const foldersPath = path.join(__dirname, '..', 'commands');
        const commandFolders = fs.readdirSync(foldersPath);
        
        for (const folder of commandFolders) {
            const commandsPath = path.join(foldersPath, folder);
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                // Clear cache to get latest version
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            }
        }

        // Construct and prepare an instance of the REST module
        const rest = new REST().setToken(client.config.token);

        console.log(`[DEPLOY] Started refreshing ${commands.length} application (/) commands.`);

        // Deploy commands globally
        const data = await rest.put(
            Routes.applicationCommands(client.config.clientId),
            { body: commands },
        );

        console.log(`[DEPLOY] Successfully reloaded ${data.length} application (/) commands.`);
        return true;
    } catch (error) {
        console.error('[DEPLOY] Failed to deploy commands:', error);
        return false;
    }
}

module.exports = { deployCommands };