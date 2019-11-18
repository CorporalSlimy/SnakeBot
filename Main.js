// config constants
const Discord = require('discord.js')
const client = new Discord.Client()
const config = require(`./config/config.json`)
const ytdl = require('ytdl-core')
const ffmpeg = require('ffmpeg-static')
console.log(`Loaded require Constants`)
// main.js constants
const queue = new Map()
console.log(`Loaded main.js Constants`)
// bot varibles
// config varibles
var bot_secret_token = config.botToken
var botName = config.botName
var djRole = config.djRole
var adminRole = config.administratorRole
var volume = config.musicVol
var p = config.commandPrefix
console.log(`Loaded config varibles`)
// main.js varibles
var songs = []
var songQueue = []
var queueLen = 0
var songTitle = []
console.log(`Loaded main.js Varibles`)
var helpArr = [
	`\n ***Commands***`,
	`\n ${p}play (YouTube link) : plays the song that is linked. Rquires role ${djRole}`,
	`\n ${p}skip : skips the current playing song. Rquires role ${djRole}`,
	`\n ${p}stop : stops all music(temp disabled). Rquires role ${djRole}`,
	`\n ${p}roll : rolls a 1d20`,
	`\n ${p}roll XdX : replace X with a number, rolls a die based on specifcations`,
	`\n ***Admin Commands***`,
	`\n __*Requires role ${adminRole}*__`,
	`\n ${p}help suffix : Change ${botName}'s suffix`,
	`\n ${p}help volume : change the volume of the music bot(check for VC connection first)`
	]
console.log(`Loaded Help Array`)
client.login(bot_secret_token)
console.log(`Inserted Token`)
client.on('ready', () => {
	console.log(`Starting ${botName}`)
})
client.on('error', console.error)

client.on(`message`, async (message) => {

	// Message Constants
	const serverQueue = queue.get(message.guild.id)
	const messageWords = message.content.split(' ')
	const rollFlavor = messageWords.slice(2).join(' ')
	const member = message.mentions.members.first();

	// MUSIC BOT check for commands
	if (message.author.bot) return
	if (messageWords[0] === `${p}play` && message.member.roles.some(role => role.name === djRole)) {
		execute(message, serverQueue)
		return
	} else if (messageWords[0] === `${p}skip` && message.member.roles.some(role => role.name === djRole)) {
		skip(message, serverQueue);
		return
	} else if (messageWords[0] === `${p}stop` && message.member.roles.some(role => role.name === djRole)) {
		stop(message, serverQueue);
		return
		// return message.reply(`Feature temporarily disabled.`)
	} else if (messageWords[0] === `${p}queue` && message.member.roles.some(role => role.name === djRole)) {
		musicQueue(message, serverQueue)
		return
	} else if ((messageWords[0] === `${p}play` || messageWords[0] === `${p}skip` || messageWords[0] === `${p}queue` || messageWords[0] === `${p}stop`) && !message.member.roles.some(role => role.name === djRole)) {
		return message.reply(`Insuffienct permissions to Play,Skip,Stop, and view the queue.`)
	}

	// chat bot
	if (messageWords[0] === `${p}help`) {
		if (messageWords.length === 1) {
			// $help
			// return message.reply(`\nCOMMANDS:\n ${p}play (YouTube link) : plays the song that is linked. \n ${p}skip : skips the current playing song. \n ${p}stop : stops all music(temp disabled). \n ${p}roll : rolls 1d6 \n ${p}roll XdX : replace X with a number, rolls a die based on specifcations \nADMIN COMMANDS: \n ${p}help suffix : Change the suffix \n ${p}help volume : change the volume of the music bot(check for VC connection first)`)
			return message.channel.send(`${helpArr}`)
		}
		if (isNaN(messageWords[1][0]) && messageWords[1].includes(`volume`)) {
			if (message.member.roles.some(role => role.name === adminRole)) {
				if (!isNaN(messageWords[2])) {
					volume = messageWords[2]
					return message.reply(`Volume has been set to ${volume}`)
				} else if (isNaN(messageWords[2])) {
					return message.reply(`Please enter a number`)
				} else {
					return message.reply(`Please enter a number`)
				}
			} else {
				return message.reply(`Insufficient permissions`)
			}
		}
		if (isNaN(messageWords[1][0]) && messageWords[1].includes(`suffix`)) {
			if (message.member.roles.some(role => role.name === adminRole)) {
				p = messageWords[2]
				return message.reply(`\nSuffix for ${botName} has been set to "${p}"`)
			} else {
				return message.reply(`Insufficient permissions`)
			}
		}
	}

	// ROLL Commands
	if (messageWords[0] === `${p}roll`) {
		if (messageWords.length === 1) {
			// $roll
			return message.reply(
				(Math.floor(Math.random() * 20) + 1) + ' ' + rollFlavor
			);
		}

		let sides = messageWords[1]; // $roll 20
		let rolls = 1;
		if (!isNaN(messageWords[1][0] / 1) && messageWords[1].includes('d')) {
			// $roll 4d20
			rolls = messageWords[1].split('d')[0] / 1;
			sides = messageWords[1].split('d')[1];
		} else if (messageWords[1][0] == 'd') {
			// $roll d20
			sides = sides.slice(1);
		}
		sides = sides / 1; // convert to number
		if (isNaN(sides) || isNaN(rolls)) {
			return;
		}

		if (rolls > 1) {
			const rollResults = [];
			for (let i = 0; i < rolls; i++) {
				rollResults.push(Math.floor(Math.random() * sides) + 1);
			}
			const sum = rollResults.reduce((a, b) => a + b);
			return message.channel.send(`[${rollResults.toString()}] ${rollFlavor}, total: ${sum}`)
		} else {
			return message.reply(
				(Math.floor(Math.random() * sides) + 1) + ' ' + rollFlavor
			);
		}
	}

})



