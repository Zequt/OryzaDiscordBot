//idk
const fs = require('node:fs');
const path = require('node:path');
//-- const mongoose = require('mongoose');

// lib
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { Guilds, GuildMembers, GuildMessages, MessageContent } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember, Channel } = Partials;
// loaders
const { loadEvents } = require('./handlers/eventHandler');
const { loadCommands } = require('./handlers/commandHandler');
const { loadErrors } = require('./handlers/errorHandler');

// クライアントインスタンスと呼ばれるオブジェクトを作成します
const client = new Client({ 
    intents: [Guilds, GuildMembers, GuildMessages, MessageContent],
    partials: [User, Message, GuildMember, ThreadMember]
});
// We recommend attaching a .commands property to your client instance so that you can access your commands in other files. 
client.config = require('./config.json');
client.commands = new Collection();

//mongoDB connections
//--const { mongoURI } = require('./config.json');
//--const mongoURI_old = "mongodb://mog:SGWCGcoG0AagSnQC@ac-dvb6idd-shard-00-00.hai6bhp.mongodb.net:27017,ac-dvb6idd-shard-00-01.hai6bhp.mongodb.net:27017,ac-dvb6idd-shard-00-02.hai6bhp.mongodb.net:27017/?ssl=true&replicaSet=atlas-i65qw5-shard-0&authSource=admin&retryWrites=true&w=majority";

(async () => {
    try {
        //--await mongoose.connect(mongoURI_old);
        //--console.log("connected mongoDB");
        // Discordbot login + load using loaders
        client.login(client.config.token).then(() => {
            console.log("client login");
            loadEvents(client);
            loadCommands(client);
            loadErrors(client);
            console.log("loaded everything");
        });
    } catch (err) {
        //--console.log(`! failed to connect MongoDB: ${err}`);
    }
})();
console.log("index.js finished");