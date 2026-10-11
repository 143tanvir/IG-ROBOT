
/**
 * File Name: uptime.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

const AVATAR_EFFECTS = ["love", "love", "love", "cry"];

function formatDuration(ms) {
	let s = Math.floor(ms / 1000);
	const d = Math.floor(s / 86400);
	s %= 86400;
	const h = Math.floor(s / 3600);
	s %= 3600;
	const m = Math.floor(s / 60);
	s %= 60;

	return [
		d && `${d}d`,
		h && `${h}h`,
		m && `${m}m`,
		`${s}s`
	].filter(Boolean).join(" ");
}

async function getStats() {
	const db = global.database;

	if (!db) {
		return { users: "N/A", threads: "N/A", groups: "N/A" };
	}

	try {
		if (db.ready) await db.ready;

		const read = async store => {
			if (!store) return null;
			if (typeof store.all === "function") {
				const data = await store.all();
				if (Array.isArray(data)) return data;
				if (data instanceof Map) return [...data.values()];
				if (data && typeof data === "object") {
					return Object.values(data);
				}
			}
			return null;
		};

		const users = await read(db.users);
		const threads = await read(db.threads);

		return {
			users: users ? users.length : "N/A",
			threads: threads ? threads.length : "N/A",
			groups: threads
				? threads.filter(t => t && t.isGroup === true).length
				: "N/A"
		};
	} catch (e) {
		console.error("[UPTIME] Stats error:", e.message);
		return { users: "N/A", threads: "N/A", groups: "N/A" };
	}
}

module.exports = {
	config: {
		name: "uptime",
		aliases: ["up", "upt", "runtime"],
		author: "Tanvir Ahmed (Tanvir143)",
		category: "Users Cmd",
		cooldown: 2,
		role: 0,
		description: {
			en: "View bot uptime and database statistics"
		},
		usage: { en: "{p}uptime" }
	},

	onStart: async function ({ message, config }) {
		const startedAt = global.instabotStartedAt || Date.now();
		const stats = await getStats();

		let version = "0.0.3";
		try {
			version = require("../package.json").version || version;
		} catch (_) {}

		const botName = (config && config.botName) || "Tanvir143_igBot";

		const body = [
			"╭───〔 BOT STATUS 〕",
			`│ ${botName}`,
			"│ Status: Online",
			`│ Uptime: ${formatDuration(Date.now() - startedAt)}`,
			"├───〔 DATABASE 〕",
			`│ Users: ${stats.users}`,
			`│ Threads: ${stats.threads}`,
			`│ Groups: ${stats.groups}`,
			"├───〔 INFO 〕",
			`│ Version: v${version}`,
			"╰────────────────"
		].join("\n");

		try {
			return await message.send({
				body,
				avatarEffect: AVATAR_EFFECTS[
					Math.floor(Math.random() * AVATAR_EFFECTS.length)
				]
			});
		} catch (_) {
			return message.send(body);
		}
	}
};
