// index.js (Fully Updated with /previewmessage and /setmessage clarification)
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
  partnerMessage: String, // The currently approved message
  pendingMessage: String, // The message waiting for approval
  pendingMessageUserId: String, // User who submitted the pending message
  approved: Boolean, // Is the server approved for partnership?
  lastBump: Date,
  messagePending: Boolean, // Is there a message waiting for approval?
  inviteLink: String,
  partnerRoleId: String,
  isTopTier: Boolean,
});
const Partner = mongoose.model("Partner", PartnerSchema);

// Discord Bot Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

// --- Define Slash Commands ---
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
  // Add the /setmessage command definition here
  new SlashCommandBuilder()
    .setName("setmessage")
    .setDescription("Set or update your partnership message (requires approval)")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Your server advertisement message")
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000), // Ensure max length matches modal if used
    ),
  // Add the new /previewmessage command definition
  new SlashCommandBuilder()
    .setName("previewmessage")
    .setDescription("Preview your current approved partnership message"),
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
    .setDescription("Set a server in a top tier slot (Owner only)")
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
  // Add invite and setinvite commands if needed
  new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Get the bot's invite link"),
  new SlashCommandBuilder()
    .setName("setinvite")
    .setDescription("Set your server's invite link")
    .addStringOption((option) =>
      option
        .setName("invite")
        .setDescription("Your server invite link (e.g., https://discord.gg/...)")
        .setRequired(true),
    ),
];
// --- End Command Definitions ---

