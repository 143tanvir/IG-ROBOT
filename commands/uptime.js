/**
 * File Name: uptime.js
 * ICA: igbot-api
 * Auhor: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

const os = require("os");

const AVATAR_EFFECTS = ["love", "love", "love", "cry"];

function formatDuration(ms) {
	let seconds = Math.max(0, Math.floor(ms / 1000));
	const days = Math.floor(seconds / 86400);
	seconds %= 86400;
	const hours = Math.floor(seconds / 3600);
	seconds %= 3600;
	const minutes = Math.floor(seconds / 60);
	seconds %= 60;

	return [
		days ? `${days}d` : null,
		hours ? `${hours}h` : null,
		minutes ? `${minutes}m` : null,
		`${String(seconds).padStart(2, "0")}s`
	].filter(Boolean).join(" ");
}

function formatBytes(bytes) {
	const mb = bytes / 1024 / 1024;
	return mb < 1024 ? `${mb.toFixed(0)} MB` : `${(mb / 1024).toFixed(1)} GB`;
}

function randomAvatarEffect() {
	return AVATAR_EFFECTS[Math.floor(Math.random() * AVATAR_EFFECTS.length)];
}

function startedTime(timestamp) {
	try {
		return new Intl.DateTimeFormat("en-GB", {
			timeZone: "Asia/Dhaka",
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true
		}).format(new Date(timestamp)).replace(",", " ·");
	} catch (_) {
		return new Date(timestamp).toLocaleString();
	}
}

module.exports = {
	config: {
		name: "uptime",
		aliases: ["up", "upt", "runtime"],
		author: "Neoaz 🐊",
		category: "Users Cmd",
		cooldown: 2,
		role: 0,
		description: { en: "View bot uptime and system information" },
		usage: { en: "{p}uptime" }
	},

	onStart: async function ({ message, config }) {
		const startedAt = global.instabotStartedAt || Date.now();
		const memory = process.memoryUsage();
		const totalMemory = os.totalmem();
		const usedMemory = totalMemory - os.freemem();
		const ramPercent = Math.round((usedMemory / totalMemory) * 100);

		let version = "1.0.0";
		try {
			version = require("../package.json").version || version;
		} catch (_) {}

		const botName = (config && config.botName) || "Tanvir143_igBot";

		const body = [
			`        𝗧𝗮𝗻𝘃𝗶𝗿𝟭𝟰𝟯_𝗶𝗴𝗕𝗼𝘁`,
			`             ᴜᴘᴛɪᴍᴇ`,
			"",
			`          𝗨𝗽𝘁𝗶𝗺𝗲`,
			`│ ${formatDuration(Date.now() - startedAt)}`,
			`│ Started ${startedTime(startedAt)}`,
			"",
			`          𝗦𝘆𝘀𝘁𝗲𝗺`,
			`│ ${os.platform()} ${os.arch()} · ${os.cpus().length} cores`,
			`│ RAM ${ramPercent}% · ${formatBytes(usedMemory)} / ${formatBytes(totalMemory)}`,
			"",
			`         𝗥𝘂𝗻𝘁𝗶𝗺𝗲`,
			`│ Node ${process.version}`,
			`│ InstaBOT v${version}`,
			`│ Process ${formatDuration(process.uptime() * 1000)}`,
			`│ Bot RAM ${formatBytes(memory.rss)}`,
			"",
			"────────────────────",
			"             ᴏɴʟɪɴᴇ"
		].join("\n");

		try {
			return await message.send({
				body,
				avatarEffect: randomAvatarEffect()
			});
		} catch (_) {
			return message.send(body);
		}
	}
};
