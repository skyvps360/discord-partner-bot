# Discord Partner Bot

A Discord bot that helps manage partnerships between Discord servers with an approval system and automated message bumping.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Docker](https://www.docker.com/get-started/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [MongoDB](https://www.mongodb.com/) (or use the included Docker Compose setup)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token

# MongoDB Configuration
MONGO_URI=mongodb://mongo:27017/discord_bot

# Admin Configuration
ADMIN_SERVER_ID=your_admin_server_id
ADMIN_CHANNEL_ID=your_admin_channel_id

# Web Server Configuration
PORT=4444
NODE_ENV=production
```

## Deployment Options

### Using Docker Compose (Recommended)

1. Ensure Docker and Docker Compose are installed on your system
2. Update the `.env` file with your configuration
3. Run the following commands:

```bash
# Build and start the containers
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the containers
docker-compose down
```

The bot will be available and connected to a MongoDB instance running in a separate container.

### Manual Setup (Without Docker)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the bot:

   ```bash
   node index.js
   ```

### PM2 Process Manager (Production)

For production deployments, you can use PM2 to keep the bot running:

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start index.js --name "discord-partner-bot"

# Set up PM2 to start on system boot
pm2 startup
pm2 save

# View logs
pm2 logs discord-partner-bot
```

## Common PM2 Commands
View running apps: `pm2 ls`

Restart app: `pm2 restart my-app`

Stop app: `pm2 stop my-app`

Delete app: `pm2 delete my-app`

View logs: `pm2 logs my-app`

## Features
- Partnership management with approval system
- Automated message bumping with 30-minute cooldown
- Role-based permissions
- Partnership message approval system
- Logging system in each server
- Automatic invite link management

## Commands
### General Commands
- `/help` - View all available commands and their descriptions
- `/register` - Register your server for partnerships (requires approval)
- `/setchannel` - Set the channel for receiving partner advertisements
- `/unregister` - Remove your server from the partner network
- `/bump` - Send your advertisement to all partner servers (30-min cooldown)
- `/setmessage` - Set your server's partnership message (requires approval)
- `/setinvite` - Set your server's invite link
- `/invite` - Get the bot's invite link

### Administrative Commands
- `/setrole` - Set the role required to use partner commands (Server Owner only)
- `/setstatus` - Change the bot's status message (Bot Owner only)

## Permissions
- Server owners can set a partner role that allows members to use partnership commands
- Users need either the partner role or administrator permissions to use most commands
- The bot automatically creates an 'ad-logs' channel for logging partnership activities

### Brought to you by the $3 Ryzen Epyc KVM VPS Provider [SkyVPS360.xyz](https://skyvps360.xyz/)
