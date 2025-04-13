// index.js (Fully Updated with Merged Interaction Handlers and /setchannel Fix)
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  ChannelType,
  ActivityType,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Setup (Removed deprecated options)
mongoose.connect(process.env.MONGO_URI);

const PartnerSchema = new mongoose.Schema({
  guildId: String,
  guildName: String,
  partnerChannelId: String,
  partnerMessage: String,
  pendingMessage: String,
  pendingMessageUserId: String,
  approved: Boolean,
  lastBump: Date,
  messagePending: Boolean,
  inviteLink: String,
  partnerRoleId: String, // For role-based permissions
});
const Partner = mongoose.model('Partner', PartnerSchema);

// Discord Bot Setup
const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildPresences
] });

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('List all commands'),
  new SlashCommandBuilder().setName('register').setDescription('Register your server for partnering'),
  new SlashCommandBuilder().setName('setchannel')
    .setDescription('Set bump channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Partner channel').setRequired(true)),
  new SlashCommandBuilder().setName('unregister').setDescription('Unregister your server'),
  new SlashCommandBuilder().setName('bump').setDescription('Send your ad to all partners'),
  new SlashCommandBuilder().setName('setstatus')
    .setDescription('Set the bot\'s status (Owner only)')
    .addStringOption(opt => opt.setName('status').setDescription('The status message').setRequired(true)),
  new SlashCommandBuilder().setName('setrole')
    .setDescription('Set the role required to use partner bot commands')
    .addRoleOption(option => 
      option.setName('role')
        .setDescription('The role that can use partner bot commands')
        .setRequired(true))
];

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  client.user.setActivity('skyvps360.xyz $4 256GB KVM VPS', { type: ActivityType.Watching });

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log('Slash commands registered.');
});

