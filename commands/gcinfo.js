
/**
 * File Name: threadinfo.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

const { getStreamFromURL } = global.utils;

module.exports = {
	config: {
		name: "BoxInfo",
		aliases: ["groupinfo", "gcinfo"],
		version: "1.0",
		author: "Tanvir Ahmed (Tanvir143)",
		helpText: "View information about the current or a specified chat",
		category: "Info",
		cooldown: 5,
		role: 0,
		description: {
			en: "View information about the current or a specified chat"
		},
		usage: {
			en: "{p}threadinfo | {p}threadinfo <threadID>"
		}
	},

	langs: {
		en: {
			failed: "❌ Failed to fetch thread info: %1"
		}
	},

	async onStart({ api, event, args, message }) {
		const threadID =
			args[0] && /^\d+$/.test(args[0])
				? args[0]
				: event.threadID;

		let info;

		try {
			info = await api.getThreadInfo(threadID);
		}
		catch (error) {
			return message.reply(
				"❌ Failed to fetch thread info: " +
				(error.error || error.message || String(error))
			);
		}

		const adminIDs = (info.adminIDs || [])
			.map(admin => admin.id || admin);

		const msg =
			"» Thread ID: " + (info.threadID || threadID) +
			"\n» Name: " + (info.name || "Unknown") +
			"\n» Type: " + (info.isGroup ? "Group" : "Private") +
			"\n» Members: " + (info.participantIDs || []).length +
			"\n» Admins: " + (adminIDs.join(", ") || "none") +
			"\n» Muted: " + (info.isMuted ? "yes" : "no") +
			"\n» Archived: " + (info.isArchived ? "yes" : "no") +
			"\n» Messages: " + (info.messageCount ?? "Unknown");

		if (!info.imageSrc || typeof getStreamFromURL !== "function") {
			return message.reply(msg);
		}

		try {
			const stream = await getStreamFromURL(info.imageSrc);

			return message.reply({
				body: msg,
				attachment: stream
			});
		}
		catch (_) {
			return message.reply(msg);
		}
	}
};
