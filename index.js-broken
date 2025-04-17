// index.js (Revamped with Tailwind CSS Theme)
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

// --- MongoDB Setup ---
// Connect to MongoDB (Ensure MONGO_URI is set in your .env file)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Define Schema for Top Tier Slots
const TopTierSlotSchema = new mongoose.Schema({
  slotNumber: Number, // Slot number (1, 2, 3)
  guildId: String,    // Discord Guild ID
  guildName: String,  // Discord Guild Name
});
const TopTierSlot = mongoose.model("TopTierSlot", TopTierSlotSchema);

// Define Schema for Partners
const PartnerSchema = new mongoose.Schema({
  guildId: String,            // Discord Guild ID
  guildName: String,          // Discord Guild Name
  partnerChannelId: String,   // Channel ID for receiving partner bumps
  partnerMessage: String,     // The partner's advertisement message
  pendingMessage: String,     // A message awaiting approval
  pendingMessageUserId: String, // User ID who submitted the pending message
  approved: Boolean,          // Whether the partnership is approved
  lastBump: Date,             // Timestamp of the last successful bump
  messagePending: Boolean,    // Whether a message is pending approval
  inviteLink: String,         // Invite link for the partner's server
  partnerRoleId: String,      // Role ID required to use partner commands in their server
  isTopTier: Boolean,         // Flag if the partner is in a top tier slot (can be derived, consider removing)
});
const Partner = mongoose.model("Partner", PartnerSchema);

// --- Discord Bot Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,       // Required to receive guild information
    GatewayIntentBits.GuildMembers, // Required to fetch member details (like presence, roles)
    GatewayIntentBits.GuildPresences, // Required to get online member counts
  ],
});

// --- Slash Commands Definition ---
const commands = [
  // /help command
  new SlashCommandBuilder().setName("help").setDescription("List all commands and show documentation link"),
  // /register command
  new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register your server for partnering (requires approval)"),
  // /setchannel command
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Set the channel where partner ads will be posted")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Select the partner channel")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) // Allow only text/announcement channels
        .setRequired(true),
    ),
  // /unregister command
  new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Unregister your server from the partner network"),
  // /bump command
  new SlashCommandBuilder()
    .setName("bump")
    .setDescription("Send your approved ad to all partner servers (30 min cooldown)"),
  // /setstatus command (Bot Owner Only)
  new SlashCommandBuilder()
    .setName("setstatus")
    .setDescription("Set the bot's status message (Bot Owner only)")
    .addStringOption((opt) =>
      opt
        .setName("status")
        .setDescription("The status message to display")
        .setRequired(true),
    ),
  // /setrole command (Server Owner Only)
  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("Set the role required to use partner bot commands (Server Owner only)")
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role that can use partner bot commands")
        .setRequired(true),
    ),
  // /settopslot command (Bot Owner Only)
  new SlashCommandBuilder()
    .setName("settopslot")
    .setDescription("Set a server in a top tier slot (Bot Owner only)")
    .addStringOption((option) =>
      option
        .setName("serverid")
        .setDescription("The Discord Server ID to add to the top slot")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("slot")
        .setDescription("The slot number (1-3)")
        .setRequired(true)
        .addChoices( // Provide choices for clarity
          { name: "Slot 1", value: 1 },
          { name: "Slot 2", value: 2 },
          { name: "Slot 3", value: 3 },
        ),
    ),
  // /removetopslot command (Bot Owner Only)
  new SlashCommandBuilder()
    .setName("removetopslot")
    .setDescription("Remove a server from a top tier slot (Bot Owner only)")
    .addIntegerOption((option) =>
      option
        .setName("slot")
        .setDescription("The slot number to clear (1-3)")
        .setRequired(true)
        .addChoices( // Provide choices for clarity
          { name: "Slot 1", value: 1 },
          { name: "Slot 2", value: 2 },
          { name: "Slot 3", value: 3 },
        ),
    ),
  // /invite command
   new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Get the invite link for this bot"),
  // /setinvite command
  new SlashCommandBuilder()
    .setName("setinvite")
    .setDescription("Set or update your server's invite link for the partner list")
    .addStringOption(option =>
        option.setName('invite')
            .setDescription('The full discord.gg invite link')
            .setRequired(true)),
 // /setmessage command (Modal based) - Renamed from original for clarity
  new SlashCommandBuilder()
    .setName("setmessage")
    .setDescription("Set or update your server's advertisement message (requires approval)"),
];

// --- Bot Ready Event ---
client.once("ready", async () => {
  try {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Set initial bot activity status
    await client.user.setActivity("skyvps360.xyz | $4 128GB KVM VPS", { // Example status
      type: ActivityType.Watching,
    });
    console.log(`📊 Bot status set`);

    // Register slash commands globally
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    console.log("⏳ Started refreshing application (/) commands...");
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands.map(command => command.toJSON()), // Ensure commands are converted to JSON
    });

    const guildCount = client.guilds.cache.size;
    console.log(`✅ Successfully registered application commands globally`);
    console.log(`🌐 Bot is active in ${guildCount} servers`);

    // Log details of servers the bot is in (optional, good for debugging)
    client.guilds.cache.forEach((guild) => {
      console.log(
        `📋 Server: ${guild.name} (${guild.id}) - Members: ${guild.memberCount}`,
      );
    });

  } catch (error) {
    console.error("❌ Error during bot startup:", error);
  }
});

