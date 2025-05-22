function loadCommands(client) {
    const ascii = require('ascii-table');
    const fs = require('fs');
    const table = new ascii().setHeading("Commands", "Status");

    let commandsArray = [];
    // サブフォルダから再帰的にコマンドファイルを取得
    const commandFolders = fs.readdirSync('./commands');
    for (const folder of commandFolders) {
        // using the modules imported above, dynamically retrieve your command files
        const commandFiles = fs.readdirSync(`./commands/${folder}`).filter((file) => file.endsWith('js'));
        for (const file of commandFiles) {
            const commandFile = require(`../commands/${folder}/${file}`);
            // register
            if ('data' in commandFile && 'execute' in commandFile) { //一応ck
                client.commands.set(commandFile.data.name, commandFile);
                commandsArray.push(commandFile.data.toJSON());
                table.addRow(file, "loaded");
                continue;
            } else {
                console.log(`[WARNING] The commandFile at ${filePath} is missing a required \"data\" or \"execute\" property.`);
            }
        }
    }
    
    client.application.commands.set(commandsArray);
    return console.log(table.toString(), "\n Commands Loaded");
}

module.exports = { loadCommands };