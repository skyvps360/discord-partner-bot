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
  TextInputStyle,
} = require("discord.js");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const { createCanvas } = require('canvas');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const MongoStore = require('connect-mongo');

/**
 * Returns an object containing the uppercase first character of the input string for use as a letter icon.
 * @param {string} letter - The input string from which to extract the first character.
 * @return {{char: string}} An object with the uppercase character for icon display.
 */
function generateLetterIcon(letter) {
  // Take first character and convert to uppercase
  const char = String(letter || '?').charAt(0).toUpperCase();
  
  // Return just the character - we'll handle styling in CSS
  // The color will be controlled by the CSS variables
  return { char };
}

// MongoDB Setup (Removed deprecated options)
mongoose.connect(process.env.MONGO_URI);

const TopTierSlotSchema = new mongoose.Schema({
  slotNumber: Number,
  guildId: String,
  guildName: String,
});
const TopTierSlot = mongoose.model("TopTierSlot", TopTierSlotSchema);

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
  partnerRoleId: String,
  isTopTier: Boolean,
});
const Partner = mongoose.model("Partner", PartnerSchema);

// Banned Guilds Schema
const BannedGuildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  guildName: String,
  bannedAt: { type: Date, default: Date.now },
  bannedBy: String,
  reason: String
});
const BannedGuild = mongoose.model("BannedGuild", BannedGuildSchema);

// Discord Bot Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

