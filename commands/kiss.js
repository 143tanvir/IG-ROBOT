
/**
 * File Name: kiss.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * Note: Uses the existing IG-ROBOT profile resolver and PairData.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const {
	resolveProfile,
	resolveUserTarget
} = require("../src/utils");

const TEMPLATE_URL = "https://i.imgur.com/3laJwc1.jpg";
const TEMPLATE_PATH = path.join(
	__dirname,
	"..",
	"data",
	"kiss-template.jpg"
);

const AVATAR_SIZE = 200;
const REQUEST_TIMEOUT = 20000;

module.exports = {
	config: {
		name: "kiss",
		aliases: ["kiss3", "kissimg"],
		version: "4.0.0",
		author: "Tanvir143",
		category: "Fun",
		cooldown: 5,
		role: 0,
		description: {
			en: "Create a kiss image using profile pictures."
		},
		usage: {
			en: ".kiss @user | .kiss @user1 @user2 | Reply + .kiss"
		}
	},

	onStart: async function ({
		message,
		args,
		event,
		api,
		threadsData
	}) {
		try {
			const senderID = String(
				event.senderID || event.userID || ""
			);

			const threadID = String(event.threadID || "");

			if (!senderID || !threadID) {
				return message.reply(
					"❌ Sender ID বা Thread ID পাওয়া যায়নি।"
				);
			}

			// Resolve targets using the actual mention metadata.
			const targetIDs = await getTargetIDs(
				args,
				event,
				api,
				senderID
			);

			if (!targetIDs || targetIDs.length !== 2) {
				return message.reply(
					"💋 Kiss Image ব্যবহার:\n\n" +
					"• .kiss @user\n" +
					"• .kiss @user1 @user2\n" +
					"• কোনো মেসেজে reply দিয়ে .kiss\n\n" +
					"দুইজন ইউজার নির্বাচন করুন।"
				);
			}

			const [id1, id2] = targetIDs;

			if (id1 === id2) {
				return message.reply(
					"❌ একই ইউজারকে দুইবার নির্বাচন করা যাবে না।"
				);
			}

			// Read gender registration from this group's PairData.
			const pairCollection = getPairCollection(threadsData);

			if (!pairCollection) {
				console.error(
					"[KISS] PairData collection পাওয়া যায়নি।"
				);
			}

			let pairData = null;

			if (pairCollection) {
				pairData = await pairCollection.findOne({
					threadID: threadID
				});
			}

			const gender1 = getGender(id1, pairData);
			const gender2 = getGender(id2, pairData);

			console.log("[KISS GENDER CHECK]", {
				threadID,
				user1: id1,
				gender1: gender1 || "unregistered",
				user2: id2,
				gender2: gender2 || "unregistered",
				pairDataFound: Boolean(pairData)
			});

			// Both registered as the same gender: do not create an image.
			if (gender1 && gender2 && gender1 === gender2) {
				return message.reply(
					gender1 === "girl"
						? "🌈 Lesbian Detected"
						: "🌈 Gay Detected"
				);
			}

			// Bottom = boy, top = girl.
			// If one gender is unknown, keep the known user's position.
			let bottomID;
			let topID;

			if (gender1 === "boy" && gender2 === "girl") {
				bottomID = id1;
				topID = id2;
			}
			else if (gender1 === "girl" && gender2 === "boy") {
				bottomID = id2;
				topID = id1;
			}
			else if (gender1 === "boy" && !gender2) {
				bottomID = id1;
				topID = id2;
			}
			else if (gender2 === "boy" && !gender1) {
				bottomID = id2;
				topID = id1;
			}
			else if (gender1 === "girl" && !gender2) {
				topID = id1;
				bottomID = id2;
			}
			else if (gender2 === "girl" && !gender1) {
				topID = id2;
				bottomID = id1;
			}
			else if (Math.random() < 0.5) {
				bottomID = id1;
				topID = id2;
			}
			else {
				bottomID = id2;
				topID = id1;
			}

			// Use the same profile resolver as pair.js.
			const [bottomProfile, topProfile] = await Promise.all([
				loadProfile(bottomID, event, api),
				loadProfile(topID, event, api)
			]);

			if (!bottomProfile || !topProfile) {
				return message.reply(
					"❌ Profile লোড করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।"
				);
			}

			const bottomPic = bottomProfile.profilePicture;
			const topPic = topProfile.profilePicture;

			if (!bottomPic || !topPic) {
				return message.reply(
					"❌ একজন বা দুজনের profile picture পাওয়া যায়নি।"
				);
			}

			const [templateBuffer, bottomAvatar, topAvatar] =
				await Promise.all([
					getTemplate(),
					downloadImage(bottomPic),
					downloadImage(topPic)
				]);

			const [bottomCircle, topCircle] = await Promise.all([
				makeCircle(bottomAvatar, AVATAR_SIZE),
				makeCircle(topAvatar, AVATAR_SIZE)
			]);

			const metadata = await sharp(templateBuffer).metadata();

			if (!metadata.width || !metadata.height) {
				throw new Error(
					"Template image dimensions পাওয়া যায়নি।"
				);
			}

			// Original template positions.
			const bottomPosition = {
				left: 200,
				top: 300
			};

			const topPosition = {
				left: 600,
				top: 80
			};

			for (const position of [
				bottomPosition,
				topPosition
			]) {
				if (
					position.left + AVATAR_SIZE > metadata.width ||
					position.top + AVATAR_SIZE > metadata.height
				) {
					throw new Error(
						`Template size ${metadata.width}x${metadata.height}; ` +
						"avatar positions template-এর বাইরে চলে যাচ্ছে।"
					);
				}
			}

			const output = await sharp(templateBuffer)
				.composite([
					{
						input: bottomCircle,
						left: bottomPosition.left,
						top: bottomPosition.top
					},
					{
						input: topCircle,
						left: topPosition.left,
						top: topPosition.top
					}
				])
				.jpeg({ quality: 90 })
				.toBuffer();

			const bottomName = cleanName(
				bottomProfile.username || bottomID
			);

			const topName = cleanName(
				topProfile.username || topID
			);

			return message.reply({
				body:
					"💋 Kiss Time!\n\n" +
					"💙 নিচে: @" + bottomName + "\n" +
					"💗 উপরে: @" + topName,
				attachment: output
			});
		}
		catch (error) {
			const status = error.status || error.response?.status;
			const url = error.url || error.config?.url || "";

			console.error("[Tanvir143 | igBot] Kiss image error:", {
				message: error.message || String(error),
				status: status || null,
				url: url ? url.split("?")[0] : null,
				stack: error.stack || null
			});

			if (
				status === 429 ||
				/\b429\b|too many requests/i.test(
					error.message || ""
				)
			) {
				return message.reply(
					"⏳ Image server request limit করেছে (429)। " +
					"কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।"
				);
			}

			return message.reply(
				"❌ Kiss image তৈরি করা যায়নি।\n" +
				"কারণ: " +
				String(error.message || error).slice(0, 350)
			);
		}
	}
};


/* =================================
   TARGET USERS
================================= */

