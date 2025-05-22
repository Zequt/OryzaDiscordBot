function loadEvents(client){
    const ascii = require('ascii-table');
    const fs = require('fs');
    const table = new ascii().setHeading('Events', 'Status');

    const eventFolders = fs.readdirSync('./events');
    for (const folder of eventFolders) {
        const eventsPath = (`./events/${folder}`);
        const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));
        for (const file of eventFiles) {
            const event = require(`../events/${folder}/${file}`);
            //register
            if (event.rest) {
                if (event.once) {
                    client.rest.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.rest.on(event.name, (...args) => event.execute(...args, client));
                }
            } else {
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.on(event.name, (...args) => event.execute(...args, client));
                }
            }
            table.addRow(file, "loaded");
        }
    }
    return console.log(table.toString(), "\nLoaded events");
}

module.exports = { loadEvents };