const commands = [
  new SlashCommandBuilder().setName("help").setDescription("List all commands"),
  new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register your server for partnering"),
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Set bump channel")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Partner channel")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Unregister your server"),
  new SlashCommandBuilder()
    .setName("bump")
    .setDescription("Send your ad to all partners"),
  new SlashCommandBuilder()
    .setName("setstatus")
    .setDescription("Set the bot's status (Owner only)")
    .addStringOption((opt) =>
      opt
        .setName("status")
        .setDescription("The status message")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("Set the role required to use partner bot commands")
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role that can use partner bot commands")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("settopslot")
    .setDescription("Set a server in a top tier slot (Bot Owner only)")
    .addStringOption((option) =>
      option
        .setName("serverid")
        .setDescription("The server ID to add to the top slot")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("slot")
        .setDescription("The slot number (1-3)")
        .setRequired(true)
        .addChoices(
          { name: "Slot 1", value: 1 },
          { name: "Slot 2", value: 2 },
          { name: "Slot 3", value: 3 },
        ),
    ),
  new SlashCommandBuilder()
    .setName("removetopslot")
    .setDescription("Remove a server from a top tier slot (Owner only)")
    .addIntegerOption((option) =>
      option
        .setName("slot")
        .setDescription("The slot number to clear (1-3)")
        .setRequired(true)
        .addChoices(
          { name: "Slot 1", value: 1 },
          { name: "Slot 2", value: 2 },
          { name: "Slot 3", value: 3 },
        ),
    ),
  new SlashCommandBuilder()
    .setName("adminunregister")
    .setDescription("Remove a server from the partner network (Bot Owner only)")
    .addStringOption(option =>
      option
        .setName("guildid")
        .setDescription("The ID of the server to unregister")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Make the bot leave a server (Bot Owner only)")
    .addStringOption(option =>
      option
        .setName("guildid")
        .setDescription("The ID of the server to leave")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a server from using the bot (Bot Owner only)")
    .addStringOption(option =>
      option
        .setName("guildid")
        .setDescription("The ID of the server to ban")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for the ban")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a server (Bot Owner only)")
    .addStringOption(option =>
      option
        .setName("guildid")
        .setDescription("The ID of the server to unban")
        .setRequired(true)
    ),
];

// Event handler for when the bot is added to a new server
client.on("guildCreate", async (guild) => {
  try {
    // Check if this guild is banned
    const bannedGuild = await BannedGuild.findOne({ guildId: guild.id });
    if (bannedGuild) {
      console.log(`Automatically leaving banned guild: ${guild.name} (${guild.id})`);
      await guild.leave();
      return;
    }

    // Log when the bot joins a new server
    console.log(`Joined new guild: ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error('Error in guildCreate event:', error);
  }
});

client.once("ready", async () => {
  try {
    console.log(`Logged in as ${client.user.tag}`);

    // Set bot's activity status
    await client.user.setActivity("skyvps360.xyz $3 Ryzen Epyc KVM VPS", {
      type: ActivityType.Watching,
    });

    // Create REST instance for command registration
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN,
    );

    console.log("Started refreshing application (/) commands...");

    // Register commands globally for all guilds
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands,
    });

    // Get the number of servers the bot is in
    const guildCount = client.guilds.cache.size;

    console.log(`✅ Successfully registered application commands globally`);
    console.log(`🌐 Bot is active in ${guildCount} servers`);

    // Log all servers the bot is in
    client.guilds.cache.forEach((guild) => {
      console.log(
        `📋 Server: ${guild.name} (${guild.id}) - Members: ${guild.memberCount}`,
      );
    });
  } catch (error) {
    console.error("❌ Error during startup:", error);
  }
});

// Use a single merged event handler for all interaction types.
client.on("interactionCreate", async (interaction) => {
  // Handle Slash Commands
  if (interaction.isChatInputCommand()) {
    // Ensure the command is used in a guild
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        ephemeral: true,
      });
    }

    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;
    const member = interaction.member;
    const hasCommandPermission = await hasPermission(member, guildId);

    // Special handling for setstatus command
    if (
      interaction.commandName === "setstatus" &&
      member.user.id !== "142025929454125056"
    ) {
      return interaction.reply({
        content: "🚫 Only the bot owner can use this command.",
        ephemeral: true,
      });
    }

    // Skip permission check for /help command
    if (interaction.commandName !== "help" && !hasCommandPermission) {
      return interaction.reply({
        content:
          "🚫 You do not have permission to use this command. You need the partner role or administrator permissions.",
        ephemeral: true,
      });
    }

    // Get or create the log channel
    const logChannelName = "ad-logs";
    let logChannel = interaction.guild.channels.cache.find(
      (c) => c.name === logChannelName,
    );
    if (!logChannel) {
      logChannel = await interaction.guild.channels.create({
        name: logChannelName,
        type: ChannelType.GuildText,
      });
    }

    await logChannel.send(
      `📥 Command used: \`${interaction.commandName}\` by ${interaction.user.tag}`,
    );

    // Slash Command Handlers:
    if (interaction.commandName === "help") {
      // Create sections for different command types
      const commandSections = [
        {
          title: "📌 GETTING STARTED",
          description: "These commands help you set up and manage your server's partnership:",
          commands: [
            { 
              name: "/register", 
              description: "Start the partnership process for your server" 
            },
            { 
              name: "/setchannel", 
              description: "Set the channel where partner ads will appear" 
            },
            { 
              name: "/bump", 
              description: "Share your server ad with all partners (30-min cooldown)" 
            }
          ]
        },
        {
          title: "⚙️ SERVER CONFIGURATION",
          description: "Manage your server's partnership settings (requires partner role or admin):",
          commands: [
            { 
              name: "/setrole", 
              description: "Set which role can use partner commands (Server Owner only)" 
            },
            { 
              name: "/unregister", 
              description: "Remove your server from the partner network (Partner role or Admin required)" 
            },
            { 
              name: "/setchannel", 
              description: "Set the channel for receiving partner ads" 
            }
          ]
        },
        {
          title: "🛡️ BOT OWNER COMMANDS",
          description: "These commands are only available to the bot owner:",
          commands: [
            { name: "/adminunregister <guildid>", description: "Remove a server from the network" },
            { name: "/kick <guildid>", description: "Make the bot leave a server" },
            { name: "/ban <guildid> [reason]", description: "Ban a server from using the bot" },
            { name: "/unban <guildid>", description: "Unban a server" },
            { name: "/setstatus", description: "Change the bot's status" }
          ]
        }
      ];

      // Create the main help embed
      const helpEmbed = new EmbedBuilder()
        .setColor("#7289da")
        .setTitle("🤝 Partner Bot Help Center")
        .setDescription("Welcome to the Partner Bot! Here's how to get started:")
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          {
            name: "🔹 Important Notice",
            value: "**WARNING ABOUT /setrole**: When setting up the partner role with `/setrole`, please ensure you select a **staff or admin role** that should have access to partner commands. This role will have special permissions, so choose carefully!"
          }
        )
        .setFooter({
          text: `Use /help in a server to see server-specific commands`,
          iconURL: interaction.guild?.iconURL() || client.user.displayAvatarURL()
        });

      // Add command sections
      for (const section of commandSections) {
        helpEmbed.addFields(
          { 
            name: `\n${section.title}`, 
            value: section.description,
            inline: false 
          },
          ...section.commands.map(cmd => ({
            name: `• ${cmd.name}`,
            value: cmd.description,
            inline: false
          }))
        );
      }

      // Add final notes
      helpEmbed.addFields(
        {
          name: "\nNeed More Help?",
          value: `• Type a command for more details\n• Visit our [Documentation](${process.env.SITE_URL || `http://0.0.0.0:${process.env.PORT || 4444}`}/docs) for guides\n• Contact server staff for assistance`
        }
      );

      return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }

    if (interaction.commandName === "register") {
      const existing = await Partner.findOne({ guildId });
      if (existing) {
        return interaction.reply({
          content:
            "❌ This server is already registered and cannot register again.",
          ephemeral: true,
        });
      }

      await Partner.create({
        guildId,
        guildName,
        approved: false,
        messagePending: false,
        lastBump: new Date(),
      });

      // Create an invite link for the server
      let inviteLink = 'Unable to generate invite link';
      try {
        // Try to create an invite in the system channel or first available text channel
        const channel = interaction.guild.systemChannel || 
          interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(interaction.guild.members.me).has('CREATE_INSTANT_INVITE'));
        
        if (channel) {
          const invite = await channel.createInvite({
            maxAge: 86400, // 24 hours
            maxUses: 5,
            unique: true,
            reason: 'Server verification for partner application'
          });
          inviteLink = invite.url;
        }
      } catch (inviteError) {
        console.error('Error creating invite:', inviteError);
        inviteLink = 'Error generating invite link';
      }

      const actionRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${guildId}`)
          .setLabel("✅ Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`decline_${guildId}`)
          .setLabel("❌ Decline")
          .setStyle(ButtonStyle.Danger)
      );

      const actionRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setURL(inviteLink)
          .setLabel("🔗 Join Server")
          .setStyle(ButtonStyle.Link)
      );

      try {
        const adminGuild = await client.guilds.fetch(process.env.ADMIN_SERVER_ID);
        if (!adminGuild) {
          console.error("Admin guild not found. Check ADMIN_SERVER_ID in the .env file.");
          return;
        }

        const adminChannel = await adminGuild.channels.fetch(process.env.ADMIN_CHANNEL_ID);
        if (!adminChannel) {
          console.error("Admin channel not found. Check ADMIN_CHANNEL_ID in the .env file.");
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📥 New Partner Registration')
          .setDescription(`**Server:** ${guildName}\n**ID:** ${guildId}`)
          .addFields(
            { name: 'Invite Link', value: inviteLink || 'No invite link generated' },
            { name: 'Member Count', value: interaction.guild.memberCount.toString() }
          )
          .setThumbnail(interaction.guild.iconURL())
          .setTimestamp();

        await adminChannel.send({
          embeds: [embed],
          components: [actionRow1, actionRow2]
        });
        return interaction.reply(
          "✅ Registration submitted. Please wait for approval.",
        );
      } catch (error) {
        console.error("Error fetching guild or channel:", error);
        return interaction.reply(
          "❌ An error occurred while processing your request.",
        );
      }
    }

    if (interaction.commandName === "setmessage") {
      console.log("Processing setmessage command");
      const msg = interaction.options.getString("message");
      const userId = interaction.user.id;
      console.log("Message content:", msg);
      console.log("Guild ID:", guildId);
      console.log("User ID:", userId);

      const partner = await Partner.findOne({ guildId });
      console.log("Found partner data:", partner);

      if (!partner) {
        return interaction.reply({
          content:
            "❌ Your server must be registered first. Use `/register` to register.",
          ephemeral: true,
        });
      }

      try {
        const adminGuild = await client.guilds.fetch(
          process.env.ADMIN_SERVER_ID,
        );
        if (!adminGuild) {
          console.error("Admin guild not found:", process.env.ADMIN_SERVER_ID);
          return interaction.reply({
            content: "❌ Configuration error: Admin guild not found",
            ephemeral: true,
          });
        }

        const adminChannel = await adminGuild.channels.fetch(
          process.env.ADMIN_CHANNEL_ID,
        );
        if (!adminChannel) {
          console.error(
            "Admin channel not found:",
            process.env.ADMIN_CHANNEL_ID,
          );
          return interaction.reply({
            content: "❌ Configuration error: Admin channel not found",
            ephemeral: true,
          });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${guildId}`)
            .setLabel("✅ Approve Message")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`decline_${guildId}`)
            .setLabel("❌ Decline Message")
            .setStyle(ButtonStyle.Danger),
        );

        await Partner.findOneAndUpdate(
          { guildId },
          {
            messagePending: true,
            pendingMessageUserId: userId,
            $set: { pendingMessage: msg },
          },
          { upsert: true },
        );

        await adminChannel.send({
          content: `✏️ Message update from **${guildName}** by <@${userId}>:\n\n${msg}`,
          components: [row],
        });
        return interaction.reply(
          "📨 Message submitted for approval. The current message will remain unchanged until approved.",
        );
      } catch (error) {
        console.error("Error in setmessage command:", error);
        return interaction.reply({
          content:
            "❌ An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        });
      }
    }

    if (interaction.commandName === "setchannel") {
      const channel = interaction.options?.getChannel("channel");
      // Validate that channel exists, is null, and is text-based
      if (
        !channel ||
        ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
          channel.type,
        )
      ) {
        return interaction.reply({
          content: "❌ Please select a valid text-based channel.",
          ephemeral: true,
        });
      }
      await Partner.findOneAndUpdate(
        { guildId },
        { partnerChannelId: channel.id },
        { upsert: true },
      );
      return interaction.reply(`📢 Partner channel set to <#${channel.id}>`);
    }

    if (interaction.commandName === "unregister") {
      // Check if user has admin permissions or the partner role
      const hasAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
      const partner = await Partner.findOne({ guildId });
      
      // If no partner role is set, only allow server owner to unregister
      if (!partner?.partnerRoleId) {
        if (interaction.member.id !== interaction.guild.ownerId) {
          return interaction.reply({
            content: "❌ Only the server owner can unregister this server.",
            ephemeral: true
          });
        }
      } 
      // If partner role is set, check if user has it or is admin
      else if (!hasAdmin) {
        const hasRole = interaction.member.roles.cache.has(partner.partnerRoleId);
        if (!hasRole) {
          return interaction.reply({
            content: `❌ You need the partner role or administrator permissions to unregister this server.`,
            ephemeral: true
          });
        }
      }

      // If we get here, user has permission to unregister
      await Partner.deleteOne({ guildId });
      return interaction.reply({
        content: "🗑️ Server has been unregistered from the partner network.",
        ephemeral: true
      });
    }

    if (interaction.commandName === "bump") {
      const self = await Partner.findOne({ guildId });
      if (!self || !self.approved) {
        return interaction.reply({
          content: "❌ This server is not an approved partner.",
          ephemeral: true,
        });
      }
      
      if (!self.partnerMessage || !self.partnerChannelId) {
        return interaction.reply({
          content: "❌ The server admin needs to set up the partner message and channel first.",
          ephemeral: true,
        });
      }
      // Update the bump command to include a 30-minute timeout
      const cooldown = 30 * 60 * 1000;
      if (self.lastBump && Date.now() - self.lastBump.getTime() < cooldown) {
        const remaining = (
          (cooldown - (Date.now() - self.lastBump.getTime())) /
          60000
        ).toFixed(1);
        return interaction.reply({
          content: `⏳ Please wait ${remaining} more minutes.`,
          ephemeral: true,
        });
      }
      const allPartners = await Partner.find({
        guildId: { $ne: guildId },
        approved: true,
      });
      let count = 0;
      for (const partner of allPartners) {
        try {
          const guild = await client.guilds.fetch(partner.guildId);
          const channel = await guild.channels.fetch(partner.partnerChannelId);
          if (channel) {
            const bumpEmbed = new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle(`📢 Partner Advertisement: ${interaction.guild.name}`)
              .setDescription(`${self.partnerMessage}${self.inviteLink ? `\n\n🔗 [Join our server](${self.inviteLink})` : ''}`)
              .setTimestamp()
              .setFooter({ text: 'SkyVPS360.xyz Partner Network' });
            
            if (interaction.guild.iconURL()) {
              bumpEmbed.setThumbnail(interaction.guild.iconURL());
            }

            await channel.send({ embeds: [bumpEmbed] });
            count++;
          }
        } catch (err) {
          console.log(`❌ Could not bump to ${partner.guildId}`);
        }
      }
      await Partner.findOneAndUpdate({ guildId }, { lastBump: new Date() });
      return interaction.reply(`✅ Bump sent to ${count} partner servers.`);
    }

    if (interaction.commandName === "invite") {
      const invite = getBotInviteUrl(); // Use the function here
      return interaction.reply({
        content: `🔗 [Click here to invite the bot](${invite})`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "setinvite") {
      const invite = interaction.options.getString("invite");
      // Validate the invite link format
      const inviteRegex = /^https:\/\/discord\.gg\//;
      if (!inviteRegex.test(invite)) {
        return interaction.reply({
          content:
            "❌ Please provide a valid Discord invite link (https://discord.gg/...).",
          ephemeral: true,
        });
      }
      await Partner.findOneAndUpdate(
        { guildId },
        { inviteLink: invite },
        { upsert: true },
      );
      return interaction.reply(`🔗 Invite link set to: ${invite}`);
    }

    // Fix the /setstatus command handler to avoid multiple interaction acknowledgments
    if (interaction.commandName === "setstatus") {
      console.log(
        `Received /setstatus command from user: ${interaction.user.id}`,
      );

      // Check if the user is the bot owner
      if (interaction.user.id !== "142025929454125056") {
        console.log("Unauthorized user attempted to use /setstatus");
        return interaction.reply({
          content: "❌ You are not authorized to use this command.",
          ephemeral: true,
        });
      }

      // Get the status message from the command options
      const status = interaction.options.getString("status");
      console.log(`Attempting to set bot status to: ${status}`);

      try {
        // Set the bot's status using the correct ActivityType
        await client.user.setActivity(status, { type: ActivityType.Watching });
        console.log("Bot status updated successfully");

        // Log the current activity to confirm
        const currentActivity =
          client.user.presence.activities[0]?.name || "No activity";
        console.log(`Current bot activity: ${currentActivity}`);

        return interaction.reply({
          content: `✅ Bot status updated to: **${status}**`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error updating bot status:", error);
        return interaction.reply({
          content:
            "❌ Failed to update bot status. Check the logs for details.",
          ephemeral: true,
        });
      }
    }

    if (interaction.commandName === "setrole") {
      // Only server owner can set the role
      if (interaction.member.id !== interaction.guild.ownerId) {
        return interaction.reply({
          content: "❌ Only the server owner can set the partner role.",
          ephemeral: true,
        });
      }

      const role = interaction.options.getRole("role");
      await Partner.findOneAndUpdate(
        { guildId },
        { partnerRoleId: role.id },
        { upsert: true },
      );

      return interaction.reply({
        content: `✅ Partner role set to ${role.name}. Members with this role can now use partner commands.`,
        ephemeral: true,
      });
    }

    // Top tier slot commands
    if (interaction.commandName === "settopslot") {
      if (interaction.user.id !== "142025929454125056") {
        return interaction.reply({
          content: "❌ Only the bot owner can manage top tier slots.",
          ephemeral: true,
        });
      }

      const serverId = interaction.options.getString("serverid");
      const slotNumber = interaction.options.getInteger("slot");

      try {
        const guild = await client.guilds.fetch(serverId);
        if (!guild) {
          return interaction.reply({
            content: "❌ Could not find the specified server.",
            ephemeral: true,
          });
        }

        const partner = await Partner.findOne({ guildId: serverId });
        if (!partner || !partner.approved) {
          return interaction.reply({
            content: "❌ Server must be an approved partner first.",
            ephemeral: true,
          });
        }

        await TopTierSlot.findOneAndUpdate(
          { slotNumber },
          { guildId: serverId, guildName: guild.name },
          { upsert: true },
        );

        return interaction.reply({
          content: `✅ Server "${guild.name}" has been set to top tier slot ${slotNumber}.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error setting top tier slot:", error);
        return interaction.reply({
          content: "❌ An error occurred while setting the top tier slot.",
          ephemeral: true,
        });
      }
    }

    if (interaction.commandName === "adminunregister") {
      // Check if the user is the bot owner
      if (interaction.user.id !== "142025929454125056") { // Replace with your actual user ID
        return interaction.reply({
          content: "❌ This command can only be used by the bot owner.",
          ephemeral: true
        });
      }

      const guildId = interaction.options.getString("guildid");
      
      try {
        // Find the partner in the database
        const partner = await Partner.findOne({ guildId });
        if (!partner) {
          return interaction.reply({
            content: "❌ No partner found with that server ID.",
            ephemeral: true
          });
        }

        // Get the guild name before deleting
        const guildName = partner.guildName;
        
        // Delete from database
        await Partner.deleteOne({ guildId });
        
        // Try to leave the guild
        try {
          const guild = await client.guilds.fetch(guildId);
          if (guild) {
            await guild.leave();
            console.log(`Left guild: ${guild.name} (${guildId})`);
          }
        } catch (guildError) {
          console.error(`Error leaving guild ${guildId}:`, guildError);
          // Continue even if we can't leave the guild
        }

        // Notify all partners
        const allPartners = await Partner.find({
          approved: true,
          partnerChannelId: { $exists: true, $ne: null }
        });

        let notifiedCount = 0;
        const notificationPromises = allPartners.map(async p => {
          try {
            const guild = await client.guilds.fetch(p.guildId);
            if (!guild) return;
            
            const channel = await guild.channels.fetch(p.partnerChannelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
              .setColor('#FF4444')
              .setTitle('🚫 Partner Removed')
              .setDescription(`**${guildName}** has been removed from the partner network.`)
              .setTimestamp();

            await channel.send({ embeds: [embed] });
            notifiedCount++;
          } catch (error) {
            console.error(`Failed to notify ${p.guildId}:`, error);
          }
        });

        await Promise.all(notificationPromises);

        return interaction.reply({
          content: `✅ Successfully unregistered **${guildName}** (${guildId}). Notified ${notifiedCount} partners.`,
          ephemeral: true
        });

      } catch (error) {
        console.error('Error in adminunregister command:', error);
        return interaction.reply({
          content: '❌ An error occurred while processing your request.',
          ephemeral: true
        });
      }
    }

    // Server Management Commands
    if (interaction.commandName === "kick") {
      // Check if the user is the bot owner
      if (interaction.user.id !== "142025929454125056") {
        return interaction.reply({
          content: "❌ This command can only be used by the bot owner.",
          ephemeral: true
        });
      }

      const guildId = interaction.options.getString("guildid");
      
      try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
          return interaction.reply({
            content: "❌ Could not find the specified server.",
            ephemeral: true
          });
        }

        const guildName = guild.name;
        await guild.leave();
        
        return interaction.reply({
          content: `✅ Successfully left server: **${guildName}** (${guildId})`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Error in kick command:', error);
        return interaction.reply({
          content: `❌ Error leaving server: ${error.message}`,
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === "ban") {
      // Check if the user is the bot owner
      if (interaction.user.id !== "142025929454125056") {
        return interaction.reply({
          content: "❌ This command can only be used by the bot owner.",
          ephemeral: true
        });
      }

      const guildId = interaction.options.getString("guildid");
      const reason = interaction.options.getString("reason") || "No reason provided";
      
      try {
        // Check if already banned
        const existingBan = await BannedGuild.findOne({ guildId });
        if (existingBan) {
          return interaction.reply({
            content: `❌ Server ${guildId} is already banned.`,
            ephemeral: true
          });
        }

        // Try to get guild info before banning
        let guildName = guildId;
        try {
          const guild = await client.guilds.fetch(guildId);
          if (guild) {
            guildName = guild.name;
            // Leave the guild
            await guild.leave();
          }
        } catch (guildError) {
          console.log(`Could not fetch guild ${guildId}, but will still ban it:`, guildError);
        }

        // Add to ban list
        await BannedGuild.create({
          guildId,
          guildName,
          bannedBy: interaction.user.tag,
          reason
        });

        // Remove from partners if exists
        await Partner.deleteOne({ guildId });

        return interaction.reply({
          content: `✅ Successfully banned server **${guildName}** (${guildId})`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Error in ban command:', error);
        return interaction.reply({
          content: `❌ Error banning server: ${error.message}`,
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === "unban") {
      // Check if the user is the bot owner
      if (interaction.user.id !== "142025929454125056") {
        return interaction.reply({
          content: "❌ This command can only be used by the bot owner.",
          ephemeral: true
        });
      }

      const guildId = interaction.options.getString("guildid");
      
      try {
        const result = await BannedGuild.deleteOne({ guildId });
        
        if (result.deletedCount === 0) {
          return interaction.reply({
            content: `❌ Server ${guildId} is not currently banned.`,
            ephemeral: true
          });
        }

        return interaction.reply({
          content: `✅ Successfully unbanned server ${guildId}. They can now invite the bot again.`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Error in unban command:', error);
        return interaction.reply({
          content: `❌ Error unbanning server: ${error.message}`,
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === "removetopslot") {
      if (interaction.user.id !== "142025929454125056") {
        return interaction.reply({
          content: "❌ Only the bot owner can manage top tier slots.",
          ephemeral: true,
        });
      }

      const slotNumber = interaction.options.getInteger("slot");

      try {
        const slot = await TopTierSlot.findOneAndDelete({ slotNumber });
        if (!slot) {
          return interaction.reply({
            content: "❌ No server was assigned to this slot.",
            ephemeral: true,
          });
        }

        return interaction.reply({
          content: `✅ Removed server from top tier slot ${slotNumber}.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error removing top tier slot:", error);
        return interaction.reply({
          content: "❌ An error occurred while removing the top tier slot.",
          ephemeral: true,
        });
      }
    }
  }

  // Handle Button Interactions
  if (interaction.isButton()) {
    console.log("Button interaction received:", {
      customId: interaction.customId,
      user: interaction.user.tag,
      guild: interaction.guild?.name,
    });

    // Split the customId and handle legacy format
    let action, type, targetId;
    const parts = interaction.customId.split("_");

    if (parts.length === 2) {
      // Handle legacy format (approve_guildId or decline_guildId)
      [action, targetId] = parts;
      type = action.includes("msg") ? "msg" : null;
    } else if (parts.length === 3) {
      // Handle new format (approve_msg_guildId)
      [action, type, targetId] = parts;
    } else {
      console.error("Invalid button customId format:", interaction.customId);
      return interaction.reply({
        content: "❌ Invalid button interaction format.",
        ephemeral: true,
      });
    }

    console.log("Parsed button data:", { action, type, targetId });

    // Validate targetId
    if (!targetId) {
      console.error("No target ID found in button interaction");
      return interaction.reply({
        content: "❌ Invalid button interaction: No target ID.",
        ephemeral: true,
      });
    }

    try {
      // Find the partner data
      console.log(`Looking for partner with guildId: ${targetId}`);
      const partner = await Partner.findOne({ guildId: targetId });
      console.log("Found partner data:", partner);

      if (!partner) {
        console.error(`No partner found for guild ID: ${targetId}`);
        return interaction.reply({
          content:
            "❌ Partner data not found. The server may have been unregistered.",
          ephemeral: true,
        });
      }

      // Handle message approval
      if (
        (action === "approve" && type === "msg") ||
        action === "approve_msg"
      ) {
        console.log("Processing message approval");
        console.log("Current partner data:", partner);

        if (!partner.pendingMessage) {
          console.error("No pending message found for partner");
          return interaction.reply({
            content: "❌ No pending message found for this server.",
            ephemeral: true,
          });
        }

        await Partner.findOneAndUpdate(
          { guildId: targetId },
          {
            messagePending: false,
            partnerMessage: partner.pendingMessage,
            $unset: { pendingMessage: "" },
          },
        );

        console.log("Message approved successfully");
        await interaction.update({
          content: `✅ Approved message for ${partner.guildName}`,
          components: [],
        });

        // Notify the server and DM the user
        try {
          const guild = await client.guilds.fetch(targetId);

          // Send to log channel
          const logChannel = guild.channels.cache.find(
            (c) => c.name === "ad-logs",
          );
          if (logChannel) {
            await logChannel.send(
              "✅ Your server ad message has been approved!",
            );
          }

          // DM the user who submitted the message
          if (partner.pendingMessageUserId) {
            try {
              const user = await client.users.fetch(
                partner.pendingMessageUserId,
              );
              await user.send(
                `✅ Your ad message for **${partner.guildName}** has been approved!`,
              );
            } catch (dmError) {
              console.log("Could not DM user:", dmError);
              // If we can't DM the user, try to notify them in the log channel
              if (logChannel) {
                await logChannel.send(
                  `<@${partner.pendingMessageUserId}> Your ad message has been approved!`,
                );
              }
            }
          }
        } catch (err) {
          console.error("Error sending approval notification:", err);
        }
        return;
      }

      // Handle message decline
      if (
        (action === "decline" && type === "msg") ||
        action === "decline_msg"
      ) {
        console.log("Processing message decline");
        await Partner.findOneAndUpdate(
          { guildId: targetId },
          {
            messagePending: false,
            $unset: { pendingMessage: "" },
          },
        );

        console.log("Message declined successfully");
        await interaction.update({
          content: `❌ Declined message for ${partner.guildName}`,
          components: [],
        });

        // Notify the server and DM the user
        try {
          const guild = await client.guilds.fetch(targetId);

          // Send to log channel
          const logChannel = guild.channels.cache.find(
            (c) => c.name === "ad-logs",
          );
          if (logChannel) {
            await logChannel.send(
              "❌ Your server ad message was declined. Please submit a new message with `/setmessage`.",
            );
          }

          // DM the user who submitted the message
          if (partner.pendingMessageUserId) {
            try {
              const user = await client.users.fetch(
                partner.pendingMessageUserId,
              );
              await user.send(
                `❌ Your ad message for **${partner.guildName}** has been declined. Please submit a new message using \`/setmessage\`.`,
              );
            } catch (dmError) {
              console.log("Could not DM user:", dmError);
              // If we can't DM the user, try to notify them in the log channel
              if (logChannel) {
                await logChannel.send(
                  `<@${partner.pendingMessageUserId}> Your ad message has been declined. Please submit a new message using \`/setmessage\`.`,
                );
              }
            }
          }
        } catch (err) {
          console.error("Error sending decline notification:", err);
        }
        return;
      }

      // Handle server approval
      if (action === "approve" && !type) {
        console.log("Processing server approval");
        await Partner.findOneAndUpdate(
          { guildId: targetId },
          { approved: true },
        );
        await interaction.update({
          content: `✅ Approved ${partner.guildName}`,
          components: [],
        });

        try {
          const guild = await client.guilds.fetch(targetId);

          // Create the setup modal
          const modal = new ModalBuilder()
            .setCustomId(`partner_setup_${targetId}`)
            .setTitle("Partner Server Setup");

          const messageInput = new TextInputBuilder()
            .setCustomId("message")
            .setLabel("Your Server Advertisement Message")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Enter your server advertisement message...")
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000);

          const inviteInput = new TextInputBuilder()
            .setCustomId("invite")
            .setLabel("Server Invite Link")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("https://discord.gg/...")
            .setRequired(true);

          const channelInput = new TextInputBuilder()
            .setCustomId("channel")
            .setLabel("Partner Channel ID")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Enter the channel ID for partner ads")
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder().addComponents(
            messageInput,
          );
          const secondActionRow = new ActionRowBuilder().addComponents(
            inviteInput,
          );
          const thirdActionRow = new ActionRowBuilder().addComponents(
            channelInput,
          );

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

          // Show the modal to the server owner
          const owner = await guild.members.fetch(guild.ownerId);
          try {
            await owner.send({
              content:
                `✅ Your server **${guild.name}** has been approved for partnering! Please click the button below to set up your server advertisement.`,
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId(`setup_modal_${targetId}`)
                    .setLabel("Setup Server Advertisement")
                    .setStyle(ButtonStyle.Primary),
                ),
              ],
            });
          } catch (dmError) {
            console.log("Could not DM server owner:", dmError);
            // Fallback to log channel
            if (logChannel) {
              await logChannel.send({
                content: `✅ Your server **${guild.name}** has been approved for partnering! ${owner}, please click the button below to set up your server advertisement.`,
                components: [
                  new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                      .setCustomId(`setup_modal_${targetId}`)
                      .setLabel("Setup Server Advertisement")
                      .setStyle(ButtonStyle.Primary),
                  ),
                ],
              });
            }
          }
        } catch (err) {
          console.error("Error sending approval notification:", err);
        }
        return;
      }

      // Handle server decline
      if (action === "decline" && !type) {
        console.log("Processing server decline");
        await Partner.findOneAndDelete({ guildId: targetId });
        await interaction.update({
          content: `❌ Declined ${partner.guildName}`,
          components: [],
        });

        try {
          const guild = await client.guilds.fetch(targetId);

          // Notify before leaving
          const logChannel = guild.channels.cache.find(
            (c) => c.name === "ad-logs",
          );
          if (logChannel) {
            await logChannel.send(
              "❌ Your server has been declined for partnering. The bot will now leave the server.",
            );
          }

          // Leave the server
          await guild.leave();
          console.log(
            `Left server ${guild.name} (${guild.id}) after declining partnership`,
          );
        } catch (err) {
          console.error("Error handling server decline:", err);
        }
        return;
      }
    } catch (error) {
      console.error("Error handling button interaction:", error);
      return interaction.reply({
        content: "❌ An error occurred while processing the interaction.",
        ephemeral: true,
      });
    }
  }

  // Add this in the button interaction handler section
  if (interaction.customId.startsWith("setup_modal_")) {
    const targetId = interaction.customId.replace("setup_modal_", "");
    const modal = new ModalBuilder()
      .setCustomId(`partner_setup_${targetId}`)
      .setTitle("Partner Server Setup");

    const messageInput = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("Your Server Advertisement Message")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter your server advertisement message...")
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1000);

    const inviteInput = new TextInputBuilder()
      .setCustomId("invite")
      .setLabel("Server Invite Link")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("https://discord.gg/...")
      .setRequired(true);

    const channelInput = new TextInputBuilder()
      .setCustomId("channel")
      .setLabel("Partner Channel ID")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter the channel ID for partner ads")
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
    const secondActionRow = new ActionRowBuilder().addComponents(inviteInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(channelInput);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

    try {
      await interaction.showModal(modal);
    } catch (error) {
      console.error("Error showing modal:", error);
      await interaction.reply({
        content: "❌ An error occurred while showing the setup form.",
        ephemeral: true,
      });
    }
    return;
  }

  // Add this after the slash command handlers but before the button handler
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("partner_setup_")) {
      const guildId = interaction.customId.replace("partner_setup_", "");
      const message = interaction.fields.getTextInputValue("message");
      const inviteLink = interaction.fields.getTextInputValue("invite");
      const channelId = interaction.fields.getTextInputValue("channel");

      try {
        // Fetch the guild first
        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
          return interaction.reply({
            content: "❌ Could not find the server. Please try again.",
            ephemeral: true,
          });
        }

        // Validate the channel
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (
          !channel ||
          ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
            channel.type,
          )
        ) {
          return interaction.reply({
            content:
              "❌ Please provide a valid text channel ID from your server.",
            ephemeral: true,
          });
        }

        // Validate the invite link
        if (!inviteLink.startsWith("https://discord.gg/")) {
          return interaction.reply({
            content:
              "❌ Please provide a valid Discord invite link (https://discord.gg/...).",
            ephemeral: true,
          });
        }

        // Update the partner data
        await Partner.findOneAndUpdate(
          { guildId },
          {
            partnerMessage: message,
            inviteLink: inviteLink,
            partnerChannelId: channelId,
          },
        );

        return interaction.reply({
          content: "✅ Server setup completed successfully!",
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error handling modal submit:", error);
        return interaction.reply({
          content: "❌ An error occurred while processing your submission.",
          ephemeral: true,
        });
      }
    }
  }
});