async function getTargetIDs(args, event, api, senderID) {
	const mentions = event.mentions || {};

	// Mention metadata generally maps user IDs to display names.
	const mentionedIDs = Object.keys(mentions)
		.map(String)
		.filter(Boolean);

	// Reply + .kiss: sender and replied-to user.
	if (
		event.messageReply &&
		event.messageReply.senderID != null
	) {
		return uniqueIDs([
			senderID,
			String(event.messageReply.senderID)
		]);
	}

	// One mention: sender + mentioned user.
	if (mentionedIDs.length === 1) {
		return uniqueIDs([
			senderID,
			mentionedIDs[0]
		]);
	}

	// Two mentions: pair the two mentioned users.
	if (mentionedIDs.length >= 2) {
		return uniqueIDs(
			mentionedIDs.slice(0, 2)
		);
	}

	// Fallback for commands that provide IDs as arguments.
	const input = Array.isArray(args)
		? args
			.map(value => String(value || "").trim())
			.filter(Boolean)
		: [];

	const targets = [];

	for (const arg of input) {
		try {
			const result = await resolveUserTarget(
				[arg],
				{
					...event,
					messageReply: null
				},
				api
			);

			if (result && result.id) {
				const id = String(result.id);

				if (!targets.includes(id)) {
					targets.push(id);
				}
			}
		}
		catch (error) {
			console.error(
				"[KISS TARGET ERROR]",
				error.message || error
			);
		}
	}

	if (targets.length === 1) {
		return uniqueIDs([
			senderID,
			targets[0]
		]);
	}

	return uniqueIDs(targets.slice(0, 2));
}


function uniqueIDs(ids) {
	return [
		...new Set(
			(ids || [])
				.map(value => String(value || "").trim())
				.filter(Boolean)
		)
	];
}