// music bot
async function execute(message, serverQueue) {
	const args = message.content.split(' ');

	const songInfo = await ytdl.getInfo(args[1]);
	const song = {
		title: songInfo.title,
		url: songInfo.video_url,
	};





	const voiceChannel = message.member.voiceChannel;
	if (!voiceChannel) return message.channel.send('Please enter a voice chat to play music.');
	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
		return message.channel.send('${botName} has insufficient permissions to play music.');
	}



	if (!serverQueue) {
		const queueContruct = {
			textChannel: message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: songs,
			volume: volume,
			playing: true,
		};

		queue.set(message.guild.id, queueContruct);

		queueContruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueContruct.connection = connection;
			play(message.guild, queueContruct.songs[0]);
			songTitle = ` ${songInfo.title}`
			songQueue[queueLen] = songTitle
			queueLen += 1
			return message.channel.send(`Now Playing ${song.title}`)
		} catch (err) {
			console.log(err);
			queue.delete(message.guild.id);
			return message.channel.send(err);
		}
	} else {
		serverQueue.songs.push(song);
		songQueue[queueLen] = songTitle
		queueLen += 1
		return message.channel.send(`${song.title} has been added to the queue.`);
	}

}

function skip(message, serverQueue) {
	if (!message.member.voiceChannel) return message.channel.send('Please enter a voice chat to play music.');
	if (!serverQueue) return message.channel.send('There are no songs to skip.');
	if (songQueue == null && queueLen == 0) {
		return
	} else if (!songQueue == null && !queueLen == 0) {
		songQueue.shift()
		queueLen - 1
	}
	message.channel.send(`Skiping song${songTitle}.`)
	serverQueue.connection.dispatcher.end();

}

function stop(message, serverQueue) {
	if (!message.member.voiceChannel) return message.channel.send('Please enter a voice chat to stop music.');
	serverQueue.songs.shift(serverQueue.songs.length)
	songQueue = []
	queueLen = 0
	serverQueue.connection.dispatcher.end();
	message.channel.send(`Stopping all music.`)
}

function musicQueue(message, serverQueue) {

	var songQLen = 0

	if (!message.member.voiceChannel) return message.channel.send(`Please enter a voice chat to see the queue.`)
	if (!serverQueue) return message.channel.send(`There are no songs in the queue.`)
	songQueue.forEach((songTitle) => {
		if (songQLen == 0) {
			message.channel.send(`${songQLen} - ${songQueue[songQLen]} -- Now Playing\n`)
			songQLen += 1
		} else if (!songQLen == 0) {
			message.channel.send(`${songQLen} - ${songQueue[songQLen]}\n`)
			songQLen += 1
		} else {
			message.channel.send(`${songQLen} - ${songQueue[songQLen]}\n`)
		}
		// message.channel.send(`${songQLen} - ${songQueue[songQLen]}\n`)
	})
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', () => {
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => {
			console.error(error);
		});
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}