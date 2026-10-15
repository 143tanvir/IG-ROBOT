/**
 * File Name: filteruser.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

const { resolveProfile } = require("../src/utils");

const pendingScans = global.filterUserPending ||
	(global.filterUserPending = new Map());

module.exports = {
	config: {
		name: "filteruser",
		aliases: [],
		author: "Tanvir143",
		category: "Admin Cmds",
		cooldown: 10,
		role: 2,
		description: {
			en: "Find members whose profile pictures fail to load"
		},
		usage: {
			en: ".filteruser die"
		}
	},

	onStart: async function ({ message, args, event, api }) {
		const threadID = String(event.threadID);
		const senderID = String(event.senderID);
		const action = String(args?.[0] || "").toLowerCase();

		if (action !== "die") {
			return message.reply(
				"❌ ব্যবহার: .filteruser die"
			);
		}

		try {
			const info = await new Promise((resolve, reject) => {
				api.getThreadInfo(threadID, (err, data) => {
					if (err || !data) {
						return reject(err || new Error(
							"Group info পাওয়া যায়নি।"
						));
					}
					resolve(data);
				});
			});

			const members = [...new Set(
				(info.participantIDs || [])
					.map(String)
					.filter(id => id && id !== senderID)
			)];

			if (!members.length) {
				return message.reply(
					"❌ গ্রুপের সদস্য পাওয়া যায়নি।"
				);
			}

			await message.reply(
				`🔎 ${members.length} জন সদস্যের profile picture পরীক্ষা করা হচ্ছে। সময় লাগতে পারে...`
			);

			const candidates = [];
			let unknown = 0;

			for (const id of members) {
				try {
					const fakeEvent = {
						...event,
						senderID: id,
						messageReply: null,
						mentions: {}
					};

					const profile = await resolveProfile(
						[id],
						fakeEvent,
						api
					);

					if (!profile || profile.rateLimited) {
						unknown++;
						continue;
					}

					const picture = profile.profilePicture ||
						profile.thumbSrc;

					if (!picture || typeof picture !== "string") {
						candidates.push({
							id,
							name: profile.username || id
						});
						continue;
					}

					const loaded = await imageLoads(picture);

					if (loaded === false) {
						candidates.push({
							id,
							name: profile.username || id
						});
					} else if (loaded === null) {
						unknown++;
					}
				} catch (error) {
					unknown++;
					console.error(
						"[FILTERUSER PROFILE ERROR]",
						id,
						error.message
					);
				}
			}

			if (!candidates.length) {
				return message.reply(
					`✅ কোনো DP-failure candidate পাওয়া যায়নি।\n` +
					`⚠️ যাদের পরীক্ষা করা যায়নি: ${unknown}`
				);
			}

			const mentions = [];
			const lines = [
				"⚠️ সম্ভাব্য inactive account তালিকা",
				"",
				"নিচের সদস্যদের DP লোড হয়নি। এটি disabled account-এর নিশ্চিত প্রমাণ নয়।",
				"Remove শুরু করতে এই মেসেজে reply দিয়ে Start লিখো।",
				"বাতিল করতে অন্য কোনো উত্তর দাও না।",
				""
			];

			for (let i = 0; i < candidates.length; i++) {
				const user = candidates[i];
				const tag = `@${user.name}`;
				const line = `${i + 1} — ${tag}`;

				const fromIndex = lines.join("\n").length +
					(lines.length ? 1 : 0);

				lines.push(line);

				mentions.push({
					tag,
					id: user.id,
					fromIndex
				});
			}

			lines.push(
				"",
				`মোট candidate: ${candidates.length}`,
				`পরীক্ষা করা যায়নি: ${unknown}`
			);

			const sent = await message.reply({
				body: lines.join("\n"),
				mentions
			});

			const listMessageID =
				sent?.messageID ||
				sent?.messageId ||
				sent?.message_id;

			if (!listMessageID) {
				return message.reply(
					"❌ তালিকার message ID পাওয়া যায়নি। Start confirmation সংরক্ষণ করা যায়নি।"
				);
			}

			pendingScans.set(
				`${threadID}:${String(listMessageID)}`,
				{
					threadID,
					requesterID: senderID,
					candidates,
					createdAt: Date.now()
				}
			);
		} catch (error) {
			console.error("[FILTERUSER ERROR]", error);

			return message.reply(
				"❌ Filter scan ব্যর্থ হয়েছে: " +
				(error.message || "Unknown error")
			);
		}
	},

	/*
	 * Dispatcher must call this for ordinary messages
	 * that reply to a pending candidate-list message.
	 */
	onReply: async function ({ message, event, api }) {
		const threadID = String(event.threadID);
		const replyID = String(
			event.messageReply?.messageID ||
			event.messageReply?.messageId ||
			""
		);

		if (!replyID) return;

		const key = `${threadID}:${replyID}`;
		const pending = pendingScans.get(key);

		if (!pending) return;

		const text = String(
			event.body || event.text || ""
		).trim().toLowerCase();

		if (String(event.senderID) !== pending.requesterID) {
			return;
		}

		pendingScans.delete(key);

		if (text !== "start") {
			return message.reply(
				"ℹ️ Filter operation বাতিল করা হয়েছে।"
			);
		}

		if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
			return message.reply(
				"⌛ এই তালিকার মেয়াদ শেষ। আবার .filteruser die দাও।"
			);
		}

		await message.reply(
			`🛠️ ${pending.candidates.length} জন candidate-এর removal শুরু হচ্ছে...`
		);

		let removed = 0;
		let failed = 0;

		for (const user of pending.candidates) {
			try {
				await new Promise((resolve, reject) => {
					api.removeUserFromThread(
						String(user.id),
						threadID,
						err => err ? reject(err) : resolve()
					);
				});

				removed++;

				console.log(
					`[Tanvir143] FILTERUSER removed: ${user.id}`
				);
			} catch (error) {
				failed++;

				console.error(
					"[FILTERUSER REMOVE ERROR]",
					user.id,
					error.message
				);
			}
		}

		return message.reply(
			"✅ Filter operation শেষ।\n\n" +
			`Removed: ${removed}\n` +
			`Failed: ${failed}`
		);
	}
};


/*
 * Checks whether an image URL returns a successful response.
 * null means the result is inconclusive, not a failed DP.
 */
async function imageLoads(url) {
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		8000
	);

	try {
		const response = await fetch(url, {
			method: "GET",
			signal: controller.signal,
			headers: {
				"Range": "bytes=0-1023"
			}
		});

		if (response.body) {
			await response.body.cancel().catch(() => {});
		}

		if (response.ok) return true;

		if ([404, 410].includes(response.status)) {
			return false;
		}

		return null;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
