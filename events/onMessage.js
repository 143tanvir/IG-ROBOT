/**
 * File Name: onMessage.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

module.exports = {
	config: {
		name: "onMessage",
		category: "system",
		eventType: ["message", "message_reply"]
	},

	onEvent: async function ({ event, threadsData, api }) {
		const patch = { lastActivity: Date.now() };
		if (event.isGroup != null) patch.isGroup = event.isGroup;
		if (Array.isArray(event.participantIDs) && event.participantIDs.length)
			patch.members = event.participantIDs.map(String);
		threadsData.update(event.threadID, patch);

		try {
			// Jodi kono message ba reel share kora hoy, tahole puro event data-ti direct group-e message hisebe pathiye debe
			const isSharedOrReel = event.sharing || event.clip || event.media_share || event.message_reels || event.attachments?.length > 0 || event.itemType;

			if (isSharedOrReel) {
				let debugText = "INCOMING_EVENT:\n" + JSON.stringify(event, null, 2);
				
                // Message-ti jate khub boro hoye geleo samlate pare, tai dorkar hole substring korte paren ba direct pathate paren
                await api.sendMessage(
                    { body: debugText },
                    event.threadID,
                    event.messageID
                );
			}
		} catch (error) {
			await api.sendMessage(
				{ body: "Error: " + error.message },
				event.threadID,
				event.messageID
			);
		}
	}
};
