const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMemberAdd
    ],
    partials: [Partials.Channel]
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const WELCOME_CHANNEL_ID = '1390466348227891261'; // Replace with your welcome channel ID
const PANEL_CHANNEL_ID = '1362971895716249651';   // Channel where the ticket panel will be posted

let welcomePanelMessage = null;

// === ON READY ===
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const guild = client.guilds.cache.first();
    const panelChannel = guild.channels.cache.get(PANEL_CHANNEL_ID);

    if (!panelChannel) {
        console.error("Panel channel not found.");
        return;
    }

    // Create welcome panel embed
    const embed = new EmbedBuilder()
        .setTitle('👋 Welcome to the Server!')
        .setDescription('Click the button below to get started.')
        .setColor(0x00ff00)
        .setImage('https://solbot.store/logo.png ')
        .setFooter({ text: 'Powered by Solace' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('send_welcome')
            .setLabel('Send Welcome Message')
            .setEmoji('📨')
            .setStyle(ButtonStyle.Primary)
    );

    try {
        const fetchedMessages = await panelChannel.messages.fetch({ limit: 10 });
        const panelMessage = fetchedMessages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

        if (panelMessage) {
            await panelMessage.edit({ embeds: [embed], components: [row] });
            welcomePanelMessage = panelMessage;
            console.log("Updated existing welcome panel.");
        } else {
            const sentMessage = await panelChannel.send({ embeds: [embed], components: [row] });
            welcomePanelMessage = sentMessage;
            console.log("Sent new welcome panel.");
        }
    } catch (error) {
        console.error("Failed to update/send welcome panel:", error);
    }
});

// === MEMBER JOIN EVENT ===
client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    const channel = guild.channels.cache.get(WELCOME_CHANNEL_ID);

    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(`👋 Welcome to ${guild.name}, ${member.displayName}!`)
        .setDescription('We’re excited to have you here!\n\nRead the rules and enjoy your stay!')
        .setColor(0x00ff00)
        .setImage('https://solbot.store/logo.png ')
        .setThumbnail(member.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Enjoy your journey!' })
        .setTimestamp();

    await channel.send({ embeds: [embed] });
});

// === INTERACTION HANDLER ===
client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'send_welcome') {
            const guild = interaction.guild;
            const welcomeChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID);

            if (!welcomeChannel) {
                return interaction.reply({
                    content: 'Welcome channel not found.',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎉 Welcome to the Server!')
                .setDescription('Thank you for joining us. Enjoy your time here!')
                .setColor(0x00ff00)
                .setImage('https://solbot.store/logo.png ')
                .setThumbnail(guild.iconURL({ dynamic: true }));

            await welcomeChannel.send({ embeds: [embed] });

            return interaction.reply({
                content: 'Welcome message sent!',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('Interaction Error:', error.message);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'An unexpected error occurred.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'An unexpected error occurred.', ephemeral: true });
        }
    }
});

// === LOGIN ===
client.login(BOT_TOKEN);
