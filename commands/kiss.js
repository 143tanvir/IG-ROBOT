/**
 * File Name: kiss.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * Description: Gender-aware kiss image generator.
 */

"use strict";

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const JimpModule = require("jimp");
const Jimp = JimpModule.Jimp || JimpModule;

const CACHE_DIR = path.join(__dirname, "cache", "canvas");
const TEMPLATE_PATH = path.join(CACHE_DIR, "kissv3.png");
const TEMPLATE_URL = "https://i.imgur.com/3laJwc1.jpg";

const captions = [
	"কারণে অকারণে প্রতিদিন নিয়ম করে, তোমার মায়াতে জড়িয়ে পড়ছি আমি বারেবার!🌷",
	"তোমাকে কেন ভালোবাসি তার কোন বিশেষ কারণ আমার জানা নাই! কিন্তু তোমার কাছে সারাজীবন থেকে যাওয়ার হাজারটা কারণ আমার কাছে আছে!💚",
	"তোমার সাথে কাটানো সময়গুলোর কথা চিন্তা করলে মনে হয়, এই এক জনম তোমার সাথে অনেক কম সময়!😘",
	"প্রিয় তুমি কি আমার জীবনের সেই গল্প হবে? যেই গল্পের শুরু থাকবে, কিন্তু কোনো শেষ থাকবে না!♥️",
	"তুমি পাশে থাকলে সবকিছু সুন্দর মনে হয়, জীবন যেন একটা মধুর কবিতায় রূপ নেয়!😍",
	"তোমাকে ছাড়া জীবনটা অসম্পূর্ণ, তুমি আমার ভালোবাসার পূর্ণতা!🧡",
	"তুমি আমার স্বপ্ন, তুমি আমার জীবনের প্রতিটি সুন্দর মুহূর্ত!🌻",
	"আমার চোখে তোমার অস্তিত্ব খুঁজতে এসো না, হারিয়ে যাবে! কেননা আমার পুরোটা জুড়েই তোমারই নির্বাক আনাগোনা!🌺",
	"তোমাতে শুরু তোমাতেই শেষ, তুমি না থাকলে আমাদের গল্প এখানেই শেষ!😘",
	"ভালোবাসা যদি কোনো অনুভূতি হয়, তাহলে তোমার প্রতি আমার অনুভূতি পৃথিবীর সেরা অনুভূতি।🌻ღ🌺"
];

/**
 * Uses the same MongoDB connection and PairData collection
 * as commands/pair.js.
 */
function getPairCollection(threadsData) {
	try {
		const threadCollection = threadsData && threadsData.collection;
		const db = threadCollection && (
			threadCollection.db ||
			(threadCollection.s && threadCollection.s.db)
		);

		if (!db || typeof db.collection !== "function") {
			return null;
		}

		return db.collection("PairData");
	} catch (error) {
		console.error("[KISS MONGODB ERROR]", error.message);
		return null;
	}
}

/**
 * Reads gender from the current group's PairData document.
 * pair.js stores boys in boy[] and girls in girl[].
 */
function getGender(userID, pairData) {
	const id = String(userID);
	const isBoy = (pairData.boy || []).map(String).includes(id);
	const isGirl = (pairData.girl || []).map(String).includes(id);

	// Missing or conflicting registration is treated as unknown.
	if (isBoy === isGirl) return null;

	return isBoy ? "boy" : "girl";
}

async function ensureCache() {
	await fs.ensureDir(CACHE_DIR);

	if (!(await fs.pathExists(TEMPLATE_PATH))) {
		const response = await axios.get(TEMPLATE_URL, {
			responseType: "arraybuffer",
			timeout: 20000
		});

		await fs.writeFile(TEMPLATE_PATH, response.data);
	}
}

async function getAvatar(userID, outputPath) {
	const url =
		"https://graph.facebook.com/" +
		encodeURIComponent(userID) +
		"/picture?width=512&height=512";

	const response = await axios.get(url, {
		responseType: "arraybuffer",
		timeout: 20000
	});

	await fs.writeFile(outputPath, response.data);
}

async function makeCircle(imagePath) {
	const image = await Jimp.read(imagePath);
	image.circle();
	return image;
}

