//idk
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

// lib
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { Guilds, GuildMembers, GuildMessages, MessageContent, GuildVoiceStates } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember, Channel } = Partials;
// loaders
const { loadEvents } = require('./handlers/eventHandler');
const { loadCommands } = require('./handlers/commandHandler');
const { loadErrors } = require('./handlers/errorHandler');
const { deployCommands } = require('./utils/deployCommands');

// クライアントインスタンスと呼ばれるオブジェクトを作成します
const client = new Client({ 
    intents: [Guilds, GuildMembers, GuildMessages, MessageContent, GuildVoiceStates],
    partials: [User, Message, GuildMember, ThreadMember]
});
// We recommend attaching a .commands property to your client instance so that you can access your commands in other files. 
client.config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    mongoURI: process.env.MONGO_URI,
    errReportChId: process.env.ERROR_REPORT_CHANNEL_ID,
    geminiApiKey: process.env.GEMINI_API_KEY
};
client.commands = new Collection();

//mongoDB connections
//--const { mongoURI } = require('./config.json');
//--const mongoURI_old = "mongodb://mog:SGWCGcoG0AagSnQC@ac-dvb6idd-shard-00-00.hai6bhp.mongodb.net:27017,ac-dvb6idd-shard-00-01.hai6bhp.mongodb.net:27017,ac-dvb6idd-shard-00-02.hai6bhp.mongodb.net:27017/?ssl=true&replicaSet=atlas-i65qw5-shard-0&authSource=admin&retryWrites=true&w=majority";

(async () => {
    try {
        // MongoDB connection
        if (client.config.mongoURI) {
            await mongoose.connect(client.config.mongoURI);
            console.log("Connected to MongoDB");
        } else {
            console.warn("MONGO_URI not found - MongoDB features will not work");
        }
        
        // Discordbot login + load using loaders
        console.log("Attempting to login with token:", client.config.token ? "Token exists" : "Token is undefined");
        client.login(client.config.token).then(async () => {
            console.log("client login successful");
            loadEvents(client);
            loadCommands(client);
            loadErrors(client);
            
            // Deploy commands automatically
            console.log("Deploying commands...");
            const deploySuccess = await deployCommands(client);
            if (deploySuccess) {
                console.log("Commands deployed successfully");
            } else {
                console.error("Failed to deploy commands - bot will continue running");
            }
            
            console.log("loaded everything");
        }).catch((loginError) => {
            console.error("Failed to login to Discord:", loginError);
        });
    } catch (err) {
        console.error(`Failed to connect to MongoDB: ${err}`);
        console.log("Bot will continue running without MongoDB features");
    }
})();
console.log("index.js finished");