// --- Interaction Handler (Unified for Commands, Buttons, Modals) ---
client.on("interactionCreate", async (interaction) => {
  // Ignore interactions from bots or outside guilds
  if (interaction.user.bot || !interaction.guild) return;

  const guildId = interaction.guild.id;
  const guildName = interaction.guild.name;
  const member = interaction.member; // The member who initiated the interaction
  const userId = interaction.user.id;

  // --- Permission Check ---
  // Bot owner bypasses all checks except for specific owner commands
  const isBotOwner = userId === process.env.BOT_OWNER_ID; // Ensure BOT_OWNER_ID is in .env

  // Helper function to check permissions
  async function hasPermission(member, guildId, commandName) {
    // Bot owner has permission for most commands
    if (isBotOwner && !['setstatus', 'settopslot', 'removetopslot'].includes(commandName)) {
        return true;
    }
    // Specific owner commands check
    if (['setstatus', 'settopslot', 'removetopslot'].includes(commandName) && !isBotOwner) {
        return false; // Only owner can use these
    }
     // Server owner check for setrole
    if (commandName === 'setrole' && member.id !== interaction.guild.ownerId) {
        return false; // Only server owner for setrole
    }
    // Server owner always has permission for other commands
    if (member.id === interaction.guild.ownerId) {
        return true;
    }
    // Check for Administrator permission
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return true;
    }
    // Check for configured partner role
    const partner = await Partner.findOne({ guildId });
    if (partner?.partnerRoleId && member.roles.cache.has(partner.partnerRoleId)) {
        return true;
    }
    // Default to no permission if none of the above match
    return false;
  }

  // --- Log Channel ---
  // Get or create the log channel for audit purposes
  const logChannelName = "partner-bot-logs"; // Use a descriptive name
  let logChannel = interaction.guild.channels.cache.find(
    (c) => c.name === logChannelName && c.type === ChannelType.GuildText
  );
  if (!logChannel) {
    try {
      logChannel = await interaction.guild.channels.create({
        name: logChannelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [ // Make channel private by default
          {
            id: interaction.guild.roles.everyone, // @everyone role
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: client.user.id, // Bot's role
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks],
          },
           // Optionally allow admins/specific roles to see logs
          {
            id: interaction.guild.ownerId, // Server Owner
             allow: [PermissionsBitField.Flags.ViewChannel],
          }
        ],
      });
      console.log(`📝 Created log channel #${logChannelName} in ${guildName}`);
    } catch (error) {
      console.error(`❌ Failed to create log channel in ${guildName}:`, error);
      // Proceed without logging if channel creation fails
    }
  }

  // Log the interaction if the log channel exists
  if (logChannel) {
    let logMessage = `🪵 Interaction: `;
    if (interaction.isChatInputCommand()) logMessage += `Command \`/${interaction.commandName}\``;
    else if (interaction.isButton()) logMessage += `Button \`${interaction.customId}\``;
    else if (interaction.isModalSubmit()) logMessage += `Modal \`${interaction.customId}\``;
    else logMessage += `Unknown Interaction Type`;
    logMessage += ` by ${interaction.user.tag} (${userId})`;
    if (interaction.channel) logMessage += ` in #${interaction.channel.name}`;

    logChannel.send(logMessage).catch(console.error); // Log errors sending to log channel
  }


  // --- Slash Command Handling ---
  if (interaction.isChatInputCommand()) {
    const commandName = interaction.commandName;

    // Check permissions (excluding /help and /invite)
    if (!['help', 'invite'].includes(commandName)) {
        const permitted = await hasPermission(member, guildId, commandName);
        if (!permitted) {
            let reason = "You lack the required permissions (Administrator or Partner Role).";
            if (commandName === 'setrole') reason = "Only the Server Owner can use this command.";
            if (['setstatus', 'settopslot', 'removetopslot'].includes(commandName)) reason = "Only the Bot Owner can use this command.";

            return interaction.reply({
                content: `🚫 Access Denied: ${reason}`,
                ephemeral: true,
            });
        }
    }


    // --- Command Logic ---

    if (commandName === "help") {
      const helpEmbed = new EmbedBuilder()
        .setColor("#5865F2") // Discord blurple
        .setTitle("📘 Partner Bot Help & Documentation")
        .setDescription(`View available commands below. For detailed setup and usage, visit the [Documentation Website](${getWebsiteUrl()}/docs).`)
        .addFields(
          { name: "🤝 Partnership", value: "`/register` - Start the partnership process.\n`/unregister` - Leave the partner network.\n`/setmessage` - Set/Update your server ad.\n`/setchannel` - Choose where ads appear.\n`/setinvite` - Set/Update your server invite link.\n`/bump` - Send your ad (30 min cooldown)." , inline: false},
          { name: "🛠️ Configuration (Permissions Required)", value: "`/setrole` - Set the partner role (Server Owner).\n", inline: false },
          { name: "🤖 Bot", value: "`/help` - Show this help message.\n`/invite` - Get the bot's invite link.", inline: false},
          { name: "👑 Owner Only", value: "`/setstatus` - Change bot's status.\n`/settopslot` - Assign a premium slot.\n`/removetopslot` - Remove from premium slot.", inline: false}
        )
        .setFooter({ text: "SkyVPS360 Partner Network", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
      return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }

    if (commandName === "register") {
      const existing = await Partner.findOne({ guildId });
      if (existing) {
        return interaction.reply({
          content: `⚠️ This server is already registered${existing.approved ? ' and approved' : ' and awaiting approval'}. Use other commands to manage your partnership.`,
          ephemeral: true,
        });
      }

      // Check if server has an icon (important for display)
      if (!interaction.guild.iconURL()) {
          return interaction.reply({
              content: "❌ Registration Failed: Your server must have a server icon set in Discord's Server Settings before registering.",
              ephemeral: true,
          });
      }


      await Partner.create({
        guildId,
        guildName,
        approved: false,
        messagePending: false, // Message isn't pending initially
        lastBump: null, // No bumps yet
      });

      // Send notification to Admin Server for approval
      try {
        const adminGuild = await client.guilds.fetch(process.env.ADMIN_SERVER_ID);
        const adminChannel = await adminGuild.channels.fetch(process.env.ADMIN_CHANNEL_ID);

        if (!adminChannel || adminChannel.type !== ChannelType.GuildText) {
           throw new Error("Admin channel not found or not a text channel.");
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_server_${guildId}`) // Clearer ID
            .setLabel("✅ Approve Server")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`decline_server_${guildId}`) // Clearer ID
            .setLabel("❌ Decline Server")
            .setStyle(ButtonStyle.Danger),
        );

        const embed = new EmbedBuilder()
            .setColor("#FFA500") // Orange for pending
            .setTitle("📥 New Server Registration")
            .setDescription(`**Server:** ${guildName} (${guildId})\n**Requested By:** ${interaction.user.tag} (${userId})`)
            .setThumbnail(interaction.guild.iconURL()) // Show server icon
            .setTimestamp();

        await adminChannel.send({
          embeds: [embed],
          components: [row],
        });

        return interaction.reply({
            content: "✅ Registration request submitted! Please wait for an admin to review your server. You'll be notified upon approval.",
            ephemeral: true // Keep confirmation private
        });

      } catch (error) {
        console.error("❌ Error sending registration to admin server:", error);
        // Attempt to clean up the partial registration if admin notification fails
        await Partner.deleteOne({ guildId });
        return interaction.reply({
          content: "❌ An error occurred while submitting your registration. Please try again later or contact support.",
          ephemeral: true,
        });
      }
    }

    if (commandName === "setchannel") {
        const channel = interaction.options.getChannel("channel");
        // Validation already done by Discord for channel type

        // Check if bot has permissions in the selected channel
        const botMember = await interaction.guild.members.fetch(client.user.id);
        const perms = channel.permissionsFor(botMember);
        if (!perms.has(PermissionsBitField.Flags.ViewChannel) || !perms.has(PermissionsBitField.Flags.SendMessages) || !perms.has(PermissionsBitField.Flags.EmbedLinks)) {
            return interaction.reply({
                content: `❌ I don't have the necessary permissions (View Channel, Send Messages, Embed Links) in <#${channel.id}>. Please adjust my permissions for that channel.`,
                ephemeral: true,
            });
        }


        await Partner.findOneAndUpdate(
            { guildId },
            { partnerChannelId: channel.id },
            { upsert: true, new: true } // Create if not exists, return updated doc
        );
        return interaction.reply({
            content: `✅ Partner advertisement channel set to <#${channel.id}>.`,
            ephemeral: true
        });
    }

    if (commandName === "unregister") {
        const deleted = await Partner.findOneAndDelete({ guildId });
        if (deleted) {
            // Also remove from top tier if present
            await TopTierSlot.deleteMany({ guildId });
            return interaction.reply({
                content: "🗑️ Your server has been successfully unregistered from the partner network.",
                ephemeral: true
            });
        } else {
            return interaction.reply({
                content: "⚠️ Your server was not found in the registration list.",
                ephemeral: true
            });
        }
    }

     if (commandName === "bump") {
        const partner = await Partner.findOne({ guildId });

        // Pre-bump checks
        if (!partner) {
            return interaction.reply({ content: "❌ You need to `/register` your server first.", ephemeral: true });
        }
        if (!partner.approved) {
            return interaction.reply({ content: "❌ Your server registration is still pending approval.", ephemeral: true });
        }
        if (!partner.partnerMessage) {
            return interaction.reply({ content: "❌ You need to set your advertisement message using `/setmessage`.", ephemeral: true });
        }
        if (!partner.partnerChannelId) {
            return interaction.reply({ content: "❌ You need to set your partner channel using `/setchannel`.", ephemeral: true });
        }

        // Cooldown check (30 minutes)
        const cooldown = 30 * 60 * 1000;
        if (partner.lastBump && (Date.now() - partner.lastBump.getTime()) < cooldown) {
            const remaining = cooldown - (Date.now() - partner.lastBump.getTime());
            const remainingMinutes = Math.ceil(remaining / 60000); // Round up to nearest minute
             return interaction.reply({
                content: `⏳ Please wait ${remainingMinutes} more minute(s) before bumping again.`,
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true }); // Acknowledge interaction, prevents timeout

        // Fetch all other approved partners with valid channels
        const allPartners = await Partner.find({
            guildId: { $ne: guildId }, // Exclude self
            approved: true,
            partnerChannelId: { $exists: true, $ne: null }, // Ensure channel is set
        });

        let successCount = 0;
        let failCount = 0;
        const bumpEmbed = new EmbedBuilder()
            .setColor('#5865F2') // Consistent branding
            .setTitle(`📢 Partner Ad: ${guildName}`) // Use sender's guild name
            .setDescription(partner.partnerMessage)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true })) // Use sender's server icon
            .setTimestamp()
            .setFooter({ text: 'SkyVPS360 Partner Network' });

        if (partner.inviteLink) {
            bumpEmbed.setURL(partner.inviteLink); // Make title clickable if invite exists
             bumpEmbed.addFields({ name: 'Join Server', value: `[Click Here](${partner.inviteLink})`, inline: true });
        }


        // Send bump to each partner
        for (const targetPartner of allPartners) {
            try {
                // Fetch channel only when needed
                const targetGuild = await client.guilds.fetch(targetPartner.guildId).catch(() => null);
                 if (!targetGuild) {
                    console.log(`⚠️ Could not fetch guild ${targetPartner.guildId} for bumping.`);
                    failCount++;
                    continue; // Skip if guild fetch fails
                }
                const channel = await targetGuild.channels.fetch(targetPartner.partnerChannelId).catch(() => null);

                if (channel && channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
                     // Check bot permissions in target channel before sending
                    const botMember = await targetGuild.members.fetch(client.user.id);
                    const perms = channel.permissionsFor(botMember);
                    if (perms.has(PermissionsBitField.Flags.SendMessages) && perms.has(PermissionsBitField.Flags.EmbedLinks)) {
                        await channel.send({ embeds: [bumpEmbed] });
                        successCount++;
                    } else {
                        console.log(`🚫 Missing permissions in channel ${channel.id} of guild ${targetGuild.id}`);
                        failCount++;
                    }
                } else {
                     console.log(`⚠️ Invalid channel ${targetPartner.partnerChannelId} for guild ${targetPartner.guildId}`);
                    failCount++;
                }
            } catch (err) {
                console.error(`❌ Failed to bump to ${targetPartner.guildName} (${targetPartner.guildId}):`, err.message);
                failCount++;
                // Consider removing partner if consistently failing? (More advanced logic)
            }
        }

        // Update last bump time for the user
        await Partner.findOneAndUpdate({ guildId }, { lastBump: new Date() });

        await interaction.editReply(`✅ Bump sent successfully to ${successCount} partner server(s).` + (failCount > 0 ? ` (${failCount} failed)` : ''));
    }

    if (commandName === "setstatus") {
      // Permission already checked
      const status = interaction.options.getString("status");
      try {
        await client.user.setActivity(status, { type: ActivityType.Watching });
        return interaction.reply({ content: `✅ Bot status updated to: **Watching ${status}**`, ephemeral: true });
      } catch (error) {
        console.error("Error setting bot status:", error);
        return interaction.reply({ content: "❌ Failed to update bot status.", ephemeral: true });
      }
    }

    if (commandName === "setrole") {
      // Permission already checked (Server Owner)
      const role = interaction.options.getRole("role");
      await Partner.findOneAndUpdate(
        { guildId },
        { partnerRoleId: role.id },
        { upsert: true }
      );
      return interaction.reply({
        content: `✅ Partner command role set to **@${role.name}**. Members with this role (or Admins) can now use partner commands.`,
        ephemeral: true,
      });
    }

    if (commandName === "settopslot") {
        // Permission already checked (Bot Owner)
        const targetServerId = interaction.options.getString("serverid");
        const slotNumber = interaction.options.getInteger("slot");

        try {
            // Validate server exists and is an approved partner
            const targetGuild = await client.guilds.fetch(targetServerId).catch(() => null);
            if (!targetGuild) {
                return interaction.reply({ content: "❌ Could not find the specified server ID.", ephemeral: true });
            }
            const partner = await Partner.findOne({ guildId: targetServerId, approved: true });
            if (!partner) {
                return interaction.reply({ content: `❌ Server "${targetGuild.name}" must be an approved partner first.`, ephemeral: true });
            }

             // Check if slot is already taken by someone else
            const existingSlot = await TopTierSlot.findOne({ slotNumber });
            if (existingSlot && existingSlot.guildId !== targetServerId) {
                return interaction.reply({ content: `⚠️ Slot ${slotNumber} is already occupied by "${existingSlot.guildName}". Use /removetopslot first if you want to replace it.`, ephemeral: true });
            }
             // Check if this server already occupies another slot
            const serverInOtherSlot = await TopTierSlot.findOne({ guildId: targetServerId, slotNumber: { $ne: slotNumber } });
            if (serverInOtherSlot) {
                return interaction.reply({ content: `⚠️ Server "${targetGuild.name}" is already in slot ${serverInOtherSlot.slotNumber}. Remove it first if you want to move it.`, ephemeral: true });
            }


            // Assign the slot
            await TopTierSlot.findOneAndUpdate(
                { slotNumber }, // Find by slot number
                { guildId: targetServerId, guildName: targetGuild.name }, // Set the new data
                { upsert: true } // Create if doesn't exist, update if it does
            );
             // Update partner schema (optional, maybe redundant)
            await Partner.updateOne({ guildId: targetServerId }, { isTopTier: true });


            return interaction.reply({
                content: `✅ Server "${targetGuild.name}" has been assigned to top tier slot ${slotNumber}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error("Error setting top tier slot:", error);
            return interaction.reply({ content: "❌ An error occurred while setting the top tier slot.", ephemeral: true });
        }
    }

    if (commandName === "removetopslot") {
        // Permission already checked (Bot Owner)
        const slotNumber = interaction.options.getInteger("slot");

        try {
            const removedSlot = await TopTierSlot.findOneAndDelete({ slotNumber });
            if (!removedSlot) {
                return interaction.reply({ content: `❌ Slot ${slotNumber} was already empty.`, ephemeral: true });
            }

            // Update partner schema (optional)
            await Partner.updateOne({ guildId: removedSlot.guildId }, { isTopTier: false });


            return interaction.reply({
                content: `✅ Removed server "${removedSlot.guildName}" from top tier slot ${slotNumber}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error("Error removing top tier slot:", error);
            return interaction.reply({ content: "❌ An error occurred while removing the top tier slot.", ephemeral: true });
        }
    }

    if (commandName === "invite") {
        const inviteUrl = getBotInviteUrl();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Invite Me!")
                .setStyle(ButtonStyle.Link)
                .setURL(inviteUrl)
        );
         return interaction.reply({
            content: "Click the button below to invite me to your server!",
            components: [row],
            ephemeral: true
        });
    }

    if (commandName === "setinvite") {
        const inviteInput = interaction.options.getString("invite");
        // Basic validation for discord.gg links
        const inviteRegex = /^https:\/\/discord\.gg\/[a-zA-Z0-9]+$/;
        if (!inviteRegex.test(inviteInput)) {
             return interaction.reply({
                content: "❌ Please provide a valid and complete Discord invite link (e.g., `https://discord.gg/yourcode`). Vanity URLs might require manual checking.",
                ephemeral: true
            });
        }

        // You might want to add more robust validation here, e.g., trying to fetch invite info
        // const invite = await client.fetchInvite(inviteInput).catch(() => null);
        // if (!invite) { return interaction.reply({ content: "❌ The provided invite link seems invalid or expired.", ephemeral: true }); }

        await Partner.findOneAndUpdate(
            { guildId },
            { inviteLink: inviteInput },
            { upsert: true }
        );
        return interaction.reply({
            content: `✅ Your server's invite link has been set to: ${inviteInput}`,
            ephemeral: true
        });
    }

    if (commandName === "setmessage") {
        const partner = await Partner.findOne({ guildId });
         if (!partner || !partner.approved) {
            return interaction.reply({ content: "❌ Your server must be registered and approved before setting a message.", ephemeral: true });
        }

        // Create and show the modal
        const modal = new ModalBuilder()
            .setCustomId(`set_message_modal_${guildId}`) // Unique ID including guildId
            .setTitle(`Set Ad Message for ${guildName}`);

        const messageInput = new TextInputBuilder()
            .setCustomId("partner_message_input")
            .setLabel("Your Advertisement Message")
            .setStyle(TextInputStyle.Paragraph) // Allow multi-line input
            .setPlaceholder("Enter your server's ad message here. Keep it concise and appealing! Max 1000 chars.")
            .setValue(partner.partnerMessage || '') // Pre-fill with existing message if available
            .setRequired(true)
            .setMinLength(20) // Encourage meaningful messages
            .setMaxLength(1000); // Discord embed description limit is higher, but keep reasonable

        const actionRow = new ActionRowBuilder().addComponents(messageInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    }


  } // --- End Slash Command Handling ---


  // --- Button Interaction Handling ---
  else if (interaction.isButton()) {
    // Ensure button interactions are only handled by the bot owner in the admin server
    if (interaction.guildId !== process.env.ADMIN_SERVER_ID || !isBotOwner) {
        return interaction.reply({ content: "🚫 You are not authorized to use these buttons.", ephemeral: true });
    }

    const [action, type, targetId] = interaction.customId.split("_"); // e.g., "approve_server_12345" or "decline_msg_12345"

    if (!action || !type || !targetId) {
        console.error("Invalid button ID format:", interaction.customId);
        return interaction.reply({ content: "❌ Invalid button action.", ephemeral: true });
    }

    try {
        const partner = await Partner.findOne({ guildId: targetId });
        if (!partner) {
            return interaction.update({ content: `⚠️ Partner data for ID ${targetId} not found (maybe unregistered?).`, components: [] });
        }

        // --- Server Approval/Decline ---
        if (type === "server") {
            const targetGuild = await client.guilds.fetch(targetId).catch(() => null); // Fetch target guild info

            if (action === "approve") {
                await Partner.updateOne({ guildId: targetId }, { approved: true });

                // Create the setup modal button to send to the user
                 const setupButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`request_setup_modal_${targetId}`) // User clicks this in DMs/channel
                        .setLabel("🚀 Setup Your Ad")
                        .setStyle(ButtonStyle.Primary)
                );

                const approvalMessage = `✅ Your server **${partner.guildName}** has been approved for partnering! Click the button below to set up your advertisement message, invite link, and partner channel.`;

                // Try to DM the user who registered (if stored) or the server owner
                let notified = false;
                const owner = targetGuild ? await targetGuild.members.fetch(targetGuild.ownerId).catch(() => null) : null;
                // Add logic here if you store the registering user's ID
                // const registeringUser = await client.users.fetch(partner.registeredByUserId).catch(() => null);

                if (owner) {
                    try {
                        await owner.send({ content: approvalMessage, components: [setupButton] });
                        notified = true;
                        console.log(`📬 Sent approval DM to owner of ${partner.guildName}`);
                    } catch (dmError) {
                        console.log(`⚠️ Could not DM owner of ${partner.guildName}: ${dmError.message}`);
                    }
                }

                // Fallback: Send to a default/log channel in their server if DM fails
                if (!notified && targetGuild) {
                    // Find a suitable channel (e.g., system channel, general, or the partner log channel)
                    let fallbackChannel = targetGuild.systemChannel ||
                                          targetGuild.channels.cache.find(c => c.name === 'general' && c.type === ChannelType.GuildText) ||
                                          targetGuild.channels.cache.find(c => c.name === logChannelName && c.type === ChannelType.GuildText);

                    if (fallbackChannel) {
                        try {
                            await fallbackChannel.send({ content: `${owner ? owner.toString() + ', ' : ''}${approvalMessage}`, components: [setupButton] });
                            notified = true;
                             console.log(`📬 Sent approval message to #${fallbackChannel.name} in ${partner.guildName}`);
                        } catch (channelError) {
                            console.log(`⚠️ Could not send approval to fallback channel in ${partner.guildName}: ${channelError.message}`);
                        }
                    }
                }

                // Update the admin message
                await interaction.update({
                     content: `✅ Server "${partner.guildName}" approved by ${interaction.user.tag}. ${notified ? 'Notification sent.' : 'Could not notify user/server.'}`,
                     components: [] // Remove buttons
                });

            } else if (action === "decline") {
                await Partner.deleteOne({ guildId: targetId }); // Remove from DB
                 await TopTierSlot.deleteMany({ guildId: targetId }); // Also remove from top tier

                 const declineReason = "Your server registration for the partner network was declined."; // Generic reason

                 // Notify user/owner (similar logic as approval)
                 let notified = false;
                 const owner = targetGuild ? await targetGuild.members.fetch(targetGuild.ownerId).catch(() => null) : null;
                 if (owner) {
                     try {
                         await owner.send(`❌ ${declineReason} The bot will now leave your server.`);
                         notified = true;
                     } catch (dmError) { /* Ignore DM errors */ }
                 }
                 // Optionally send to a channel before leaving

                // Update admin message
                 await interaction.update({ content: `❌ Server "${partner.guildName}" declined by ${interaction.user.tag}.`, components: [] });

                 // Leave the server after declining
                 if (targetGuild) {
                    await targetGuild.leave();
                    console.log(`👢 Left server ${partner.guildName} (${targetId}) after decline.`);
                 }
            }
        }

        // --- Message Approval/Decline ---
        else if (type === "msg") {
             if (!partner.pendingMessage) {
                 return interaction.update({ content: `⚠️ No pending message found for "${partner.guildName}". It might have been already handled.`, components: [] });
            }

            const originalMessageContent = interaction.message.content; // Get original admin message content

            if (action === "approve") {
                await Partner.updateOne(
                    { guildId: targetId },
                    {
                        partnerMessage: partner.pendingMessage, // Approve the pending message
                        messagePending: false,
                        $unset: { pendingMessage: "", pendingMessageUserId: "" } // Clear pending fields
                    }
                );

                // Notify the user who submitted
                if (partner.pendingMessageUserId) {
                    const user = await client.users.fetch(partner.pendingMessageUserId).catch(() => null);
                    if (user) {
                        user.send(`✅ Your submitted ad message for **${partner.guildName}** has been approved!`).catch(console.error);
                    }
                }

                await interaction.update({
                    content: `${originalMessageContent}\n---\n✅ Message approved by ${interaction.user.tag}`,
                    components: []
                });

            } else if (action === "decline") {
                 await Partner.updateOne(
                    { guildId: targetId },
                    {
                        messagePending: false,
                        $unset: { pendingMessage: "", pendingMessageUserId: "" } // Clear pending fields only
                    }
                );

                 // Notify the user who submitted
                if (partner.pendingMessageUserId) {
                    const user = await client.users.fetch(partner.pendingMessageUserId).catch(() => null);
                    if (user) {
                        user.send(`❌ Your submitted ad message for **${partner.guildName}** was declined. Please review the rules and submit a new one using \`/setmessage\`.`).catch(console.error);
                    }
                }

                 await interaction.update({
                    content: `${originalMessageContent}\n---\n❌ Message declined by ${interaction.user.tag}`,
                    components: []
                });
            }
        }

    } catch (error) {
        console.error("Error handling button interaction:", error);
        // Use update if possible, otherwise reply
        if (!interaction.replied && !interaction.deferred) {
             await interaction.reply({ content: "❌ An error occurred processing this button.", ephemeral: true }).catch(console.error);
        } else {
            await interaction.followUp({ content: "❌ An error occurred processing this button.", ephemeral: true }).catch(console.error);
        }
    }

  } // --- End Button Handling ---

  // --- Modal Interaction Handling ---
  else if (interaction.isModalSubmit()) {

    // --- Set Message Modal ---
    if (interaction.customId.startsWith("set_message_modal_")) {
        const targetGuildId = interaction.customId.replace("set_message_modal_", "");
        const messageContent = interaction.fields.getTextInputValue("partner_message_input");

        const partner = await Partner.findOne({ guildId: targetGuildId });
        if (!partner || !partner.approved) {
            return interaction.reply({ content: "❌ Cannot set message: Server not registered or not approved.", ephemeral: true });
        }

        // Send message to admin channel for approval
        try {
            const adminGuild = await client.guilds.fetch(process.env.ADMIN_SERVER_ID);
            const adminChannel = await adminGuild.channels.fetch(process.env.ADMIN_CHANNEL_ID);
             if (!adminChannel || adminChannel.type !== ChannelType.GuildText) {
                throw new Error("Admin channel not found or invalid.");
            }

            // Store pending message in DB
             await Partner.updateOne(
                { guildId: targetGuildId },
                {
                    pendingMessage: messageContent,
                    pendingMessageUserId: interaction.user.id, // Store who submitted
                    messagePending: true
                }
            );


            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_msg_${targetGuildId}`) // Note the ID structure
                    .setLabel("✅ Approve Message")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`decline_msg_${targetGuildId}`)
                    .setLabel("❌ Decline Message")
                    .setStyle(ButtonStyle.Danger),
            );

             const embed = new EmbedBuilder()
                .setColor("#FFFF00") // Yellow for pending message
                .setTitle(`📝 Ad Message Submission/Update`)
                .setDescription(`**Server:** ${partner.guildName} (${targetGuildId})\n**Submitted By:** ${interaction.user.tag} (${interaction.user.id})\n\n**Message:**\n\`\`\`\n${messageContent}\n\`\`\``)
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();


            await adminChannel.send({
                content: `New message submission from **${partner.guildName}**. Please review and approve/decline.`,
                embeds: [embed],
                components: [row]
            });

            return interaction.reply({
                content: "✅ Your advertisement message has been submitted for approval. You will be notified once it's reviewed.",
                ephemeral: true,
            });

        } catch (error) {
            console.error("Error submitting message for approval:", error);
             // Clear pending state if admin notification failed
             await Partner.updateOne({ guildId: targetGuildId }, { messagePending: false, $unset: { pendingMessage: "", pendingMessageUserId: "" }});
            return interaction.reply({
                content: "❌ An error occurred while submitting your message for approval. Please try again later.",
                ephemeral: true,
            });
        }
    }

     // --- Initial Setup Modal (after server approval) ---
    if (interaction.customId.startsWith("partner_setup_modal_")) {
        const targetGuildId = interaction.customId.replace("partner_setup_modal_", "");
        const message = interaction.fields.getTextInputValue("setup_message");
        const inviteLink = interaction.fields.getTextInputValue("setup_invite");
        const channelId = interaction.fields.getTextInputValue("setup_channel");

        const partner = await Partner.findOne({ guildId: targetGuildId });
         if (!partner || !partner.approved) {
            return interaction.reply({ content: "❌ Cannot complete setup: Server not approved.", ephemeral: true });
        }

        try {
            // --- Validation ---
            const guild = await client.guilds.fetch(targetGuildId); // Ensure guild exists

            // Validate Channel
            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
                return interaction.reply({ content: `❌ Invalid Channel ID: Please provide a valid ID for a text or announcement channel in your server.`, ephemeral: true });
            }
             // Check bot permissions in the selected channel
            const botMember = await guild.members.fetch(client.user.id);
            const perms = channel.permissionsFor(botMember);
            if (!perms.has(PermissionsBitField.Flags.ViewChannel) || !perms.has(PermissionsBitField.Flags.SendMessages) || !perms.has(PermissionsBitField.Flags.EmbedLinks)) {
                return interaction.reply({ content: `❌ Bot Permissions Missing: I need 'View Channel', 'Send Messages', and 'Embed Links' permissions in <#${channel.id}>.`, ephemeral: true });
            }


            // Validate Invite Link
            const inviteRegex = /^https:\/\/discord\.gg\/[a-zA-Z0-9]+$/;
             if (!inviteRegex.test(inviteLink)) {
                 return interaction.reply({ content: "❌ Invalid Invite Link: Please provide a full `https://discord.gg/yourcode` link.", ephemeral: true });
            }
            // Optional: Deeper invite validation
            // const inviteInfo = await client.fetchInvite(inviteLink).catch(() => null);
            // if (!inviteInfo || inviteInfo.guild?.id !== targetGuildId) {
            //     return interaction.reply({ content: "❌ Invite Link Error: The invite link is invalid, expired, or doesn't belong to this server.", ephemeral: true });
            // }

            // --- Submit Message for Approval (same flow as /setmessage) ---
             const adminGuild = await client.guilds.fetch(process.env.ADMIN_SERVER_ID);
             const adminChannel = await adminGuild.channels.fetch(process.env.ADMIN_CHANNEL_ID);
             if (!adminChannel || adminChannel.type !== ChannelType.GuildText) {
                 throw new Error("Admin channel not found or invalid.");
             }

             const row = new ActionRowBuilder().addComponents(
                 new ButtonBuilder().setCustomId(`approve_msg_${targetGuildId}`).setLabel("✅ Approve Message").setStyle(ButtonStyle.Success),
                 new ButtonBuilder().setCustomId(`decline_msg_${targetGuildId}`).setLabel("❌ Decline Message").setStyle(ButtonStyle.Danger)
             );
             const embed = new EmbedBuilder()
                .setColor("#FFFF00")
                .setTitle(`📝 Ad Message Submission (Initial Setup)`)
                .setDescription(`**Server:** ${partner.guildName} (${targetGuildId})\n**Submitted By:** ${interaction.user.tag} (${interaction.user.id})\n\n**Message:**\n\`\`\`\n${message}\n\`\`\``)
                .setThumbnail(guild.iconURL())
                .setTimestamp();

             await adminChannel.send({
                 content: `Initial setup message submission from **${partner.guildName}**. Please review.`,
                 embeds: [embed],
                 components: [row]
             });


            // Update partner data (Channel and Invite are set directly, message is pending)
            await Partner.updateOne(
                { guildId: targetGuildId },
                {
                    partnerChannelId: channelId,
                    inviteLink: inviteLink,
                    pendingMessage: message, // Set as pending
                    pendingMessageUserId: interaction.user.id,
                    messagePending: true
                }
            );

            return interaction.reply({
                content: "✅ Setup information received! Your **Channel** and **Invite Link** are saved. Your **Ad Message** has been submitted for approval. You'll be notified when it's reviewed.",
                ephemeral: true,
            });

        } catch (error) {
            console.error("Error processing setup modal:", error);
            return interaction.reply({
                content: "❌ An error occurred during setup. Please ensure the Channel ID and Invite Link are correct and try again, or contact support.",
                ephemeral: true,
            });
        }
    }

     // --- Add other modal handlers here if needed ---

  } // --- End Modal Handling ---


  // --- Button Handler (for User-clicked Setup Button) ---
  // This handles the button click from the user's DM/channel after server approval
  else if (interaction.isButton() && interaction.customId.startsWith("request_setup_modal_")) {
        const targetGuildId = interaction.customId.replace("request_setup_modal_", "");

        // Basic check: is the user who clicked the button the owner of the target guild?
        // More robust check might involve checking if they are an admin or have the partner role.
        const targetGuild = await client.guilds.fetch(targetGuildId).catch(() => null);
        if (!targetGuild || interaction.user.id !== targetGuild.ownerId) {
             // Maybe allow Admins too?
             // const member = await targetGuild.members.fetch(interaction.user.id).catch(() => null);
             // if (!member || !member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "🚫 Only the server owner can initiate this setup.", ephemeral: true });
             // }
        }


        const partner = await Partner.findOne({ guildId: targetGuildId });
        if (!partner || !partner.approved) {
             return interaction.reply({ content: "❌ Cannot start setup: Server is not approved.", ephemeral: true });
        }


        // Create and show the actual setup modal
        const modal = new ModalBuilder()
            .setCustomId(`partner_setup_modal_${targetGuildId}`) // This ID is handled by the modal submit listener
            .setTitle(`Partner Setup: ${targetGuild.name}`);

        const messageInput = new TextInputBuilder()
            .setCustomId("setup_message") // Corresponds to modal submit handler
            .setLabel("Your Server Advertisement Message")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Enter your ad message (max 1000 chars). This will require approval.")
            .setValue(partner.partnerMessage || partner.pendingMessage || '') // Pre-fill if available
            .setRequired(true)
            .setMinLength(20)
            .setMaxLength(1000);

        const inviteInput = new TextInputBuilder()
            .setCustomId("setup_invite")
            .setLabel("Server Invite Link (Permanent)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("https://discord.gg/yourcode")
            .setValue(partner.inviteLink || '')
            .setRequired(true);

        const channelInput = new TextInputBuilder()
            .setCustomId("setup_channel")
            .setLabel("Partner Channel ID")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Enter the ID of the channel for partner ads")
            .setValue(partner.partnerChannelId || '')
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
            await interaction.reply({ content: "❌ Failed to open the setup form.", ephemeral: true });
        }
    } // --- End User Setup Button Handling ---


}); // --- End Interaction Handler ---


