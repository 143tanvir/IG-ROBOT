
/**
 * File Name: uptime.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

const AVATAR_EFFECTS = ["cry"];

function formatDuration(ms) {
	let seconds = Math.floor(Math.max(0, ms) / 1000);
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
		`${seconds}s`
	].filter(Boolean).join(" ");
}

async function getStats() {
	const db = global.database;

	if (!db) {
		return { users: "Unavailable", threads: "Unavailable" };
	}

	try {
		if (db.ready) await db.ready;

		async function count(store) {
			if (!store) return "Unavailable";

			if (typeof store.countDocuments === "function") {
				return await store.countDocuments({});
			}

			if (store.collection &&
				typeof store.collection.countDocuments === "function") {
				return await store.collection.countDocuments({});
			}

			if (typeof store.all === "function") {
				const data = await store.all();

				if (Array.isArray(data)) return data.length;
				if (data instanceof Map) return data.size;
				if (data && typeof data === "object") {
					return Object.keys(data).length;
				}
			}

			if (typeof store.getAll === "function") {
				const data = await store.getAll();
				if (Array.isArray(data)) return data.length;
			}

			return "Unavailable";
		}

		return {
			users: await count(db.users),
			threads: await count(db.threads)
		};
	} catch (error) {
		console.error("[UPTIME] Database count error:", error.message);
		return { users: "Unavailable", threads: "Unavailable" };
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

		let version = "1.0.0";

		try {
			version = require("../package.json").version || version;
		} catch (_) {}

		const botName =
			(config && config.botName) || "Tanvir143_igBot";

		const body = [
			"╭───〔 BOT STATUS 〕",
			`│ ${botName}`,
			"│ Status: Online",
			`│ Uptime: ${formatDuration(Date.now() - startedAt)}`,
			"├───〔 DATABASE 〕",
			`│ Users: ${stats.users}`,
			`│ Threads: ${stats.threads}`,
			`│ Groups: ${stats.threads}`,
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
