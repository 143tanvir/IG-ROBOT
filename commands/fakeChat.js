
/**
 * File Name: fakechat.js
 * ICA: igbot-api
 * Project: IG-ROBOT
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

const axios = require("axios");
const { resolveProfile } = require("../src/utils");

module.exports = {
	config: {
		name: "fakechat",
		aliases: ["fc"],
		version: "3.1",
		author: "Tanvir143",
		cooldown: 5,
		role: 0,
		description: "Create a fake chat image",
		category: "fun",
		guide:
			"{pn} Hello ++ Hi\n" +
			"{pn} Hello --user 123456789\n" +
			"{pn} Hello --name false\n" +
			"{pn} Hello --time false\n" +
			"{pn} Hello --attachment https://example.com/image.jpg\n" +
			"Reply to a message to use its sender."
	},

	onStart: async function ({ api, event, args, message, usersData }) {
		const TAG = "[Tanvir143 | IG-ROBOT]";
		const BASE_URL = "https://tawsif.is-a.dev/fakechat/max";

		const originalPrompt = args.join(" ")
			.split("\n\n").join("##")
			.split("\n").join("####");

		if (!originalPrompt.trim()) {
			return message.reply(
				"❌ | Fakechat text দাও।\n\nExample: .fc Hello ++ Hi"
			);
		}

		const getOption = (text, option) => {
			const regex = new RegExp(
				"(?:^|\\s)" + option +
				"\\s+(.+?)(?=\\s--[a-zA-Z]+(?:\\s|$)|$)",
				"s"
			);

			const match = text.match(regex);
			return match ? match[1].trim() : null;
		};

		const getHex = color => {
			if (typeof color !== "string") return null;

			let hex = color.replace(/^#/, "");

			if (hex.length === 8) {
				hex = hex.substring(2);
			}

			hex = hex.substring(0, 6);

			return /^[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
		};

		const getProfileImage = profile => {
			if (!profile || typeof profile !== "object") return "";

			const fields = [
				profile.profilePicture,
				profile.profilePicUrl,
				profile.profile_pic_url,
				profile.profile_pic_url_hd,
				profile.thumbSrc,
				profile.avatarUrl,
				profile.avatar,
				profile.picture,
				profile.photoUrl,
				profile.image,
				profile.url
			];

			return fields.find(
				value => typeof value === "string" &&
					/^https?:\/\//i.test(value)
			) || "";
		};

		const getProfileName = profile => {
			if (!profile || typeof profile !== "object") return "";

			return (
				profile.name ||
				profile.fullName ||
				profile.full_name ||
				profile.username ||
				profile.vanity ||
				""
			);
		};

		const setReaction = async emoji => {
			try {
				if (typeof api.setMessageReaction === "function") {
					await api.setMessageReaction(emoji, event.messageID);
				} else if (typeof message.reaction === "function") {
					await message.reaction(emoji, event.messageID);
				}
			} catch (_) {}
		};

		try {
			const threadID = event.threadID;
			const senderID = String(event.senderID);

			let threadInfo = {};

			try {
				threadInfo = await api.getThreadInfo(threadID);
			} catch (error) {
				console.log(TAG, "Thread info unavailable:", error.message);
			}

			// Resolve the target user.
			let targetID = senderID;
			const userOption = getOption(originalPrompt, "--user");

			if (userOption) {
				const value = userOption.split(/\s+/)[0];

				if (/^https?:\/\//i.test(value)) {
					if (typeof api.getUID !== "function") {
						return message.reply(
							"❌ | Profile link থেকে UID বের করা যাচ্ছে না। Numeric UID ব্যবহার করো।"
						);
					}

					targetID = String(await api.getUID(value));
				} else {
					targetID = value;
				}
			} else if (event.messageReply?.senderID) {
				targetID = String(event.messageReply.senderID);
			}

			if (!targetID || !/^\d+$/.test(targetID)) {
				return message.reply("❌ | সঠিক user ID পাওয়া যায়নি।");
			}

			// Fetch profile using the project's existing utility.
			let profile = null;

			try {
				profile = await resolveProfile(
					[targetID],
					{
						...event,
						messageReply: null,
						mentions: {}
					},
					api
				);
			} catch (error) {
				console.error(TAG, "resolveProfile error:", error.message);
			}

			let avatarURL = getProfileImage(profile);
			let profileName = getProfileName(profile);

			// Fallback to the bot's existing user-data provider.
			if (!avatarURL && usersData?.getAvatarUrl) {
				try {
					const fallbackURL = await usersData.getAvatarUrl(targetID);

					if (
						typeof fallbackURL === "string" &&
						/^https?:\/\//i.test(fallbackURL)
					) {
						avatarURL = fallbackURL;
					}
				} catch (error) {
					console.log(TAG, "Avatar fallback failed:", error.message);
				}
			}

			if (!profileName && usersData?.getName) {
				try {
					profileName = await usersData.getName(targetID);
				} catch (_) {}
			}

			const nameOption = getOption(originalPrompt, "--name");
			const displayName = nameOption === "false"
				? ""
				: (
					threadInfo?.nicknames?.[targetID] ||
					profileName ||
					"User"
				).toString().split(/\s+/)[0];

			if (!avatarURL) {
				return message.reply(
					"❌ | User profile picture পাওয়া যায়নি।\n" +
					"এই UID-এর জন্য API কোনো valid image URL দেয়নি।"
				);
			}

			// Read optional reply image or explicit image URL.
			let replyImage = "";

			if (event.messageReply?.attachments?.length) {
				const attachment = event.messageReply.attachments[0];

				replyImage =
					attachment?.url ||
					attachment?.imageUrl ||
					"";
			}

			const attachmentOption = getOption(
				originalPrompt,
				"--attachment"
			);

			if (attachmentOption) {
				replyImage = attachmentOption.split(/\s+/)[0];
			}

			if (
				replyImage &&
				!/^https?:\/\//i.test(replyImage)
			) {
				return message.reply("❌ | Attachment-এর image URL সঠিক নয়।");
			}

			// Parse options.
			const timeOption = getOption(originalPrompt, "--time");
			const showTime = timeOption === null || timeOption === "true";
			const themeMode = getOption(originalPrompt, "--theme") || "light";

			let ownText = getOption(originalPrompt, "--own");

			if (ownText) {
				ownText = ownText
					.replace(/\s+--[a-zA-Z]+(?:\s+.*)?$/, "")
					.trim();
			}

			// Remove options from the chat text.
			const chatText = originalPrompt
				.split(/\s--(?:theme|user|name|time|attachment|own)\b/)[0]
				.trim();

			if (!chatText) {
				return message.reply("❌ | Chat text পাওয়া যায়নি।");
			}

			// Detect available thread theme colors.
			let ownColor = "3874ff";
			let textColor = "3874ff";
			let barColor = "1a1a1a";
			let background = "";

			try {
				const themeID = threadInfo?.threadTheme?.id;

				if (themeID && typeof api.theme === "function") {
					const themeList = await api.theme("list", threadID);

					const themeData = Array.isArray(themeList)
						? themeList.find(item => item.id === themeID)
						: null;

					if (themeData) {
						const gradients = themeData.gradientColors;
						const inbound = themeData.inboundMessageGradientColors;

						if (Array.isArray(gradients) && gradients.length) {
							ownColor =
								getHex(gradients[gradients.length - 1]) ||
								ownColor;
						} else {
							ownColor =
								getHex(themeData.titleBarButtonTintColor) ||
								ownColor;
						}

						if (Array.isArray(inbound) && inbound.length) {
							textColor = getHex(inbound[0]) || textColor;
						}

						barColor =
							getHex(themeData.composerInputBackgroundColor) ||
							barColor;

						background = themeData.backgroundImage || "";
					}
				}

				if (
					!background &&
					threadInfo?.threadTheme?.id &&
					typeof api.fetchThemeData === "function"
				) {
					const fetchedTheme = await api.fetchThemeData(
						threadInfo.threadTheme.id
					);

					if (fetchedTheme) {
						background = fetchedTheme.backgroundImage || "";
					}
				}
			} catch (error) {
				console.log(TAG, "Theme detection skipped:", error.message);
			}

			await setReaction("⏳");

			// Construct the fakechat request.
			const params = new URLSearchParams({
				theme: themeMode,
				name: displayName,
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

			const imageURL = BASE_URL + "?" + params.toString();

			// Download and validate the generated image.
			const response = await axios.get(imageURL, {
				responseType: "arraybuffer",
				timeout: 120000,
				maxRedirects: 5,
				maxContentLength: 15 * 1024 * 1024,
				maxBodyLength: 15 * 1024 * 1024,
				headers: {
					"User-Agent": "Mozilla/5.0"
				},
				validateStatus: status => status >= 200 && status < 300
			});

			const contentType = String(
				response.headers["content-type"] || ""
			).toLowerCase();

			if (!contentType.startsWith("image/")) {
				throw new Error(
					"Fakechat API image ফেরত দেয়নি। API response পরীক্ষা করো।"
				);
			}

			const imageBuffer = Buffer.from(response.data);

			if (!imageBuffer.length) {
				throw new Error("Generated image ফাঁকা এসেছে।");
			}

			// Send the image using the command's message interface.
			await message.reply({
				body: "",
				attachment: imageBuffer
			});

			await setReaction("✅");
		} catch (error) {
			console.error(TAG, "Fakechat error:", error.message);

			await setReaction("❌");

			const errorMessage = error.response?.status
				? "API HTTP " + error.response.status
				: error.message;

			return message.reply(
				"❌ | Fakechat image তৈরি করা যায়নি।\n" +
				"কারণ: " + errorMessage
			);
		}
	}
};