// Use a single merged event handler for all interaction types.
client.on('interactionCreate', async (interaction) => {
  // Handle Slash Commands
  if (interaction.isChatInputCommand()) {
    // Ensure the command is used in a guild
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    }

    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;
    const member = interaction.member;
    const hasCommandPermission = await hasPermission(member, guildId);

    // Special handling for setstatus command
    if (interaction.commandName === 'setstatus' && member.user.id !== '142025929454125056') {
      return interaction.reply({ content: '🚫 Only the bot owner can use this command.', ephemeral: true });
    }
    
    // Skip permission check for /help command
    if (interaction.commandName !== 'help' && !hasCommandPermission) {
      return interaction.reply({ content: '🚫 You do not have permission to use this command. You need the partner role or administrator permissions.', ephemeral: true });
    }

    // Get or create the log channel
    const logChannelName = 'ad-logs';
    let logChannel = interaction.guild.channels.cache.find(c => c.name === logChannelName);
    if (!logChannel) {
      logChannel = await interaction.guild.channels.create({ name: logChannelName, type: ChannelType.GuildText });
    }

    await logChannel.send(`📥 Command used: \`${interaction.commandName}\` by ${interaction.user.tag}`);

    // Slash Command Handlers:
    if (interaction.commandName === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setColor('#7289da')
        .setTitle('📘 Partner Bot Commands')
        .setDescription('These commands require the partner role or administrator permissions:')
        .addFields(
          { name: '/register', value: 'Register your server (starts the partnership process)' },
          { name: '/setchannel', value: 'Set the channel for receiving partner ads' },
          { name: '/unregister', value: 'Remove server from partner list' },
          { name: '/bump', value: 'Send your ad to all partners (30-min cooldown)' },
          { name: '/help', value: 'View this help message' }
        )
        .addFields({
          name: 'Special Commands',
          value: '`/setrole` - Set the role required to use commands (Server Owner only)\n`/setstatus` - Change bot status (Bot Owner only)'
        })
        .setFooter({ text: `After registration approval, you'll receive a setup form to configure your server.`, iconURL: client.user.displayAvatarURL() })
        .setURL(`${process.env.SITE_URL || `http://0.0.0.0:${process.env.PORT || 3000}`}/docs`);
      
      return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }

    if (interaction.commandName === 'register') {
            const existing = await Partner.findOne({ guildId });
            if (existing) {
                return interaction.reply({ content: '❌ This server is already registered and cannot register again.', ephemeral: true });
            }

            await Partner.create({ guildId, guildName, approved: false, messagePending: false, lastBump: new Date() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`approve_${guildId}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`decline_${guildId}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger),
            );

            try {
                const adminGuild = await client.guilds.fetch(process.env.ADMIN_SERVER_ID);
                if (!adminGuild) {
                    console.error('Admin guild not found. Check ADMIN_SERVER_ID in the .env file.');
                    return;
                }

                const adminChannel = await adminGuild.channels.fetch(process.env.ADMIN_CHANNEL_ID);
                if (!adminChannel) {
                    console.error('Admin channel not found. Check ADMIN_CHANNEL_ID in the .env file.');
                    return;
                }

                await adminChannel.send({ content: `📥 New registration from **${guildName}** (ID: ${guildId})`, components: [row] });
                return interaction.reply('✅ Registration submitted. Please wait for approval.');
            } catch (error) {
                console.error('Error fetching guild or channel:', error);
                return interaction.reply('❌ An error occurred while processing your request.');
            }
        }

    if (interaction.commandName === 'setmessage') {
      console.log('Processing setmessage command');
      const msg = interaction.options.getString('message');
      const userId = interaction.user.id;
      console.log('Message content:', msg);
      console.log('Guild ID:', guildId);
      console.log('User ID:', userId);
      
      const partner = await Partner.findOne({ guildId });
      console.log('Found partner data:', partner);
      
      if (!partner) {
        return interaction.reply({ content: '❌ Your server must be registered first. Use `/register` to register.', ephemeral: true });
      }

      try {
        const adminGuild = await client.guilds.fetch(process.env.ADMIN_SERVER_ID);
        if (!adminGuild) {
          console.error('Admin guild not found:', process.env.ADMIN_SERVER_ID);
          return interaction.reply({ content: '❌ Configuration error: Admin guild not found', ephemeral: true });
        }

        const adminChannel = await adminGuild.channels.fetch(process.env.ADMIN_CHANNEL_ID);
        if (!adminChannel) {
          console.error('Admin channel not found:', process.env.ADMIN_CHANNEL_ID);
          return interaction.reply({ content: '❌ Configuration error: Admin channel not found', ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`approve_${guildId}`).setLabel('✅ Approve Message').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`decline_${guildId}`).setLabel('❌ Decline Message').setStyle(ButtonStyle.Danger),
        );

        await Partner.findOneAndUpdate(
          { guildId }, 
          { 
            messagePending: true,
            pendingMessageUserId: userId,
            $set: { 'pendingMessage': msg }
          },
          { upsert: true }
        );

        await adminChannel.send({
          content: `✏️ Message update from **${guildName}** by <@${userId}>:\n\n${msg}`,
          components: [row]
        });
        return interaction.reply('📨 Message submitted for approval. The current message will remain unchanged until approved.');
      } catch (error) {
        console.error('Error in setmessage command:', error);
        return interaction.reply({ content: '❌ An error occurred while processing your request. Please try again later.', ephemeral: true });
      }
    }

    if (interaction.commandName === 'setchannel') {
      const channel = interaction.options?.getChannel('channel');
      // Validate that channel exists, is null, and is text-based
      if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
        return interaction.reply({ content: '❌ Please select a valid text-based channel.', ephemeral: true });
      }
      await Partner.findOneAndUpdate({ guildId }, { partnerChannelId: channel.id }, { upsert: true });
      return interaction.reply(`📢 Partner channel set to <#${channel.id}>`);
    }

    if (interaction.commandName === 'unregister') {
      await Partner.deleteOne({ guildId });
      return interaction.reply('🗑️ Server unregistered.');
    }

    if (interaction.commandName === 'bump') {
      const self = await Partner.findOne({ guildId });
      if (!self || !self.approved || !self.partnerMessage || !self.partnerChannelId) {
        return interaction.reply({ content: '❌ You must be approved and have message/channel set.', ephemeral: true });
      }
      // Update the bump command to include a 30-minute timeout
      const cooldown = 30 * 60 * 1000;
      if (self.lastBump && Date.now() - self.lastBump.getTime() < cooldown) {
        const remaining = ((cooldown - (Date.now() - self.lastBump.getTime())) / 60000).toFixed(1);
        return interaction.reply({ content: `⏳ Please wait ${remaining} more minutes.`, ephemeral: true });
      }
      const allPartners = await Partner.find({ guildId: { $ne: guildId }, approved: true });
      let count = 0;
      for (const partner of allPartners) {
        try {
          const guild = await client.guilds.fetch(partner.guildId);
          const channel = await guild.channels.fetch(partner.partnerChannelId);
          if (channel) {
            await channel.send(`📢 New partner bump from **${guildName}**:\n\n${self.partnerMessage}`);
            count++;
          }
        } catch (err) {
          console.log(`❌ Could not bump to ${partner.guildId}`);
        }
      }
      await Partner.findOneAndUpdate({ guildId }, { lastBump: new Date() });
      return interaction.reply(`✅ Bump sent to ${count} partner servers.`);
    }

    if (interaction.commandName === 'invite') {
      const invite = getBotInviteUrl(); // Use the function here
      return interaction.reply({ content: `🔗 [Click here to invite the bot](${invite})`, ephemeral: true });
    }

    if (interaction.commandName === 'setinvite') {
      const invite = interaction.options.getString('invite');
      // Validate the invite link format
      const inviteRegex = /^https:\/\/discord\.gg\//;
      if (!inviteRegex.test(invite)) {
        return interaction.reply({ content: '❌ Please provide a valid Discord invite link (https://discord.gg/...).', ephemeral: true });
      }
      await Partner.findOneAndUpdate({ guildId }, { inviteLink: invite }, { upsert: true });
      return interaction.reply(`🔗 Invite link set to: ${invite}`);
    }

    // Fix the /setstatus command handler to avoid multiple interaction acknowledgments
    if (interaction.commandName === 'setstatus') {
      console.log(`Received /setstatus command from user: ${interaction.user.id}`);

      // Check if the user is the bot owner
      if (interaction.user.id !== '142025929454125056') {
        console.log('Unauthorized user attempted to use /setstatus');
        return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
      }

      // Get the status message from the command options
      const status = interaction.options.getString('status');
      console.log(`Attempting to set bot status to: ${status}`);

      try {
        // Set the bot's status using the correct ActivityType
        await client.user.setActivity(status, { type: ActivityType.Watching });
        console.log('Bot status updated successfully');
        
        // Log the current activity to confirm
        const currentActivity = client.user.presence.activities[0]?.name || 'No activity';
        console.log(`Current bot activity: ${currentActivity}`);
        
        return interaction.reply({ content: `✅ Bot status updated to: **${status}**`, ephemeral: true });
      } catch (error) {
        console.error('Error updating bot status:', error);
        return interaction.reply({ content: '❌ Failed to update bot status. Check the logs for details.', ephemeral: true });
      }
    }

    if (interaction.commandName === 'setrole') {
      // Only server owner can set the role
      if (interaction.member.id !== interaction.guild.ownerId) {
        return interaction.reply({ content: '❌ Only the server owner can set the partner role.', ephemeral: true });
      }

      const role = interaction.options.getRole('role');
      await Partner.findOneAndUpdate(
        { guildId },
        { partnerRoleId: role.id },
        { upsert: true }
      );

      return interaction.reply({ content: `✅ Partner role set to ${role.name}. Members with this role can now use partner commands.`, ephemeral: true });
    }
  } 

  // Handle Button Interactions
  if (interaction.isButton()) {
    console.log('Button interaction received:', {
      customId: interaction.customId,
      user: interaction.user.tag,
      guild: interaction.guild?.name
    });
    
    // Split the customId and handle legacy format
    let action, type, targetId;
    const parts = interaction.customId.split('_');
    
    if (parts.length === 2) {
      // Handle legacy format (approve_guildId or decline_guildId)
      [action, targetId] = parts;
      type = action.includes('msg') ? 'msg' : null;
    } else if (parts.length === 3) {
      // Handle new format (approve_msg_guildId)
      [action, type, targetId] = parts;
    } else {
      console.error('Invalid button customId format:', interaction.customId);
      return interaction.reply({ content: '❌ Invalid button interaction format.', ephemeral: true });
    }
    
    console.log('Parsed button data:', { action, type, targetId });
    
    // Validate targetId
    if (!targetId) {
      console.error('No target ID found in button interaction');
      return interaction.reply({ content: '❌ Invalid button interaction: No target ID.', ephemeral: true });
    }

    try {
      // Find the partner data
      console.log(`Looking for partner with guildId: ${targetId}`);
      const partner = await Partner.findOne({ guildId: targetId });
      console.log('Found partner data:', partner);

      if (!partner) {
        console.error(`No partner found for guild ID: ${targetId}`);
        return interaction.reply({ content: '❌ Partner data not found. The server may have been unregistered.', ephemeral: true });
      }

      // Handle message approval
      if ((action === 'approve' && type === 'msg') || action === 'approve_msg') {
        console.log('Processing message approval');
        console.log('Current partner data:', partner);
        
        if (!partner.pendingMessage) {
          console.error('No pending message found for partner');
          return interaction.reply({ content: '❌ No pending message found for this server.', ephemeral: true });
        }

        await Partner.findOneAndUpdate(
          { guildId: targetId },
          {
            messagePending: false,
            partnerMessage: partner.pendingMessage,
            $unset: { pendingMessage: "" }
          }
        );

        console.log('Message approved successfully');
        await interaction.update({ content: `✅ Approved message for ${partner.guildName}`, components: [] });

        // Notify the server and DM the user
        try {
          const guild = await client.guilds.fetch(targetId);
          
          // Send to log channel
          const logChannel = guild.channels.cache.find(c => c.name === 'ad-logs');
          if (logChannel) {
            await logChannel.send('✅ Your server ad message has been approved!');
          }

          // DM the user who submitted the message
          if (partner.pendingMessageUserId) {
            try {
              const user = await client.users.fetch(partner.pendingMessageUserId);
              await user.send(`✅ Your ad message for **${partner.guildName}** has been approved!`);
            } catch (dmError) {
              console.log('Could not DM user:', dmError);
              // If we can't DM the user, try to notify them in the log channel
              if (logChannel) {
                await logChannel.send(`<@${partner.pendingMessageUserId}> Your ad message has been approved!`);
              }
            }
          }
        } catch (err) {
          console.error('Error sending approval notification:', err);
        }
        return;
      }

      // Handle message decline
      if ((action === 'decline' && type === 'msg') || action === 'decline_msg') {
        console.log('Processing message decline');
        await Partner.findOneAndUpdate(
          { guildId: targetId },
          {
            messagePending: false,
            $unset: { pendingMessage: "" }
          }
        );

        console.log('Message declined successfully');
        await interaction.update({ content: `❌ Declined message for ${partner.guildName}`, components: [] });

        // Notify the server and DM the user
        try {
          const guild = await client.guilds.fetch(targetId);
          
          // Send to log channel
          const logChannel = guild.channels.cache.find(c => c.name === 'ad-logs');
          if (logChannel) {
            await logChannel.send('❌ Your server ad message was declined. Please submit a new message with `/setmessage`.');
          }

          // DM the user who submitted the message
          if (partner.pendingMessageUserId) {
            try {
              const user = await client.users.fetch(partner.pendingMessageUserId);
              await user.send(`❌ Your ad message for **${partner.guildName}** has been declined. Please submit a new message using \`/setmessage\`.`);
            } catch (dmError) {
              console.log('Could not DM user:', dmError);
              // If we can't DM the user, try to notify them in the log channel
              if (logChannel) {
                await logChannel.send(`<@${partner.pendingMessageUserId}> Your ad message has been declined. Please submit a new message using \`/setmessage\`.`);
              }
            }
          }
        } catch (err) {
          console.error('Error sending decline notification:', err);
        }
        return;
      }

      // Handle server approval
      if (action === 'approve' && !type) {
        console.log('Processing server approval');
        await Partner.findOneAndUpdate({ guildId: targetId }, { approved: true });
        await interaction.update({ content: `✅ Approved ${partner.guildName}`, components: [] });

        try {
          const guild = await client.guilds.fetch(targetId);
          const logChannel = guild.channels.cache.find(c => c.name === 'ad-logs');
          
          // Create the setup modal
          const modal = new ModalBuilder()
            .setCustomId(`partner_setup_${targetId}`)
            .setTitle('Partner Server Setup');

          const messageInput = new TextInputBuilder()
            .setCustomId('message')
            .setLabel('Your Server Advertisement Message')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter your server advertisement message...')
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000);

          const inviteInput = new TextInputBuilder()
            .setCustomId('invite')
            .setLabel('Server Invite Link')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://discord.gg/...')
            .setRequired(true);

          const channelInput = new TextInputBuilder()
            .setCustomId('channel')
            .setLabel('Partner Channel ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the channel ID for partner ads')
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
          const secondActionRow = new ActionRowBuilder().addComponents(inviteInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(channelInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

          // Show the modal to the server owner
          const owner = await guild.members.fetch(guild.ownerId);
          try {
            await owner.send({ 
              content: '✅ Your server has been approved for partnering! Please click the button below to set up your server advertisement.',
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId(`setup_modal_${targetId}`)
                    .setLabel('Setup Server Advertisement')
                    .setStyle(ButtonStyle.Primary)
                )
              ]
            });
          } catch (dmError) {
            console.log('Could not DM server owner:', dmError);
            // Fallback to log channel
            if (logChannel) {
              await logChannel.send({
                content: `✅ Your server has been approved for partnering! ${owner}, please click the button below to set up your server advertisement.`,
                components: [
                  new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                      .setCustomId(`setup_modal_${targetId}`)
                      .setLabel('Setup Server Advertisement')
                      .setStyle(ButtonStyle.Primary)
                  )
                ]
              });
            }
          }
        } catch (err) {
          console.error('Error sending approval notification:', err);
        }
        return;
      }

      // Handle server decline
      if (action === 'decline' && !type) {
        console.log('Processing server decline');
        await Partner.findOneAndDelete({ guildId: targetId });
        await interaction.update({ content: `❌ Declined ${partner.guildName}`, components: [] });

        try {
          const guild = await client.guilds.fetch(targetId);
          
          // Notify before leaving
          const logChannel = guild.channels.cache.find(c => c.name === 'ad-logs');
          if (logChannel) {
            await logChannel.send('❌ Your server has been declined for partnering. The bot will now leave the server.');
          }

          // Leave the server
          await guild.leave();
          console.log(`Left server ${guild.name} (${guild.id}) after declining partnership`);
        } catch (err) {
          console.error('Error handling server decline:', err);
        }
        return;
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
      return interaction.reply({ content: '❌ An error occurred while processing the interaction.', ephemeral: true });
    }
  }

  // Add this in the button interaction handler section
  if (interaction.customId.startsWith('setup_modal_')) {
    const targetId = interaction.customId.replace('setup_modal_', '');
    const modal = new ModalBuilder()
      .setCustomId(`partner_setup_${targetId}`)
      .setTitle('Partner Server Setup');

    const messageInput = new TextInputBuilder()
      .setCustomId('message')
      .setLabel('Your Server Advertisement Message')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter your server advertisement message...')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1000);

    const inviteInput = new TextInputBuilder()
      .setCustomId('invite')
      .setLabel('Server Invite Link')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://discord.gg/...')
      .setRequired(true);

    const channelInput = new TextInputBuilder()
      .setCustomId('channel')
      .setLabel('Partner Channel ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter the channel ID for partner ads')
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
    const secondActionRow = new ActionRowBuilder().addComponents(inviteInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(channelInput);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

    try {
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error showing modal:', error);
      await interaction.reply({ content: '❌ An error occurred while showing the setup form.', ephemeral: true });
    }
    return;
  }

  // Add this after the slash command handlers but before the button handler
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('partner_setup_')) {
      const guildId = interaction.customId.replace('partner_setup_', '');
      const message = interaction.fields.getTextInputValue('message');
      const inviteLink = interaction.fields.getTextInputValue('invite');
      const channelId = interaction.fields.getTextInputValue('channel');

      try {
        // Fetch the guild first
        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
          return interaction.reply({ content: '❌ Could not find the server. Please try again.', ephemeral: true });
        }

        // Validate the channel
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
          return interaction.reply({ content: '❌ Please provide a valid text channel ID from your server.', ephemeral: true });
        }

        // Validate the invite link
        if (!inviteLink.startsWith('https://discord.gg/')) {
          return interaction.reply({ content: '❌ Please provide a valid Discord invite link (https://discord.gg/...).', ephemeral: true });
        }

        // Update the partner data
        await Partner.findOneAndUpdate(
          { guildId },
          {
            partnerMessage: message,
            inviteLink: inviteLink,
            partnerChannelId: channelId
          }
        );

        return interaction.reply({ content: '✅ Server setup completed successfully!', ephemeral: true });
      } catch (error) {
        console.error('Error handling modal submit:', error);
        return interaction.reply({ content: '❌ An error occurred while processing your submission.', ephemeral: true });
      }
    }
  }
});

