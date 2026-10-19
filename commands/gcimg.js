/**

* File Name: gcimg.js
* ICA: igbot-api
* Author: Tanvir Ahmed (Tanvir143)
* GitHub: www.github.com/143tanvir
* Note: Group card generated using Sharp and SVG.
  */

"use strict";

const sharp = require("sharp");
const axios = require("axios");
const { resolveProfile } = require("../src/utils");

const WIDTH = 1800;
const CACHE = new Map();
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function escapeXML(value) {
return String(value ?? "")
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function cleanName(value, max = 30) {
let name = String(value || "Unknown")
.replace(/\s+/g, " ")
.trim();

if (name.length > max) {
	name = name.slice(0, max - 1) + "…";
}

return name || "Unknown";

}

function getThreadInfo(api, threadID) {
return new Promise((resolve, reject) => {
api.getThreadInfo(threadID, (error, info) => {
if (error) return reject(error);
if (!info) {
return reject(new Error("Group information পাওয়া যায়নি।"));
}
resolve(info);
});
});
}

function getUserInfo(api, uid) {
return new Promise((resolve, reject) => {
api.getUserInfo(uid, (error, result) => {
if (error) return reject(error);
resolve(result?.[uid] || result?.[String(uid)] || {});
});
});
}

async function downloadImage(url) {
if (!url || typeof url !== "string") return null;

if (CACHE.has(url)) {
	return CACHE.get(url);
}

try {
	const response = await axios.get(url, {
		responseType: "arraybuffer",
		timeout: 15000,
		maxRedirects: 5,
		maxContentLength: MAX_IMAGE_SIZE,
		headers: {
			"User-Agent": "Mozilla/5.0",
			"Accept": "image/*"
		},
		validateStatus: status => status >= 200 && status < 300
	});

	const buffer = Buffer.from(response.data);

	if (!buffer.length || buffer.length > MAX_IMAGE_SIZE) {
		return null;
	}

	const image = await sharp(buffer)
		.rotate()
		.resize(500, 500, {
			fit: "cover",
			withoutEnlargement: true
		})
		.png()
		.toBuffer();

	if (CACHE.size >= 200) {
		CACHE.delete(CACHE.keys().next().value);
	}

	CACHE.set(url, image);
	return image;
} catch {
	return null;
}

}

async function getAvatar(api, usersData, uid) {
try {
if (typeof usersData?.getAvatarUrl === "function") {
const url = await usersData.getAvatarUrl(uid);
const image = await downloadImage(url);
if (image) return image;
}
} catch {}

try {
	const profile = await resolveProfile(
		[String(uid)],
		{
			senderID: String(uid),
			mentions: {},
			messageReply: null
		},
		api
	);

	const image = await downloadImage(
		profile?.profilePicture
	);

	if (image) return image;
} catch {}

try {
	const info = await getUserInfo(api, String(uid));

	const image = await downloadImage(
		info?.thumbSrc ||
		info?.profilePic ||
		info?.photoUrl
	);

	if (image) return image;
} catch {}

return null;

}

async function getMemberData(api, usersData, ids, adminIDs) {
return Promise.all(ids.map(async uid => {
const id = String(uid);
let name = "Unknown";

	try {
		const data = await usersData?.get(id);
		name = data?.name || data?.userName || name;
	} catch {}

	let image = await getAvatar(api, usersData, id);

	if (name === "Unknown" || !name) {
		try {
			const data = await getUserInfo(api, id);
			name = data?.name || data?.firstName || name;
		} catch {}
	}

	return {
		id,
		name: cleanName(name, 36),
		admin: adminIDs.has(id),
		image
	};
}));

}

function imageElement(image, x, y, size, clipID) {
if (!image) return "";

return `
	<image
		x="${x - size / 2}"
		y="${y - size / 2}"
		width="${size}"
		height="${size}"
		href="data:image/png;base64,${image.toString("base64")}"
		clip-path="url(#${clipID})"
		preserveAspectRatio="xMidYMid slice"
	/>
`;

}

function avatarSVG(user, x, y, radius, clipID, index) {
const size = radius * 2;
const name = escapeXML(user.name);

return `
	<defs>
		<clipPath id="${clipID}">
			<circle cx="${x}" cy="${y}" r="${radius}"/>
		</clipPath>
	</defs>

	<circle cx="${x}" cy="${y}" r="${radius + 7}"
		fill="none"
		stroke="${user.admin ? "#FFD66B" : "#7CFF6B"}"
		stroke-width="3"/>

	<circle cx="${x}" cy="${y}" r="${radius}"
		fill="#101D25"/>

	${imageElement(user.image, x, y, size, clipID)}

	${!user.image ? `
		<text x="${x}" y="${y + 10}"
			fill="#FFFFFF"
			font-size="${Math.max(18, radius * 0.8)}"
			text-anchor="middle"
			font-family="sans-serif"
			font-weight="bold">
			${escapeXML((user.name || "?").charAt(0).toUpperCase())}
		</text>
	` : ""}

	<text x="${x}" y="${y + radius + 28}"
		fill="#FFFFFF"
		font-size="${index.fontSize}"
		text-anchor="middle"
		font-family="sans-serif"
		font-weight="600">
		${name}
	</text>
`;

}

async function buildCard(api, usersData, threadID) {
const info = await getThreadInfo(api, threadID);

const ids = [
	...new Set((info.participantIDs || []).map(String))
];

if (!ids.length) {
	throw new Error("Group member পাওয়া যায়নি।");
}

const adminIDs = new Set(
	(info.adminIDs || []).map(item =>
		String(item.id || item)
	)
);

const users = await getMemberData(
	api,
	usersData,
	ids,
	adminIDs
);

const admins = users.filter(user => user.admin);
const members = users.filter(user => !user.admin);

const groupName = cleanName(
	info.threadName || info.name || "Group Chat",
	55
);

const groupImage = await downloadImage(
	info.imageSrc || info.imageUrl
);

const adminColumns = Math.max(
	1,
	Math.min(8, admins.length || 1)
);

const adminRows = Math.max(
	1,
	Math.ceil(admins.length / adminColumns)
);

const adminCellHeight = 125;
const adminHeight = 100 + adminRows * adminCellHeight;

const memberColumns =
	members.length <= 2 ? 2 :
	members.length <= 6 ? 3 :
	members.length <= 12 ? 4 :
	members.length <= 24 ? 6 :
	members.length <= 48 ? 8 :
	members.length <= 100 ? 10 : 12;

const memberRows = Math.max(
	1,
	Math.ceil(members.length / memberColumns)
);

const memberCellHeight = 175;
const memberStart = 430 + adminHeight;
const footerHeight = 110;

const height = Math.min(
	16000,
	memberStart + memberRows * memberCellHeight + footerHeight
);

const cellWidth = (WIDTH - 100) / memberColumns;
const memberRadius = Math.max(
	23,
	Math.min(55, cellWidth * 0.25)
);

const parts = [];

parts.push(`
	<svg xmlns="http://www.w3.org/2000/svg"
		width="${WIDTH}" height="${height}"
		viewBox="0 0 ${WIDTH} ${height}">

		<defs>
			<linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color="#02090B"/>
				<stop offset="50%" stop-color="#071B22"/>
				<stop offset="100%" stop-color="#10102A"/>
			</linearGradient>

			<linearGradient id="border" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color="#7CFF6B"/>
				<stop offset="50%" stop-color="#3CF4FF"/>
				<stop offset="100%" stop-color="#FFD66B"/>
			</linearGradient>

			<radialGradient id="glow">
				<stop offset="0%" stop-color="#20DDA0" stop-opacity=".28"/>
				<stop offset="100%" stop-color="#20DDA0" stop-opacity="0"/>
			</radialGradient>
		</defs>

		<rect width="${WIDTH}" height="${height}" fill="url(#background)"/>
		<circle cx="250" cy="180" r="500" fill="url(#glow)"/>
		<circle cx="1550" cy="250" r="550" fill="url(#glow)"/>

		<rect x="20" y="20" width="${WIDTH - 40}" height="${height - 40}"
			rx="35" fill="none" stroke="url(#border)" stroke-width="3"/>

		<text x="100" y="100" fill="#7CFF6B"
			font-size="22" font-family="sans-serif" font-weight="bold">
			TANVIR143 • GROUP COMMUNITY
		</text>
`);

// Group avatar
if (groupImage) {
	parts.push(`
		<defs>
			<clipPath id="groupAvatar">
				<circle cx="150" cy="225" r="72"/>
			</clipPath>
		</defs>

		<circle cx="150" cy="225" r="82"
			fill="none" stroke="#3CF4FF" stroke-width="4"/>

		${imageElement(groupImage, 150, 225, 144, "groupAvatar")}
	`);
} else {
	parts.push(`
		<circle cx="150" cy="225" r="78"
			fill="#10232B" stroke="#3CF4FF" stroke-width="4"/>

		<text x="150" y="240" text-anchor="middle"
			font-size="38" fill="#FFFFFF" font-family="sans-serif">GC</text>
	`);
}

parts.push(`
	<text x="275" y="205" fill="#FFFFFF"
		font-size="48" font-family="sans-serif" font-weight="bold">
		${escapeXML(groupName)}
	</text>

	<text x="278" y="255" fill="#7CFF6B"
		font-size="25" font-family="sans-serif">
		${users.length} MEMBERS  •  ${admins.length} ADMINS
	</text>

	<text x="278" y="295" fill="#3CF4FF"
		font-size="17" font-family="sans-serif">
		GROUP COMMUNITY
	</text>

	<rect x="65" y="335" width="${WIDTH - 130}" height="2"
		fill="#3CF4FF" opacity=".55"/>

	<text x="80" y="390" fill="#FFD66B"
		font-size="30" font-family="sans-serif" font-weight="bold">
		GROUP ADMINS • ${admins.length}
	</text>
`);

// Admin grid
for (let i = 0; i < admins.length; i++) {
	const row = Math.floor(i / adminColumns);
	const col = i % adminColumns;

	const spacing = (WIDTH - 200) / adminColumns;
	const x = 100 + spacing * (col + 0.5);
	const y = 445 + row * adminCellHeight;

	parts.push(avatarSVG(
		admins[i],
		x,
		y,
		36,
		`adminClip${i}`,
		{ fontSize: 16 }
	));
}

const memberTitleY = memberStart - 35;

parts.push(`
	<rect x="65" y="${memberTitleY - 38}"
		width="${WIDTH - 130}" height="2"
		fill="#3CF4FF" opacity=".4"/>

	<text x="80" y="${memberTitleY}"
		fill="#FFFFFF" font-size="30"
		font-family="sans-serif" font-weight="bold">
		GROUP MEMBERS • ${members.length}
	</text>
`);

// Member grid
for (let i = 0; i < members.length; i++) {
	const row = Math.floor(i / memberColumns);
	const col = i % memberColumns;

	const x = 50 + cellWidth * (col + 0.5);
	const y = memberStart + row * memberCellHeight + 55;

	const boxWidth = cellWidth - 12;

	parts.push(`
		<rect x="${x - boxWidth / 2}"
			y="${y - 52}"
			width="${boxWidth}"
			height="155"
			rx="16"
			fill="#FFFFFF" fill-opacity=".035"
			stroke="#3CF4FF" stroke-opacity=".16"/>
	`);

	parts.push(avatarSVG(
		members[i],
		x,
		y,
		memberRadius,
		`memberClip${i}`,
		{
			fontSize: members.length > 60 ? 12 :
				members.length > 25 ? 14 : 17
		}
	));
}

parts.push(`
	<rect x="65" y="${height - 80}"
		width="${WIDTH - 130}" height="1"
		fill="#3CF4FF" opacity=".35"/>

	<text x="80" y="${height - 45}"
		fill="#7CFF6B" font-size="17"
		font-family="sans-serif">
		GROUP COMMUNITY
	</text>

	<text x="${WIDTH - 80}" y="${height - 45}"
		text-anchor="end" fill="#7CFF6B"
		font-size="17" font-family="sans-serif">
		Powered By Tanvir143
	</text>
</svg>
`);

const svg = Buffer.from(parts.join("\n"));

return sharp(svg, {
	limitInputPixels: 100000000
})
	.png()
	.toBuffer();

}

module.exports = {
config: {
name: "gcimg",
aliases: ["groupimage", "groupcard", "gc"],
version: "14.0.0",
author: "Tanvir143",
countDown: 5,
role: 0,
category: "Users Cmd",
shortDescription: "Generate a group member card",
longDescription: "Shows group photo, name, admins and members.",
guide: {
en: "{pn}"
}
},

onStart: async function ({
	message,
	event,
	api,
	usersData
}) {
	try {
		const threadID = String(event.threadID);

		const card = await buildCard(
			api,
			usersData,
			threadID
		);

		return message.reply({
			body: "🖼️ Group Community Card\n\nPowered By Tanvir143",
			attachment: card
		});
	} catch (error) {
		console.error("[GCIMG ERROR]", error);

		return message.reply(
			"❌ Group card তৈরি করা যায়নি।\n\n" +
			(error.message || "Unknown error")
		);
	}
}

};
