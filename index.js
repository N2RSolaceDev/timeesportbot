const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

require('dotenv').config();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;

// Hardcoded sensitive values (not exposed to .env)
const TICKET_CHANNEL_ID = '1362971895716249651';
const STAFF_ROLE_ID = '1378772752558981296';
const OWNER_ROLE_ID = '1354748863633821716';

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

  // Create or find categories
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

  // Panel Embed
  const embed = new EmbedBuilder()
    .setTitle('🎫 Welcome to the Support Center')
    .setDescription('Please choose one of the options below to open a ticket.')
    .setColor(0x5865F2)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setTimestamp();

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
    const fetchedMessages = await ticketChannel.messages.fetch({ limit: 10 });
    const panelMessage = fetchedMessages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

    if (panelMessage) {
      await panelMessage.edit({ embeds: [embed], components: [rowOne, rowTwo] });
      ticketPanelMessage = panelMessage;
      console.log("Updated existing ticket panel.");
    } else {
      const sentMessage = await ticketChannel.send({ embeds: [embed], components: [rowOne, rowTwo] });
      ticketPanelMessage = sentMessage;
      console.log("Sent new ticket panel.");
    }
  } catch (error) {
    console.error("Failed to update/send ticket panel:", error);
  }
});

// === BUTTON HANDLER ===
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const guild = interaction.guild;
  const customId = interaction.customId;

  // Handle ticket creation
  if (['join_team', 'join_staff', 'support', 'contact_owner'].includes(customId)) {
    const existingChannel = guild.channels.cache.find(
      c => c.name === `ticket-${userId}` && c.parentId === CATEGORIES[customId]?.id
    );

    if (existingChannel) {
      return interaction.reply({
        content: `You already have an open ticket: ${existingChannel}`,
        ephemeral: true,
      });
    }

    // Create overwrites
    let overwrites = [
      { id: guild.roles.everyone, deny: ['ViewChannel'] },
      { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
    ];

    if (customId !== 'contact_owner') {
      overwrites.push({ id: STAFF_ROLE_ID, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
    } else {
      overwrites.push({ id: OWNER_ROLE_ID, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
    }

    const ticketChannel = await guild.channels.create({
      name: `ticket-${userId}`,
      type: ChannelType.GuildText,
      parent: CATEGORIES[customId].id,
      permissionOverwrites: overwrites,
    });

    const embed = new EmbedBuilder()
      .setTitle(`${customId.replace('_', ' ').toProperCase()} Ticket`)
      .setDescription(`Hello <@${userId}>, this is your ticket. Please describe your request.`)
      .setColor(0x00ff00)
      .setFooter({ text: 'Click the close button when done.' });

    const closeBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ content: `<@${userId}>`, embeds: [embed], components: [closeBtn] });

    return interaction.reply({
      content: `Your ticket has been created: ${ticketChannel}`,
      ephemeral: true,
    });
  }

  // Handle ticket closure
  if (customId === 'close_ticket') {
    const modal = new ModalBuilder()
      .setCustomId('close_confirm_modal')
      .setTitle('Confirm Closing Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('Reason for closing (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setPlaceholder('Enter optional reason here...');

    const actionRow = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }
});

// === MODAL HANDLER ===
client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;

  const channelId = interaction.channel.id;
  const userId = interaction.user.id;

  if (interaction.customId === 'close_confirm_modal') {
    const reason = interaction.fields.getTextInputValue('close_reason') || 'No reason provided.';
    const channel = interaction.channel;

    const confirmEmbed = new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setDescription(`This ticket was closed by <@${userId}>.\n\n**Reason:**\n${reason}`)
      .setColor(0xff0000);

    await interaction.reply({ embeds: [confirmEmbed], components: [] });

    setTimeout(async () => {
      await channel.delete();
    }, 5000); // Delete after 5 seconds
  }
});

// Helper method
String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

// === LOGIN ===
client.login(BOT_TOKEN);
