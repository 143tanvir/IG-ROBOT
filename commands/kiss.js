/**
 * File Name: kiss.js
 * ICA: igbot-api
 * Auhor: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

const sharp = require("sharp");
const fontkit = require("fontkit");
const fs = require("fs");
const path = require("path");

const {
	resolveUserTarget,
	resolveProfile
} = require("../src/utils");

const REGULAR_FONT = fontkit.openSync(
	require.resolve(
		"@fontsource/roboto/files/roboto-latin-400-normal.woff"
	)
);

const BOLD_FONT = fontkit.openSync(
	require.resolve(
		"@fontsource/roboto/files/roboto-latin-700-normal.woff"
	)
);

module.exports = {
	config: {
		name: "kiss",
		aliases: ["kissing"],
		author: "Tanvir143",
		category: "Users Cmd",
		helpText: "Kiss Image Gen",
		cooldown: 5,
		role: 0,
		description: {
			en: "Create a kiss image"
		},
		usage: {
			en:
				".kiss @user | reply + .kiss | .kiss @user1 @user2"
		}
	},

	onStart: async function ({
		message,
		args,
		event,
		api
	}) {
		try {
			const senderID = String(event.senderID);

			let id1;
			let id2;

			/*
			 * =================================
			 * 1. REPLY + KISS
			 * =================================
			 */
			if (
				event.messageReply &&
				event.messageReply.senderID
			) {
				id1 = senderID;
				id2 = String(event.messageReply.senderID);

				if (id1 === id2) {
					return message.reply(
						"😂 | Nijer sathe kiss kora jabe na!"
					);
				}
			}

			/*
			 * =================================
			 * 2. TWO MENTIONS (.kiss @user1 @user2)
			 * =================================
			 */
			else if (args && args.length >= 2) {
				const foundIDs = [];

				if (event.mentions) {
					const mentionIDs = Object.keys(event.mentions);
					for (const id of mentionIDs) {
						const cleanID = String(id);
						if (cleanID && !foundIDs.includes(cleanID)) {
							foundIDs.push(cleanID);
						}
					}
				}

				for (const arg of args) {
					if (!arg) continue;

					try {
						const target = await resolveUserTarget([arg], event, api);
						if (target && target.id) {
							const targetID = String(target.id);
							if (!foundIDs.includes(targetID)) {
								foundIDs.push(targetID);
							}
						}
					} catch (error) {
						console.error("[KISS TARGET ERROR]", arg, error);
					}

					if (foundIDs.length >= 2) break;
				}

				if (foundIDs.length < 2) {
					return message.reply(
						"❌ | Dujon user thikbhabe pawa jayni.\n\n" +
						"Example:\n" +
						".kiss @user1 @user2"
					);
				}

				id1 = foundIDs[0];
				id2 = foundIDs[1];

				if (String(id1) === String(id2)) {
					return message.reply(
						"😂 | Ekoi user-er sathe kiss kora jabe na!"
					);
				}
			}

			/*
			 * =================================
			 * 3. ONE TARGET (.kiss @user)
			 * =================================
			 */
			else if (args && args.length === 1) {
				const target = await resolveUserTarget(args, event, api);

				if (!target || !target.id) {
					return message.reply(
						"❌ | User pawa jayni.\n\n" +
						"Example:\n" +
						".kiss @user"
					);
				}

				id1 = senderID;
				id2 = String(target.id);

				if (id1 === id2) {
					return message.reply(
						"😂 | Nijer sathe kiss kora jabe na!"
					);
				}
			}

			/*
			 * =================================
			 * 4. JUST .KISS (SHOW USAGE ONLY)
			 * =================================
			 */
			else {
				return message.reply(
					"⚠️ | Command-ti thikbhabe bebohar korun:\n\n" +
					"1️⃣ Reply kore: Msg reply-te `.kiss`\n" +
					"2️⃣ Single tag: `.kiss @user`\n" +
					"3️⃣ Double tag: `.kiss @user1 @user2`"
				);
			}

			/*
			 * =================================
			 * FINAL VALIDATION
			 * =================================
			 */
			if (!id1 || !id2 || String(id1) === String(id2)) {
				return message.reply("❌ | Kiss pair tairi kora jayni.");
			}

			/*
			 * =================================
			 * LOAD PROFILES
			 * =================================
			 */
			const [profile1, profile2] = await Promise.all([
				getProfile(id1, event, api),
				getProfile(id2, event, api)
			]);

			if (!profile1 || !profile2) {
				return message.reply("❌ | Profile load kora jayni.");
			}

			const pic1 = profile1.profilePicture;
			const pic2 = profile2.profilePicture;

			if (!pic1 || !pic2) {
				return message.reply("❌ | Profile picture pawa jayni.");
			}

			const username1 = cleanUsername(profile1.username || id1);
			const username2 = cleanUsername(profile2.username || id2);

			/*
			 * =================================
			 * CREATE IMAGE
			 * =================================
			 */
			const image = await createKissCard({
				pic1,
				pic2,
				username1,
				username2
			});

			/*
			 * =================================
			 * TEMP FILE
			 * =================================
			 */
			const tmpDir = path.join(__dirname, "tmp");
			if (!fs.existsSync(tmpDir)) {
				fs.mkdirSync(tmpDir, { recursive: true });
			}

			const filePath = path.join(
				tmpDir,
				`${id1}_${id2}_kiss_${Date.now()}.png`
			);

			fs.writeFileSync(filePath, image);

			/*
			 * =================================
			 * SEND
			 * =================================
			 */
			return message.reply(
				{
					body: `😘 Kiss Time!\n@${username1} ❤️ @${username2}`,
					attachment: fs.createReadStream(filePath)
				},
				() => {
					try {
						if (fs.existsSync(filePath)) {
							fs.unlinkSync(filePath);
						}
					} catch (error) {
						console.error("[KISS CLEANUP ERROR]", error);
					}
				}
			);
		} catch (error) {
			console.error("[KISS ERROR]", error);

			return message.reply(
				"❌ | Kiss failed.\n\n" + (error.message || "Unknown error")
			);
		}
	}
};

