const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const userFilePath = path.join(__dirname, 'allowed_users.json');
const channelFilePath = path.join(__dirname, 'allowed_channels.json');

// Utility functions to read/write JSON files
function write(data, filePath) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function read(filePath) {
  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  }
  return {};
}

// Load allowed users and channels
let allowedUsers = read(userFilePath);
let allowedChannels = read(channelFilePath);

if (!allowedUsers.master) {
  allowedUsers.master = "478620292831510529"; // "me"
  write(allowedUsers, userFilePath);
}

// If the users array does not exist, initialize it as an empty array
if (!allowedUsers.users) {
  allowedUsers.users = [];
}

// Helper function to check if user is allowed
function isAllowedUser(userId) {
  return allowedUsers.master === userId || allowedUsers.users.includes(userId);
}

function isAllowedBot(channelId, botId) {
  if (allowedChannels[channelId]) {
    const channel = allowedChannels[channelId];

    if (channel.type === 'all') {
      return true; // All bots are allowed
    } else if (channel.type === 'whitelist' && channel.whitelistedBots.includes(botId)) {
      return true;
    }
  }
  return false;
}

// Event: When the bot is ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Add commands for managing users and channels
client.on('messageCreate', (message) => {
  if (!message.guild) return; // Ignore DMs

  // only allowed users can run the following commands
  if (!isAllowedUser(message.author.id)) return;

  const [command, ...args] = message.content.trim().split(/\s+/);
  console.log(`Received command: ${command}, args: ${args}`);

  // Add allowed channel command
  if (command === '!addchannel' && args.length === 1) {
    console.log("running addchannel");
    const channelId = message.channelId;
    const type = args[0]; // "all" for all bots, "whitelist" for specific bots

    if (!allowedChannels[channelId]) {
      allowedChannels[channelId] = {
        type: type,
        whitelistedBots: []
      };
      write(allowedChannels, channelFilePath);
      message.reply(`Channel ${channelId} added as "${type}" channel.`);
    } else {
      message.reply(`Channel ${channelId} is already allowed.`);
    }
  }

  // Remove allowed channel command
  if (command === '!removechannel' && args.length === 1) {
    const channelId = message.channelId;
    delete allowedChannels[channelId];
    write(allowedChannels, channelFilePath);
    message.reply(`Channel ${channelId} removed from allowed channels.`);
  }

  // Add bot to whitelist command
  if (command === '!whitelistbot' && args.length === 1) {
    const channelId = message.channelId;
    const botId = args[0];

    if (allowedChannels[channelId] && allowedChannels[channelId].type === 'whitelist') {
      if (!allowedChannels[channelId].whitelistedBots.includes(botId)) {
        allowedChannels[channelId].whitelistedBots.push(botId);
        write(allowedChannels, channelFilePath);
        message.reply(`Bot ${botId} whitelisted for channel ${channelId}.`);
      } else {
        message.reply(`Bot ${botId} is already whitelisted.`);
      }
    } else {
      message.reply(`Channel ${channelId} is not a "whitelist" type channel.`);
    }
  }

  // Remove bot from whitelist command
  if (command === '!unwhitelistbot' && args.length === 1) {
    const channelId = message.channelId;
    const botId = args[0];

    if (allowedChannels[channelId] && allowedChannels[channelId].type === 'whitelist') {
      allowedChannels[channelId].whitelistedBots = allowedChannels[channelId].whitelistedBots.filter((id) => id !== botId);
      write(allowedChannels, channelFilePath);
      message.reply(`Bot ${botId} removed from whitelist for channel ${channelId}.`);
    }
  }

  // Check if the message author is the master user before running the following commands
  if (message.author.id !== allowedUsers.master) return;

  // list allowed users command
  if (command === '!listusers') {
    message.reply(`Allowed users: ${allowedUsers.users.join(', ')}`);
  }

  // Add user command
  if (command === '!adduser' && args.length === 1) {
    const userId = args[0];
    if (!allowedUsers.users.includes(userId)) {
      allowedUsers.users.push(userId);
      write(allowedUsers, userFilePath);
      message.reply(`User ${userId} added to allowed users.`);
    } else {
      message.reply(`User ${userId} is already allowed.`);
    }
  }

  // Remove user command
  if (command === '!removeuser' && args.length === 1) {
    const userId = args[0];
    allowedUsers.users = allowedUsers.users.filter((id) => id !== userId);
    write(allowedUsers, userFilePath);
    message.reply(`User ${userId} removed from allowed users.`);
  }

});

// Check if a bot is allowed to respond in the channel
client.on('messageCreate', (message) => {
  // Prevent the bot from deleting its own messages
  if (message.author.id === client.user.id) return;

  if (message.author.bot) {
    if (!isAllowedBot(message.channelId, message.author.id)) {
      message.delete()
      .then(() => console.log(`Deleted bot message from ${message.author.username} in channel ${message.channelId}`))
      .catch(console.error);
    }
  }
});

// Log in to Discord with the bot token
client.login(process.env.BOT_TOKEN);
