/**
 * File Name: groupList.js
 * ICA: igbot-api
 * Auhor: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

module.exports = {
	config: {
		name: "gclist",
		aliases: ["grouplist", "groups"],
		author: "Tanvir143",
		category: "Users Cmd",
		cooldown: 5,
		role: 0,
		description: {
			en: "List all group chats"
		},
		usage: {
			en: "{p}gclist"
		}
	},

	onStart: async function ({
		message,
		event,
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
					name: name || "Unnamed Group"
				});
			}

			if (!groups.length) {
				return message.reply("No group chats found.");
			}

			groups.sort((a, b) =>
				a.name.localeCompare(b.name)
			);

			const list = groups.map((group, index) => {
				const number = String(index + 1).padStart(2, "0");
				return `${number}. ${group.name}`;
			});

			const text =
`──────────────
   GROUP LIST
──────────────

${list.join("\n")}

Total Groups: ${String(groups.length).padStart(2, "0")}

Reply with a number to join.
(Admin only)
──────────────`;

			const sent = await message.reply(text);

			if (!sent?.messageID) return;

			setReplyHandler(
				async ({ event: replyEvent, message: replyMessage }) => {
					const admins = Array.isArray(config.adminBot)
						? config.adminBot.map(String)
						: [];

					if (!admins.includes(String(replyEvent.senderID))) {
						return replyMessage.reply(
							"Only bot admins can use the group number."
						);
					}

					const input = String(
						replyEvent.body || ""
					).trim();

					if (!/^\d+$/.test(input)) {
						return replyMessage.reply(
							"Reply with a valid group number."
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

					try {
						await api.addUserToThread(
							userID,
							selected.id
						);

						return replyMessage.reply(
`──────────────
     SUCCESS
──────────────

You have been added to:

${selected.name}

──────────────`
						);

					} catch (error) {
						return replyMessage.reply(
`──────────────
      ERROR
──────────────

Unable to add you to:

${selected.name}

${error.message || "Please try again."}

──────────────`
						);
					}
				},
				sent.messageID
			);

		} catch (error) {
			return message.reply(
				`Unable to get group list.\n${error.message || error}`
			);
		}
	}
};