/* =================================
   GET PROFILE
================================= */
async function getProfile(id, event, api) {
	try {
		const fakeEvent = {
			...event,
			senderID: String(id),
			messageReply: null,
			mentions: {}
		};

		return await resolveProfile([String(id)], fakeEvent, api);
	} catch (error) {
		console.error("[PROFILE ERROR]", id, error);
		return null;
	}
}

/* =================================
   CREATE KISS CARD
================================= */
async function createKissCard({ pic1, pic2, username1, username2 }) {
	const WIDTH = 1080;
	const HEIGHT = 720;

	const image1 = await downloadImage(pic1);
	const image2 = await downloadImage(pic2);

	const avatarSize = 280;

	const avatar1 = await makeCircle(image1, avatarSize);
	const avatar2 = await makeCircle(image2, avatarSize);

	// Fontkit layout using Spacing-Adjusted Path Generator
	const textSVG = `
		${makeText("Tanvir143 IgBot", 540, 80, 34, "#FFFFFF", true, "center", 1)}

		${makeFittedText(`@${username1} Kissed`, 540, 525, 800, 40, 22, "#FFFFFF", true, 1.5)}

		${makeFittedText(`@${username2} Er Lips`, 510, 585, 750, 38, 20, "#F8BBD0", true, 1.5)}
	`;

	const svg = `
	<svg
		width="${WIDTH}"
		height="${HEIGHT}"
		xmlns="http://www.w3.org/2000/svg"
		xmlns:xlink="http://www.w3.org/1999/xlink"
	>
		<defs>
			<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color="#080414" />
				<stop offset="45%" stop-color="#250820" />
				<stop offset="100%" stop-color="#05030D" />
			</linearGradient>

			<radialGradient id="pinkGlow">
				<stop offset="0%" stop-color="#FF2D9B" stop-opacity="0.45" />
				<stop offset="100%" stop-color="#FF2D9B" stop-opacity="0" />
			</radialGradient>

			<radialGradient id="purpleGlow">
				<stop offset="0%" stop-color="#A45CFF" stop-opacity="0.35" />
				<stop offset="100%" stop-color="#A45CFF" stop-opacity="0" />
			</radialGradient>

			<linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color="#FF4DA6" />
				<stop offset="100%" stop-color="#A86CFF" />
			</linearGradient>

			<clipPath id="clip1">
				<circle cx="285" cy="250" r="140" />
			</clipPath>

			<clipPath id="clip2">
				<circle cx="795" cy="250" r="140" />
			</clipPath>
		</defs>

		<!-- Background -->
		<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />

		<circle cx="130" cy="100" r="310" fill="url(#pinkGlow)" />
		<circle cx="950" cy="120" r="320" fill="url(#purpleGlow)" />

		<!-- Main Card Box -->
		<rect
			x="40"
			y="30"
			width="1000"
			height="660"
			rx="30"
			fill="#FFFFFF"
			fill-opacity="0.03"
			stroke="#FFFFFF"
			stroke-opacity="0.15"
			stroke-width="1.5"
		/>

		<!-- Avatar Glow & Rings -->
		<circle cx="285" cy="250" r="148" fill="none" stroke="#FF3DAE" stroke-width="10" opacity="0.30" />
		<circle cx="795" cy="250" r="148" fill="none" stroke="#A86CFF" stroke-width="10" opacity="0.30" />

		<circle cx="285" cy="250" r="144" fill="none" stroke="url(#ringGradient)" stroke-width="5" />
		<circle cx="795" cy="250" r="144" fill="none" stroke="url(#ringGradient)" stroke-width="5" />

		<!-- Avatar Images -->
		<image
			x="145"
			y="110"
			width="${avatarSize}"
			height="${avatarSize}"
			href="data:image/jpeg;base64,${avatar1.toString("base64")}"
			xlink:href="data:image/jpeg;base64,${avatar1.toString("base64")}"
			clip-path="url(#clip1)"
			preserveAspectRatio="xMidYMid slice"
		/>

		<image
			x="655"
			y="110"
			width="${avatarSize}"
			height="${avatarSize}"
			href="data:image/jpeg;base64,${avatar2.toString("base64")}"
			xlink:href="data:image/jpeg;base64,${avatar2.toString("base64")}"
			clip-path="url(#clip2)"
			preserveAspectRatio="xMidYMid slice"
		/>

		<!-- Center Connection Line -->
		<line
			x1="440"
			y1="250"
			x2="640"
			y2="250"
			stroke="#FFFFFF"
			stroke-opacity="0.25"
			stroke-width="2"
			stroke-dasharray="6 8"
		/>

		<!-- Big Vector Love / Heart Icon in the Middle -->
		<g transform="translate(540, 250)">
			<path
				d="M 0 25 C -10 14 -38 -2 -38 -22 C -38 -36 -23 -44 -10 -37 C -5 -34 0 -28 0 -22 C 0 -28 5 -34 10 -37 C 23 -44 38 -36 38 -22 C 38 -2 10 14 0 25 Z"
				fill="#FF2D9B"
			/>
		</g>

		<!-- Bottom Text Box Area -->
		<rect
			x="120"
			y="460"
			width="840"
			height="180"
			rx="24"
			fill="#000000"
			fill-opacity="0.35"
			stroke="#FFFFFF"
			stroke-opacity="0.12"
			stroke-width="1"
		/>

		<!-- Vector Love / Heart Icon beside Line 2 -->
		<g transform="translate(745, 575) scale(0.65)">
			<path
				d="M 0 25 C -10 14 -38 -2 -38 -22 C -38 -36 -23 -44 -10 -37 C -5 -34 0 -28 0 -22 C 0 -28 5 -34 10 -37 C 23 -44 38 -36 38 -22 C 38 -2 10 14 0 25 Z"
				fill="#FF4081"
			/>
		</g>

		${textSVG}

	</svg>
	`;

	return sharp(Buffer.from(svg)).png().toBuffer();
}