async function makeImage(maleID, femaleID) {
	await ensureCache();

	const stamp =
		`${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

	const outputPath = path.join(CACHE_DIR, `kiss_${stamp}.png`);
	const maleAvatarPath = path.join(CACHE_DIR, `male_${stamp}.png`);
	const femaleAvatarPath = path.join(CACHE_DIR, `female_${stamp}.png`);

	try {
		await Promise.all([
			getAvatar(maleID, maleAvatarPath),
			getAvatar(femaleID, femaleAvatarPath)
		]);

		const [template, maleAvatar, femaleAvatar] = await Promise.all([
			Jimp.read(TEMPLATE_PATH),
			makeCircle(maleAvatarPath),
			makeCircle(femaleAvatarPath)
		]);

		maleAvatar.resize(350, 350);
		femaleAvatar.resize(350, 350);

		// Male DP stays lower; female DP stays upper.
		template
			.composite(maleAvatar, 200, 300)
			.composite(femaleAvatar, 600, 80);

		const mime = JimpModule.MIME_PNG || Jimp.MIME_PNG;

		let buffer;

		if (typeof template.getBufferAsync === "function") {
			buffer = await template.getBufferAsync(mime || "image/png");
		} else {
			buffer = await template.getBuffer(mime || "image/png");
		}

		await fs.writeFile(outputPath, buffer);
		return outputPath;
	} catch (error) {
		await fs.remove(outputPath).catch(() => {});
		throw error;
	} finally {
		await Promise.all([
			fs.remove(maleAvatarPath).catch(() => {}),
			fs.remove(femaleAvatarPath).catch(() => {})
		]);
	}
}

module.exports = {
	config: {
		name: "kiss",
		aliases: ["kiss3", "kissimg"],
		version: "2.0.0",
		author: "Tanvir Ahmed (Tanvir143)",
		cooldown: 5,
		role: 0,
		description: {
			en: "Create a kiss image using mentions or replies"
		},
		category: "Images",
		guide: {
			en: "{pn} @mention\n{pn} @mention @mention\nReply to a message with {pn}"
		}
	},

	onStart: async function ({
		api,
		event,
		message,
		threadsData
	}) {
		const senderID = String(event.senderID || "");
		const threadID = String(event.threadID || "");
		const mentions = Object.keys(event.mentions || {})
			.map(String)
			.filter(Boolean);

		let userOne;
		let userTwo;

		// Two mentions: pair the two mentioned users.
		if (mentions.length >= 2) {
			userOne = mentions[0];
			userTwo = mentions[1];
		}
		// One mention: pair sender with the mentioned user.
		else if (mentions.length === 1) {
			userOne = senderID;
			userTwo = mentions[0];
		}
		// Reply: pair sender with the replied-to user.
		else if (
			event.messageReply &&
			event.messageReply.senderID
		) {
			userOne = senderID;
			userTwo = String(event.messageReply.senderID);
		} else {
			return message.reply(
				"💋 Kiss command ব্যবহার:\n\n" +
				"1. .kiss @mention\n" +
				"2. .kiss @mention @mention\n" +
				"3. কোনো message-এর reply দিয়ে .kiss"
			);
		}

		if (!userOne || !userTwo) {
			return message.reply("❌ দুইজন user শনাক্ত করা যায়নি।");
		}

		if (userOne === userTwo) {
			return message.reply("⚠️ দুজন আলাদা user নির্বাচন করো।");
		}

		const pairCollection = getPairCollection(threadsData);

		if (!pairCollection) {
			return message.reply(
				"❌ PairData MongoDB collection পাওয়া যাচ্ছে না। " +
				"MongoDB connection এবং threadsData পরীক্ষা করো।"
			);
		}

		let pairData;

		try {
			pairData = await pairCollection.findOne({ threadID });
		} catch (error) {
			console.error("[KISS MONGODB ERROR]", error.message);

			return message.reply(
				"❌ Gender data পড়তে সমস্যা হয়েছে। পরে আবার চেষ্টা করো।"
			);
		}

		// No registration document means both genders are unknown.
		pairData = pairData || { boy: [], girl: [] };

		const genderOne = getGender(userOne, pairData);
		const genderTwo = getGender(userTwo, pairData);

		// Block same-gender pairs only when both registrations are known.
		if (genderOne && genderTwo && genderOne === genderTwo) {
			return message.reply(
				genderOne === "girl"
					? "🚨 Lesbian Detected! 🌈"
					: "🚨 Gay Detected! 🌈"
			);
		}

		let maleID;
		let femaleID;

		/*
		 * If both genders are known and different, use their
		 * registered genders. If either is unknown, randomize
		 * the avatar positions as requested.
		 */
		if (genderOne && genderTwo && genderOne !== genderTwo) {
			maleID = genderOne === "boy" ? userOne : userTwo;
			femaleID = genderOne === "girl" ? userOne : userTwo;
		} else if (Math.random() < 0.5) {
			maleID = userOne;
			femaleID = userTwo;
		} else {
			maleID = userTwo;
			femaleID = userOne;
		}

		let imagePath;

		try {
			imagePath = await makeImage(maleID, femaleID);

			await new Promise((resolve, reject) => {
				const stream = fs.createReadStream(imagePath);

				stream.once("error", reject);

				api.sendMessage(
					{
						body: captions[
							Math.floor(Math.random() * captions.length)
						],
						attachment: stream
					},
					threadID,
					error => {
						if (error) reject(error);
						else resolve();
					},
					event.messageID
				);
			});
		} catch (error) {
			console.error(
				"[Tanvir143 | igBot] Kiss image error:",
				error.message || error
			);

			return message.reply(
				"❌ Kiss image তৈরি করা যায়নি। Avatar URL, template image " +
				"এবং Jimp package পরীক্ষা করো।"
			);
		} finally {
			if (imagePath) {
				await fs.remove(imagePath).catch(() => {});
			}
		}
	}
};
