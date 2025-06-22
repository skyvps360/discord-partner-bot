# Discord Partner Bot

A Discord bot that helps manage partnerships between Discord servers with an approval system and automated message bumping.

## Setup Instructions
1. Install dependencies: `npm install`
2. Create a `.env` file with the following variables:
   - `DISCORD_TOKEN` - Your Discord bot token
   - `MONGO_URI` - MongoDB connection string
   - `ADMIN_SERVER_ID` - ID of the server where partnership approvals will be handled
   - `ADMIN_CHANNEL_ID` - Channel ID where partnership requests will be sent
3. Start the bot: `node index.js` - best if testing in dev or deploying to an App Platform like Heroku or Vercel or DigitalOcean
   - Optionally use PM2 for process management: [pm2.io](https://pm2.io/)
   - `npm install -g pm2`
   - `pm2 start index.js --name "my-app"`
   - `pm2 startup`
   - `pm2 save`

 
### 🔧 Common PM2 Commands:
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