// Express Setup (including the navbar for home and docs pages)
const app = express();

// Passport setup
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: `${process.env.SITE_URL || `http://localhost:${process.env.PORT || 4444}`}/auth/discord/callback`,
  scope: ['identify']
}, (accessToken, refreshToken, profile, done) => {
  process.nextTick(() => done(null, profile));
}));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

app.use(passport.initialize());
app.use(passport.session());

// Middleware for parsing POST request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', {
  failureRedirect: '/'
}), (req, res) => {
  res.redirect('/admin'); // Redirect to admin panel after successful login
});

app.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

/**
 * Middleware that restricts access to admin-only routes by verifying the user is authenticated and matches the configured admin user ID.
 * Redirects unauthenticated users to the Discord login page and denies access to non-admin users.
 */
function ensureAdmin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.id === process.env.ADMIN_USER_ID) {
    return next();
  }
  // If not admin, redirect to login or show an error
  if (req.user) { // User is logged in but not admin
    res.status(403).send("Access Denied. You are not authorized to view this page. <a href='/logout'>Logout</a>");
  } else { // User is not logged in
     res.redirect('/auth/discord');
  }
}

// Wait for database connection
mongoose.connection.once("open", () => {
  console.log("✅ MongoDB connected successfully");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

// Admin panel route
app.get("/admin", ensureAdmin, async (req, res) => {
  try {
    const partners = await Partner.find({});
    const bannedGuilds = await BannedGuild.find({});
    // More data fetching can be added here as needed (e.g., top tier slots)

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Panel - Partner Bot</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; color: #333; }
          .container { max-width: 1200px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          h1, h2 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .action-button { padding: 5px 10px; color: white; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin-right: 5px; }
          .approve-btn { background-color: #4CAF50; } /* Green */
          .decline-btn { background-color: #f44336; } /* Red */
          .manage-btn { background-color: #008CBA; } /* Blue */
          .ban-btn { background-color: #555; } /* Dark Grey */
          .unban-btn { background-color: #777; } /* Grey */
          .logout-btn { background-color: #f44336; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block; margin-bottom:20px;}
          .nav { margin-bottom: 20px; }
          .nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
          .nav a.logout-btn { color: white; }
          .pending-approval { background-color: #ffffe0; } /* Light yellow for pending items */
          .section { margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="nav">
            <h1>Admin Panel</h1>
            <a href="/logout" class="logout-btn">Logout</a>
          </div>

          <div class="section" id="partners-section">
            <h2>Partner Management</h2>
            <table>
              <thead>
                <tr>
                  <th>Server Name</th>
                  <th>Guild ID</th>
                  <th>Status</th>
                  <th>Message Pending</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${partners.map(partner => `
                  <tr class="${!partner.approved || partner.messagePending ? 'pending-approval' : ''}">
                    <td>${partner.guildName}</td>
                    <td>${partner.guildId}</td>
                    <td>${partner.approved ? 'Approved' : 'Pending Approval'}</td>
                    <td>${partner.messagePending ? `Yes (Pending: ${partner.pendingMessage ? partner.pendingMessage.substring(0,50)+'...' : 'N/A'})` : 'No'}</td>
                    <td>
                      ${!partner.approved ? `<form method="POST" action="/admin/approve_server" style="display:inline;"><input type="hidden" name="guildId" value="${partner.guildId}"><button type="submit" class="action-button approve-btn">Approve Server</button></form>` : ''}
                      ${partner.messagePending ? `<form method="POST" action="/admin/approve_message" style="display:inline;"><input type="hidden" name="guildId" value="${partner.guildId}"><button type="submit" class="action-button approve-btn">Approve Msg</button></form>` : ''}
                      ${partner.messagePending ? `<form method="POST" action="/admin/decline_message" style="display:inline;"><input type="hidden" name="guildId" value="${partner.guildId}"><button type="submit" class="action-button decline-btn">Decline Msg</button></form>` : ''}
                      <form method="POST" action="/admin/unregister_server" style="display:inline;"><input type="hidden" name="guildId" value="${partner.guildId}"><button type="submit" class="action-button decline-btn">Unregister</button></form>
                      <form method="POST" action="/admin/ban_server" style="display:inline;"><input type="hidden" name="guildId" value="${partner.guildId}"><input type="text" name="reason" placeholder="Ban reason (optional)"><button type="submit" class="action-button ban-btn">Ban</button></form>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section" id="banned-guilds-section">
            <h2>Banned Guilds</h2>
            <table>
              <thead>
                <tr>
                  <th>Server Name</th>
                  <th>Guild ID</th>
                  <th>Reason</th>
                  <th>Banned By</th>
                  <th>Banned At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${bannedGuilds.map(banned => `
                  <tr>
                    <td>${banned.guildName || 'N/A'}</td>
                    <td>${banned.guildId}</td>
                    <td>${banned.reason || 'No reason provided'}</td>
                    <td>${banned.bannedBy || 'N/A'}</td>
                    <td>${new Date(banned.bannedAt).toLocaleString()}</td>
                    <td>
                      <form method="POST" action="/admin/unban_server" style="display:inline;"><input type="hidden" name="guildId" value="${banned.guildId}"><button type="submit" class="action-button unban-btn">Unban</button></form>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          </div>
        </div>
        <script>
          // Basic client-side interactions can be added here if needed
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("❌ Error in the `/admin` route:", error);
    res.status(500).send("❌ An error occurred while loading the admin panel.");
  }
});

// Admin panel action routes
app.post("/admin/approve_server", ensureAdmin, async (req, res) => {
  try {
    const { guildId } = req.body;
    const partner = await Partner.findOneAndUpdate({ guildId }, { approved: true }, { new: true });
    if (partner) {
      // Attempt to notify server/owner (similar to button interaction logic)
      try {
        const guild = await client.guilds.fetch(guildId);
        const owner = await guild.members.fetch(guild.ownerId);
         await owner.send(`✅ Your server **${guild.name}** has been approved for partnering! Please use bot commands to set up your ad message and channel.`);
      } catch (notifyError) {
        console.error(`Failed to notify owner of ${guildId} about approval:`, notifyError);
      }
    }
    res.redirect("/admin#partners-section");
  } catch (error) {
    console.error("Error approving server:", error);
    res.status(500).send("Error approving server.");
  }
});

app.post("/admin/approve_message", ensureAdmin, async (req, res) => {
  try {
    const { guildId } = req.body;
    const partner = await Partner.findOne({ guildId });
    if (partner && partner.pendingMessage) {
      await Partner.findOneAndUpdate(
        { guildId },
        { partnerMessage: partner.pendingMessage, messagePending: false, $unset: { pendingMessage: "" } }
      );
      // Notify user if possible
      if (partner.pendingMessageUserId) {
        try {
          const user = await client.users.fetch(partner.pendingMessageUserId);
          await user.send(`✅ Your ad message for **${partner.guildName}** has been approved!`);
        } catch (dmError) {
          console.log("Could not DM user about message approval:", dmError);
        }
      }
    }
    res.redirect("/admin#partners-section");
  } catch (error) {
    console.error("Error approving message:", error);
    res.status(500).send("Error approving message.");
  }
});

app.post("/admin/decline_message", ensureAdmin, async (req, res) => {
  try {
    const { guildId } = req.body;
    const partner = await Partner.findOneAndUpdate(
      { guildId },
      { messagePending: false, $unset: { pendingMessage: "" } }
    );
     if (partner && partner.pendingMessageUserId) {
        try {
          const user = await client.users.fetch(partner.pendingMessageUserId);
          await user.send(`❌ Your ad message for **${partner.guildName}** has been declined.`);
        } catch (dmError) {
          console.log("Could not DM user about message decline:", dmError);
        }
      }
    res.redirect("/admin#partners-section");
  } catch (error) {
    console.error("Error declining message:", error);
    res.status(500).send("Error declining message.");
  }
});

app.post("/admin/unregister_server", ensureAdmin, async (req, res) => {
  try {
    const { guildId } = req.body;
    const partner = await Partner.findOneAndDelete({ guildId });
    if (partner) {
        // Optionally, make the bot leave the server
        try {
            const guild = await client.guilds.fetch(guildId);
            if (guild) await guild.leave();
        } catch (leaveError) {
            console.error(`Error making bot leave ${guildId} after unregister:`, leaveError);
        }
    }
    res.redirect("/admin#partners-section");
  } catch (error) {
    console.error("Error unregistering server:", error);
    res.status(500).send("Error unregistering server.");
  }
});

app.post("/admin/ban_server", ensureAdmin, async (req, res) => {
  try {
    const { guildId, reason } = req.body;
    const existingBan = await BannedGuild.findOne({ guildId });
    if (existingBan) {
        // Update reason if already banned
        existingBan.reason = reason || "No reason provided (updated via admin panel)";
        existingBan.bannedBy = req.user.username + "#" + req.user.discriminator;
        await existingBan.save();
    } else {
        let guildName = guildId;
        try {
            const guild = await client.guilds.fetch(guildId);
            if (guild) {
                guildName = guild.name;
                await guild.leave();
            }
        } catch (e) { console.log(`Couldn't fetch guild ${guildId} for banning, or already left.`); }

        await BannedGuild.create({
            guildId,
            guildName,
            reason: reason || "Banned via admin panel",
            bannedBy: req.user.username + "#" + req.user.discriminator,
        });
    }
    await Partner.deleteOne({ guildId }); // Also remove from partners if they were one
    res.redirect("/admin#banned-guilds-section");
  } catch (error) {
    console.error("Error banning server:", error);
    res.status(500).send("Error banning server.");
  }
});

app.post("/admin/unban_server", ensureAdmin, async (req, res) => {
  try {
    const { guildId } = req.body;
    await BannedGuild.deleteOne({ guildId });
    res.redirect("/admin#banned-guilds-section");
  } catch (error) {
    console.error("Error unbanning server:", error);
    res.status(500).send("Error unbanning server.");
  }
});


// Add error handling for the `/` route
app.get("/", async (req, res) => {
  try {
    console.log("Fetching top tier slots...");
    let topTierSlots, partners;
    if (process.env.DEV_MODE === "true") {
      // Sample data for development
      topTierSlots = [
        { slotNumber: 1, guildId: "111", guildName: "Level 1 Premium Server", memberCount: 1200, iconURL: () => "https://cdn-icons-png.flaticon.com/512/5968/5968756.png", members: { cache: { filter: () => ({ size: 300 }) } } },
        { slotNumber: 2, guildId: "222", guildName: "Level 2 Premium Server", memberCount: 850, iconURL: () => "https://cdn-icons-png.flaticon.com/512/5968/5968774.png", members: { cache: { filter: () => ({ size: 120 }) } } },
        { slotNumber: 3, guildId: "333", guildName: "Level 3 Premium Server", memberCount: 430, iconURL: () => "https://cdn-icons-png.flaticon.com/512/5968/5968707.png", members: { cache: { filter: () => ({ size: 45 }) } } }
      ];
      partners = [
        // Premium partners
        { guildId: "111", guildName: "Level 1 Premium Server", partnerMessage: "The best premium server for your needs!", inviteLink: "https://discord.gg/level1" },
        { guildId: "222", guildName: "Level 2 Premium Server", partnerMessage: "A great community for everyone.", inviteLink: "https://discord.gg/level2" },
        { guildId: "333", guildName: "Level 3 Premium Server", partnerMessage: "Join us for fun and events!", inviteLink: "https://discord.gg/level3" },
        // Regular partners
        { guildId: "444", guildName: "Regular Partner Alpha", partnerMessage: "A friendly server for all things tech!", inviteLink: "https://discord.gg/alpha" },
        { guildId: "555", guildName: "Regular Partner Beta", partnerMessage: "Chill, chat, and game with us.", inviteLink: "https://discord.gg/beta" },
        { guildId: "666", guildName: "Regular Partner Gamma", partnerMessage: "Events, giveaways, and more!", inviteLink: "https://discord.gg/gamma" }
      ];
    } else {
      topTierSlots = await TopTierSlot.find({}).sort({ slotNumber: 1 });
      console.log("Fetching approved partners...");
      partners = await Partner.find(
        {
          approved: true,
          partnerMessage: { $exists: true, $ne: null },
        },
        "guildId guildName partnerMessage inviteLink lastBump",
      ).sort({ lastBump: -1 });
    }

    // Weighted single slot selection for premium slots
    // Level 1 = slotNumber 1, Level 2 = slotNumber 2, Level 3 = slotNumber 3
    const weightedPool = [1, 1, 1, 2, 2, 3]; // Level 1 most likely, then 2, then 3
    const selectedLevel = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    const selectedSlot = topTierSlots.find(s => s.slotNumber === selectedLevel) || { slotNumber: selectedLevel };
    const slotsToDisplay = [selectedSlot];

    const topTierCards = await Promise.all(
      slotsToDisplay.map(async (slot) => {
        if (!slot.guildId) {
          // Define probability for each slot
          let probability = '';
          if (slot.slotNumber === 1) probability = '50% chance to be shown';
          else if (slot.slotNumber === 2) probability = '33.3% chance to be shown';
          else if (slot.slotNumber === 3) probability = '16.7% chance to be shown';
          return `<div class="top-tier-card empty">
          <h3>Premium Slot ${slot.slotNumber}</h3>
          <p>This premium advertising slot is available!</p>
          <p class="probability">${probability}</p>
          <a href="https://skyvps360.xyz/discord" class="cta-button">Get Your Slot Now</a>
        </div>`;
        }

        try {
          const guild = await client.guilds.fetch(slot.guildId);
          const iconURL = guild.iconURL();
          const memberCount = guild.memberCount;
          const onlineMembers = guild.members.cache.filter(
            (m) => m.presence?.status === "online",
          ).size;
          const partner = partners.find((p) => p.guildId === slot.guildId);

          return `<div class="top-tier-card">
            <div class="premium-badge">⭐ Premium</div>
            <img src="${iconURL || "https://discord.com/assets/6debd47ed13483642cf09e832ed0bc1b.png"}" 
                 alt="${guild.name}" 
                 onerror="this.onerror=null;this.src='https://discord.com/assets/6debd47ed13483642cf09e832ed0bc1b.png'">
            <h3 title="${guild.name}">${guild.name}</h3>
            <p>${partner?.partnerMessage?.substring(0, 100) || "No message set"}${partner?.partnerMessage?.length > 100 ? '...' : ''}</p>
            <div class="stats">
              <span class="stat" title="Total Members">👥 ${memberCount.toLocaleString()}</span>
              <span class="stat" title="Online Members">🟢 ${onlineMembers.toLocaleString()}</span>
            </div>
            ${partner?.inviteLink ? `
              <a href="${partner.inviteLink}" class="cta-button" target="_blank" rel="noopener noreferrer">
                Join Server
              </a>` : 
              '<div class="cta-button disabled">No Invite</div>'
            }
          </div>`;
        } catch (error) {
          console.error(
            `Error generating top tier card for ${slot.guildId}:`,
            error,
          );
          return `<div class="top-tier-card empty">
          <h3>Premium Slot ${slot.slotNumber}</h3>
          <p>This premium advertising slot is available!</p>
          <a href="https://skyvps360.xyz/discord" class="cta-button">Get Your Slot Now</a>
        </div>`;
        }
      }),
    );

    // Generate regular partner cards (excluding top tier slots and your server)
    const regularPartners = partners.filter(
      (p) =>
        !topTierSlots.some((slot) => slot.guildId === p.guildId) &&
        p.guildId !== process.env.PRIORITY_SERVER_ID,
    );

    const regularCards = await Promise.all(
      regularPartners.map(async (p) => {
        try {
          const guild = await client.guilds.fetch(p.guildId);
          const iconURL = guild.iconURL();
          const memberCount = guild.memberCount;
          const onlineMembers = guild.members.cache.filter(
            (m) => m.presence?.status === "online",
          ).size;
          const botCount = guild.members.cache.filter((m) => m.user.bot).size;
          
          // Generate fallback icon if no server icon
          const { bgColor, char } = generateLetterIcon(guild.name);
          const iconHtml = iconURL 
            ? `<img src="${iconURL}" alt="${guild.name} Icon" class="server-icon" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
               <div class="letter-icon" style="display: none; background-color: ${bgColor};">${char}</div>`
            : `<div class="letter-icon" style="background-color: ${bgColor};">${char}</div>`;

          return `<div class="partner-card">
          ${iconHtml}
          <strong>${guild.name}</strong>
          <p>${p.partnerMessage}</p>
          <div class="stats">
            <span class="stat">👥 ${memberCount}</span>
            <span class="stat">🟢 ${onlineMembers}</span>
            <span class="stat">🤖 ${botCount}</span>
          </div>
          ${p.inviteLink ? `<a href="${p.inviteLink}" target="_blank" class="invite-button">Join Server</a>` : "<em>No invite set</em>"}
        </div>`;
        } catch (error) {
          return `<div class="partner-card">
          <strong>${p.guildName}</strong>
          <p>${p.partnerMessage}</p>
          <p><em>Unable to fetch details</em></p>
        </div>`;
        }
      }),
    );

    // Generate priority banner for SkyVPS360
    let priorityBanner = "👊SkyVPS360.xyz Partner Network";
    const skyVpsId = "1310474963865833483";
    const priorityServer = partners.find(p => p.guildId === skyVpsId);
    if (priorityServer) {
        try {
          const guild = await client.guilds.fetch(skyVpsId).catch(console.error);
          if (!guild) {
            console.log("Priority server not found in bot's guilds");
            return "";
          }
          
          const iconURL = guild.iconURL({ format: 'png', dynamic: true, size: 256 });
          const { bgColor, char } = generateLetterIcon(guild.name);
          const iconHtml = iconURL 
            ? `<img src="${iconURL}" alt="${guild.name} Icon" class="banner-icon" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
               <div class="letter-icon banner-icon" style="display: none; background-color: ${bgColor};">${char}</div>`
            : `<div class="letter-icon banner-icon" style="background-color: ${bgColor};">${char}</div>`;
            
          priorityBanner = `<div class="priority-banner">
            <div class="banner-content">
              ${iconHtml}
              <div class="banner-info">
                <h2>${guild.name}</h2>
                <p>${priorityServer.partnerMessage || 'Premium Partner Server'}</p>
                ${priorityServer.inviteLink ? `<a href="${priorityServer.inviteLink}" target="_blank" rel="noopener noreferrer" class="cta-button">Join Now</a>` : ''}
              </div>
            </div>
          </div>`;
        } catch (error) {
          console.error("Error generating priority banner:", error);
        }
      }

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>SkyVPS360.xyz Partner Network</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        
        :root {
          --bg-primary: #0d0d0f;
          --bg-secondary: #1a1b23;
          --bg-tertiary: #16171e;
          --bg-card: rgba(26, 27, 35, 0.8);
          --accent: #00d4ff;
          --accent-hover: #00b8e6;
          --accent-light: #33e0ff;
          --accent-secondary: #ff6b35;
          --accent-gradient: linear-gradient(135deg, #00d4ff 0%, #0099cc 50%, #0066aa 100%);
          --accent-gradient-secondary: linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #e6007e 100%);
          --text-primary: #ffffff;
          --text-secondary: #b4b4b4;
          --text-muted: #666666;
          --text-accent: #00d4ff;
          --border-primary: rgba(0, 212, 255, 0.2);
          --border-secondary: rgba(255, 255, 255, 0.1);
          --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
          --shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
          --shadow-glow: 0 0 20px rgba(0, 212, 255, 0.3);
          --shadow-glow-secondary: 0 0 20px rgba(255, 107, 53, 0.3);
          --radius-sm: 8px;
          --radius: 16px;
          --radius-lg: 24px;
          --gradient-bg: radial-gradient(ellipse at top, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
                         radial-gradient(ellipse at bottom right, rgba(255, 107, 53, 0.1) 0%, transparent 50%);
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: var(--bg-primary);
          background-image: var(--gradient-bg);
          color: var(--text-primary);
          line-height: 1.6;
          min-height: 100vh;
          overflow-x: hidden;
          position: relative;
        }

        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2300d4ff' fill-opacity='0.03' fill-rule='evenodd'%3E%3Cpath d='m0 40l40-40h-40v40zm40 0v-40h-40l40 40z'/%3E%3C/g%3E%3C/svg%3E") repeat;
          pointer-events: none;
          z-index: -1;
        }

        .tech-grid {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(rgba(0, 212, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
          z-index: -1;
        }

        .navbar {
          background: rgba(22, 23, 30, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-primary);
          padding: 1rem 2rem;
          position: sticky;
          top: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          box-shadow: var(--shadow-lg);
        }
        
        .navbar::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--accent-gradient);
          opacity: 0.7;
        }
        
        .navbar a {
          color: var(--text-primary);
          text-decoration: none;
          font-weight: 500;
          padding: 0.75rem 1.5rem;
          border-radius: var(--radius-sm);
          background: var(--bg-card);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          font-size: 0.9rem;
          border: 1px solid var(--border-secondary);
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .navbar a::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: var(--accent-gradient);
          transition: all 0.3s ease;
          z-index: -1;
        }
        
        .navbar a:hover {
          color: var(--bg-primary);
          transform: translateY(-2px);
          border-color: var(--accent);
          box-shadow: var(--shadow-glow);
        }
        
        .navbar a:hover::before {
          left: 0;
        }

        .container {
          max-width: 1200px;
          margin: 2rem auto;
          padding: 2rem;
        }

        .partner-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-top: 3.5rem;
        }

        /* Add spacing below premium/top-tier card section */
        .top-tier-section {
          margin-bottom: 3.5rem;
        }

        .partner-card {
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          border-radius: var(--radius);
          padding: 2rem;
          text-align: center;
          border: 1px solid var(--border-secondary);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeIn 0.6s ease-out;
          max-height: 500px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          box-shadow: var(--shadow);
        }

        .partner-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--accent-gradient);
          border-radius: var(--radius);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }

        .partner-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: var(--shadow-glow);
          border-color: var(--accent);
        }

        .partner-card:hover::before {
          opacity: 0.1;
        }

        .server-icon {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          object-fit: cover;
          margin: 0 auto 1rem;
          border: 3px solid var(--accent);
          background: var(--bg-tertiary);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .partner-card:hover .server-icon {
          transform: scale(1.05);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
        
        .letter-icon {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary);
          font-size: 3rem;
          font-weight: 700;
          margin: 0 auto 1rem;
          border: 3px solid var(--accent);
          background: var(--accent-gradient);
          text-transform: uppercase;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: 'JetBrains Mono', monospace;
          box-shadow: var(--shadow-glow);
          position: relative;
        }
        
        .letter-icon::before {
          content: '';
          position: absolute;
          top: -3px;
          left: -3px;
          right: -3px;
          bottom: -3px;
          background: var(--accent-gradient);
          border-radius: 50%;
          z-index: -1;
          animation: pulse 2s infinite;
        }
        
        .partner-card:hover .letter-icon {
          transform: scale(1.1) rotate(5deg);
          box-shadow: var(--shadow-glow), 0 0 40px rgba(0, 212, 255, 0.4);
        }

        @keyframes pulse {
          0% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.05); }
          100% { opacity: 0.7; transform: scale(1); }
        }
        
        .banner-icon {
          width: 150px;
          height: 150px;
          font-size: 4.5rem;
          border-width: 4px;
          background: var(--bg-secondary);
          color: var(--accent);
          border-color: var(--accent);
          font-weight: 600;
        }
        
        .banner-icon.letter-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stats {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: center;
          margin: 2rem 0 1.5rem 0;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-primary);
          position: relative;
        }

        .stats::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 50px;
          height: 1px;
          background: var(--accent-gradient);
        }

        .stat {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-secondary);
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-accent);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .stat::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: var(--accent-gradient);
          transition: all 0.3s ease;
          z-index: -1;
          opacity: 0.1;
        }

        .stat:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-glow);
          border-color: var(--accent);
          color: var(--text-primary);
        }

        .stat:hover::before {
          left: 0;
        }

        .invite-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: var(--accent-gradient);
          color: var(--text-primary);
          text-decoration: none;
          border-radius: var(--radius);
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 1px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-top: auto;
          position: relative;
          overflow: hidden;
          border: 1px solid var(--accent);
          box-shadow: var(--shadow-glow);
        }

        .invite-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: var(--accent-gradient-secondary);
          transition: all 0.3s ease;
          z-index: -1;
        }

        .invite-button:hover {
          transform: translateY(-4px) scale(1.05);
          box-shadow: var(--shadow-glow), 0 0 30px rgba(0, 212, 255, 0.5);
          border-color: var(--accent-light);
        }

        .invite-button:hover::before {
          left: 0;
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

        .top-tier-card.empty {
          border: 2px dashed rgba(114, 137, 218, 0.3);
          background: rgba(44, 45, 49, 0.5);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem 1.5rem;
          transition: all 0.3s ease;
        }

        .top-tier-card.empty:hover {
          border-color: var(--accent);
          background: rgba(44, 45, 49, 0.7);
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .empty-slot-icon {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(114, 137, 218, 0.1);
          border-radius: 50%;
          margin-bottom: 1rem;
        }

        .empty-slot-icon svg {
          width: 40px;
          height: 40px;
        }

        .premium-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: linear-gradient(45deg, #7289da, #5865f2);
          color: white;
          padding: 4px 12px 3px;
          border-radius: 50px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          z-index: 1;
        }

        .top-tier-card {
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          border-radius: var(--radius);
          padding: 20px;
          color: var(--text-primary);
          text-align: center;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          border: 1px solid var(--border-primary);
          display: flex;
          flex-direction: column;
          height: 100%;
          box-shadow: var(--shadow-glow);
        }

        .top-tier-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--accent-gradient);
          opacity: 0.05;
          transition: opacity 0.3s ease;
          z-index: -1;
        }

        .top-tier-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: var(--shadow-glow), 0 0 40px rgba(0, 212, 255, 0.3);
          border-color: var(--accent);
        }

        .top-tier-card:hover::before {
          opacity: 0.15;
        }

        .top-tier-card img {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          margin: 0 auto 12px;
          display: block;
          object-fit: cover;
          border: 3px solid var(--accent);
          transition: transform 0.3s ease;
        }

        .top-tier-card:hover img {
          transform: scale(1.05);
        }

        .top-tier-card h3 {
          margin: 8px 0 4px;
          font-size: 1.2rem;
          color: var(--text-primary);
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 0 10px;
        }

        .top-tier-card p {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin: 0 0 16px;
          min-height: 40px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.4;
        }

        .top-tier-card .stats {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin: 12px 0 20px;
          flex-wrap: wrap;
        }

        .top-tier-card .stat {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.85rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 10px;
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .top-tier-card .stat:hover {
          background: rgba(114, 137, 218, 0.2);
          color: var(--text-primary);
        }

        .cta-button {
          display: inline-block;
          padding: 12px 24px;
          background: var(--accent-gradient);
          color: white;
          text-decoration: none;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.9rem;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-top: auto;
          width: fit-content;
          align-self: center;
          position: relative;
          overflow: hidden;
          border: 1px solid var(--accent);
          box-shadow: var(--shadow-glow);
        }

        .cta-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: var(--accent-gradient-secondary);
          transition: all 0.3s ease;
          z-index: -1;
        }

        .cta-button:hover {
          transform: translateY(-4px) scale(1.05);
          box-shadow: var(--shadow-glow), 0 0 25px rgba(0, 212, 255, 0.4);
          border-color: var(--accent-light);
        }

        .cta-button:hover::before {
          left: 0;
        }

        .cta-button.disabled {
          background: var(--bg-tertiary);
          color: var(--text-muted);
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
          border-color: var(--border-secondary);
        }

        .cta-button.disabled::before {
          display: none;
        }

        @media (max-width: 768px) {
          .top-tier-section {
            grid-template-columns: 1fr;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
          }
        }

        .priority-banner {
          width: 100%;
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          border-radius: var(--radius-lg);
          margin: 2rem 0;
          padding: 3rem;
          box-shadow: var(--shadow-glow), 0 0 50px rgba(0, 212, 255, 0.2);
          border: 2px solid var(--accent);
          position: relative;
          overflow: hidden;
        }

        .priority-banner::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--accent-gradient);
          opacity: 0.1;
          z-index: -1;
        }

        .priority-banner::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--accent-gradient);
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        }

        .banner-content {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 3rem;
          max-width: 100%;
        }

        .banner-content img {
          width: 200px;
          height: 200px;
          border-radius: 20px;
          border: 4px solid var(--accent-light);
          box-shadow: 0 0 20px rgba(88, 101, 242, 0.4);
        }

        .banner-info {
          flex: 1;
          text-align: left;
        }

        .banner-info h2 {
          font-size: 2rem;
          margin-bottom: 1rem;
          color: var(--text-primary);
        }

        .banner-info p {
          font-size: 1.1rem;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }

        .regular-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          grid-auto-rows: 1fr;
          gap: 2rem;
        }

        @media (max-width: 1024px) {
          .top-tier-section {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .regular-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .top-tier-section {
            grid-template-columns: 1fr;
          }
          
          .regular-grid {
            grid-template-columns: 1fr;
          }
          
          .banner-content {
            flex-direction: column;
            text-align: center;
          }
        }
      </style>
    </head>
    <body>
      <div class="tech-grid"></div>
      <div class="navbar">
        <a href="/">Home</a>
        <a href="/docs">Docs</a>
        <a href="${process.env.DOMAIN}">SkyVPS360.xyz - KVM VPS $3 Ryzen Epyc</a>
        <a href="${getBotInviteUrl()}">Invite Bot</a>
      </div>
      <div class="container">
        <div class="hero-header">
          ${priorityBanner}
        </div>

        <div class="top-tier-section">
          ${topTierCards.join("")}
        </div>

        <div class="regular-grid">
          ${regularCards.join("")}
        </div>
      </div>
    </body>
    </html>
  `;
    res.send(htmlTemplate);
  } catch (error) {
    console.error("❌ Error in the `/` route:", error);
    res.status(500).send("❌ An error occurred while loading the page.");
  }
});

app.get("/docs", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Partner Bot Documentation</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        
        :root {
          --bg-primary: #0d0d0f;
          --bg-secondary: #1a1b23;
          --bg-tertiary: #16171e;
          --bg-card: rgba(26, 27, 35, 0.8);
          --accent: #00d4ff;
          --accent-hover: #00b8e6;
          --accent-light: #33e0ff;
          --accent-secondary: #ff6b35;
          --accent-gradient: linear-gradient(135deg, #00d4ff 0%, #0099cc 50%, #0066aa 100%);
          --accent-gradient-secondary: linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #e6007e 100%);
          --text-primary: #ffffff;
          --text-secondary: #b4b4b4;
          --text-muted: #666666;
          --text-accent: #00d4ff;
          --border-primary: rgba(0, 212, 255, 0.2);
          --border-secondary: rgba(255, 255, 255, 0.1);
          --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
          --shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
          --shadow-glow: 0 0 20px rgba(0, 212, 255, 0.3);
          --shadow-glow-secondary: 0 0 20px rgba(255, 107, 53, 0.3);
          --radius-sm: 8px;
          --radius: 16px;
          --radius-lg: 24px;
          --gradient-bg: radial-gradient(ellipse at top, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
                         radial-gradient(ellipse at bottom right, rgba(255, 107, 53, 0.1) 0%, transparent 50%);
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: var(--bg-primary);
          background-image: var(--gradient-bg);
          color: var(--text-primary);
          line-height: 1.6;
          min-height: 100vh;
          overflow-x: hidden;
          position: relative;
        }

        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2300d4ff' fill-opacity='0.03' fill-rule='evenodd'%3E%3Cpath d='m0 40l40-40h-40v40zm40 0v-40h-40l40 40z'/%3E%3C/g%3E%3C/svg%3E") repeat;
          pointer-events: none;
          z-index: -1;
        }

        .tech-grid {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(rgba(0, 212, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
          z-index: -1;
        }
        
        .navbar {
          background: rgba(22, 23, 30, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-primary);
          padding: 1rem 2rem;
          position: sticky;
          top: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          box-shadow: var(--shadow-lg);
        }
        
        .navbar::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--accent-gradient);
          opacity: 0.7;
        }
        
        .navbar a {
          color: var(--text-primary);
          text-decoration: none;
          font-weight: 500;
          padding: 0.75rem 1.5rem;
          border-radius: var(--radius-sm);
          background: var(--bg-card);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          font-size: 0.9rem;
          border: 1px solid var(--border-secondary);
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .navbar a::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: var(--accent-gradient);
          transition: all 0.3s ease;
          z-index: -1;
        }
        
        .navbar a:hover {
          color: var(--bg-primary);
          transform: translateY(-2px);
          border-color: var(--accent);
          box-shadow: var(--shadow-glow);
        }
        
        .navbar a:hover::before {
          left: 0;
        }
        


        .container {
          max-width: 1200px;
          margin: 2rem auto;
          padding: 2rem;
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

        .content {
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          border-radius: var(--radius);
          padding: 2rem;
          margin-top: 2rem;
          box-shadow: var(--shadow-glow);
          border: 1px solid var(--border-primary);
          animation: slideUp 0.6s ease-out;
          position: relative;
          overflow: hidden;
        }

        .content::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--accent-gradient);
          opacity: 0.05;
          z-index: -1;
        }

        h1 {
          color: var(--text-primary);
          text-align: center;
          margin-bottom: 3rem;
          font-size: 2.5em;
          font-weight: 700;
          font-family: 'Space Grotesk', sans-serif;
          position: relative;
          padding-bottom: 1rem;
          text-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
        }

        h1::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100px;
          height: 4px;
          background: var(--accent-gradient);
          border-radius: 2px;
          box-shadow: var(--shadow-glow);
        }

        h2 {
          color: var(--text-accent);
          margin: 2rem 0 1rem;
          font-size: 1.75rem;
          font-weight: 700;
          font-family: 'Space Grotesk', sans-serif;
          position: relative;
          padding-left: 1rem;
          border-left: 3px solid var(--accent);
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
          border: 1px solid var(--border-primary);
          padding: 0.3em 0.6em;
          border-radius: var(--radius-sm);
          font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
          color: var(--text-accent);
          font-size: 0.9em;
          box-shadow: var(--shadow-sm);
          position: relative;
        }

        code::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--accent-gradient);
          opacity: 0.1;
          border-radius: var(--radius-sm);
          z-index: -1;
        }

        strong {
          color: var(--text-accent);
          font-weight: 600;
        }

        .section {
          margin-bottom: 2.5rem;
          animation: slideUp 0.6s ease-out;
          background: var(--bg-card);
          backdrop-filter: blur(10px);
          border-radius: var(--radius);
          padding: 1.5rem;
          border: 1px solid var(--border-secondary);
          box-shadow: var(--shadow);
          position: relative;
          overflow: hidden;
        }

        .section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 3px;
          height: 100%;
          background: var(--accent-gradient);
        }

        .warning-box {
          background: rgba(255, 107, 53, 0.1);
          border: 1px solid var(--accent-secondary);
          border-left: 4px solid var(--accent-secondary);
          padding: 1.5rem;
          margin: 1.5rem 0;
          border-radius: var(--radius);
          box-shadow: var(--shadow-glow-secondary);
          animation: pulse 3s infinite;
          position: relative;
          overflow: hidden;
        }

        .warning-box::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--accent-gradient-secondary);
          opacity: 0.05;
          z-index: -1;
        }

        .warning-box h3 {
          color: var(--accent-secondary);
          margin-top: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
        }

        .warning-box p, .warning-box li {
          color: var(--text-secondary);
          margin: 0.5rem 0;
        }

        .warning-box ul {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }

        @keyframes pulse {
          0% { box-shadow: var(--shadow-glow-secondary); }
          50% { box-shadow: var(--shadow-glow-secondary), 0 0 30px rgba(255, 107, 53, 0.2); }
          100% { box-shadow: var(--shadow-glow-secondary); }
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

        @media (max-width: 768px) {
          .navbar {
            flex-direction: column;
            padding: 1rem;
          }
          
          .navbar a {
            width: 100%;
            text-align: center;
          }
          
          .container {
            padding: 1rem;
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
      <div class="tech-grid"></div>
      <div class="navbar">
        <a href="/">Home</a>
        <a href="/docs">Docs</a>
        <a href="${process.env.DOMAIN}">SkyVPS360 - $3 Ryzen Epyc KVM VPS</a>
        <a href="${getBotInviteUrl()}">Invite Bot</a>
      </div>
      <div class="container">
        <h1>📘 Discord Partner Bot Documentation</h1>
        <div class="content">
          <div class="section">
            <h2>Standard Commands</h2>
            <p>These commands require the partner role or administrator permissions:</p>
            <ul>
              <li><strong>/register</strong> – Register your server for partnership
                <ul>
                  <li><b>IMPORTANT:</b> Your server must have a server image or it will not be accepted</li>
                  <li>After approval, you'll receive a setup form to configure your advertisement and settings</li>
                  <li>If declined, the bot will automatically leave your server</li>
                </ul>
              </li>
              <li><strong>/setchannel</strong> – Set the channel for receiving partner advertisements</li>
              <li><strong>/bump</strong> – Send your advertisement to all partner servers (30-minute cooldown, available to all server members)</li>
              <li><strong>/help</strong> – View this help message</li>
            </ul>
          </div>

          <div class="section">
            <h2>🔐 Important Security Notice</h2>
            <div class="warning-box">
              <h3>⚠️ WARNING ABOUT /setrole COMMAND</h3>
              <p><strong>CRITICAL:</strong> The <code>/setrole</code> command grants significant permissions to the selected role. Please follow these guidelines carefully:</p>
              <ul>
                <li>🔒 <strong>ONLY</strong> assign this to a trusted <strong>staff or admin role</strong> in your server</li>
                <li>🚫 Never assign this to @everyone or public roles</li>
                <li>👑 Consider creating a dedicated role for partner management if needed</li>
                <li>⚠️ Misconfiguration could allow unauthorized access to partner features</li>
              </ul>
              <p>This command is restricted to server owners only for security reasons.</p>
            </div>
          </div>

          <div class="section">
            <h2>Server Configuration</h2>
            <ul>
              <li><strong>/setrole</strong> – <strong>IMPORTANT:</strong> Set which role can manage partner settings (Server Owner only)
                <ul>
                  <li>Choose carefully - this role will have access to partner management features</li>
                  <li>Recommended: Use an existing admin role or create a dedicated partner manager role</li>
                </ul>
              </li>
              <li><strong>/setchannel</strong> – Designate the channel for receiving partner advertisements</li>
              <li><strong>/unregister</strong> – Remove your server from the partner network
                <ul>
                  <li><strong>Requires:</strong> The partner role (set by /setrole) <strong>OR</strong> Administrator permissions</li>
                  <li>If no partner role is set, only the server owner can unregister</li>
                  <li>This action cannot be undone - you'll need to re-register if you change your mind</li>
                </ul>
              </li>
            </ul>
          </div>

          <div class="section">
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
              <li>Use <code>/setrole</code> to set which role can use partner commands (Server Owner only - see security notice above)</li>
              <li>Anyone in your server can use <code>/bump</code> to share your advertisement with all partners!</li>
            </ol>
          </div>

          <div class="section">
            <h2>Server Management (Bot Owner Only)</h2>
            <ul>
              <li><strong>/adminunregister &lt;guildid&gt;</strong> – Remove a server from the partner network</li>
              <li><strong>/kick &lt;guildid&gt;</strong> – Make the bot leave a server</li>
              <li><strong>/ban &lt;guildid&gt; [reason]</strong> – Ban a server from using the bot and prevent re-invites</li>
              <li><strong>/unban &lt;guildid&gt;</strong> – Remove a server from the ban list</li>
              <li><strong>/setstatus</strong> – Change bot status</li>
            </ul>
          </div>

        </div>
      </div>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 4444;
app.listen(PORT, () =>
  console.log(`🌐 Web dashboard running on http://localhost:${PORT}`),
);

// Add error handling for Discord client login
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("❌ Failed to log in to Discord:", error);
});

function getBotInviteUrl() {
  // Check if client.user is available
  if (!client.user) {
    console.warn('⚠️ Warning: client.user is not available yet. Bot invite URL cannot be generated.');
    return '#'; // Return a fallback URL
  }
  return `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
}

// Add this before the interaction handler
async function hasPermission(member, guildId) {
  // Owner override for status command
  if (member.user.id === "142025929454125056") {
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