/* =================================
   FONTKIT FITTED TEXT WITH SPACING
================================= */
function makeFittedText(
	text,
	centerX,
	baselineY,
	maxWidth,
	maxSize,
	minSize,
	fill,
	bold = false,
	letterSpacing = 1
) {
	let size = maxSize;

	while (size > minSize) {
		const width = getTextWidth(text, size, bold, letterSpacing);

		if (width <= maxWidth) {
			break;
		}

		size--;
	}

	return makeText(text, centerX, baselineY, size, fill, bold, "center", letterSpacing);
}

/* =================================
   FONTKIT MAKE TEXT WITH LETTER SPACING
================================= */
function makeText(
	text,
	centerX,
	baselineY,
	fontSize,
	fill,
	bold = false,
	align = "center",
	letterSpacing = 1
) {
	const font = bold ? BOLD_FONT : REGULAR_FONT;
	const run = font.layout(String(text));
	const scale = fontSize / font.unitsPerEm;

	let width = 0;
	for (let i = 0; i < run.positions.length; i++) {
		width += run.positions[i].xAdvance * scale + letterSpacing;
	}

	let x;
	if (align === "right") {
		x = centerX - width;
	} else {
		x = centerX - width / 2;
	}

	const paths = [];
	let cursorX = x;

	for (let i = 0; i < run.glyphs.length; i++) {
		const glyph = run.glyphs[i];
		const position = run.positions[i];

		if (glyph && glyph.path) {
			const path = glyph.path.toSVG();

			paths.push(`
				<g
					transform="
						translate(${cursorX},${baselineY})
						scale(${scale},${-scale})
					"
				>
					<path
						d="${path}"
						fill="${fill}"
					/>
				</g>
			`);
		}

		cursorX += position.xAdvance * scale + letterSpacing;
	}

	return paths.join("\n");
}

/* =================================
   TEXT WIDTH CALCULATION
================================= */
function getTextWidth(text, fontSize, bold = false, letterSpacing = 1) {
	const font = bold ? BOLD_FONT : REGULAR_FONT;
	const run = font.layout(String(text));
	const scale = fontSize / font.unitsPerEm;

	let width = 0;
	for (let i = 0; i < run.positions.length; i++) {
		width += run.positions[i].xAdvance * scale + letterSpacing;
	}

	return width;
}

/* =================================
   CIRCLE IMAGE
================================= */
async function makeCircle(buffer, size) {
	return sharp(buffer)
		.resize(size, size, {
			fit: "cover",
			position: "centre"
		})
		.jpeg({ quality: 90 })
		.toBuffer();
}

/* =================================
   DOWNLOAD IMAGE
================================= */
async function downloadImage(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Image download failed: ${response.status}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

/* =================================
   CLEAN USERNAME
================================= */
function cleanUsername(value) {
	let username = String(value || "")
		.trim()
		.replace(/^@+/, "")
		.replace(/\s+/g, "");

	if (!username) {
		return "unknown";
	}

	if (username.length > 20) {
		username = username.slice(0, 17) + "...";
	}

	return username;
}
