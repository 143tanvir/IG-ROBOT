/**
 * File Name: onMessage.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

/**
 * onMessage — runs for every incoming message event.
 * Records activity and keeps basic thread metadata fresh.
 * Author: Saifullah Al Neoaz (https://github.com/lazyneoaz)
 */

module.exports = {
	config: {
		name: "onMessage",
		category: "system",
		// Both a plain message and a reply count as activity; an earlier config
		// listed only "message", so replies never updated lastActivity/members.
		eventType: ["message", "message_reply"]
	},

	onEvent: async function ({ event, threadsData, api }) {
		const patch = { lastActivity: Date.now() };
		if (event.isGroup != null) patch.isGroup = event.isGroup;
		if (Array.isArray(event.participantIDs) && event.participantIDs.length)
			patch.members = event.participantIDs.map(String);
		threadsData.update(event.threadID, patch);

		// --- নতুন যোগ করা অংশ: রিল বা মিডিয়া শেয়ার ডিটেক্ট করার জন্য লজিক ---
		try {
			// মেসেজের ভেতর sharing, clip, বা media_share আছে কিনা চেক করা
			const sharedData = event.sharing || event.clip || event.media_share || event.attachments?.[0];

			if (sharedData) {
				// রিল বা ভিডিওর সরাসরি ডাউনলোড ইউআরএল খুঁজে বের করা
				let videoUrl = sharedData.video_url || sharedData.video_versions?.[0]?.url;

				if (videoUrl) {
					console.log("রিল শেয়ার ডিটেক্ট হয়েছে! ডাউনলোড লিঙ্ক:", videoUrl);

					// আপনি চাইলে এখানে অটো-ডাউনলোড বা ব্যবহারকারীকে লিঙ্ক পাঠানোর কোড যুক্ত করতে পারেন
					// উদাহরণস্বরূপ:
					// await api.sendMessage({ body: "রিলটির ডাউনলোড লিঙ্ক: " + videoUrl }, event.threadID, event.messageID);
				}
			}
		} catch (error) {
			console.error("রিল পার্স করার সময় সমস্যা হয়েছে:", error);
		}
	}
};
