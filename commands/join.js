
/**
 * File Name: join.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

module.exports = {
	config: {
		name: "join",
		aliases: ["gclist", "grouplist", "groups"],
		author: "Tanvir143",
		category: "Users Cmd",
		cooldown: 5,
		role: 0,
		description: {
			en: "List available group chats and join by number"
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
			if (typeof api.getThreadList !== "function") {
				return message.reply(
					"❌ ICA API does not support getThreadList()."
				);
			}

			/*
			 * Normalize possible timestamp formats for pagination.
			 * The ICA server may use different thread field names.
			 */
			function getCursor(thread) {
				if (!thread || typeof thread !== "object") {
					return null;
				}

				const values = [
					thread.timestamp,
					thread.lastActivityTimestamp,
					thread.lastMessageTimestamp,
					thread.lastActivity,
					thread.updatedTime,
					thread.lastMessageTime
				];

				for (const value of values) {
					if (value === null || value === undefined) {
						continue;
					}

					if (
						typeof value === "string" ||
						typeof value === "number"
					) {
						const result = String(value).trim();

						if (result) return result;
					}
				}

				return null;
			}

			function getThreadID(thread) {
				const id =
					thread?.threadID ??
					thread?.threadId ??
					thread?.thread_id ??
					thread?.id;

				if (id === null || id === undefined || id === "") {
					return null;
				}

				return String(id);
			}

			function isGroupThread(thread) {
				if (!thread || typeof thread !== "object") {
					return false;
				}

				const explicitFlags = [
					thread.isGroup,
					thread.isGroupChat,
					thread.is_group
				];

				if (
					explicitFlags.some(
						value =>
							value === true ||
							String(value).toLowerCase() === "true"
					)
				) {
					return true;
				}

				const types = [
					thread.threadType,
					thread.thread_type,
					thread.type
				];

				for (const value of types) {
					if (value === null || value === undefined) {
						continue;
					}

					const type = String(value).toLowerCase();

					if (
						type === "2" ||
						type.includes("group") ||
						type.includes("multi")
					) {
						return true;
					}
				}

				const participants =
					thread.participantIDs ??
					thread.participantIds ??
					thread.participants ??
					thread.users ??
					thread.members;

				if (Array.isArray(participants)) {
					return participants.length > 2;
				}

				if (
					participants &&
					typeof participants === "object"
				) {
					return Object.keys(participants).length > 2;
				}

				// Unknown thread metadata cannot safely identify a group.
				return false;
			}

			/*
			 * Fetch multiple pages where the server supports timestamp
			 * pagination. Deduplicate threads across every page.
			 */
			const allThreads = new Map();
			const seenCursors = new Set();

			let cursor = null;
			let pageCount = 0;
			const maxPages = 10;
			const pageSize = 100;

			while (pageCount < maxPages) {
				const page = await api.getThreadList(
					pageSize,
					cursor,
					[]
				);

				pageCount++;

				if (!Array.isArray(page) || page.length === 0) {
					break;
				}

				let newThreads = 0;

				for (const thread of page) {
					const id = getThreadID(thread);

					if (!id || allThreads.has(id)) {
						continue;
					}

					allThreads.set(id, thread);
					newThreads++;
				}

				// No new records means the server is repeating a page.
				if (newThreads === 0) {
					break;
				}

				if (page.length < pageSize) {
					/*
					 * A short page can mean the end of the inbox.
					 * If the server caps page size, try advancing
					 * using its oldest available timestamp.
					 */
				}

				const oldestFirst = page
					.map(getCursor)
					.filter(Boolean);

				const nextCursor =
					oldestFirst.length > 0
						? oldestFirst[oldestFirst.length - 1]
						: null;

				if (
					!nextCursor ||
					nextCursor === cursor ||
					seenCursors.has(nextCursor)
				) {
					break;
				}

				seenCursors.add(nextCursor);
				cursor = nextCursor;

				if (page.length < pageSize) {
					// A short page is normally the end of the list.
					break;
				}
			}

			const groups = [];
			const seenGroupIDs = new Set();

			for (const thread of allThreads.values()) {
				if (!isGroupThread(thread)) continue;

				const id = getThreadID(thread);

				if (!id || seenGroupIDs.has(id)) continue;
				seenGroupIDs.add(id);

				const rawName =
					thread.name ||
					thread.threadName ||
					thread.thread_name ||
					thread.title ||
					thread.subject ||
					"Unnamed Group";

				const name = String(rawName).trim();

				groups.push({
					id,
					name: name || "Unnamed Group"
				});
			}

			if (groups.length === 0) {
				return message.reply(
					"❌ No groups were found in the ICA thread list.\n\n" +
					`Threads received: ${allThreads.size}\n` +
					"Your ICA server may be returning only inbox threads " +
					"or using a different group metadata format."
				);
			}

			groups.sort((a, b) =>
				a.name.localeCompare(b.name)
			);

			const lines = groups.map((group, index) => {
				const number = String(index + 1).padStart(2, "0");
				return `${number}. ${group.name}`;
			});

			const text =
`──────────────
       GROUP LIST
──────────────

${lines.join("\n")}

Total Groups: ${groups.length}

Reply with a group number to join.
(Admin only)
──────────────`;

			const sent = await message.reply(text);

			if (!sent?.messageID) return;

			setReplyHandler(
				async ({
					event: replyEvent,
					message: replyMessage
				}) => {
					const admins = Array.isArray(config.adminBot)
						? config.adminBot.map(String)
						: [];

					if (
						!admins.includes(String(replyEvent.senderID))
					) {
						return replyMessage.reply(
							"❌ Only bot admins can use the group number."
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
							`❌ Invalid number. Choose 1-${groups.length}.`
						);
					}

					const selected = groups[index];

					if (
						typeof api.addUserToThread !== "function" &&
						typeof api.addUserToGroup !== "function"
					) {
						return replyMessage.reply(
							"❌ ICA does not support adding users to groups."
						);
					}

					try {
						const addUser =
							typeof api.addUserToThread === "function"
								? api.addUserToThread.bind(api)
								: api.addUserToGroup.bind(api);

						await addUser(
							String(replyEvent.senderID),
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
				"❌ Unable to retrieve groups.\n" +
				(error.message || String(error))
			);
		}
	}
};
