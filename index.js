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
  PermissionsBitField 
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
  approved: Boolean,
  lastBump: Date,
  messagePending: Boolean,
  inviteLink: String,
  // (If needed, you can add declinedAt here later)
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
  new SlashCommandBuilder().setName('setmessage')
    .setDescription('Set your server ad')
    .addStringOption(opt => opt.setName('message').setDescription('Your ad').setRequired(true)),
  new SlashCommandBuilder().setName('setchannel')
    .setDescription('Set the channel for bump posts')
    .addChannelOption(opt => opt.setName('channel').setDescription('Partner channel').setRequired(true)),
  new SlashCommandBuilder().setName('unregister').setDescription('Unregister your server'),
  new SlashCommandBuilder().setName('bump').setDescription('Send your ad to all partners'),
  new SlashCommandBuilder().setName('invite').setDescription('Get the bot invite link'),
  // Add a new command to set the server invite
  new SlashCommandBuilder().setName('setinvite')
    .setDescription('Set your server invite link')
    .addStringOption(opt => opt.setName('invite').setDescription('Your server invite link').setRequired(true)),
];

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  client.user.setActivity('skyvps360.xyz $4 256GB KVM VPS', { type: 'WATCHING' });

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
    const hasAdmin = member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    if (!hasAdmin) {
      return interaction.reply({ content: '🚫 You must have **Administrator** permissions to use this command.', ephemeral: true });
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
        .setDescription('Here are all available commands:')
        .addFields(
          { name: '/register', value: 'Register your server' },
          { name: '/setmessage', value: 'Set partner message' },
          { name: '/setchannel', value: 'Set bump channel' },
          { name: '/unregister', value: 'Remove server from partner list' },
          { name: '/bump', value: 'Broadcast your message' },
          { name: '/invite', value: 'Get bot invite' },
          { name: '/help', value: 'View this help message' }
        )
        .setFooter({ text: `Visit our docs`, iconURL: client.user.displayAvatarURL() })
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
      const msg = interaction.options.getString('message');
      await Partner.findOneAndUpdate({ guildId }, { partnerMessage: msg, messagePending: true }, { upsert: true });

      const adminGuild = await client.guilds.fetch(process.env.ADMIN_SERVER_ID);
      const adminChannel = await adminGuild.channels.fetch(process.env.ADMIN_CHANNEL_ID);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`approve_msg_${guildId}`).setLabel('✅ Approve Message').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`decline_msg_${guildId}`).setLabel('❌ Decline Message').setStyle(ButtonStyle.Danger),
      );

      await adminChannel.send({
        content: `✏️ Message update from **${guildName}**:

${msg}`,
        components: [row]
      });
      return interaction.reply('📨 Message submitted for approval.');
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
  } 

  // Handle Button Interactions
  if (interaction.isButton()) {
        const [action, targetId] = interaction.customId.split('_');

        // Validate targetId
        if (!targetId) {
            return interaction.reply({ content: '❌ Invalid button interaction.', ephemeral: true });
        }

        const partner = await Partner.findOne({ guildId: targetId });

        // Validate partner existence
        if (!partner) {
            return interaction.reply({ content: '❌ Partner data not found.', ephemeral: true });
        }

        try {
            if (action === 'approve') {
                await Partner.findOneAndUpdate({ guildId: targetId }, { approved: true });
                await interaction.update({ content: `✅ Approved ${partner.guildName}`, components: [] });

                // Send DM to the user who registered
                const user = await client.users.fetch(interaction.user.id);
                if (user) {
                    await user.send(`✅ Your server **${partner.guildName}** has been approved for partnering!`);
                }
                return;
            }

            if (action === 'decline') {
                await Partner.findOneAndDelete({ guildId: targetId });
                await interaction.update({ content: `❌ Declined ${partner.guildName}`, components: [] });

                // Send DM to the user who registered
                const user = await client.users.fetch(interaction.user.id);
                if (user) {
                    await user.send(`❌ Your server **${partner.guildName}** has been declined for partnering.`);
                }
                return;
            }

            if (action === 'approve_msg') {
                await Partner.findOneAndUpdate({ guildId: targetId }, { messagePending: false });
                await interaction.update({ content: `✅ Approved message for ${partner.guildName}`, components: [] });
                return;
            }

            if (action === 'decline_msg') {
                await Partner.findOneAndUpdate({ guildId: targetId }, { messagePending: false, partnerMessage: null });
                await interaction.update({ content: `❌ Declined message for ${partner.guildName}`, components: [] });
                return;
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            return interaction.reply({ content: '❌ An error occurred while processing the interaction.', ephemeral: true });
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
          <img src="${iconURL}" alt="Server Icon" style="width: 100px; height: 100px; border-radius: 50%; margin-bottom: 10px;">
          <strong>${name}</strong>
          <p>${p.partnerMessage}</p>
          <p>Members: ${memberCount} 👤 | Online: ${onlineMembers} 🟢 | Offline: ${offlineMembers} 🔴 | Bots: ${botCount} 🤖</p>
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
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Discord Partner Network</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #36393f;
          color: #ffffff;
          margin: 0;
          padding: 20px;
        }
        .navbar {
          background: #2c2f33;
          padding: 15px 30px;
          border-bottom: 1px solid #202225;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .navbar a {
          color: #ffffff;
          text-decoration: none;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 6px;
          background: #36393f;
          transition: all 0.2s ease;
        }
        .navbar a:hover {
          background: #7289da;
          transform: translateY(-2px);
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          color: #7289da;
          text-align: center;
          margin-bottom: 40px;
          font-size: 2.5em;
        }
        .partner-card {
          background: #2f3136;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          border: 1px solid #202225;
          text-align: center;
        }
        .partner-card strong {
          color: #7289da;
          font-size: 1.2em;
          display: block;
          margin-bottom: 10px;
        }
        .partner-card p {
          color: #dcddde;
          line-height: 1.5;
          margin: 0;
        }
        .invite-button {
          display: inline-block;
          padding: 10px 20px;
          color: #ffffff;
          background-color: #7289da;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          transition: background-color 0.3s ease;
          text-align: center;
          margin: 10px auto;
        }

        .invite-button:hover {
          background-color: #5b6eae;
        }
      </style>
    </head>
    <body>
      <div class="navbar">
        <a href="/">Home</a>
        <a href="/docs">Docs</a>
        <a href="$(DOMAIN)">SkyVPS360 - 256GB KVM VPS $4</a>
        <a href="${getBotInviteUrl()}">Invite Bot</a> </div>
      <div class="container">
        <h1>🤝 SkyVPS360 Discord Partner Network</h1>
        ${cards.join('')}
      </div>
    </body>
    </html>
    `);
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
        body {
          background: #36393f;
          color: white;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .navbar {
          background: #2c2f33;
          padding: 15px 30px;
          border-bottom: 1px solid #202225;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .navbar a {
          color: #ffffff;
          text-decoration: none;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 6px;
          background: #36393f;
          transition: all 0.2s ease;
        }
        .navbar a:hover {
          background: #7289da;
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="navbar">
        <a href="/">Home</a>
        <a href="/docs">Docs</a>
        <a href="https://skyvps360.xyz/products/data-center-new-jersey-teb2">SkyVPS360 - 256GB KVM VPS $4</a>
        <a href="${getBotInviteUrl()}">Invite Bot</a>
      </div>
      <h1>📘 Bot Commands</h1>
      <ul>
        <li>/register – Register your server</li>
        <li>/setmessage – Set partner message</li>
        <li>/setchannel – Set bump channel</li>
        <li>/unregister – Remove server from partner list</li>
        <li>/bump – Broadcast your message (30-minute cooldown)</li>
        <li>/setinvite – Set your server invite link</li>
        <li>/invite – Get bot invite</li>
        <li>/help – View this page</li>
      </ul>
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
