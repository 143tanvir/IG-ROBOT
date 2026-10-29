/**
 * File Name: onMessage.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

const axios = require("axios");

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

		// --- অটোমেটিক রিল ডাউনলোড ও গ্রুপে পাঠানোর অংশ ---
		try {
			const sharedData = event.sharing || event.clip || event.media_share || event.attachments?.[0];

			if (sharedData) {
				let videoUrl = sharedData.video_url || sharedData.video_versions?.[0]?.url;

				if (videoUrl) {
					console.log("রিল শেয়ার ডিটেক্ট হয়েছে! অটো ডাউনলোড শুরু হচ্ছে...");

					// ১. সরাসরি ভিডিও ড্রাইভ/সার্ভার থেকে ডাউনলোড করা (stream/buffer আকারে)
					const videoResponse = await axios.get(videoUrl, {
						responseType: "arraybuffer"
					});
					const videoBuffer = Buffer.from(videoResponse.data, "binary");

					// ২. ডাউনলোড করা ভিডিওটি গ্রুপে রিপ্লাই বা মেসেজ হিসেবে পাঠানো
					await api.sendMessage(
						{
							body: " Here is your shared Reel!",
							attachment: videoBuffer
						},
						event.threadID,
						event.messageID
					);

					console.log("রিল সফলভাবে গ্রুপে পাঠানো হয়েছে!");
				}
			}
		} catch (error) {
			console.error("রিল প্রসেস বা ডাউনলোড করার সময় সমস্যা হয়েছে:", error);
		}
	}
};
