const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('ロール、カテゴリ、チャンネルを一度に作成してロールを付与します')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('作成するロール/カテゴリ/チャンネルの名前')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('member1')
                .setDescription('ロールを付与するメンバー1')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('member2')
                .setDescription('ロールを付与するメンバー2')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('member3')
                .setDescription('ロールを付与するメンバー3')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('member4')
                .setDescription('ロールを付与するメンバー4')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('member5')
                .setDescription('ロールを付与するメンバー5')
                .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply();

        try {
            const name = interaction.options.getString('name');
            const guild = interaction.guild;
            const user = interaction.user;

            // メンバーオプションを収集
            const members = [];
            for (let i = 1; i <= 5; i++) {
                const member = interaction.options.getUser(`member${i}`);
                if (member) {
                    members.push(member);
                }
            }

            // 1. ロールを作成
            const role = await guild.roles.create({
                name: name,
                color: 0x000000,
                hoist: false,
                mentionable: true,
                reason: `${user.tag}による/setupコマンド実行`
            });

            // 2. カテゴリを作成
            const category = await guild.channels.create({
                name: name,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: role.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.UseExternalEmojis,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles
                        ]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.UseExternalEmojis,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ],
                reason: `${user.tag}による/setupコマンド実行`
            });

            // 3. テキストチャンネルを作成（カテゴリ内）
            const textChannel = await guild.channels.create({
                name: name,
                type: ChannelType.GuildText,
                parent: category.id,
                reason: `${user.tag}による/setupコマンド実行`
            });

            // 4. フォーラムチャンネルを作成（カテゴリ内）
            const forumChannel = await guild.channels.create({
                name: name,
                type: ChannelType.GuildForum,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: role.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.CreatePublicThreads,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.UseExternalEmojis,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles
                        ]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.CreatePublicThreads,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.UseExternalEmojis,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ManageThreads
                        ]
                    }
                ],
                reason: `${user.tag}による/setupコマンド実行`
            });

            // 5. 実行者にロールを付与
            const executor = interaction.member;
            await executor.roles.add(role);

            // 6. 指定されたメンバーにロールを付与
            const assignedMembers = [user.username];
            for (const member of members) {
                try {
                    const guildMember = await guild.members.fetch(member.id);
                    await guildMember.roles.add(role);
                    assignedMembers.push(member.username);
                } catch (memberError) {
                    console.error(`[setup] メンバー ${member.tag} へのロール付与に失敗:`, memberError);
                }
            }

            // 7. 完了メッセージ
            const successMessage = `✅ セットアップが完了しました！\n\n` +
                `**作成されたロール:** ${role}\n` +
                `**作成されたカテゴリ:** ${category.name}\n` +
                `**作成されたテキストチャンネル:** ${textChannel}\n` +
                `**作成されたフォーラムチャンネル:** ${forumChannel}\n\n` +
                `**ロールが付与されたメンバー:** ${assignedMembers.join(', ')}\n` +
                `あなたには各チャンネルの管理権限が与えられました。`;

            await interaction.editReply({ content: successMessage });

        } catch (error) {
            console.error('[setup] セットアップコマンド実行中にエラーが発生:', error);
            
            let errorMessage = 'セットアップ中にエラーが発生しました。';
            
            if (error.code === 50013) {
                errorMessage = 'ボットにロールまたはチャンネル作成の権限がありません。ボットの権限を確認してください。';
            } else if (error.code === 50001) {
                errorMessage = 'ボットにサーバーへのアクセス権限がありません。';
            } else if (error.message.includes('Invalid Form Body')) {
                errorMessage = '入力された名前に問題があります。名前を確認してください。';
            }

            await interaction.editReply({
                content: `❌ ${errorMessage}\n\n詳細: ${error.message}`
            });
        }
    },
};

