const { Events } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        // Initialize Gemini AI
        if (client.config.geminiApiKey) {
            client.genAI = new GoogleGenerativeAI(client.config.geminiApiKey);
            console.log('Gemini AI initialized');
        } else {
            console.warn('GEMINI_API_KEY not found - ask command will not work');
            client.genAI = null;
        }
    },
};