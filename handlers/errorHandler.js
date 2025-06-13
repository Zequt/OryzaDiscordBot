const { Client, EmbedBuilder } = require('discord.js');

/**
 * @param { Client } client
 */

async function loadErrors(client) {
    async function logErr(description, consoleLog1, consoleLog2) {
        try {
            //console.log(consoleLog1);
            //console.log(consoleLog2);
            if(consoleLog1 == "" && consoleLog2 == "") {
                return;
            }

            let botCh = null;
            
            // Try to get error report channel
            if (client.config.errReportChId) {
                botCh = client.channels.cache.get(client.config.errReportChId);
                if (!botCh) {
                    try {
                        botCh = await client.channels.fetch(client.config.errReportChId);
                    } catch (error) {
                        console.warn('[ERROR_HANDLER] Could not fetch error report channel:', error.message);
                    }
                }
            }

            // Fallback to DM if channel not available
            if (!botCh) {
                try {
                    const owner = await client.application.fetch();
                    if (owner.owner) {
                        botCh = await owner.owner.createDM();
                    }
                } catch (error) {
                    console.warn('[ERROR_HANDLER] Could not create DM with owner:', error.message);
                }
            }

            // Send error report if we have a valid channel
            if (botCh && botCh.send) {
                await botCh.send({
                    content: `<@${client.application.owner?.id || 'Unknown'}>`,
                    embeds: [new EmbedBuilder()
                        .setTitle("📨 Anti-Crash Report")
                        .setDescription("Detected system crash.\nRescued.\n\n" + description)
                        .setTimestamp()
                    ]
                });
            } else {
                console.warn('[ERROR_HANDLER] No valid channel available for error reporting');
                console.warn('[ERROR_HANDLER] Error details:', description);
            }
        } catch (error) {
            console.error('[ERROR_HANDLER] Failed to send error report:', error);
            console.error('[ERROR_HANDLER] Original error:', description);
        }
        return;
    };

    process.on("unhandledRejection", (reason, p) => {
        console.log('unhandled Rejection from errorHandler.js');
	    console.log(`----${new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })}----`);
        console.log(`reason:${reason}, p: ${p}`);
        console.log(p);
        logErr("**Unhandled Rejection**\n ```" + reason + "```", reason, p);
    });

    process.on("uncaughtException", (err, origin) => {
        console.log('uncaught Exception from errorHandler.js');
	    console.log(`----${new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })}----`);
        console.log(`error:${err}, origin:${origin}, err.stack:${err.stack}`);
	    console.log("ERROR OCCURED");
        logErr("**Uncaught Exception**\n ```" + err + "\n----\n" + origin.toString() + "```", err, origin);
    });

    process.on("uncaughtExceptionMonitor", (err, origin) => {
	    console.log('uncaught Exception Monitor from errorHandler.js');
        console.log(`----${new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })}----`);
        console.log(err, origin);
        logErr("**Uncaught Exception Monitor**\n ```" + err + "\n----\n" + origin.toString() + "```", err, origin);
    });
}

module.exports = { loadErrors };
