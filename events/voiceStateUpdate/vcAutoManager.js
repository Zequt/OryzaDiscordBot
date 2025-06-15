const { ChannelType, Events } = require('discord.js');

async function createNewVC(guild, categoryId, baseChannelName) {
    const existingNumbers = guild.channels.cache
        .filter(c =>
            c.type === ChannelType.GuildVoice &&
            c.parentId === categoryId &&
            c.name.startsWith(baseChannelName + ' ')
        )
        .map(c => {
            const match = c.name.match(/^.+ (\d+)$/);
            return match ? parseInt(match[1], 10) : null;
        })
        .filter(n => n !== null)
        .sort((a, b) => a - b);

    let nextNumber = 1;
    for (const num of existingNumbers) {
        if (num === nextNumber) {
            nextNumber++;
        } else break;
    }

    return guild.channels.create({
        name: `${baseChannelName} ${nextNumber}`,
        type: ChannelType.GuildVoice,
        parent: categoryId
    });
}

async function handleAllVoiceChannels(guild) {
    const allVoiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);

    const normalVCs = allVoiceChannels.filter(c => !/ \d+$/.test(c.name));
    const botVCs = allVoiceChannels.filter(c => / \d+$/.test(c.name));

    for (const waitChannel of normalVCs.values()) {
        const baseName = waitChannel.name;
        const categoryId = waitChannel.parentId;
        const usersInWaitVC = waitChannel.members.filter(m => !m.user.bot).size;

        const relatedBotVCs = botVCs.filter(c =>
            c.parentId === categoryId && c.name.startsWith(baseName + ' ')
        );

        const emptyBotVCs = relatedBotVCs.filter(c => c.members.size === 0);

        if (usersInWaitVC === 0) {
            for (const vc of emptyBotVCs.values()) {
                await vc.delete().catch(() => {});
            }
        } else {
            if (emptyBotVCs.size === 0) {
                await createNewVC(guild, categoryId, baseName);
            } else if (emptyBotVCs.size > 1) {
                let keepOne = true;
                for (const vc of emptyBotVCs.values()) {
                    if (keepOne) {
                        keepOne = false;
                        continue;
                    }
                    await vc.delete().catch(() => {});
                }
            }
        }
    }
}

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild || oldState.guild;
        if (!guild) return;
        await handleAllVoiceChannels(guild);
    }
};
