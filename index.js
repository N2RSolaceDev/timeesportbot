const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// === CONFIGURATION (Only BOT_TOKEN in .env) ===
require('dotenv').config();
const BOT_TOKEN = process.env.BOT_TOKEN;

// Hardcoded sensitive values (you can move them to another file if you want)
const TICKET_CHANNEL_ID = '1362971895716249651'; // Where to send the ticket panel
const STAFF_ROLE_ID = '1378772752558981296';       // For Join Team/Staff/Support
const OWNER_ROLE_ID = '1354748863633821716';       // For Contact Owner

// Ticket categories - create them on startup if they don't exist
const CATEGORIES = {
  join_team: null,
  join_staff: null,
  support: null,
  contact_owner: null,
};

let ticketPanelMessage = null;

// === ON READY ===
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  const ticketChannel = guild.channels.cache.get(TICKET_CHANNEL_ID);

  if (!ticketChannel) {
    console.error("Ticket channel not found.");
    return;
  }

  // Fetch or create categories
  for (let key of Object.keys(CATEGORIES)) {
    let category = guild.channels.cache.find(
      ch => ch.name === key && ch.type === ChannelType.GuildCategory
    );
    if (!category) {
      category = await guild.channels.create({
        name: key,
        type: ChannelType.GuildCategory,
      });
    }
    CATEGORIES[key] = category;
  }

  // Create embed and buttons
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket Panel')
    .setDescription('Click a button below to open a ticket.')
    .setColor(0x5865F2);

  const rowOne = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_team')
      .setLabel('Join Team')
      .setEmoji('🎮')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('join_staff')
      .setLabel('Join Staff')
      .setEmoji('👨‍💼')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('support')
      .setLabel('Support')
      .setEmoji('❓')
      .setStyle(ButtonStyle.Primary)
  );

  const rowTwo = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('contact_owner')
      .setLabel('Contact Owner')
      .setEmoji('🧑')
      .setStyle(ButtonStyle.Success)
  );

  try {
    // Try to fetch last panel message sent by bot in that channel
    const fetchedMessages = await ticketChannel.messages.fetch({ limit: 10 });
    const panelMessage = fetchedMessages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

    if (panelMessage) {
      // Edit existing message
      await panelMessage.edit({ embeds: [embed], components: [rowOne, rowTwo] });
      ticketPanelMessage = panelMessage;
      console.log("Updated existing ticket panel.");
    } else {
      // Send new message
      const sentMessage = await ticketChannel.send({ embeds: [embed], components: [rowOne, rowTwo] });
      ticketPanelMessage = sentMessage;
      console.log("Sent new ticket panel.");
    }
  } catch (error) {
    console.error("Failed to update/send ticket panel:", error);
  }
});

// === BUTTON HANDLER ===
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const guild = interaction.guild;
  const existingChannel = guild.channels.cache.find(
    (c) =>
      c.name === `ticket-${userId}` &&
      c.parentId === CATEGORIES[interaction.customId]?.id
  );

  if (existingChannel) {
    return interaction.reply({
      content: `You already have an open ticket: ${existingChannel}`,
      ephemeral: true,
    });
  }

  // Create ticket channel
  let overwrites = [
    {
      id: guild.roles.everyone,
      deny: ['ViewChannel'],
    },
    {
      id: userId,
      allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
    },
  ];

  if (interaction.customId !== 'contact_owner') {
    overwrites.push({
      id: STAFF_ROLE_ID,
      allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
    });
  } else {
    overwrites.push({
      id: OWNER_ROLE_ID,
      allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
    });
  }

  const ticketChannel = await guild.channels.create({
    name: `ticket-${userId}`,
    type: ChannelType.GuildText,
    parent: CATEGORIES[interaction.customId].id,
    permissionOverwrites: overwrites,
  });

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.customId.replace('_', ' ').toProperCase()} Ticket`)
    .setDescription(`Hello <@${userId}>, this is your ticket. Please describe your request.`)
    .setColor(0x00ff00);

  await ticketChannel.send({ content: `<@${userId}>`, embeds: [embed] });

  await interaction.reply({
    content: `Your ticket has been created: ${ticketChannel}`,
    ephemeral: true,
  });
});

// Helper method to capitalize words
String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

// === LOGIN ===
client.login(BOT_TOKEN);
