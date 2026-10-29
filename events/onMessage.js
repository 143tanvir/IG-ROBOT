/**
 * File Name: onMessage.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

const axios = require("axios");

/**
 * onMessage — runs for every incoming message event.
 * Records activity and keeps basic thread metadata fresh.
 * Author: Saifullah Al Neoaz (https://github.com/lazyneoaz)
 */

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

		// Render logs theke paowa event structure onujayi reel/link detection
		try {
			// Logs-er structure check kore sob possible property gulo ekhane rakha holo
			const sharedData = event.sharing || event.clip || event.media_share || event.attachments?.[0];
			
			// Jodi itemType link ba media hoy ebong shared content thake
			if (sharedData || event.itemType === "link" || event.itemType === "media") {
				let videoUrl = sharedData?.video_url || sharedData?.video_versions?.[0]?.url || sharedData?.url;

				// Jodi direct videoUrl object theke na paoyay jay, kintu attachments ba url e thake
				if (!videoUrl && event.attachments && event.attachments.length > 0) {
					videoUrl = event.attachments[0].url;
				}

				if (videoUrl) {
					console.log("Reel ba Media download URL paoya geche:", videoUrl);

					// Video buffer akare download kore group a pathanor logic
					const videoResponse = await axios.get(videoUrl, {
						responseType: "arraybuffer"
					});
					const videoBuffer = Buffer.from(videoResponse.data, "binary");

					await api.sendMessage(
						{
							body: "Here is your shared Reel!",
							attachment: videoBuffer
						},
						event.threadID,
						event.messageID
					);

					console.log("Reel sothikvabe group a pathano hoyeche!");
				} else {
					console.log("Event asheche kintu kono direct video url paoya jayni:", JSON.stringify(event, null, 2));
				}
			}
		} catch (error) {
			console.error("Reel process ba download korar somoy error eseche:", error);
		}
	}
};