client.once("ready", async () => {
  try {
    console.log(`Logged in as ${client.user.tag}`);

    // Set bot's activity status
    await client.user.setActivity("skyvps360.xyz $4 256GB KVM VPS", {
      type: ActivityType.Watching,
    });

    // Create REST instance for command registration
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN,
    );

    console.log("Started refreshing application (/) commands...");

    // Register commands globally for all guilds
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands.map(cmd => cmd.toJSON()), // Ensure commands are converted to JSON
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

    // Special handling for owner-only commands
    const ownerOnlyCommands = ["setstatus", "settopslot", "removetopslot"];
    if (
      ownerOnlyCommands.includes(interaction.commandName) &&
      member.user.id !== process.env.BOT_OWNER_ID // Use an env variable for owner ID
    ) {
      return interaction.reply({
        content: "🚫 Only the bot owner can use this command.",
        ephemeral: true,
      });
    }

    // Skip permission check for /help and /invite commands
    if (
      !["help", "invite"].includes(interaction.commandName) &&
      !hasCommandPermission
    ) {
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
        try {
            logChannel = await interaction.guild.channels.create({
                name: logChannelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [ // Make channel private by default
                    {
                        id: interaction.guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    { // Allow admins to see it
                        id: member.guild.ownerId, // Or specific admin roles
                        allow: [PermissionsBitField.Flags.ViewChannel],
                    },
                    // Add permissions for the bot itself if needed
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks],
                    },
                ],
            });
            console.log(`Created log channel #${logChannelName} in ${guildName}`);
        } catch (err) {
            console.error(`Failed to create log channel in ${guildName}:`, err);
            // Optionally notify the user or admin if channel creation fails
        }
    }

    // Log command usage if log channel exists
    if (logChannel) {
        try {
            await logChannel.send(
                `📥 Command used: \`/${interaction.commandName}\` by ${interaction.user.tag} (${interaction.user.id})`,
            );
        } catch (logErr) {
            console.error(`Failed to send log message to #${logChannelName} in ${guildName}:`, logErr);
        }
    } else {
        console.warn(`Log channel #${logChannelName} not found or couldn't be created in ${guildName}.`);
    }


    // --- Slash Command Handlers ---
    if (interaction.commandName === "help") {
      const helpEmbed = new EmbedBuilder()
        .setColor("#7289da")
        .setTitle("📘 Partner Bot Commands")
        .setDescription(
          "These commands require the partner role or administrator permissions:",
        )
        .addFields(
          {
            name: "/register",
            value: "Register your server (starts the partnership process)",
          },
          {
            name: "/setchannel",
            value: "Set the channel for receiving partner ads",
          },
          {
            name: "/setmessage",
            value: "Set or update your partnership message (requires approval)",
          },
           // Add the new command here
          {
            name: "/previewmessage",
            value: "Preview your currently approved partnership message",
          },
          {
            name: "/setinvite",
            value: "Set your server's invite link",
          },
          { name: "/unregister", value: "Remove server from partner list" },
          {
            name: "/bump",
            value: "Send your ad to all partners (30-min cooldown)",
          },
          { name: "/help", value: "View this help message" },
          { name: "/invite", value: "Get the bot's invite link" },
        )
        .addFields({
          name: "Special Commands",
          value:
            "`/setrole` - Set the role required to use commands (Server Owner only)\n`/setstatus` - Change bot status (Bot Owner only)\n`/settopslot` - Add server to premium slot (Bot Owner only)\n`/removetopslot` - Remove server from premium slot (Bot Owner only)",
        })
        .setFooter({
          text: `After registration approval, you'll receive a setup form to configure your server.`,
          iconURL: client.user.displayAvatarURL(),
        })
        .setURL(
          `${process.env.SITE_URL || `http://0.0.0.0:${process.env.PORT || 3000}`}/docs`,
        );

      return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }

    if (interaction.commandName === "register") {
      const existing = await Partner.findOne({ guildId });
      if (existing) {
        return interaction.reply({
          content:
            "❌ This server is already registered or pending approval.",
          ephemeral: true,
        });
      }

       // Check for server icon
      if (!interaction.guild.iconURL()) {
          return interaction.reply({
              content: "❌ Your server must have an icon set to register.",
              ephemeral: true,
          });
      }

      await Partner.create({
        guildId,
        guildName,
        approved: false,
        messagePending: false,
        lastBump: null, // Set lastBump initially to null or a date far in the past
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_server_${guildId}`) // Clearer custom ID
          .setLabel("✅ Approve Server")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`decline_server_${guildId}`) // Clearer custom ID
          .setLabel("❌ Decline Server")
          .setStyle(ButtonStyle.Danger),
      );

      try {
        const adminGuild = await client.guilds.fetch(
          process.env.ADMIN_SERVER_ID,
        );
        const adminChannel = await adminGuild.channels.fetch(
          process.env.ADMIN_CHANNEL_ID,
        );

        if (!adminGuild || !adminChannel) {
          console.error("Admin guild or channel not found. Check .env variables.");
           // Don't fail silently, inform the user
           await Partner.deleteOne({ guildId }); // Clean up the partial registration
           return interaction.reply({
             content: "❌ Registration failed due to a configuration issue. Please contact the bot owner.",
             ephemeral: true,
           });
        }

        await adminChannel.send({
          content: `📥 New registration from **${guildName}** (ID: ${guildId})`,
          components: [row],
        });
        return interaction.reply({
          content: "✅ Registration submitted. Please wait for approval. Ensure your server has an icon.",
          ephemeral: true // Keep this ephemeral
        });
      } catch (error) {
        console.error("Error during registration submission:", error);
        await Partner.deleteOne({ guildId }); // Clean up on error
        return interaction.reply({
          content: "❌ An error occurred while submitting your registration.",
          ephemeral: true,
        });
      }
    }

    // --- /setmessage Command Handler ---
    if (interaction.commandName === "setmessage") {
      const msg = interaction.options.getString("message");
      const userId = interaction.user.id;

      const partner = await Partner.findOne({ guildId });

      if (!partner) {
        return interaction.reply({
          content:
            "❌ Your server must be registered first. Use `/register`.",
          ephemeral: true,
        });
      }
       if (!partner.approved) {
        return interaction.reply({
          content:
            "❌ Your server registration is still pending approval.",
          ephemeral: true,
        });
      }

      try {
        const adminGuild = await client.guilds.fetch(process.env.ADMIN_SERVER_ID);
        const adminChannel = await adminGuild.channels.fetch(process.env.ADMIN_CHANNEL_ID);

        if (!adminGuild || !adminChannel) {
          console.error("Admin guild or channel not found for setmessage. Check .env variables.");
          return interaction.reply({
            content: "❌ Message submission failed due to a configuration issue. Please contact the bot owner.",
            ephemeral: true,
          });
        }

        // Prepare the approval buttons
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_msg_${guildId}`) // Use specific ID format
            .setLabel("✅ Approve Message")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`decline_msg_${guildId}`) // Use specific ID format
            .setLabel("❌ Decline Message")
            .setStyle(ButtonStyle.Danger),
        );

        // Update the partner document with the pending message
        await Partner.findOneAndUpdate(
          { guildId },
          {
            pendingMessage: msg,
            pendingMessageUserId: userId,
            messagePending: true, // Explicitly set messagePending to true
          },
          { new: true } // Ensure we get the updated document if needed, though not used here
        );

        // Send the message to the admin channel for approval
        await adminChannel.send({
          content: `✏️ Message update submitted by <@${userId}> for **${guildName}** (ID: ${guildId}):\n\n${msg}`,
          components: [row],
        });

        // Construct the reply message with clarifications
        let replyMessage = "📨 Message submitted for approval.";
        if (partner.messagePending && partner.pendingMessage) {
             replyMessage += "\n⚠️ This will replace your *previous pending* message.";
        }
        if (partner.partnerMessage) {
            replyMessage += "\nℹ️ Your *current active* message will remain unchanged until this new one is approved.";
        }

        return interaction.reply({ content: replyMessage, ephemeral: true }); // Keep ephemeral

      } catch (error) {
        console.error("Error in setmessage command:", error);
        return interaction.reply({
          content:
            "❌ An error occurred while submitting your message. Please try again later.",
          ephemeral: true,
        });
      }
    }
    // --- End /setmessage Command Handler ---


    // --- /previewmessage Command Handler ---
    if (interaction.commandName === "previewmessage") {
        const partner = await Partner.findOne({ guildId });

        if (!partner || !partner.approved) {
            return interaction.reply({
                content: "❌ Your server is not registered or not yet approved.",
                ephemeral: true
            });
        }

        if (!partner.partnerMessage) {
            return interaction.reply({
                content: "❌ You haven't set an approved partnership message yet. Use the setup form (after approval) or `/setmessage`.",
                ephemeral: true
            });
        }

        // Display the current approved message
        const previewEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`Preview: Your Approved Partnership Message`)
            .setDescription(partner.partnerMessage)
            .setFooter({ text: "This is the message currently used for /bump." })
            .setTimestamp();

        return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
    }
    // --- End /previewmessage Command Handler ---


    if (interaction.commandName === "setchannel") {
      const channel = interaction.options?.getChannel("channel");
      // Validate that channel exists and is text-based
      if (
        !channel ||
        ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
          channel.type,
        )
      ) {
        return interaction.reply({
          content: "❌ Please select a valid text or announcement channel.",
          ephemeral: true,
        });
      }

      // Check if bot has permissions in the selected channel
       const botMember = await interaction.guild.members.fetch(client.user.id);
       const permissions = channel.permissionsFor(botMember);
       if (!permissions || !permissions.has(PermissionsBitField.Flags.SendMessages) || !permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
           return interaction.reply({
               content: `❌ I don't have permission to send messages and embed links in <#${channel.id}>. Please grant permissions and try again.`,
               ephemeral: true,
           });
       }


      await Partner.findOneAndUpdate(
        { guildId },
        { partnerChannelId: channel.id },
        { upsert: true }, // Use upsert cautiously, ensure server is registered first
      );
      return interaction.reply({
          content: `📢 Partner channel successfully set to <#${channel.id}>`,
          ephemeral: true // Keep ephemeral
        });
    }

    if (interaction.commandName === "unregister") {
      const deleted = await Partner.findOneAndDelete({ guildId });
       if (!deleted) {
           return interaction.reply({ content: "❌ Your server was not registered.", ephemeral: true });
       }
      // Also remove from top tier slots if present
      await TopTierSlot.deleteMany({ guildId });
      return interaction.reply({ content: "🗑️ Server unregistered successfully.", ephemeral: true }); // Keep ephemeral
    }

    if (interaction.commandName === "bump") {
      const self = await Partner.findOne({ guildId });
      if (!self) {
          return interaction.reply({ content: "❌ Your server is not registered.", ephemeral: true });
      }
      if (!self.approved) {
          return interaction.reply({ content: "❌ Your server registration is not yet approved.", ephemeral: true });
      }
      if (!self.partnerMessage) {
          return interaction.reply({ content: "❌ You must set your partnership message first using `/setmessage` or the setup form.", ephemeral: true });
      }
       if (!self.partnerChannelId) {
          return interaction.reply({ content: "❌ You must set your partner channel first using `/setchannel` or the setup form.", ephemeral: true });
      }


      // Cooldown check (30 minutes)
      const cooldown = 30 * 60 * 1000; // 30 minutes in milliseconds
      if (self.lastBump && Date.now() - self.lastBump.getTime() < cooldown) {
        const remainingTime = cooldown - (Date.now() - self.lastBump.getTime());
        const remainingMinutes = Math.ceil(remainingTime / 60000); // Round up to nearest minute
        return interaction.reply({
          content: `⏳ Please wait ${remainingMinutes} more minute(s) before bumping again.`,
          ephemeral: true,
        });
      }

      // Defer reply as bumping can take time
      await interaction.deferReply();

      // Fetch all approved partners *except* the current guild
      const allPartners = await Partner.find({
        guildId: { $ne: guildId },
        approved: true,
        partnerChannelId: { $exists: true, $ne: null }, // Ensure they have a channel set
      });

      let successCount = 0;
      let failCount = 0;
      const failedServers = [];

      // Prepare the bump embed once
       const bumpEmbed = new EmbedBuilder()
          .setColor('#5865F2') // Consistent color
          .setTitle(`📢 Partner Ad: ${guildName}`) // Use guild name from interaction
          .setDescription(self.partnerMessage) // Use the approved message
          .setTimestamp()
          .setFooter({ text: 'SkyVPS360 Partner Network' });

        // Add server icon as thumbnail if available
        if (interaction.guild.iconURL()) {
            bumpEmbed.setThumbnail(interaction.guild.iconURL());
        }

        // Add invite link if available
        if (self.inviteLink) {
            // You might want a button instead or add it to the description/field
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Join Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL(self.inviteLink)
            );
             // Sending components requires modifying the send call below
        }


      // Loop through partners and send the bump
      for (const partner of allPartners) {
        try {
          const targetGuild = await client.guilds.fetch(partner.guildId);
          const targetChannel = await targetGuild.channels.fetch(partner.partnerChannelId);

          if (targetChannel && targetChannel.isTextBased()) {
             // Check bot permissions in the target channel before sending
             const botMember = await targetGuild.members.fetch(client.user.id);
             const permissions = targetChannel.permissionsFor(botMember);
             if (permissions && permissions.has(PermissionsBitField.Flags.SendMessages) && permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
                 await targetChannel.send({ embeds: [bumpEmbed], components: self.inviteLink ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Join Server').setStyle(ButtonStyle.Link).setURL(self.inviteLink))] : [] }); // Add button if invite exists
                 successCount++;
             } else {
                 console.warn(`Bump failed to ${partner.guildName} (${partner.guildId}): Missing permissions in channel #${targetChannel.name}`);
                 failCount++;
                 failedServers.push(partner.guildName);
             }
          } else {
             console.warn(`Bump failed to ${partner.guildName} (${partner.guildId}): Channel ${partner.partnerChannelId} not found or not text-based.`);
             failCount++;
             failedServers.push(partner.guildName);
          }
        } catch (err) {
          console.error(`❌ Error bumping to ${partner.guildName} (${partner.guildId}):`, err.message);
          failCount++;
          failedServers.push(partner.guildName);
           // Consider removing partner if error persists (e.g., bot kicked)
           if (err.code === 10003 || err.code === 50001) { // Unknown channel or Missing Access
               console.log(`Removing partner ${partner.guildName} due to likely invalid channel or permissions.`);
               // await Partner.deleteOne({ guildId: partner.guildId }); // Be cautious with auto-removal
           }
        }
      }

      // Update the last bump time for the current guild
      await Partner.findOneAndUpdate({ guildId }, { lastBump: new Date() });

      // Edit the deferred reply with the results
       let replyContent = `✅ Bump successfully sent to ${successCount} partner server(s).`;
       if (failCount > 0) {
           replyContent += `\n❌ Failed to send to ${failCount} server(s).`;
           // Optional: List failed servers if the list isn't too long
           // if (failedServers.length < 5) {
           //     replyContent += ` (Failed: ${failedServers.join(', ')})`;
           // }
       }
      return interaction.editReply(replyContent);
    }

    if (interaction.commandName === "invite") {
      const invite = getBotInviteUrl(); // Use the function here
      const inviteEmbed = new EmbedBuilder()
        .setTitle("Invite Me!")
        .setDescription(`Click the button below to invite the Partner Bot to your server.`)
        .setColor("#5865F2");
      const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Invite Bot")
            .setStyle(ButtonStyle.Link)
            .setURL(invite)
      );
      return interaction.reply({ embeds: [inviteEmbed], components: [row], ephemeral: true });
    }

    if (interaction.commandName === "setinvite") {
      const invite = interaction.options.getString("invite");
      // Basic validation for Discord invite link format
      const inviteRegex = /^https:\/\/discord\.(gg|com\/invite)\/[\w-]+$/;
      if (!inviteRegex.test(invite)) {
        return interaction.reply({
          content:
            "❌ Please provide a valid Discord invite link (e.g., `https://discord.gg/yourinvite`).",
          ephemeral: true,
        });
      }

       const partner = await Partner.findOne({ guildId });
        if (!partner || !partner.approved) {
            return interaction.reply({
                content: "❌ Your server must be registered and approved first.",
                ephemeral: true
            });
        }

      await Partner.findOneAndUpdate(
        { guildId },
        { inviteLink: invite },
        // { upsert: true }, // Removed upsert - server must exist
      );
      return interaction.reply({
          content: `✅ Invite link set successfully to: <${invite}>`,
          ephemeral: true // Keep ephemeral
        });
    }

    if (interaction.commandName === "setstatus") {
        // Permission check already handled at the beginning
        const status = interaction.options.getString("status");
        try {
            await client.user.setActivity(status, { type: ActivityType.Watching });
            console.log(`Bot status updated by owner to: ${status}`);
            return interaction.reply({
                content: `✅ Bot status updated to: **Watching ${status}**`,
                ephemeral: true,
            });
        } catch (error) {
            console.error("Error updating bot status:", error);
            return interaction.reply({
                content: "❌ Failed to update bot status. Check the logs.",
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

       // Ensure the role is not @everyone or a managed role (like bot roles)
       if (role.id === interaction.guild.roles.everyone.id || role.managed) {
           return interaction.reply({
               content: "❌ You cannot set the partner role to `@everyone` or a managed role.",
               ephemeral: true,
           });
       }


      await Partner.findOneAndUpdate(
        { guildId },
        { partnerRoleId: role.id },
        { upsert: true }, // Upsert might be okay here if registration failed partially
      );

      return interaction.reply({
        content: `✅ Partner role set to ${role}. Members with this role (or admins) can now use partner commands.`,
        ephemeral: true, // Keep ephemeral
      });
    }

    // Top tier slot commands (Owner Only - checked earlier)
    if (interaction.commandName === "settopslot") {
      const serverId = interaction.options.getString("serverid");
      const slotNumber = interaction.options.getInteger("slot");

      try {
        const guild = await client.guilds.fetch(serverId).catch(() => null); // Handle fetch errors
        if (!guild) {
          return interaction.reply({
            content: "❌ Could not find the specified server. Ensure the bot is in that server.",
            ephemeral: true,
          });
        }

        const partner = await Partner.findOne({ guildId: serverId });
        if (!partner || !partner.approved) {
          return interaction.reply({
            content: `❌ Server "${guild.name}" must be an approved partner first.`,
            ephemeral: true,
          });
        }

        // Check if another server already occupies this slot
        const existingSlot = await TopTierSlot.findOne({ slotNumber });
        if (existingSlot && existingSlot.guildId !== serverId) {
             return interaction.reply({
                 content: `❌ Slot ${slotNumber} is already occupied by "${existingSlot.guildName}". Use \`/removetopslot\` first.`,
                 ephemeral: true,
             });
        }
        // Check if this server already occupies another slot
        const serverInAnotherSlot = await TopTierSlot.findOne({ guildId: serverId });
         if (serverInAnotherSlot && serverInAnotherSlot.slotNumber !== slotNumber) {
             return interaction.reply({
                 content: `❌ Server "${guild.name}" is already in slot ${serverInAnotherSlot.slotNumber}. Use \`/removetopslot\` first.`,
                 ephemeral: true,
             });
         }


        await TopTierSlot.findOneAndUpdate(
          { slotNumber },
          { guildId: serverId, guildName: guild.name },
          { upsert: true, new: true },
        );
         // Update the partner document as well
         await Partner.findOneAndUpdate({ guildId: serverId }, { isTopTier: true });


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

    if (interaction.commandName === "removetopslot") {
      const slotNumber = interaction.options.getInteger("slot");

      try {
        const slot = await TopTierSlot.findOneAndDelete({ slotNumber });
        if (!slot) {
          return interaction.reply({
            content: `❌ No server was assigned to slot ${slotNumber}.`,
            ephemeral: true,
          });
        }
         // Update the partner document as well
         await Partner.findOneAndUpdate({ guildId: slot.guildId }, { isTopTier: false });


        return interaction.reply({
          content: `✅ Removed server "${slot.guildName}" from top tier slot ${slotNumber}.`,
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
  } // --- End Slash Command Handling ---


  // --- Handle Button Interactions ---
  if (interaction.isButton()) {
    console.log("Button interaction received:", {
      customId: interaction.customId,
      user: interaction.user.tag,
      guild: interaction.guild?.name, // Admin guild
    });

    // Ensure button interaction is from the admin server
    if (interaction.guildId !== process.env.ADMIN_SERVER_ID) {
        console.warn(`Button interaction received from non-admin server: ${interaction.guildId}`);
        return interaction.reply({ content: "❌ This button can only be used in the admin server.", ephemeral: true });
    }


    // Split the customId: action_type_targetId (e.g., approve_msg_12345, decline_server_67890)
    const parts = interaction.customId.split("_");
    if (parts.length < 3) {
      console.error("Invalid button customId format:", interaction.customId);
      return interaction.reply({
        content: "❌ Invalid button interaction format.",
        ephemeral: true,
      });
    }

    const action = parts[0]; // approve, decline, setup
    const type = parts[1]; // msg, server, modal
    const targetId = parts.slice(2).join("_"); // Guild ID might contain underscores, rejoin

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
      // Fetch the partner data using targetId (which is the guildId)
      console.log(`Looking for partner with guildId: ${targetId}`);
      const partner = await Partner.findOne({ guildId: targetId });
      // No partner needed for setup_modal button, handled separately

      // --- Button Handlers ---

      // Handle "Setup Server Advertisement" button (pressed by server owner in DMs/log channel)
      if (action === "setup" && type === "modal") {
           // Ensure the interaction user is the owner of the target guild
           try {
               const targetGuild = await client.guilds.fetch(targetId);
               if (interaction.user.id !== targetGuild.ownerId) {
                   return interaction.reply({ content: "❌ Only the server owner can use this setup button.", ephemeral: true });
               }
           } catch (fetchErr) {
               console.error(`Error fetching target guild ${targetId} for setup modal check:`, fetchErr);
               return interaction.reply({ content: "❌ Could not verify server ownership.", ephemeral: true });
           }


          const modal = new ModalBuilder()
            .setCustomId(`partner_setup_${targetId}`) // Link modal submit to the guild
            .setTitle(`Setup: ${partner?.guildName || targetId}`); // Show guild name if available

          const messageInput = new TextInputBuilder()
            .setCustomId("message")
            .setLabel("Your Server Advertisement Message")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Enter your server advertisement message...")
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000); // Match command option length

          const inviteInput = new TextInputBuilder()
            .setCustomId("invite")
            .setLabel("Server Invite Link")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("https://discord.gg/yourinvite")
            .setRequired(true);

          const channelInput = new TextInputBuilder()
            .setCustomId("channel")
            .setLabel("Partner Channel ID")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Enter the ID of the channel for partner ads")
            .setRequired(true);

          modal.addComponents(
              new ActionRowBuilder().addComponents(messageInput),
              new ActionRowBuilder().addComponents(inviteInput),
              new ActionRowBuilder().addComponents(channelInput)
          );

          try {
              await interaction.showModal(modal);
          } catch (error) {
              console.error("Error showing setup modal:", error);
              // If modal fails, try replying ephemerally
              try {
                  await interaction.reply({
                      content: "❌ An error occurred while showing the setup form. Please try using the `/setmessage`, `/setinvite`, and `/setchannel` commands instead.",
                      ephemeral: true,
                  });
              } catch (replyError) {
                  console.error("Error sending fallback reply for modal failure:", replyError);
              }
          }
          return; // Stop further processing for this button
      }


      // --- Admin Button Handlers (Require partner data) ---
      if (!partner && !(action === 'setup' && type === 'modal')) { // Check partner exists for non-setup buttons
        console.error(`No partner found for guild ID: ${targetId} during ${action}_${type} action.`);
        // Disable buttons on the original message
        await interaction.update({
            content: `⚠️ Partner data not found for ${targetId}. Server might be unregistered.`,
            components: []
        });
        return;
      }


      // --- Message Approval/Decline ---
      if (type === "msg") {
        if (!partner.messagePending || !partner.pendingMessage) {
          console.warn(`No pending message found for partner ${targetId} during ${action}_msg action.`);
          await interaction.update({
            content: `⚠️ No pending message found for ${partner.guildName}. It might have been handled already.`,
            components: [],
          });
          return;
        }

        let notificationMessage = "";
        let updateData = {};

        if (action === "approve") {
          updateData = {
            partnerMessage: partner.pendingMessage, // Move pending to approved
            pendingMessage: null, // Clear pending message
            pendingMessageUserId: null, // Clear pending user ID
            messagePending: false, // Set pending flag to false
          };
          notificationMessage = `✅ Your ad message submission for **${partner.guildName}** has been approved! You can now use \`/bump\`.`;
          await interaction.update({
            content: `✅ Approved message for ${partner.guildName}.`,
            components: [], // Remove buttons
          });
        } else if (action === "decline") {
          updateData = {
            pendingMessage: null, // Clear pending message
            pendingMessageUserId: null, // Clear pending user ID
            messagePending: false, // Set pending flag to false
          };
          notificationMessage = `❌ Your ad message submission for **${partner.guildName}** has been declined. Please review the rules and submit a new one using \`/setmessage\`.`;
           await interaction.update({
            content: `❌ Declined message for ${partner.guildName}.`,
            components: [], // Remove buttons
          });
        } else {
             console.warn(`Unknown action '${action}' for type 'msg'`);
             return; // Unknown action
        }

        // Update the database
        await Partner.findOneAndUpdate({ guildId: targetId }, updateData);

        // Notify the user who submitted the message
        if (partner.pendingMessageUserId) {
          try {
            const user = await client.users.fetch(partner.pendingMessageUserId);
            await user.send(notificationMessage);
          } catch (dmError) {
            console.log(`Could not DM user ${partner.pendingMessageUserId}:`, dmError.message);
            // Fallback: Try sending to the server's log channel
            try {
               const targetGuild = await client.guilds.fetch(targetId);
               const logChannel = targetGuild.channels.cache.find(c => c.name === logChannelName);
               if (logChannel) {
                   await logChannel.send(`<@${partner.pendingMessageUserId}> ${notificationMessage}`);
               }
            } catch (logNotifyError) {
                console.error(`Failed to send fallback notification to log channel for ${targetId}:`, logNotifyError);
            }
          }
        }
        return; // Handled message approval/decline
      }

      // --- Server Approval/Decline ---
      if (type === "server") {
         if (action === "approve") {
             if (partner.approved) {
                 return interaction.update({ content: `⚠️ Server ${partner.guildName} is already approved.`, components: [] });
             }

             await Partner.findOneAndUpdate({ guildId: targetId }, { approved: true });
             await interaction.update({
                 content: `✅ Approved server: ${partner.guildName}. Sent setup instructions.`,
                 components: [],
             });

             // Send setup instructions (DM owner with fallback to log channel)
             try {
                 const targetGuild = await client.guilds.fetch(targetId);
                 const owner = await targetGuild.members.fetch(targetGuild.ownerId);
                 const setupButton = new ButtonBuilder()
                     .setCustomId(`setup_modal_${targetId}`) // Button to trigger the modal
                     .setLabel("Setup Server Advertisement")
                     .setStyle(ButtonStyle.Primary);
                 const setupActionRow = new ActionRowBuilder().addComponents(setupButton);

                 try {
                     await owner.send({
                         content: `✅ Your server **${targetGuild.name}** has been approved for partnering! Please click the button below to set up your server advertisement, invite link, and partner channel.`,
                         components: [setupActionRow],
                     });
                 } catch (dmError) {
                     console.log(`Could not DM server owner ${owner.user.tag} (${targetGuild.ownerId}):`, dmError.message);
                     // Fallback to log channel
                     const logChannel = targetGuild.channels.cache.find(c => c.name === logChannelName);
                     if (logChannel) {
                         await logChannel.send({
                             content: `✅ Your server has been approved for partnering! ${owner}, please click the button below to set up your server advertisement. (We couldn't DM you).`,
                             components: [setupActionRow],
                         });
                     } else {
                          console.warn(`Could not send setup instructions to ${targetGuild.name} - no DM access and no log channel found.`);
                           // Maybe notify admin interaction user?
                           await interaction.followUp({ content: `⚠️ Could not notify owner of ${targetGuild.name} (DM closed, no log channel). Setup required via commands.`, ephemeral: true });
                     }
                 }
             } catch (err) {
                 console.error(`Error sending approval notification/setup for ${targetId}:`, err);
                 // Notify admin interaction user about the failure
                 await interaction.followUp({ content: `⚠️ Error occurred trying to notify owner of ${partner.guildName}. Setup might need manual instruction.`, ephemeral: true });
             }

         } else if (action === "decline") {
             await interaction.update({
                 content: `❌ Declined server: ${partner.guildName}. Bot will leave shortly.`,
                 components: [],
             });

             // Delete partner data first
             await Partner.deleteOne({ guildId: targetId });
             // Also remove from top tier slots if present
             await TopTierSlot.deleteMany({ guildId: targetId });

             // Notify and leave the server
             try {
                 const targetGuild = await client.guilds.fetch(targetId);
                 // Try sending to log channel first
                 const logChannel = targetGuild.channels.cache.find(c => c.name === logChannelName);
                 let notified = false;
                 if (logChannel) {
                     try {
                         await logChannel.send("❌ Your server registration has been declined. The bot will now leave.");
                         notified = true;
                     } catch (logSendErr) {
                         console.warn(`Could not send decline message to log channel in ${targetGuild.name}`);
                     }
                 }
                 // Try DMing owner if log channel failed or doesn't exist
                 if (!notified) {
                     try {
                         const owner = await targetGuild.members.fetch(targetGuild.ownerId);
                         await owner.send(`❌ Your server registration for **${targetGuild.name}** has been declined. The bot will now leave.`);
                     } catch (dmError) {
                         console.log(`Could not DM owner of ${targetGuild.name} about decline.`);
                     }
                 }

                 // Leave the server after attempting notification
                 await targetGuild.leave();
                 console.log(`Left server ${targetGuild.name} (${targetGuild.id}) after declining partnership.`);

             } catch (err) {
                 console.error(`Error handling server decline for ${targetId}:`, err);
                 // If guild fetch fails, it might already be gone or invalid ID
                 if (err.code === 10004) { // Unknown Guild
                      console.log(`Guild ${targetId} not found, likely already left or invalid.`);
                 }
             }
         } else {
             console.warn(`Unknown action '${action}' for type 'server'`);
         }
         return; // Handled server approval/decline
      }


    } catch (error) {
      console.error("Error handling button interaction:", error);
       // Try to inform the button user about the error
       try {
           if (interaction.replied || interaction.deferred) {
               await interaction.followUp({ content: "❌ An error occurred while processing this action.", ephemeral: true });
           } else {
               await interaction.reply({ content: "❌ An error occurred while processing this action.", ephemeral: true });
           }
       } catch (replyError) {
           console.error("Error sending error feedback for button interaction:", replyError);
       }
    }
  } // --- End Button Handling ---


  // --- Handle Modal Submissions ---
  if (interaction.isModalSubmit()) {
    console.log("Modal submission received:", {
      customId: interaction.customId,
      user: interaction.user.tag, // User who submitted the modal
    });

    if (interaction.customId.startsWith("partner_setup_")) {
      const guildId = interaction.customId.replace("partner_setup_", "");
      const message = interaction.fields.getTextInputValue("message");
      const inviteLink = interaction.fields.getTextInputValue("invite");
      const channelId = interaction.fields.getTextInputValue("channel");

      // Defer reply as validation takes time
      await interaction.deferReply({ ephemeral: true });

      try {
        // Fetch the target guild
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
          return interaction.editReply({
            content: "❌ Could not find the associated server. Please contact support.",
          });
        }

         // Ensure the user submitting the modal is the owner
         if (interaction.user.id !== guild.ownerId) {
             return interaction.editReply({ content: "❌ Only the server owner can submit this setup form." });
         }


        // Validate the channel ID
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (
          !channel ||
          ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
            channel.type,
          )
        ) {
          return interaction.editReply({
            content:
              `❌ Invalid Partner Channel ID: Please provide a valid ID for a text or announcement channel in **${guild.name}**. You entered: \`${channelId}\``,
          });
        }

         // Check bot permissions in the selected channel
         const botMember = await guild.members.fetch(client.user.id);
         const permissions = channel.permissionsFor(botMember);
         if (!permissions || !permissions.has(PermissionsBitField.Flags.SendMessages) || !permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
             return interaction.editReply({
                 content: `❌ I don't have permission to send messages and embed links in the selected channel <#${channel.id}>. Please grant permissions and use \`/setchannel\` to update.`,
             });
         }


        // Validate the invite link format
        const inviteRegex = /^https:\/\/discord\.(gg|com\/invite)\/[\w-]+$/;
        if (!inviteRegex.test(inviteLink)) {
          return interaction.editReply({
            content:
              "❌ Invalid Invite Link: Please provide a valid Discord invite link (e.g., `https://discord.gg/yourinvite`).",
          });
        }

        // Update the partner data
        // IMPORTANT: Set the message directly, don't put it in pending
        await Partner.findOneAndUpdate(
          { guildId },
          {
            partnerMessage: message, // Directly set the approved message
            inviteLink: inviteLink,
            partnerChannelId: channelId,
            messagePending: false, // Ensure no pending message state
            pendingMessage: null,
            pendingMessageUserId: null,
          },
          { new: true } // Make sure the partner exists and is approved
        );

        return interaction.editReply({
          content: "✅ Server setup completed successfully! You can now use `/bump`.",
        });
      } catch (error) {
        console.error("Error handling partner_setup modal submit:", error);
        return interaction.editReply({
          content: "❌ An error occurred while processing your setup submission. Please try again or use the individual set commands.",
        });
      }
    }
     // Handle other potential modals here if added later
  } // --- End Modal Handling ---

}); // --- End interactionCreate Listener ---


// --- Express Web Server Setup ---
const app = express();

// Wait for database connection before starting web server potentially
mongoose.connection.once("open", () => {
  console.log("✅ MongoDB connected successfully");
  // Start listening only after DB is connected (optional, depends on needs)
  // app.listen(PORT, () => console.log(`🌐 Web dashboard running on http://localhost:${PORT}`));
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
  // Consider exiting the process if DB connection is critical
  // process.exit(1);
});


// --- Web Routes ---

// Function to generate Bot Invite URL (ensure client.user is ready)
function getBotInviteUrl() {
    if (!client.user?.id) {
        console.warn("getBotInviteUrl called before client is ready.");
        return "#"; // Return a placeholder if client ID is not available yet
    }
    // Permissions needed: Send Messages, Embed Links, View Channels (implicitly granted), Read Message History (for logs?), Manage Webhooks (if using?)
    // Use permission calculator: 8 = Admin (simplest), more granular: 2048 (Send) + 16384 (Embed) + 1024 (View) = 19456
    const permissions = '19456'; // Send Messages, Embed Links, View Channels
    return `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=${permissions}&scope=bot%20applications.commands`;
}


// Shared HTML Head and Navbar Structure
const getHtmlStructure = (title, content) => {
    const inviteUrl = getBotInviteUrl(); // Get current invite URL
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title} - SkyVPS360 Partner Network</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="description" content="Discord partnership network featuring various communities.">
      <link rel="icon" href="/favicon.ico" type="image/x-icon"> <style>
        /* Inter Font */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        /* Base Styles & Variables */
        :root {
          --bg-primary: #1a1b1e; /* Darker background */
          --bg-secondary: #2c2d31; /* Card background */
          --bg-tertiary: #1f2023; /* Navbar/Footer background */
          --accent: #5865f2; /* Discord blue */
          --accent-hover: #4752c4;
          --accent-light: #7289da;
          --text-primary: #ffffff;
          --text-secondary: #dcddde;
          --text-muted: #96989d; /* Slightly lighter muted text */
          --border-color: rgba(255, 255, 255, 0.08); /* Subtle border */
          --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
          --shadow: 0 4px 8px rgba(0,0,0,0.15);
          --shadow-lg: 0 10px 20px rgba(0,0,0,0.2);
          --radius-sm: 6px;
          --radius: 12px;
          --radius-lg: 16px;
          --transition-speed: 0.3s;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          line-height: 1.6;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Navbar */
        .navbar {
          background: rgba(31, 32, 35, 0.8); /* Slightly transparent */
          backdrop-filter: blur(10px);
          padding: 1rem 2rem;
          position: sticky;
          top: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center; /* Center items */
          gap: 1rem; /* Reduced gap */
          box-shadow: var(--shadow);
          border-bottom: 1px solid var(--border-color);
        }

        .navbar a {
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          padding: 0.6rem 1.2rem; /* Slightly larger padding */
          border-radius: var(--radius-sm);
          transition: all var(--transition-speed) ease;
          font-size: 0.95rem;
          border: 1px solid transparent; /* Placeholder border */
        }
         .navbar a:hover, .navbar a.active { /* Style for active link */
          background: var(--bg-secondary);
          color: var(--text-primary);
          border-color: var(--border-color);
          transform: translateY(-1px);
        }

        /* Main Container */
        .container {
          max-width: 1300px; /* Slightly wider */
          margin: 2rem auto;
          padding: 0 2rem; /* Padding on sides */
          flex: 1; /* Make container grow */
          width: 100%;
        }

        /* Headings */
        h1, h2, h3 { color: var(--text-primary); font-weight: 700; margin-bottom: 1rem; }
        h1 { font-size: 2.2rem; text-align: center; margin-bottom: 2rem; color: var(--accent-light); }
        h2 { font-size: 1.8rem; margin-top: 2.5rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.5rem; display: inline-block; }
        h3 { font-size: 1.4rem; color: var(--accent); } /* Card titles */

        /* Paragraphs and Lists */
        p, ul, ol { color: var(--text-secondary); margin-bottom: 1rem; }
        ul, ol { padding-left: 1.5rem; }
        li { margin-bottom: 0.5rem; }
        code { background: var(--bg-tertiary); padding: 0.2em 0.5em; border-radius: var(--radius-sm); font-family: 'Consolas', 'Monaco', monospace; color: var(--accent-light); font-size: 0.9em; border: 1px solid var(--border-color); }
        strong { color: var(--accent); font-weight: 600; }
        a { color: var(--accent); text-decoration: none; transition: color var(--transition-speed) ease; }
        a:hover { color: var(--accent-hover); text-decoration: underline; }

        /* Buttons */
        .button, .cta-button, .invite-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: var(--accent);
          color: var(--text-primary);
          text-decoration: none;
          border-radius: var(--radius);
          font-weight: 600;
          transition: all var(--transition-speed) ease;
          border: none;
          cursor: pointer;
          text-align: center;
          font-size: 1rem;
        }
        .button:hover, .cta-button:hover, .invite-button:hover {
          background: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 5px 10px rgba(88, 101, 242, 0.3);
        }

        /* Footer */
        .footer {
          background: var(--bg-tertiary);
          color: var(--text-muted);
          text-align: center;
          padding: 1.5rem 2rem;
          margin-top: 3rem; /* Ensure space above footer */
          border-top: 1px solid var(--border-color);
          font-size: 0.9rem;
        }
        .footer a { color: var(--accent-light); }
        .footer a:hover { color: var(--accent); }

        /* Responsive */
        @media (max-width: 768px) {
          .navbar { flex-direction: column; padding: 1rem; }
          .navbar a { width: 100%; text-align: center; margin-bottom: 0.5rem; }
          .container { padding: 0 1rem; }
          h1 { font-size: 1.8rem; }
          h2 { font-size: 1.5rem; }
        }

        /* Fade-in Animation */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.5s ease-out forwards; }
      </style>
    </head>
    <body>
      <nav class="navbar">
        <a href="/" class="${title === 'Home' ? 'active' : ''}">Home</a>
        <a href="/docs" class="${title === 'Documentation' ? 'active' : ''}">Docs</a>
        <a href="${process.env.DOMAIN || '#'}" target="_blank" rel="noopener noreferrer">SkyVPS360</a> <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer">Invite Bot</a>
      </nav>
      <main class="container fade-in">
        ${content}
      </main>
      <footer class="footer">
        © ${new Date().getFullYear()} SkyVPS360 Partner Network | Powered by Discord.js
        | <a href="${process.env.DOMAIN || '#'}" target="_blank" rel="noopener noreferrer">Visit SkyVPS360</a>
      </footer>
    </body>
    </html>
  `;
};


// Home Page Route (`/`)
app.get("/", async (req, res) => {
  try {
    console.log("Fetching data for home page...");
    const topTierSlotsData = await TopTierSlot.find({}).sort({ slotNumber: 1 });
    const partnersData = await Partner.find(
      {
        approved: true,
        partnerMessage: { $exists: true, $ne: null, $ne: "" }, // Ensure message exists and is not empty
        inviteLink: { $exists: true, $ne: null, $ne: "" }, // Ensure invite link exists
        partnerChannelId: { $exists: true, $ne: null }, // Ensure channel is set
      },
      "guildId guildName partnerMessage inviteLink isTopTier" // Select necessary fields
    ).lean(); // Use .lean() for faster queries when not modifying docs

    console.log(`Found ${topTierSlotsData.length} top tier slots definitions.`);
    console.log(`Found ${partnersData.length} approved partners with message/invite/channel.`);

    // Create a map for quick partner lookup
    const partnerMap = new Map(partnersData.map(p => [p.guildId, p]));

    // Generate Top Tier Slot Cards (always show 3 slots)
    const slotsToDisplay = Array.from({ length: 3 }, (_, i) => {
      const slotNumber = i + 1;
      const existingSlot = topTierSlotsData.find(s => s.slotNumber === slotNumber);
      return {
        slotNumber,
        guildId: existingSlot?.guildId,
        guildName: existingSlot?.guildName, // Use stored name as fallback
      };
    });

    const topTierCardsPromises = slotsToDisplay.map(async (slot) => {
      const partner = slot.guildId ? partnerMap.get(slot.guildId) : null;

      if (!slot.guildId || !partner) {
        // Empty Slot Card
        return `
          <div class="top-tier-card empty">
            <div class="slot-number">Slot ${slot.slotNumber}</div>
            <h3>Premium Slot Available</h3>
            <p>Boost your server's visibility!</p>
            <a href="#" class="cta-button disabled">Contact Owner</a> </div>`;
      }

      // Filled Slot Card
      try {
        const guild = await client.guilds.fetch(slot.guildId).catch(() => null);
        const iconURL = guild?.iconURL({ dynamic: true, size: 128 }) || 'https://cdn.discordapp.com/embed/avatars/0.png'; // Default icon
        const memberCount = guild?.memberCount || 'N/A';
        // Fetching online members can be intensive, consider caching or omitting if slow
        // const onlineMembers = guild?.presences?.cache.filter(p => p.status === 'online').size || 'N/A';

        return `
          <div class="top-tier-card filled">
            <div class="premium-badge">⭐ Premium</div>
            <img src="${iconURL}" alt="${partner.guildName} Icon" loading="lazy">
            <h3>${guild?.name || partner.guildName}</h3>
            <p class="partner-message">${partner.partnerMessage}</p>
            <div class="stats">
              <span class="stat">👥 ${memberCount} Members</span>
              </div>
            <a href="${partner.inviteLink}" target="_blank" rel="noopener noreferrer" class="cta-button">Join Server</a>
          </div>`;
      } catch (error) {
        console.error(`Error generating top tier card for ${slot.guildId}:`, error);
        // Fallback card on error
        return `
          <div class="top-tier-card error">
             <div class="slot-number">Slot ${slot.slotNumber}</div>
            <h3>${partner.guildName}</h3>
            <p>Error loading details.</p>
            <a href="${partner.inviteLink}" target="_blank" rel="noopener noreferrer" class="cta-button">Join (Link Only)</a>
          </div>`;
      }
    });

    const topTierCardsHtml = (await Promise.all(topTierCardsPromises)).join("");

    // Generate Regular Partner Cards (exclude top tier)
    const regularPartners = partnersData.filter(p => !p.isTopTier); // Filter using the isTopTier flag

    const regularCardsPromises = regularPartners.map(async (partner) => {
      try {
        const guild = await client.guilds.fetch(partner.guildId).catch(() => null);
        const iconURL = guild?.iconURL({ dynamic: true, size: 128 }) || 'https://cdn.discordapp.com/embed/avatars/1.png'; // Different default icon
        const memberCount = guild?.memberCount || 'N/A';

        return `
          <div class="partner-card">
            <img src="${iconURL}" alt="${partner.guildName} Icon" loading="lazy">
            <h3>${guild?.name || partner.guildName}</h3>
            <p class="partner-message">${partner.partnerMessage}</p>
            <div class="stats">
              <span class="stat">👥 ${memberCount} Members</span>
            </div>
            <a href="${partner.inviteLink}" target="_blank" rel="noopener noreferrer" class="invite-button">Join Server</a>
          </div>`;
      } catch (error) {
        console.error(`Error generating regular card for ${partner.guildId}:`, error);
        return `
          <div class="partner-card error">
            <h3>${partner.guildName}</h3>
            <p>Error loading details.</p>
             <a href="${partner.inviteLink}" target="_blank" rel="noopener noreferrer" class="invite-button">Join (Link Only)</a>
          </div>`;
      }
    });

    const regularCardsHtml = (await Promise.all(regularCardsPromises)).join("");

    // --- Home Page Specific Styles ---
    const pageStyles = `
      <style>
        .section-title {
          text-align: center;
          margin: 3rem 0 2rem;
          font-size: 2rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        /* Top Tier Section */
        .top-tier-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); /* Responsive grid */
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .top-tier-card {
          background: linear-gradient(145deg, var(--bg-secondary), #3a3c41); /* Subtle gradient */
          border-radius: var(--radius-lg);
          padding: 2rem 1.5rem;
          text-align: center;
          position: relative;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow);
          transition: transform var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden; /* Prevent content overflow */
        }
        .top-tier-card:hover {
            transform: translateY(-5px);
            box-shadow: var(--shadow-lg);
        }
         .top-tier-card.empty {
            border: 2px dashed var(--accent-light);
            background: var(--bg-secondary);
            opacity: 0.8;
         }
         .top-tier-card.error { border-color: #e53e3e; } /* Error indication */

         .slot-number { /* For empty slots */
             position: absolute;
             top: 1rem;
             left: 1rem;
             font-size: 0.9rem;
             color: var(--text-muted);
             background: var(--bg-tertiary);
             padding: 0.3rem 0.6rem;
             border-radius: var(--radius-sm);
         }

        .premium-badge {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: var(--accent);
          color: var(--text-primary);
          padding: 0.4rem 0.8rem;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          font-weight: 600;
          box-shadow: var(--shadow-sm);
        }

        .top-tier-card img {
          width: 100px; /* Slightly smaller */
          height: 100px;
          border-radius: 50%;
          margin-bottom: 1rem;
          border: 3px solid var(--bg-tertiary);
          box-shadow: var(--shadow-sm);
        }

        .top-tier-card h3 {
          color: var(--text-primary); /* White title for cards */
          font-size: 1.5rem; /* Adjusted size */
          margin-bottom: 0.8rem;
        }
         .top-tier-card.empty h3 { color: var(--accent-light); }

        .top-tier-card p, .partner-card p {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
          font-size: 0.95rem;
          flex-grow: 1; /* Allow paragraph to take space */
          max-height: 100px; /* Limit description height */
          overflow: hidden;
          text-overflow: ellipsis; /* Add ellipsis for overflow */
          display: -webkit-box;
          -webkit-line-clamp: 4; /* Limit to 4 lines */
          -webkit-box-orient: vertical;
        }

        .stats {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        .stat {
          background: var(--bg-tertiary);
          padding: 0.4rem 0.9rem;
          border-radius: 20px;
          font-size: 0.85rem;
          color: var(--text-muted);
          border: 1px solid var(--border-color);
        }

        .cta-button { margin-top: auto; /* Push button to bottom */ }
        .cta-button.disabled { background-color: var(--text-muted); cursor: not-allowed; }

        /* Regular Partner Grid */
        .partner-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); /* Responsive */
          gap: 1.5rem; /* Slightly smaller gap */
        }

        .partner-card {
          background: var(--bg-secondary);
          border-radius: var(--radius);
          padding: 1.5rem;
          text-align: center;
          border: 1px solid var(--border-color);
          transition: transform var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden;
        }
        .partner-card:hover {
            transform: translateY(-3px);
            box-shadow: var(--shadow);
            border-color: rgba(88, 101, 242, 0.3); /* Subtle accent border on hover */
        }
         .partner-card.error { border-color: #e53e3e; }

        .partner-card img {
          width: 80px; /* Smaller icon */
          height: 80px;
          border-radius: 50%;
          margin-bottom: 1rem;
          border: 2px solid var(--bg-tertiary);
        }

        .partner-card h3 { font-size: 1.3rem; margin-bottom: 0.5rem; }

        .invite-button { margin-top: auto; /* Push to bottom */ padding: 0.6rem 1.2rem; font-size: 0.9rem; }

         /* No Partners Message */
         .no-partners {
             text-align: center;
             padding: 3rem;
             background: var(--bg-secondary);
             border-radius: var(--radius);
             color: var(--text-muted);
             margin-top: 2rem;
         }

      </style>
    `;

    // --- Assemble Home Page Content ---
    const pageContent = `
      ${pageStyles}
      <h1>🌟 Premium Partners</h1>
      <section class="top-tier-section">
        ${topTierCardsHtml || '<p class="no-partners">No premium partners configured yet.</p>'}
      </section>

      <h2 class="section-title">🤝 Our Partners</h2>
      <section class="partner-grid">
        ${regularCardsHtml || '<p class="no-partners">No regular partners found. Invite the bot and register!</p>'}
      </section>
    `;

    // Send the final HTML structure
    res.send(getHtmlStructure("Home", pageContent));

  } catch (error) {
    console.error("❌ Error in the `/` route:", error);
    // Send a user-friendly error page
    res.status(500).send(getHtmlStructure("Error", `
        <h1>Oops! Something went wrong.</h1>
        <p>We encountered an error while loading the partner list. Please try again later.</p>
        <p>If the problem persists, contact the bot owner.</p>
        <code>${error.message}</code>
    `));
  }
});


// Docs Page Route (`/docs`)
app.get("/docs", (req, res) => {
    const docsContent = `
      <style>
        .docs-content {
          background: var(--bg-secondary);
          border-radius: var(--radius);
          padding: 2.5rem; /* More padding */
          margin-top: 2rem;
          box-shadow: var(--shadow);
          border: 1px solid var(--border-color);
        }
        .section { margin-bottom: 2.5rem; }
        .command-list li { margin-bottom: 1rem; } /* More space between commands */
        .command-list code { font-size: 1em; padding: 0.3em 0.6em; } /* Larger code blocks */
        .command-list ul { margin-top: 0.5rem; padding-left: 1rem; }
        .command-list ul li { margin-bottom: 0.5rem; font-size: 0.95rem; color: var(--text-secondary); }
        .important { color: #f9a825; /* Yellowish warning color */ font-weight: 600; }
        .note { font-size: 0.9rem; color: var(--text-muted); }
        hr { border: none; height: 1px; background-color: var(--border-color); margin: 2rem 0; }
      </style>
      <h1>📘 Partner Bot Documentation</h1>
      <div class="docs-content">
        <div class="section">
          <h2>Getting Started</h2>
          <ol>
            <li>Invite the bot to your server using the "Invite Bot" link in the navbar.</li>
            <li>Ensure the bot has permissions to view channels, send messages, and embed links.</li>
            <li>Use <code>/register</code> to begin the partnership process. <strong class="important">Your server must have an icon set!</strong></li>
            <li>Wait for approval from the bot administrators (this happens in the admin server).</li>
            <li>Once approved, the server owner will receive a DM (or a message in your <code>#ad-logs</code> channel) with a button to set up the advertisement message, invite link, and partner channel using a form.</li>
            <li>Alternatively, after approval, use the <code>/setmessage</code>, <code>/setinvite</code>, and <code>/setchannel</code> commands.</li>
            <li>(Optional but Recommended) Use <code>/setrole</code> (Server Owner only) to designate a specific role that can use partner commands like <code>/bump</code>. Admins can always use them.</li>
            <li>Use <code>/bump</code> to send your ad!</li>
          </ol>
          <p class="note">A channel named <code>#ad-logs</code> will be created automatically (if it doesn't exist) to log bot actions and potentially receive notifications.</p>
        </div>

        <hr>

        <div class="section">
          <h2>User Commands</h2>
          <p>These commands generally require Administrator permission or the role set via <code>/setrole</code>.</p>
          <ul class="command-list">
            <li><code>/help</code> - Displays the list of commands.</li>
            <li><code>/register</code> - Starts the server registration process.</li>
            <li><code>/setchannel [channel]</code> - Sets the channel where your server will receive partner ads.
                <ul><li>The bot needs Send Message & Embed Link permissions in this channel.</li></ul>
            </li>
            <li><code>/setmessage [message]</code> - Sets or updates your server's advertisement message. Requires admin approval each time.</li>
            <li><code>/previewmessage</code> - Shows your currently approved advertisement message (the one used for bumps).</li>
            <li><code>/setinvite [invite_link]</code> - Sets or updates the permanent invite link for your server displayed on the website and in bumps.</li>
            <li><code>/bump</code> - Sends your approved advertisement message to all other approved partner servers. (Default 30-minute cooldown).</li>
            <li><code>/unregister</code> - Removes your server from the partnership network. This is permanent and requires re-registering.</li>
            <li><code>/invite</code> - Gets the bot's invite link.</li>
          </ul>
        </div>

        <hr>

        <div class="section">
          <h2>Admin & Owner Commands</h2>
          <ul class="command-list">
            <li><code>/setrole [role]</code> - (Server Owner Only) Sets the specific role that can use partner commands (e.g., <code>/bump</code>, <code>/setmessage</code>).</li>
            <li><code>/setstatus [status]</code> - (Bot Owner Only) Sets the bot's "Watching" status message.</li>
            <li><code>/settopslot [serverid] [slot]</code> - (Bot Owner Only) Assigns an approved partner server to a premium slot (1-3) on the website.</li>
            <li><code>/removetopslot [slot]</code> - (Bot Owner Only) Removes a server from a premium slot.</li>
          </ul>
        </div>

         <hr>

         <div class="section">
            <h2>Troubleshooting</h2>
            <ul>
                <li><strong>Command Not Working?</strong> Ensure you have Administrator permission or the role set by <code>/setrole</code>. Check if the bot is online.</li>
                <li><strong>"Interaction Failed" Error?</strong> This usually means the bot took too long to respond or encountered an internal error. Try the command again. If it persists, contact the bot owner. Check the bot's console logs for specific errors.</li>
                <li><strong>Cannot Set Channel?</strong> Make sure the bot has 'View Channel', 'Send Messages', and 'Embed Links' permissions in the channel you're trying to set.</li>
                <li><strong>Bump Fails?</strong> Check the cooldown with <code>/bump</code>. Ensure your message, channel, and invite are set using <code>/previewmessage</code>, <code>/setchannel</code>, and <code>/setinvite</code>. Check the <code>#ad-logs</code> channel for any specific failure messages.</li>
                 <li><strong>Modal Not Appearing?</strong> Ensure your DMs are open from server members if the bot tries to DM you for setup. Check the <code>#ad-logs</code> channel for the setup button.</li>
            </ul>
         </div>

      </div>
    `;
    res.send(getHtmlStructure("Documentation", docsContent));
});


// --- Start Express Server ---
const PORT = process.env.PORT || 3000;
// Listen only if the script is run directly (not required/imported)
if (require.main === module) {
    // Wait for bot login before starting web server
    client.login(process.env.DISCORD_TOKEN)
      .then(() => {
          console.log("✅ Discord client logged in successfully.");
          app.listen(PORT, () => console.log(`🌐 Web server running on http://localhost:${PORT}`));
      })
      .catch((error) => {
          console.error("❌ Failed to log in to Discord:", error);
          process.exit(1); // Exit if login fails
      });
}


// --- Helper Functions ---

// Check if a member has permission to use partner commands
async function hasPermission(member, guildId) {
  // Bot owner always has permission
  if (member.user.id === process.env.BOT_OWNER_ID) { // Use env var
    return true;
  }

  // Server owner always has permission
  if (member.id === member.guild.ownerId) {
    return true;
  }

  // Check for Administrator permission
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }

  // Check for the specific partner role, if set
  try {
      const partner = await Partner.findOne({ guildId }).lean(); // Use lean for read-only
      if (partner && partner.partnerRoleId) {
          return member.roles.cache.has(partner.partnerRoleId);
      }
  } catch (dbError) {
      console.error("Error fetching partner role for permission check:", dbError);
      // Fallback to false or re-throw depending on desired strictness
      return false;
  }


  // If no role is set and user is not admin/owner, deny permission
  return false;
}

// Graceful Shutdown Handling (Optional but Recommended)
process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    client.destroy();
    console.log('Discord client destroyed.');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    client.destroy();
    console.log('Discord client destroyed.');
    process.exit(0);
});
