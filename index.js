const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');

const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Start Express server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// === DISCORD BOT SETUP ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// Health route to keep the bot alive (used by uptime services)
app.get('/', (req, res) => {
  res.send('Discord bot is running!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;

// Channel IDs
const TICKET_CHANNEL_ID = process.env.TICKET_CHANNEL_ID || '1362971895716249651'; // Panel channel
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || '1390466348227891261'; // Welcome channel
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '1368931765439299584'; // Log channel
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '1378772752558981296'; // Staff role ID
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID || '1354748863633821716'; // Owner role ID

let ticketPanelMessage = null;

const CATEGORIES = {
  join_team: null,
  join_staff: null,
  support: null,
  contact_owner: null,
};

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

  // Ticket panel embed
  const embed = new EmbedBuilder()
    .setTitle('🎫 Welcome to the Support Center')
    .setDescription('Please choose one of the options below to open a ticket.')
    .setColor(0x5865F2)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '🎮 Join Team', value: 'Apply to join our team.', inline: true },
      { name: '👨‍💼 Join Staff', value: 'Apply to become staff.', inline: true },
      { name: '❓ Support', value: 'Get help from support.', inline: true },
      { name: '🧑 Contact Owner', value: 'Contact the server owner directly.' }
    )
    .setFooter({ text: 'Powered by Solace' })
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

// === MEMBER JOIN EVENT (Welcome Message) ===
client.on('guildMemberAdd', async (member) => {
  const guild = member.guild;
  const welcomeChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID);

  if (!welcomeChannel) {
    console.error("Welcome channel not found.");
    return;
  }

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`👋 Welcome to ${guild.name}, ${member.displayName}!`)
    .setDescription('We’re excited to have you here! Make sure to read the rules and enjoy your stay!')
    .setColor(0x00ff00)
    .setThumbnail(member.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'Enjoy your journey!' })
    .setTimestamp();

  await welcomeChannel.send({ embeds: [welcomeEmbed] });
});

// === INTERACTION HANDLER ===
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
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

        if (customId === 'join_staff') {
          // Show application modal
          const modal = new ModalBuilder()
            .setCustomId('staff_application')
            .setTitle('Staff Application');

          const fullNameInput = new TextInputBuilder()
            .setCustomId('full_name')
            .setLabel("What's your full name?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const userIdInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel("User ID")
            .setValue(userId)
            .setStyle(TextInputStyle.Short)
            .setDisabled(true)
            .setRequired(true);

          const resumeInput = new TextInputBuilder()
            .setCustomId('resume')
            .setLabel("Tell us about your experience")
            .setPlaceholder("e.g., Previous roles, skills, etc.")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const row1 = new ActionRowBuilder().addComponents(fullNameInput);
          const row2 = new ActionRowBuilder().addComponents(userIdInput);
          const row3 = new ActionRowBuilder().addComponents(resumeInput);

          modal.addComponents(row1, row2, row3);

          await interaction.showModal(modal);
          return;
        }

        // For all non-staff tickets
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
    }

    if (interaction.isModalSubmit()) {
      const modalId = interaction.customId;

      if (modalId === 'staff_application') {
        const fullName = interaction.fields.getTextInputValue('full_name');
        const userId = interaction.fields.getTextInputValue('user_id');
        const resume = interaction.fields.getTextInputValue('resume');

        const guild = interaction.guild;
        const user = interaction.user;

        // Create ticket
        const overwrites = [
          { id: guild.roles.everyone, deny: ['ViewChannel'] },
          { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          { id: STAFF_ROLE_ID, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        ];

        const ticketChannel = await guild.channels.create({
          name: `ticket-${userId}`,
          type: ChannelType.GuildText,
          parent: CATEGORIES['join_staff'].id,
          permissionOverwrites: overwrites,
        });

        const staffEmbed = new EmbedBuilder()
          .setTitle('👨‍💼 Staff Application Received')
          .addFields(
            { name: 'Full Name', value: fullName },
            { name: 'User ID', value: userId },
            { name: 'Resume / Experience', value: resume }
          )
          .setColor(0x00ff00)
          .setFooter({ text: 'Click the close button when done.' });

        const closeBtn = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `<@${userId}>`, embeds: [staffEmbed], components: [closeBtn] });

        return interaction.reply({
          content: `Your staff application ticket has been created: ${ticketChannel}`,
          ephemeral: true,
        });
      }

      if (modalId === 'close_confirm_modal') {
        const reason = interaction.fields.getTextInputValue('close_reason') || 'No reason provided.';
        const user = interaction.user;
        const channel = interaction.channel;

        const confirmEmbed = new EmbedBuilder()
          .setTitle('🔒 Ticket Closed')
          .setDescription(`This ticket was closed by <@${user.id}>.\n\n**Reason:**\n${reason}`)
          .setColor(0xff0000);

        await interaction.reply({ embeds: [confirmEmbed] });

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🗂️ Ticket Closed Log')
            .addFields(
              { name: 'Closed By', value: `<@${user.id}> (${user.tag})` },
              { name: 'Reason', value: reason },
              { name: 'Ticket Channel', value: `#${channel.name}` }
            )
            .setColor(0x5865f2)
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }

        setTimeout(async () => {
          await channel.delete();
        }, 5000);
      }
    }
  } catch (error) {
    console.error('Interaction Error:', error.message);
    if (error.code !== 40060) {
      await interaction.followUp({
        content: 'An unexpected error occurred.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

// Helper method
String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

// === LOGIN ===
client.login(BOT_TOKEN);