const { Client, GatewayIntentBits, Partials, ChannelType, EmbedBuilder } = require('discord.js');
require('dotenv').config(); // Load .env variables
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

// === CONFIGURATION (from .env) ===
const TOKEN = process.env.BOT_TOKEN;
const TICKET_CHANNEL_ID = '1362971895716249651'; // Where to send the ticket panel
const STAFF_ROLE_ID = '1378772752558981296'; // For Join Team/Staff/Support
const OWNER_ROLE_ID = '1354748863633821716'; // For Contact Owner

// Ticket categories - create them on startup if they don't exist
const CATEGORIES = {
    join_team: null,
    join_staff: null,
    support: null,
    contact_owner: null
};

// === ON READY ===
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Fetch or create categories
    const guild = client.guilds.cache.first();
    for (let key of Object.keys(CATEGORIES)) {
        let category = guild.channels.cache.find(ch => ch.name === key && ch.type === ChannelType.GuildCategory);
        if (!category) {
            category = await guild.channels.create({
                name: key,
                type: ChannelType.GuildCategory
            });
        }
        CATEGORIES[key] = category;
    }

    // Send ticket panel
    const channel = guild.channels.cache.get(TICKET_CHANNEL_ID);
    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket Panel')
            .setDescription('Click a button below to open a ticket.')

        const row = new client.discord.ActionRowBuilder()
            .addComponents(
                new client.discord.ButtonBuilder()
                    .setCustomId('join_team')
                    .setLabel('Join Team')
                    .setEmoji('🎮')
                    .setStyle(client.discord.ButtonStyle.Primary),

                new client.discord.ButtonBuilder()
                    .setCustomId('join_staff')
                    .setLabel('Join Staff')
                    .setEmoji('👨‍💼')
                    .setStyle(client.discord.ButtonStyle.Primary),

                new client.discord.ButtonBuilder()
                    .setCustomId('support')
                    .setLabel('Support')
                    .setEmoji('❓')
                    .setStyle(client.discord.ButtonStyle.Primary)
            );

        const ownerButton = new client.discord.ActionRowBuilder()
            .addComponents(
                new client.discord.ButtonBuilder()
                    .setCustomId('contact_owner')
                    .setLabel('Contact Owner')
                    .setEmoji('🧑')
                    .setStyle(client.discord.ButtonStyle.Success)
            );

        await channel.send({ embeds: [embed], components: [row, ownerButton] });
    }
});

// === BUTTON HANDLER ===
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    const guild = interaction.guild;
    const existingChannel = guild.channels.cache.find(c =>
        c.name === `ticket-${userId}` && c.parentId === CATEGORIES[interaction.customId]?.id
    );

    if (existingChannel) {
        return interaction.reply({ content: `You already have an open ticket: ${existingChannel}`, ephemeral: true });
    }

    // Create ticket channel
    let overwrites = [
        {
            id: guild.roles.everyone,
            deny: ['ViewChannel']
        },
        {
            id: userId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        }
    ];

    if (interaction.customId !== 'contact_owner') {
        overwrites.push({
            id: STAFF_ROLE_ID,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        });
    } else {
        overwrites.push({
            id: OWNER_ROLE_ID,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        });
    }

    const ticketChannel = await guild.channels.create({
        name: `ticket-${userId}`,
        type: ChannelType.GuildText,
        parent: CATEGORIES[interaction.customId].id,
        permissionOverwrites: overwrites
    });

    const embed = new EmbedBuilder()
        .setTitle(`${interaction.customId.replace('_', ' ').toProperCase()} Ticket`)
        .setDescription(`Hello <@${userId}>, this is your ticket. Please describe your request.`)
        .setColor(0x00FF00);

    await ticketChannel.send({ content: `<@${userId}>`, embeds: [embed] });

    interaction.reply({ content: `Your ticket has been created: ${ticketChannel}`, ephemeral: true });
});

String.prototype.toProperCase = function () {
    return this.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

// === LOGIN ===
client.login(TOKEN);