/* =================================
   PROFILE LOADER
================================= */

async function loadProfile(userID, event, api) {
	try {
		const fakeEvent = {
			...event,
			senderID: String(userID),
			userID: String(userID),
			messageReply: null,
			mentions: {}
		};

		return await resolveProfile(
			[String(userID)],
			fakeEvent,
			api
		);
	}
	catch (error) {
		console.error(
			"[KISS PROFILE ERROR]",
			String(userID),
			error.message || error
		);

		return null;
	}
}


/* =================================
   MONGODB PAIR DATA
================================= */

function getPairCollection(threadsData) {
	try {
		const threadCollection =
			threadsData && threadsData.collection;

		const db = threadCollection && (
			threadCollection.db ||
			(threadCollection.s && threadCollection.s.db)
		);

		if (!db || typeof db.collection !== "function") {
			return null;
		}

		return db.collection("PairData");
	}
	catch (error) {
		console.error(
			"[KISS PAIRDATA ERROR]",
			error.message || error
		);

		return null;
	}
}


function getGender(userID, pairData) {
	if (!pairData) return null;

	const id = String(userID).trim();

	const boys = Array.isArray(pairData.boy)
		? pairData.boy.map(value => String(value).trim())
		: [];

	const girls = Array.isArray(pairData.girl)
		? pairData.girl.map(value => String(value).trim())
		: [];

	if (boys.includes(id)) return "boy";
	if (girls.includes(id)) return "girl";

	return null;
}


/* =================================
   TEMPLATE CACHE
================================= */

async function getTemplate() {
	try {
		if (fs.existsSync(TEMPLATE_PATH)) {
			const cached = fs.readFileSync(TEMPLATE_PATH);

			await sharp(cached).metadata();

			return cached;
		}
	}
	catch (error) {
		console.error(
			"[KISS TEMPLATE CACHE ERROR]",
			error.message || error
		);
	}

	const buffer = await downloadImage(TEMPLATE_URL);

	await sharp(buffer).metadata();

	fs.mkdirSync(
		path.dirname(TEMPLATE_PATH),
		{ recursive: true }
	);

	fs.writeFileSync(TEMPLATE_PATH, buffer);

	return buffer;
}


/* =================================
   DOWNLOAD IMAGE
================================= */

async function downloadImage(url) {
	if (!url || typeof url !== "string") {
		throw new Error("Image URL পাওয়া যায়নি।");
	}

	const controller = new AbortController();

	const timeout = setTimeout(
		() => controller.abort(),
		REQUEST_TIMEOUT
	);

	try {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
					"AppleWebKit/537.36 (KHTML, like Gecko) " +
					"Chrome/124.0 Safari/537.36",
				"Accept":
					"image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
			},
			signal: controller.signal,
			redirect: "follow"
		});

		if (!response.ok) {
			const error = new Error(
				`Image download failed with HTTP ${response.status}`
			);

			error.status = response.status;
			error.url = url;

			throw error;
		}

		const contentType =
			response.headers.get("content-type") || "";

		if (
			contentType &&
			!contentType.startsWith("image/")
		) {
			const error = new Error(
				"Image server returned " + contentType
			);

			error.status = response.status;
			error.url = url;

			throw error;
		}

		const buffer = Buffer.from(
			await response.arrayBuffer()
		);

		if (!buffer.length) {
			throw new Error("Downloaded image খালি।");
		}

		await sharp(buffer).metadata();

		return buffer;
	}
	catch (error) {
		if (!error.url) error.url = url;
		throw error;
	}
	finally {
		clearTimeout(timeout);
	}
}


/* =================================
   CIRCULAR AVATAR
================================= */

async function makeCircle(buffer, size) {
	const mask = Buffer.from(`
		<svg
			width="${size}"
			height="${size}"
			xmlns="http://www.w3.org/2000/svg"
		>
			<circle
				cx="${size / 2}"
				cy="${size / 2}"
				r="${size / 2}"
				fill="#ffffff"
			/>
		</svg>
	`);

	return sharp(buffer)
		.resize(size, size, {
			fit: "cover",
			position: "centre"
		})
		.composite([
			{
				input: mask,
				blend: "dest-in"
			}
		])
		.png()
		.toBuffer();
}


/* =================================
   SAFE USERNAME
================================= */

function cleanName(value) {
	return String(value || "user")
		.replace(/^@+/, "")
		.replace(/[\r\n]/g, "")
		.slice(0, 40);
}
