const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let db;
open({
    filename: './excuses.db',
    driver: sqlite3.Database
}).then(async database => {
    db = database;
    await db.run(`
        CREATE TABLE IF NOT EXISTS excuses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            excuse TEXT NOT NULL
        )
    `);
});

const commands = [
    new SlashCommandBuilder()
        .setName('add_excuse')
        .setDescription('Add a new excuse')
        .addStringOption(option =>
            option.setName('excuse')
                .setDescription('The excuse text')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('list_excuses')
        .setDescription('List all excuses'),
    new SlashCommandBuilder()
        .setName('remove_excuse')
        .setDescription('Remove an excuse by ID')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('The ID of the excuse to remove')
                .setRequired(true)),
];

const rest = new REST({ version: '10' }).setToken(config.token);
(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.user.id === config.blockedUserId) {
        await interaction.reply('Sorry, you are not allowed to use this command.');
        return;
    }

    const { commandName } = interaction;

    if (commandName === 'add_excuse') {
        const excuse = interaction.options.getString('excuse');
        await db.run('INSERT INTO excuses (excuse) VALUES (?)', [excuse]);
        await interaction.reply(`Excuse added: "${excuse}"`);
    } else if (commandName === 'list_excuses') {
        const excuses = await db.all('SELECT id, excuse FROM excuses');
        if (excuses.length === 0) {
            await interaction.reply('No excuses found.');
        } else {
            const excuseList = excuses.map(row => `${row.id}. ${row.excuse}`).join('\n');
            await interaction.reply(`Here are the current excuses:\n${excuseList}`);
        }
    } else if (commandName === 'remove_excuse') {
        const id = interaction.options.getInteger('id');
        const result = await db.run('DELETE FROM excuses WHERE id = ?', [id]);
        if (result.changes > 0) {
            await interaction.reply(`Excuse ${id} removed.`);
        } else {
            await interaction.reply(`Excuse ${id} not found.`);
        }
    }
});

client.login(config.token);
