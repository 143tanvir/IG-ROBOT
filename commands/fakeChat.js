
/**
 * File Name: fakechat.js
 * ICA: igbot-api
 * Project: IG-ROBOT
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

const axios = require("axios");

module.exports = {
	config: {
		name: "fakechat",
		aliases: ["fc"],
		version: "3.0",
		author: "Tanvir143",
		cooldown: 5,
		role: 0,
		description: "Create a fake chat image",
		category: "fun",
		guide: "{pn} Hello ++ Hi"
	},

	onStart: async function ({ api, event, args, message, usersData }) {
		const TAG = "[Tanvir143 | IG-ROBOT]";
		const BASE_URL = "https://tawsif.is-a.dev/fakechat/max";

		let prompt = args.join(" ")
			.split("\n\n").join("##")
			.split("\n").join("####");

		if (!prompt.trim()) {
			return message.reply("❌ | Fake chat তৈরি করতে text দাও।");
		}

		const getOption = (text, option) => {
			const match = text.match(
				new RegExp("(?:^|\\s)" + option + "\\s+(.+?)(?=\\s--[a-zA-Z]+(?:\\s|$)|$)", "s")
			);
			return match ? match[1].trim() : null;
		};

		const getHex = color => {
			if (typeof color !== "string") return null;
			let hex = color.replace(/^#/, "");
			if (hex.length === 8) hex = hex.substring(2);
			hex = hex.substring(0, 6);
			return /^[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
		};

		try {
			let threadInfo = {};

			try {
				threadInfo = await api.getThreadInfo(event.threadID);
			} catch (_) {}

			let targetID = String(event.senderID);
			const userOption = getOption(prompt, "--user");

			if (userOption) {
				const value = userOption.split(/\s+/)[0];

				if (/^https?:\/\//i.test(value)) {
					if (typeof api.getUID !== "function") {
						return message.reply("❌ | Profile link থেকে UID বের করা যাচ্ছে না। সরাসরি UID দাও।");
					}
					targetID = String(await api.getUID(value));
				} else {
					targetID = value;
				}
			} else if (event.messageReply?.senderID) {
				targetID = String(event.messageReply.senderID);
			}

			if (!/^\d+$/.test(targetID)) {
				return message.reply("❌ | সঠিক user ID দাও।");
			}

			let userName = "";

			if (getOption(prompt, "--name") !== "false") {
				try {
					userName = await usersData.getName(targetID);
				} catch (_) {}

				userName = threadInfo?.nicknames?.[targetID] ||
					userName || "Instagram User";

				userName = String(userName).split(/\s+/)[0];
			}

			let avatarURL = "";

			try {
				avatarURL = await usersData.getAvatarUrl(targetID);
			} catch (_) {}

			if (!avatarURL) {
				return message.reply("❌ | User profile picture পাওয়া যায়নি।");
			}

			let replyImage = "";

			if (event.messageReply?.attachments?.length) {
				replyImage = event.messageReply.attachments[0]?.url || "";
			}

			const attachmentOption = getOption(prompt, "--attachment");

			if (attachmentOption) {
				replyImage = attachmentOption.split(/\s+/)[0];
			}

			const ownText = getOption(prompt, "--own");
			const timeOption = getOption(prompt, "--time");
			const showTime = timeOption === null || timeOption === "true";
			const themeMode = getOption(prompt, "--theme") || "light";

			let ownColor = "3874ff";
			let textColor = "3874ff";
			let barColor = "1a1a1a";
			let background = "";

			try {
				const themeID = threadInfo?.threadTheme?.id;

				if (themeID && typeof api.theme === "function") {
					const themes = await api.theme("list", event.threadID);
					const theme = Array.isArray(themes)
						? themes.find(item => item.id === themeID)
						: null;

					if (theme) {
						const colors = theme.gradientColors;
						const inbound = theme.inboundMessageGradientColors;

						if (Array.isArray(colors) && colors.length) {
							ownColor = getHex(colors[colors.length - 1]) || ownColor;
						}

						if (Array.isArray(inbound) && inbound.length) {
							textColor = getHex(inbound[0]) || textColor;
						}

						barColor = getHex(theme.composerInputBackgroundColor) || barColor;
						background = theme.backgroundImage || "";
					}
				}
			} catch (_) {}

			const chatText = prompt
				.split(/\s--(?:theme|user|name|time|attachment|own)\b/)[0]
				.trim();

			if (!chatText) {
				return message.reply("❌ | Chat text পাওয়া যায়নি।");
			}

			try {
				await api.setMessageReaction("⏳", event.messageID);
			} catch (_) {}

			const params = new URLSearchParams({
				theme: themeMode,
				name: userName,
				avatar: avatarURL,
				text: chatText,
				time: String(showTime),
				emoji: String(threadInfo?.emoji || ""),
				textBg: "#" + textColor,
				ownTextBg: "#" + ownColor,
				bg: background,
				barColor: "#" + barColor,
				ownTextColor: "#000000",
				textColor: "#000000"
			});

			if (replyImage) {
				params.set("replyImageUrl", replyImage);
			}

			if (ownText) {
				params.set("ownText", ownText);
			}

			const response = await axios.get(BASE_URL + "?" + params.toString(), {
				responseType: "arraybuffer",
				timeout: 120000,
				maxContentLength: 15 * 1024 * 1024,
				validateStatus: status => status >= 200 && status < 300
			});

			const contentType = String(
				response.headers["content-type"] || ""
			).toLowerCase();

			if (!contentType.includes("image/")) {
				throw new Error("Fakechat API image দেয়নি।");
			}

			const imageBuffer = Buffer.from(response.data);

			if (!imageBuffer.length) {
				throw new Error("Generated image ফাঁকা এসেছে।");
			}

			await message.reply({
				body: "",
				attachment: imageBuffer
			});

			try {
				await api.setMessageReaction("✅", event.messageID);
			} catch (_) {}

		} catch (error) {
			console.error(TAG, "Fakechat error:", error.message);

			try {
				await api.setMessageReaction("❌", event.messageID);
			} catch (_) {}

			return message.reply(
				"❌ | Fakechat image তৈরি করা যায়নি: " +
				(error.response?.status
					? "HTTP " + error.response.status
					: error.message)
			);
		}
	}
};
