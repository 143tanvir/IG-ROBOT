/**
 * File Name: report.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

module.exports = {
	config: {
		name: "report",
		aliases: ["rep"],
		version: "0.0.2",
		author: "Tanvir Ahmed",
		cooldown: 5,
		role: 2,
		description: {
			en: "Report Instagram user profile multiple times for harassment"
		},
		category: "Users Cmd",
		guide: {
			en: "{pn} @mention\n{pn} username\nReply to a message with {pn} to report its sender."
		}
	},

	onStart: async function ({ api, event, args, message }) {
		const targets = [];
		const mentions = event.mentions || {};

		if (event.messageReply && event.messageReply.senderID) {
			targets.push({
				id: String(event.messageReply.senderID),
				label: String(event.messageReply.senderID)
			});
		} else if (Object.keys(mentions).length > 0) {
			for (const id of Object.keys(mentions)) {
				targets.push({
					id: String(id),
					label: String(mentions[id] || id).replace(/^@/, "")
				});
			}
		} else if (args.length > 0) {
			const findUid = global.utils && global.utils.findUid;

			if (typeof findUid !== "function") {
				return message.reply(
					"❌ Username lookup is unavailable. Please mention or reply to the user."
				);
			}

			for (const arg of args) {
				try {
					const cleanArg = arg.replace("@", "");
					const id = await findUid(cleanArg);

					if (!id) {
						targets.push({ error: true, label: cleanArg });
					} else {
						targets.push({
							id: String(id),
							label: cleanArg
						});
					}
				} catch (error) {
					targets.push({ error: true, label: arg });
				}
			}
		} else {
			return message.reply(
				"⚠️ Mention a user, reply to their message, or provide a username to report."
			);
		}

		for (const target of targets) {
			if (target.error) {
				return message.reply(`❌ Could not find user: ${target.label}`);
			}

			try {
				if (typeof api.reportUser !== "function") {
					throw new Error("api.reportUser() is not supported by this ICA");
				}

				message.reply(`[+] Target @${target.label} er biruddhe reporting shuru hocche...`);

				let successCount = 0;
				const totalReports = 10;
				let lastErrorMessage = "";

				for (let i = 1; i <= totalReports; i++) {
					try {
						await api.reportUser(target.id);
						successCount++;
						await new Promise(resolve => setTimeout(resolve, 2000));
					} catch (err) {
						lastErrorMessage = err.error || err.message || String(err);
						console.error(`Report ${i} failed for ${target.label}:`, lastErrorMessage);
					}
				}

				// Jodi shob gulo ba kichu report successful hoy
				if (successCount > 0) {
					return message.reply(`[✔] Report ${successCount} successful`);
				} else {
					// Jodi ektao successful na hoy, tahole shesh error message-ti message a bole debe
					return message.reply(`❌ Report failed! Error: ${lastErrorMessage || "Unknown error occurred"}`);
				}

			} catch (error) {
				const reason = error.error || error.message || String(error);
				return message.reply(`❌ Error: ${reason}`);
			}
		}
	}
};