// Express Setup (including the navbar for home and docs pages)
const app = express();

// Wait for database connection
mongoose.connection.once('open', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

// Add error handling for the `/` route
app.get('/', async (req, res) => {
  try {
    console.log('Fetching approved partners from the database...');
    const partners = await Partner.find({ 
      approved: true,
      partnerMessage: { $exists: true, $ne: null }
    }, 'guildId guildName partnerMessage inviteLink').sort({ guildId: 1 });

    console.log('Sorting partners...');
    const topId = process.env.PRIORITY_SERVER_ID;
    const sortedPartners = partners.sort((a, b) => (a.guildId === topId ? -1 : b.guildId === topId ? 1 : 0));

    console.log('Generating partner cards...');
    const cards = await Promise.all(sortedPartners.map(async (p) => {
      try {
        console.log(`Fetching data for guild ID: ${p.guildId}`);
        let name = p.guildName || p.guildId;
        const guild = await client.guilds.fetch(p.guildId);
        const memberCount = guild.memberCount;
        const iconURL = guild.iconURL();
        const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
        const offlineMembers = guild.members.cache.filter(m => !m.presence || m.presence.status === 'offline').size;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;

        let invite = p.inviteLink ? `<a href="${p.inviteLink}" target="_blank" class="invite-button">Join Server</a>` : '<em>No invite set</em>';
        return `<div class="partner-card">
          <img src="${iconURL}" alt="Server Icon">
          <strong>${name}</strong>
          <p>${p.partnerMessage}</p>
          <div class="stats">
            <span class="stat">👥 ${memberCount} Members</span>
            <span class="stat">🟢 ${onlineMembers} Online</span>
            <span class="stat">🤖 ${botCount} Bots</span>
          </div>
          ${invite}
        </div>`;
      } catch (error) {
        console.error(`Error fetching data for guild ID ${p.guildId}:`, error);
        return `<div class="partner-card">
          <strong>${p.guildName || p.guildId}</strong>
          <p>${p.partnerMessage}</p>
          <p><em>Unable to fetch additional details.</em></p>
        </div>`;
      }
    }));

    console.log('Rendering the page...');
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Discord Partner Network</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        :root {
          --bg-primary: #1a1b1e;
          --bg-secondary: #2c2d31;
          --bg-tertiary: #18191c;
          --accent: #5865f2;
          --accent-hover: #4752c4;
          --accent-light: #7289da;
          --text-primary: #ffffff;
          --text-secondary: #dcddde;
          --text-muted: #72767d;
          --success: #3ba55c;
          --danger: #ed4245;
          --warning: #faa61a;
          --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
          --shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
          --radius-sm: 6px;
          --radius: 12px;
          --radius-lg: 16px;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          line-height: 1.6;
          min-height: 100vh;
          overflow-x: hidden;
        }
        
        .navbar {
          background: var(--bg-tertiary);
          padding: 1rem 2rem;
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          box-shadow: var(--shadow);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .navbar a {
          color: var(--text-primary);
          text-decoration: none;
          font-weight: 500;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          background: var(--bg-secondary);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          font-size: 0.95rem;
          border: 1px solid rgba(255,255,255,0.05);
        }
        
        .navbar a:hover {
          background: var(--accent);
          transform: translateY(-2px);
          border-color: var(--accent);
          box-shadow: var(--shadow-lg);
        }
        
        .navbar a::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            45deg,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
          );
          transform: translateX(-100%);
          transition: transform 0.6s;
        }
        
        .navbar a:hover::before {
          transform: translateX(100%);
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          animation: fadeIn 0.5s ease-out;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        h1 {
          color: var(--accent-light);
          text-align: center;
          margin-bottom: 3rem;
          font-size: 2.5em;
          font-weight: 700;
          position: relative;
          padding-bottom: 1rem;
        }
        
        h1::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 60px;
          height: 4px;
          background: var(--accent);
          border-radius: 2px;
        }
        
        .page-header {
          text-align: center;
          margin-bottom: 3rem;
          animation: slideDown 0.5s ease-out;
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }      .partner-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 2rem;
        margin-top: 2rem;
        padding: 1rem;
        animation: fadeIn 0.6s ease-out;
      }

      .partner-card {
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        padding: 2rem;
        text-align: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(255,255,255,0.05);
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow);
      }

      .partner-card:hover {
        transform: translateY(-5px) scale(1.02);
        box-shadow: var(--shadow-lg);
        border-color: var(--accent);
      }

      .partner-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(45deg, 
          transparent 0%, 
          rgba(88, 101, 242, 0.05) 50%,
          transparent 100%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .partner-card:hover::before {
        opacity: 1;
      }

      .partner-card img {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        margin-bottom: 1.5rem;
        border: 4px solid var(--bg-tertiary);
        transition: all 0.3s ease;
        box-shadow: var(--shadow);
      }

      .partner-card:hover img {
        transform: scale(1.05) rotate(5deg);
        border-color: var(--accent);
        box-shadow: 0 0 20px rgba(88, 101, 242, 0.3);
      }

      .partner-card strong {
        color: var(--accent-light);
        font-size: 1.5em;
        display: block;
        margin-bottom: 1rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .partner-card p {
        color: var(--text-secondary);
        line-height: 1.7;
        margin: 0 0 1.5rem;
        font-size: 0.95rem;
      }

      .partner-card .stats {
        display: flex;
        justify-content: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin: 1.5rem 0;
        font-size: 0.9em;
      }

      .partner-card .stat {
        background: var(--bg-tertiary);
        padding: 0.6rem 1rem;
        border-radius: 30px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s ease;
        border: 1px solid rgba(255,255,255,0.05);
      }

      .partner-card:hover .stat {
        transform: translateY(-2px);
        background: var(--bg-primary);
      }

      .invite-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 2rem;
        color: var(--text-primary);
        background: var(--accent);
        text-decoration: none;
        border-radius: var(--radius);
        font-weight: 600;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        margin: 1rem auto 0;
        border: none;
        position: relative;
        overflow: hidden;
        font-size: 0.95rem;
        gap: 0.5rem;
      }

      .invite-button:hover {
        background: var(--accent-hover);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(88, 101, 242, 0.4);
      }

      .invite-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          45deg,
          transparent,
          rgba(255, 255, 255, 0.2),
          transparent
        );
        transform: translateX(-100%);
        transition: transform 0.6s;
      }

      .invite-button:hover::before {
        transform: translateX(100%);
      }

      .section {
        background: var(--bg-secondary);
        border-radius: var(--radius);
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: var(--shadow);
        border: 1px solid rgba(255,255,255,0.05);
        animation: slideUp 0.5s ease-out;
      }

      .alert {
        background: rgba(88, 101, 242, 0.1);
        border-left: 4px solid var(--accent);
        padding: 1rem 1.5rem;
        margin-bottom: 2rem;
        border-radius: 0 var(--radius) var(--radius) 0;
        animation: slideIn 0.5s ease-out;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @media (max-width: 768px) {
        .partner-grid {
          grid-template-columns: 1fr;
          gap: 1.5rem;
          padding: 0.5rem;
        }

        .partner-card {
          padding: 1.5rem;
        }

        .partner-card img {
          width: 100px;
          height: 100px;
        }

        .navbar {
          flex-direction: column;
          padding: 1rem;
        }

        .navbar a {
          width: 100%;
          text-align: center;
        }

        h1 {
          font-size: 2rem;
        }
      }

      @media (max-width: 768px) {
        .partner-grid {
          grid-template-columns: 1fr;
        }
      }
      </style>
    </head>
    <body>
      <div class="navbar">
        <a href="/">Home</a>
        <a href="/docs">Docs</a>
        <a href="${process.env.DOMAIN}">SkyVPS360 - 256GB KVM VPS $4</a>
        <a href="${getBotInviteUrl()}">Invite Bot</a>
      </div>
      <div class="container">
              <h1>🤝 SkyVPS360 Discord Partner Network</h1>
        ${cards.join('')}
      </div>
    </body>
    </html>
    `;
    res.send(htmlTemplate);
  } catch (error) {
    console.error('❌ Error in the `/` route:', error);
    res.status(500).send('❌ An error occurred while loading the page.');
  }
});

app.get('/docs', (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Partner Bot Docs</title>
      <style>
        :root {
          --bg-primary: #36393f;
          --bg-secondary: #2f3136;
          --bg-tertiary: #202225;
          --accent: #7289da;
          --accent-hover: #5b6eae;
          --text-primary: #ffffff;
          --text-secondary: #dcddde;
          --text-muted: #72767d;
          --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        body {
          background: var(--bg-primary);
          color: var(--text-primary);
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          padding: 0;
          margin: 0;
          line-height: 1.6;
        }

        .navbar {
          background: var(--bg-tertiary);
          padding: 1rem 2rem;
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          box-shadow: var(--shadow);
          backdrop-filter: blur(10px);
        }

        .navbar a {
          color: var(--text-primary);
          text-decoration: none;
          font-weight: 600;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          background: var(--bg-secondary);
          transition: all 0.2s ease;
          font-size: 0.95rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .navbar a:hover {
          background: var(--accent);
          transform: translateY(-2px);
          border-color: var(--accent);
        }

        .container {
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 2rem;
        }

        h1, h2 {
          color: var(--accent);
          margin-bottom: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.025em;
        }

        h1 {
          font-size: 2.5rem;
          text-align: center;
          margin-bottom: 3rem;
          position: relative;
        }

        h1::after {
          content: "";
          display: block;
          width: 60px;
          height: 4px;
          background: var(--accent);
          margin: 1rem auto 0;
          border-radius: 2px;
        }

        h2 {
          font-size: 1.75rem;
          margin-top: 2.5rem;
        }

        p, ul, ol {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        ul, ol {
          padding-left: 1.5rem;
        }

        li {
          margin-bottom: 0.75rem;
        }

        code {
          background: var(--bg-tertiary);
          padding: 0.2em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
          font-family: 'Consolas', 'Monaco', monospace;
          color: var(--accent);
        }

        .card {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 1.5rem;
          box-shadow: var(--shadow);
          border: 1px solid var(--bg-tertiary);
        }

        strong {
          color: var(--accent);
          font-weight: 600;
        }

        .section {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: var(--shadow);
        }

        .alert {
          background: rgba(114, 137, 218, 0.1);
          border-left: 4px solid var(--accent);
          padding: 1rem 1.5rem;
          margin-bottom: 1.5rem;
          border-radius: 0 8px 8px 0;
        }

        @media (max-width: 768px) {
          .navbar {
            flex-direction: column;
            padding: 1rem;
          }
          
          .container {
            padding: 0 1rem;
          }
          
          h1 {
            font-size: 2rem;
          }
          
          h2 {
            font-size: 1.5rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="navbar">
        <a href="/">Home</a>
        <a href="/docs">Docs</a>
        <a href="${process.env.DOMAIN}">SkyVPS360 - 256GB KVM VPS $4</a>
        <a href="${getBotInviteUrl()}">Invite Bot</a>
      </div>
      <h1>📘 Partner Bot Commands</h1>
      <h2>Standard Commands</h2>
      <p>These commands require the partner role or administrator permissions:</p>
      <ul>
        <li><strong>/register</strong> – Register your server for partnership
          <ul>
            <li>After approval, you'll receive a setup form to configure your advertisement and settings</li>
            <li>If declined, the bot will automatically leave your server</li>
          </ul>
        </li>
        <li><strong>/setchannel</strong> – Set the channel for receiving partner advertisements</li>
        <li><strong>/bump</strong> – Send your advertisement to all partner servers (30-minute cooldown)</li>
        <li><strong>/unregister</strong> – Remove your server from the partner network</li>
        <li><strong>/help</strong> – View this help message</li>
      </ul>

      <h2>Special Commands</h2>
      <ul>
        <li><strong>/setrole</strong> – Set the role required to use partner commands (Server Owner only)</li>
        <li><strong>/setstatus</strong> – Change bot status (Bot Owner only)</li>
      </ul>

      <h2>Partnership Process</h2>
      <ol>
        <li>Use <code>/register</code> to request partnership</li>
        <li>Wait for approval from our staff</li>
        <li>Upon approval, you'll receive a setup form to configure:
          <ul>
            <li>Your server advertisement message</li>
            <li>Server invite link</li>
            <li>Partner channel for receiving ads</li>
          </ul>
        </li>
        <li>Use <code>/setrole</code> to set which role can use partner commands (optional)</li>
        <li>Start using <code>/bump</code> to share your advertisement!</li>
      </ol>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web dashboard running on http://localhost:${PORT}`));

// Add error handling for Discord client login
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('❌ Failed to log in to Discord:', error);
});

function getBotInviteUrl() {
  return `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
}

// Add this before the interaction handler
async function hasPermission(member, guildId) {
  // Owner override for status command
  if (member.user.id === '142025929454125056') {
    return true;
  }

  // Server owner always has permission
  if (member.id === member.guild.ownerId) {
    return true;
  }

  const partner = await Partner.findOne({ guildId });
  if (!partner || !partner.partnerRoleId) {
    // If no role is set, fall back to admin permission
    return member.permissions.has(PermissionsBitField.Flags.Administrator);
  }

  // Check if user has the partner role
  return member.roles.cache.has(partner.partnerRoleId);
}