// --- Express Web Server Setup ---
const app = express();
const PORT = process.env.PORT || 3000;

// Helper function to get the base URL for links
function getWebsiteUrl() {
    // Use environment variable if set (for production), otherwise default for local dev
    return process.env.SITE_URL || `http://localhost:${PORT}`;
}

// --- Route: Home Page (/) ---
app.get("/", async (req, res) => {
  try {
    // Fetch data concurrently
    const [topTierSlots, allPartners] = await Promise.all([
      TopTierSlot.find({}).sort({ slotNumber: 1 }).lean(), // Use .lean() for performance if not modifying
      Partner.find({
        approved: true,
        partnerMessage: { $exists: true, $ne: null }, // Ensure they have a message set
        partnerChannelId: { $exists: true, $ne: null }, // Ensure channel is set
      }).lean() // Use .lean()
    ]);

    // Prepare data for rendering
    const partnerMap = new Map(allPartners.map(p => [p.guildId, p])); // Map for easy lookup

    // --- Generate Top Tier Cards ---
    const slotsToDisplay = Array.from({ length: 3 }, (_, i) => {
      const slotData = topTierSlots.find(s => s.slotNumber === i + 1);
      return slotData || { slotNumber: i + 1, isEmpty: true }; // Mark empty slots
    });

    const topTierCardsHtml = await Promise.all(
      slotsToDisplay.map(async (slot) => {
        if (slot.isEmpty) {
          // HTML for an empty slot
          return `
            <div class="bg-gray-700/50 border border-indigo-500/30 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-lg transform transition hover:scale-105 min-h-[300px]">
              <div class="text-indigo-400 text-5xl mb-4">✨</div>
              <h3 class="text-xl font-semibold text-indigo-300 mb-2">Premium Slot ${slot.slotNumber}</h3>
              <p class="text-gray-400 text-sm mb-4">This premium advertising slot is available!</p>
              <a href="${getBotInviteUrl()}" class="mt-auto inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-5 rounded-lg transition duration-200 text-sm">
                Claim Your Spot!
              </a>
            </div>`;
        }

        // Fetch guild details for filled slots
        try {
          const guild = await client.guilds.fetch(slot.guildId);
           // Fetch members to get accurate counts (might be slow for large guilds)
           // Consider caching or periodic updates for member counts if performance is an issue
          await guild.members.fetch();
          const iconURL = guild.iconURL({ dynamic: true, size: 128 }) || 'https://cdn.discordapp.com/embed/avatars/0.png'; // Default icon
          const memberCount = guild.memberCount;
          // Filter presences for online count (requires GuildPresences intent)
          const onlineMembers = guild.presences.cache.filter(p => p.status === 'online' || p.status === 'dnd' || p.status === 'idle').size;
          const partner = partnerMap.get(slot.guildId); // Get partner data from map

          // HTML for a filled top tier slot
          return `
            <div class="relative bg-gray-800/60 border border-indigo-500 rounded-xl p-6 flex flex-col items-center text-center shadow-xl transform transition hover:scale-105 min-h-[300px]">
              <span class="absolute top-3 right-3 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">⭐ Premium</span>
              <img src="${iconURL}" alt="${guild.name} Icon" class="w-24 h-24 rounded-full mb-4 border-4 border-gray-700 shadow-md" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'; this.onerror=null;">
              <h3 class="text-xl font-bold text-white mb-2">${guild.name}</h3>
              <p class="text-gray-300 text-sm mb-4 flex-grow overflow-hidden max-h-24">${partner?.partnerMessage || "No ad message set."}</p>
              <div class="flex space-x-4 text-xs text-gray-400 mb-4">
                <span>👥 ${memberCount} Members</span>
                <span>🟢 ${onlineMembers} Online</span>
              </div>
              ${partner?.inviteLink ? `<a href="${partner.inviteLink}" target="_blank" rel="noopener noreferrer" class="mt-auto inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-5 rounded-lg transition duration-200 text-sm">Join Server</a>` : '<span class="mt-auto text-gray-500 text-sm italic">No Invite Set</span>'}
            </div>`;
        } catch (error) {
          console.error(`Error fetching details for top tier guild ${slot.guildId}:`, error.message);
          // Fallback HTML for error fetching guild details
          return `
            <div class="bg-gray-700/50 border border-red-500/30 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-lg min-h-[300px]">
              <div class="text-red-400 text-5xl mb-4">⚠️</div>
              <h3 class="text-xl font-semibold text-red-300 mb-2">Premium Slot ${slot.slotNumber}</h3>
              <p class="text-gray-400 text-sm mb-4">Error loading details for server: ${slot.guildName || slot.guildId}</p>
               <p class="text-gray-500 text-xs">(${error.message})</p>
            </div>`;
        }
      })
    );


    // --- Generate Regular Partner Cards ---
    // Filter out top tier partners and the priority server (if applicable)
    const priorityServerId = process.env.PRIORITY_SERVER_ID; // Your main server ID from .env
    const topTierIds = new Set(topTierSlots.map(s => s.guildId));

    const regularPartners = allPartners.filter(p =>
        !topTierIds.has(p.guildId) && p.guildId !== priorityServerId
    );

    const regularCardsHtml = await Promise.all(
      regularPartners.map(async (p) => {
        try {
          const guild = await client.guilds.fetch(p.guildId);
          await guild.members.fetch(); // Fetch members for counts
          const iconURL = guild.iconURL({ dynamic: true, size: 128 }) || 'https://cdn.discordapp.com/embed/avatars/1.png'; // Different default
          const memberCount = guild.memberCount;
          const onlineMembers = guild.presences.cache.filter(presence => presence.status === 'online' || presence.status === 'dnd' || presence.status === 'idle').size;
          // const botCount = guild.members.cache.filter(m => m.user.bot).size; // Bot count can be intensive

          // HTML for a regular partner card
          return `
            <div class="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-lg p-5 flex flex-col items-center text-center shadow-md hover:shadow-lg transition duration-300 transform hover:-translate-y-1 min-h-[280px]">
              <img src="${iconURL}" alt="${guild.name} Icon" class="w-20 h-20 rounded-full mb-3 border-2 border-gray-600" onerror="this.src='https://cdn.discordapp.com/embed/avatars/1.png'; this.onerror=null;">
              <h4 class="text-lg font-semibold text-white mb-1">${guild.name}</h4>
              <p class="text-gray-400 text-xs mb-3 flex-grow overflow-hidden max-h-20">${p.partnerMessage}</p>
              <div class="flex space-x-3 text-xs text-gray-500 mb-3">
                <span>👥 ${memberCount}</span>
                <span>🟢 ${onlineMembers}</span>
                </div>
              ${p.inviteLink ? `<a href="${p.inviteLink}" target="_blank" rel="noopener noreferrer" class="mt-auto inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded-md transition duration-200 text-xs">Join</a>` : '<span class="mt-auto text-gray-600 text-xs italic">No Invite</span>'}
            </div>`;
        } catch (error) {
          console.error(`Error fetching details for regular partner ${p.guildId}:`, error.message);
          // Fallback HTML for error
          return `
            <div class="bg-gray-700/50 border border-red-500/30 rounded-lg p-5 flex flex-col items-center text-center shadow-md min-h-[280px]">
             <img src="https://cdn.discordapp.com/embed/avatars/1.png" alt="Default Icon" class="w-20 h-20 rounded-full mb-3 border-2 border-gray-600">
              <h4 class="text-lg font-semibold text-red-400 mb-1">${p.guildName || 'Unknown Server'}</h4>
              <p class="text-gray-400 text-xs mb-3 flex-grow">Error loading details.</p>
              <span class="mt-auto text-gray-600 text-xs italic">(${error.message})</span>
            </div>`;
        }
      })
    );

    // --- Generate Priority Banner (Your Server) ---
    let priorityBannerHtml = "";
    if (priorityServerId && partnerMap.has(priorityServerId)) {
        const priorityPartner = partnerMap.get(priorityServerId);
        try {
            const guild = await client.guilds.fetch(priorityServerId);
            await guild.members.fetch();
            const iconURL = guild.iconURL({ dynamic: true, size: 128 }) || 'https://cdn.discordapp.com/embed/avatars/2.png';
            const memberCount = guild.memberCount;
            const onlineMembers = guild.presences.cache.filter(p => p.status === 'online' || p.status === 'dnd' || p.status === 'idle').size;

            priorityBannerHtml = `
            <div class="bg-gradient-to-r from-purple-900/70 to-indigo-900/70 border border-purple-600 rounded-xl shadow-2xl p-8 my-12 flex flex-col md:flex-row items-center gap-8">
              <img src="${iconURL}" alt="${guild.name} Icon" class="w-32 h-32 rounded-2xl border-4 border-purple-500/50 shadow-lg flex-shrink-0" onerror="this.src='https://cdn.discordapp.com/embed/avatars/2.png'; this.onerror=null;">
              <div class="text-center md:text-left">
                <h2 class="text-3xl font-bold text-white mb-2">${guild.name}</h2>
                <p class="text-purple-200 text-base mb-4">${priorityPartner.partnerMessage || "Welcome to our main server!"}</p>
                <div class="flex justify-center md:justify-start space-x-4 text-sm text-purple-300 mb-5">
                  <span><i class="fas fa-users mr-1"></i> ${memberCount} Members</span>
                  <span><i class="fas fa-signal mr-1"></i> ${onlineMembers} Online</span>
                </div>
                ${priorityPartner.inviteLink ? `<a href="${priorityPartner.inviteLink}" target="_blank" rel="noopener noreferrer" class="inline-block bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-6 rounded-lg transition duration-200 text-base shadow-md">
                  <i class="fas fa-sign-in-alt mr-2"></i>Join Now
                </a>` : ''}
              </div>
            </div>`;
        } catch (error) {
            console.error("Error generating priority banner:", error.message);
            priorityBannerHtml = ``;
        }
    }


    // --- Final HTML Structure ---
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SkyVPS360 Partner Network</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
      <style>
        /* Custom scrollbar for webkit browsers */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #1f2937; } /* gray-800 */
        ::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 4px; } /* indigo-600 */
        ::-webkit-scrollbar-thumb:hover { background: #4338ca; } /* indigo-700 */

        body {
          background-color: #111827; /* gray-900 */
          color: #d1d5db; /* gray-300 */
          font-family: 'Inter', sans-serif; /* Consider adding Google Font import if needed */
        }
        /* Add a subtle background pattern */
         body::before {
            content: "";
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: radial-gradient(circle at top left, rgba(55, 48, 163, 0.1), transparent 40%),
                              radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.08), transparent 50%);
            z-index: -1;
            pointer-events: none;
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      </style>
      <script>
        // Optional: Set theme based on user preference or default to dark
        tailwind.config = {
          darkMode: 'class', // Enable class-based dark mode
          theme: {
            extend: {
              colors: {
                 // You can customize or extend Tailwind colors here
                 discord: {
                    blurple: '#5865F2',
                    greyple: '#99AAB5',
                    dark: '#2C2F33',
                    darker: '#23272A'
                 }
              }
            }
          }
        }
        // Ensure dark class is on html tag
        document.documentElement.classList.add('dark');
      </script>
    </head>
    <body class="antialiased">

      <nav class="bg-gray-800/70 backdrop-blur-md sticky top-0 z-50 shadow-md border-b border-gray-700/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center space-x-4">
              <a href="/" class="text-white font-bold text-xl hover:text-indigo-400 transition">Partner Network</a>
               <a href="${process.env.DOMAIN || '#'}" target="_blank" class="hidden md:block text-sm bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold px-3 py-1 rounded-md transition shadow">
                 <i class="fas fa-bolt mr-1"></i> SkyVPS360 - $4 VPS
               </a>
            </div>
            <div class="flex items-center space-x-2">
              <a href="/" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition">Home</a>
              <a href="/docs" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition">Docs</a>
              <a href="${getBotInviteUrl()}" target="_blank" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow-md">
                <i class="fab fa-discord mr-1"></i> Invite Bot
              </a>
            </div>
          </div>
        </div>
      </nav>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <header class="text-center mb-12"> 
          <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 mb-2">
             SkyVPS360 Discord Partner Network
          </h1>
          <p class="text-lg text-gray-400">Discover amazing communities partnered with us!</p>
        </header>

        <section class="mb-16">
          <h2 class="text-2xl font-bold text-indigo-400 mb-6 text-center border-b-2 border-indigo-500/30 pb-2 inline-block mx-auto">
            ⭐ Premium Partners ⭐
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            ${topTierCardsHtml.join("")}
          </div>
        </section>

         ${priorityBannerHtml}


        <section>
           <h2 class="text-2xl font-bold text-blue-400 mb-6 text-center border-b-2 border-blue-500/30 pb-2 inline-block mx-auto">
            🌐 Our Partners
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            ${regularCardsHtml.join("")}
          </div>
           ${regularCardsHtml.length === 0 ? '<p class="text-center text-gray-500 mt-6">No regular partners listed yet. Invite the bot and register!</p>' : ''}
        </section>

      </div>

      <footer class="bg-gray-800/50 border-t border-gray-700/50 mt-16 py-6">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
                &copy; ${new Date().getFullYear()} SkyVPS360 Partner Network. Bot developed with ❤️.
            </div>
        </footer>

    </body>
    </html>
  `;
    res.send(htmlTemplate);
  } catch (error) {
    console.error("❌ Error in the `/` route:", error);
    // Send a user-friendly error page
    res.status(500).send(`
        <!DOCTYPE html><html><head><title>Error</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-gray-900 text-red-400 flex items-center justify-center h-screen">
            <div class="text-center">
                <h1 class="text-3xl font-bold mb-4">Oops! Something went wrong.</h1>
                <p>We encountered an error while loading the partner list. Please try again later.</p>
                <pre class="mt-4 text-xs text-left bg-gray-800 p-4 rounded overflow-auto max-w-lg mx-auto">${error.message}</pre>
            </div>
        </body></html>`);
  }
});


// --- Route: Documentation Page (/docs) ---
app.get("/docs", (req, res) => {
  // Generate HTML for the documentation page using Tailwind
  const docsHtml = `
   <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Partner Bot Documentation</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
       <style>
        /* Custom scrollbar for webkit browsers */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #1f2937; } /* gray-800 */
        ::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 4px; } /* indigo-600 */
        ::-webkit-scrollbar-thumb:hover { background: #4338ca; } /* indigo-700 */

        body {
          background-color: #111827; /* gray-900 */
          color: #d1d5db; /* gray-300 */
          font-family: 'Inter', sans-serif;
        }
         body::before {
            content: "";
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-image: radial-gradient(circle at top right, rgba(139, 92, 246, 0.1), transparent 40%),
                              radial-gradient(circle at bottom left, rgba(55, 48, 163, 0.08), transparent 50%);
            z-index: -1; pointer-events: none;
        }
        code { background-color: #374151; /* gray-700 */ padding: 0.2em 0.4em; border-radius: 4px; font-family: monospace; color: #a5b4fc; /* indigo-300 */ }
        .prose-invert a { color: #818cf8; /* indigo-400 */ }
        .prose-invert strong { color: #c7d2fe; /* indigo-200 */ }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      </style>
       <script>
        tailwind.config = { darkMode: 'class' }
        document.documentElement.classList.add('dark');
      </script>
    </head>
    <body class="antialiased">

      <nav class="bg-gray-800/70 backdrop-blur-md sticky top-0 z-50 shadow-md border-b border-gray-700/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center space-x-4">
              <a href="/" class="text-white font-bold text-xl hover:text-indigo-400 transition">Partner Network</a>
               <a href="${process.env.DOMAIN || '#'}" target="_blank" class="hidden md:block text-sm bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold px-3 py-1 rounded-md transition shadow">
                 <i class="fas fa-bolt mr-1"></i> SkyVPS360 - $4 VPS
               </a>
            </div>
            <div class="flex items-center space-x-2">
              <a href="/" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition">Home</a>
              <a href="/docs" class="bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium" aria-current="page">Docs</a>
              <a href="${getBotInviteUrl()}" target="_blank" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow-md">
                <i class="fab fa-discord mr-1"></i> Invite Bot
              </a>
            </div>
          </div>
        </div>
      </nav>

      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article class="prose prose-invert lg:prose-xl prose-indigo max-w-none bg-gray-800/50 p-8 rounded-lg shadow-lg border border-gray-700/50">
          <h1 class="text-center text-4xl font-extrabold mb-8">📘 Partner Bot Documentation</h1>

          <section class="mb-10">
            <h2 class="text-2xl font-semibold border-b border-indigo-500/50 pb-2 mb-4">Getting Started</h2>
            <p>Welcome! This bot helps Discord servers partner with each other to grow their communities.</p>
            <ol>
              <li>Invite the bot using the <a href="${getBotInviteUrl()}" target="_blank">Invite Link</a>.</li>
              <li>Ensure the bot has necessary permissions (Send Messages, Embed Links, Manage Roles if using <code>/setrole</code>).</li>
              <li>Use <code>/register</code> in your server to begin the partnership process. <strong>Your server must have an icon set!</strong></li>
              <li>Wait for approval from the admin team. You'll be notified via DM or a server channel.</li>
              <li>Once approved, use the "Setup Your Ad" button/modal to configure your settings.</li>
            </ol>
          </section>

          <section class="mb-10">
            <h2 class="text-2xl font-semibold border-b border-indigo-500/50 pb-2 mb-4">User Commands</h2>
            <p>These commands can typically be used by members with the Partner Role (set via <code>/setrole</code>) or Administrators.</p>
            <ul>
              <li><code>/register</code> - Initiates the partnership registration process for your server. Requires admin approval.</li>
              <li><code>/setmessage</code> - Opens a form to set or update your server's advertisement message (max 1000 characters). Requires admin approval each time.</li>
              <li><code>/setchannel</code> - Designates a specific text or announcement channel in your server where ads from other partners will be posted.</li>
              <li><code>/setinvite</code> - Sets or updates the permanent <code>discord.gg</code> invite link for your server displayed on the partner list.</li>
              <li><code>/bump</code> - Sends your currently approved advertisement message to all other approved partner servers. Has a <strong>30-minute cooldown</strong> per server.</li>
              <li><code>/unregister</code> - Removes your server completely from the partner network. This action is irreversible.</li>
              <li><code>/help</code> - Displays a summary of commands and a link to this documentation page.</li>
               <li><code>/invite</code> - Provides the bot's invite link.</li>
            </ul>
             <p class="text-sm text-indigo-300 bg-indigo-900/30 p-3 rounded-md border border-indigo-700"><i class="fas fa-info-circle mr-2"></i><strong>Important:</strong> Your ad message (set via <code>/setmessage</code>) needs to be approved by an admin before you can use <code>/bump</code>.</p>
          </section>

          <section class="mb-10">
              <h2 class="text-2xl font-semibold border-b border-indigo-500/50 pb-2 mb-4">Configuration Commands</h2>
              <ul>
                  <li><code>/setrole</code> - <strong>(Server Owner Only)</strong> Assigns a specific role in your server that grants permission to use the partner commands (like <code>/bump</code>, <code>/setmessage</code>, etc.). If not set, only Administrators can use these commands.</li>
              </ul>
          </section>

          <section>
            <h2 class="text-2xl font-semibold border-b border-indigo-500/50 pb-2 mb-4">Bot Owner Commands</h2>
            <p>These commands are restricted to the Bot Owner specified in the environment variables.</p>
            <ul>
              <li><code>/setstatus</code> - Changes the bot's activity status message.</li>
              <li><code>/settopslot [serverid] [slot]</code> - Assigns an approved partner server to a premium display slot (1, 2, or 3) on the website homepage.</li>
              <li><code>/removetopslot [slot]</code> - Removes the server currently occupying the specified premium slot.</li>
            </ul>
          </section>

        </article>
      </div>

       <footer class="bg-gray-800/50 border-t border-gray-700/50 mt-16 py-6">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
                &copy; ${new Date().getFullYear()} SkyVPS360 Partner Network. Documentation Page.
            </div>
        </footer>

    </body>
    </html>
  `;
  res.send(docsHtml);
});


// --- Start Express Server ---
// Ensure MongoDB is connected before starting the Express server
mongoose.connection.once("open", () => {
    app.listen(PORT, () =>
        console.log(`🌐 Web server running on ${getWebsiteUrl()}`)
    );
});

// --- Bot Login ---
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("❌ Failed to log in to Discord:", error);
  process.exit(1); // Exit if login fails
});

// --- Helper Functions ---

// Function to generate the bot's invite URL
function getBotInviteUrl() {
    if (!client.user?.id) return '#'; // Return placeholder if client not ready
    // Permissions needed: Read Messages, Send Messages, Embed Links, Manage Roles (if /setrole used often), View Channel
    // Use a permission calculator (like discord.com/developers/docs/topics/permissions#permissions-calculator)
    // 8 = Administrator (simplest, but grants all perms)
    // More granular permissions:
    // 2048 (Send Messages) + 16384 (Embed Links) + 1024 (Read Message History - needed?) + 8 (Manage Roles - if needed) + 1024 (View Channel) = ~19480+
    // Let's use a safe set: Send Messages, Embed Links, View Channel, Read History = 1024 + 2048 + 16384 + 65536 = 84992
    const permissions = '8'; // Administrator for simplicity, adjust if needed
    return `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=${permissions}&scope=bot%20applications.commands`;
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log("🔌 Shutting down bot...");
    client.destroy();
    mongoose.connection.close(() => {
        console.log("🔒 MongoDB connection closed.");
        process.exit(0);
    });
});
