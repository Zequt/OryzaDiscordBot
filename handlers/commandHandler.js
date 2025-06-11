function loadCommands(client) {
    const ascii = require('ascii-table');
    const fs = require('fs');
    const path = require('path');
    const table = new ascii().setHeading("Commands", "Status");

    client.commands.clear();
    let commandsArray = [];
    
    // サブフォルダから再帰的にコマンドファイルを取得
    const commandFolders = fs.readdirSync('./commands');
    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(`./commands/${folder}`).filter((file) => file.endsWith('js'));
        for (const file of commandFiles) {
            const filePath = path.resolve(`./commands/${folder}/${file}`);
            
            // キャッシュをクリアしてリロード
            delete require.cache[filePath];
            
            try {
                const commandFile = require(`../commands/${folder}/${file}`);
                
                if ('data' in commandFile && 'execute' in commandFile) {
                    client.commands.set(commandFile.data.name, commandFile);
                    commandsArray.push(commandFile.data.toJSON());
                    table.addRow(file, "loaded");
                } else {
                    console.log(`[WARNING] The commandFile at ${filePath} is missing a required "data" or "execute" property.`);
                    table.addRow(file, "failed");
                }
            } catch (error) {
                console.log(`[ERROR] Failed to load command ${file}: ${error.message}`);
                table.addRow(file, "error");
            }
        }
    }
    
    // Note: コマンドの登録はdeploy-commands.jsで行うため、ここでは登録しない
    // client.application.commands.set(commandsArray);
    return console.log(table.toString(), "\n Commands Loaded");
}

module.exports = { loadCommands };