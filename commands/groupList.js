/**
 * File Name: join.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

module.exports = {
	config: {
		name: "join",
		aliases: ["joingc", "addme"],
		author: "Tanvir143",
		category: "Users Cmd",
		cooldown: 5,
		role: 2,
		description: {
			en: "Join a group using its number"
		},
		usage: {
			en: "{p}join"
		}
	},

	onStart: async function ({
		message,
		api,
		config,
		setReplyHandler
	}) {
		try {
			const threads = await api.getThreadList(100, null, []);

			if (!Array.isArray(threads)) {
				return message.reply("Unable to get group list.");
			}

			const seen = new Set();
			const groups = [];

			for (const thread of threads) {
				if (!thread || !thread.threadID) continue;

				const isGroup =
					thread.isGroup === true ||
					Number(thread.threadType) === 2 ||
					(
						Array.isArray(thread.participantIDs) &&
						thread.participantIDs.length > 2
					);

				if (!isGroup) continue;

				const id = String(thread.threadID);

				if (seen.has(id)) continue;
				seen.add(id);

				const name = String(
					thread.name ||
					thread.threadName ||
					thread.title ||
					"Unnamed Group"
				).trim();

				groups.push({
					id,
					name: name || "Unnamed Group",
					participantIDs: Array.isArray(thread.participantIDs)
						? thread.participantIDs.map(String)
						: []
				});
			}

			if (!groups.length) {
				return message.reply("No group chats found.");
			}

			groups.sort((a, b) =>
				a.name.localeCompare(b.name)
			);

			const list = groups.map((group, index) =>
				`${String(index + 1).padStart(2, "0")}. ${group.name}`
			);

			const text =
`──────────────
    JOIN GROUP
──────────────

${list.join("\n")}

Total Groups: ${String(groups.length).padStart(2, "0")}

Reply with a group number to continue.
(Admin only)
──────────────`;

			const sent = await message.reply(text);

			if (!sent || !sent.messageID) return;

			setReplyHandler(
				async ({ event: replyEvent, message: replyMessage }) => {
					try {
						const admins = Array.isArray(config.adminBot)
							? config.adminBot.map(String)
							: [];

						if (!admins.includes(String(replyEvent.senderID))) {
							return replyMessage.reply(
								"Only bot admins can use this command."
							);
						}

						const input = String(
							replyEvent.body || ""
						).trim();

						if (!/^\d+$/.test(input)) {
							return replyMessage.reply(
								"Please reply with a valid group number."
							);
						}

						const index = Number(input) - 1;

						if (index < 0 || index >= groups.length) {
							return replyMessage.reply(
								`Invalid group number. Choose 01-${String(groups.length).padStart(2, "0")}.`
							);
						}

						const selected = groups[index];
						const userID = String(replyEvent.senderID);

						if (selected.participantIDs.includes(userID)) {
							return replyMessage.reply(
								`You are already a member of "${selected.name}".`
							);
						}

						if (typeof api.addUserToThread !== "function") {
							return replyMessage.reply(
								"ERROR: api.addUserToThread() is not available in your ICA API."
							);
						}

						await api.addUserToThread(
							userID,
							selected.id
						);

						return replyMessage.reply(
`──────────────
     SUCCESS
──────────────

Join request sent for:

${selected.name}

──────────────`
						);

					} catch (error) {
						return replyMessage.reply(
`──────────────
      ERROR
──────────────

Unable to join the selected group.

${error.message || String(error)}

──────────────`
						);
					}
				},
				sent.messageID
			);

		} catch (error) {
			return message.reply(
				`Unable to get group list.\n${error.message || String(error)}`
			);
		}
	}
};
