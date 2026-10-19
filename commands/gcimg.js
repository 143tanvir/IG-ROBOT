/**

* File Name: gcimg.js
* ICA: igbot-api
* Author: Tanvir Ahmed (Tanvir143)
* GitHub: www.github.com/143tanvir
* WhatsApp: +8801750079773
* Note: Project metadata only; original source credits and license notices are retained.
  */

"use strict";

const sharp = require("sharp");
const fontkit = require("fontkit");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const W = 1800;
const H = 1150;
const CACHE = path.join(__dirname, "cache");

fs.ensureDirSync(CACHE);

const REGULAR_FONT = fontkit.openSync(
require.resolve("@fontsource/roboto/files/roboto-latin-400-normal.woff")
);

const BOLD_FONT = fontkit.openSync(
require.resolve("@fontsource/roboto/files/roboto-latin-700-normal.woff")
);

const imageCache = new Map();
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

async function getImage(url) {
if (!url) return null;

const key = String(url);

if (imageCache.has(key)) {
	return imageCache.get(key);
}

const promise = (async () => {
	try {
		const response = await axios.get(key, {
			responseType: "arraybuffer",
			timeout: 15000,
			headers: {
				"User-Agent": "Mozilla/5.0",
				"Accept": "image/*"
			},
			maxContentLength: MAX_IMAGE_SIZE,
			maxBodyLength: MAX_IMAGE_SIZE
		});

		const buffer = Buffer.from(response.data);

		if (!buffer.length || buffer.length > MAX_IMAGE_SIZE) {
			return null;
		}

		return await sharp(buffer, {
			failOn: "none",
			limitInputPixels: 40000000
		})
			.rotate()
			.resize(600, 600, {
				fit: "inside",
				withoutEnlargement: true
			})
			.png()
			.toBuffer();
	} catch (error) {
		return null;
	}
})();

imageCache.set(key, promise);

const result = await promise;

if (!result) {
	imageCache.delete(key);
}

return result;

}

function escapeXML(value) {
return String(value ?? "")
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function textWidth(value, size, bold = false) {
const font = bold ? BOLD_FONT : REGULAR_FONT;
const run = font.layout(String(value));
const scale = size / font.unitsPerEm;

return run.positions.reduce(
	(total, position) => total + position.xAdvance * scale,
	0
);

}

function makeText(
value,
centerX,
baselineY,
fontSize,
fill = "#FFFFFF",
bold = false,
align = "center"
) {
const font = bold ? BOLD_FONT : REGULAR_FONT;
const run = font.layout(String(value));
const scale = fontSize / font.unitsPerEm;

const width = run.positions.reduce(
	(total, position) => total + position.xAdvance * scale,
	0
);

let cursorX = align === "left"
	? centerX
	: align === "right"
		? centerX - width
		: centerX - width / 2;

const paths = [];

for (let i = 0; i < run.glyphs.length; i++) {
	const glyph = run.glyphs[i];
	const position = run.positions[i];

	if (glyph && glyph.path) {
		const pathData = glyph.path.toSVG();

		if (pathData) {
			paths.push(
				`<path d="${pathData}" fill="${fill}" transform="translate(${cursorX.toFixed(2)},${baselineY}) scale(${scale},${-scale})"/>`
			);
		}
	}

	cursorX += position.xAdvance * scale;
}

return paths.join("");

}

function fitText(value, maxWidth, maxSize, minSize = 8) {
let result = String(value || "Unknown")
.trim()
.replace(/\s+/g, " ");

for (let size = maxSize; size >= minSize; size--) {
	if (textWidth(result, size, true) <= maxWidth) {
		return {
			text: result,
			size
		};
	}
}

let output = "";

for (const char of result) {
	if (
		textWidth(output + char + "...", minSize, true) > maxWidth
	) {
		break;
	}

	output += char;
}

return {
	text: output + (output.length < result.length ? "..." : ""),
	size: minSize
};

}

function fittedText(
value,
x,
y,
maxWidth,
maxSize,
minSize = 8,
fill = "#FFFFFF",
bold = true,
align = "center"
) {
const fitted = fitText(value, maxWidth, maxSize, minSize);

return makeText(
	fitted.text,
	x,
	y,
	fitted.size,
	fill,
	bold,
	align
);

}

function imageElement(buffer, x, y, size, clipId) {
if (!buffer) {
return "<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="#111A1D"/> ${makeText( "?", x + size / 2, y + size * 0.67, size * 0.48, "#FFFFFF", true )}";
}

const data = buffer.toString("base64");

return `
	<image
		x="${x}" y="${y}"
		width="${size}" height="${size}"
		href="data:image/png;base64,${data}"
		clip-path="url(#${clipId})"
		preserveAspectRatio="xMidYMid slice"
	/>
`;

}

function circleAvatar(buffer, cx, cy, radius, clipId, ringColor) {
return "<circle cx="${cx}" cy="${cy}" r="${radius + 5}" fill="none" stroke="${ringColor}" stroke-width="3"/> <clipPath id="${clipId}"> <circle cx="${cx}" cy="${cy}" r="${radius}"/> </clipPath> ${imageElement( buffer, cx - radius, cy - radius, radius * 2, clipId )}";
}

function roundRect(x, y, w, h, r, fill, stroke = "none", width = 1) {
return "<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>";
}

function callbackCall(api, method, args) {
return new Promise((resolve, reject) => {
let settled = false;

	const done = (error, result) => {
		if (settled) return;
		settled = true;

		if (error) return reject(error);

		resolve(result);
	};

	try {
		const returned = api[method](...args, done);

		if (returned && typeof returned.then === "function") {
			returned.then(
				result => {
					if (!settled) {
						settled = true;
						resolve(result);
					}
				},
				error => {
					if (!settled) {
						settled = true;
						reject(error);
					}
				}
			);
		} else if (
			returned &&
			typeof returned === "object" &&
			!settled
		) {
			settled = true;
			resolve(returned);
		}
	} catch (error) {
		if (!settled) {
			settled = true;
			reject(error);
		}
	}
});

}

async function userImage(api, usersData, uid) {
try {
if (usersData && typeof usersData.getAvatarUrl === "function") {
const url = await usersData.getAvatarUrl(String(uid));
const image = await getImage(url);

		if (image) return image;
	}
} catch (error) {}

try {
	const data = await callbackCall(
		api,
		"getUserInfo",
		[String(uid)]
	);

	const user = data?.[uid];
	const image = await getImage(
		user?.thumbSrc || user?.profileUrl || user?.avatarUrl
	);

	if (image) return image;
} catch (error) {}

return null;

}

async function getMemberName(api, usersData, uid) {
try {
const data = usersData && typeof usersData.get === "function"
? await usersData.get(String(uid))
: null;

	if (data?.name) {
		return String(data.name).trim() || "Unknown";
	}
} catch (error) {}

try {
	const info = await callbackCall(
		api,
		"getUserInfo",
		[String(uid)]
	);

	return String(info?.[uid]?.name || "Unknown").trim() || "Unknown";
} catch (error) {
	return "Unknown";
}

}

async function buildCard(api, usersData, threadID) {
const info = await callbackCall(
api,
"getThreadInfo",
[String(threadID)]
);

if (!info) {
	throw new Error("Group information পাওয়া যায়নি।");
}

const ids = [...new Set(
	(info.participantIDs || []).map(String).filter(Boolean)
)];

const adminIDs = new Set(
	(info.adminIDs || []).map(item =>
		String(item.id || item)
	)
);

const users = await Promise.all(
	ids.map(async id => ({
		id,
		name: await getMemberName(api, usersData, id),
		admin: adminIDs.has(id)
	}))
);

const admins = users.filter(user => user.admin);
const members = users.filter(user => !user.admin);

const groupImage = await getImage(
	info.imageSrc || info.imageUrl
);

const [adminImages, memberImages] = await Promise.all([
	Promise.all(admins.map(user =>
		userImage(api, usersData, user.id)
	)),
	Promise.all(members.map(user =>
		userImage(api, usersData, user.id)
	))
]);

const G = "#7CFF6B";
const CY = "#3CF4FF";
const GD = "#FFD66B";
const WH = "#FFFFFF";

const parts = [];

parts.push(`
	<svg xmlns="http://www.w3.org/2000/svg"
		width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
		<defs>
			<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color="#02090B"/>
				<stop offset="45%" stop-color="#041719"/>
				<stop offset="100%" stop-color="#071128"/>
			</linearGradient>

			<radialGradient id="greenGlow">
				<stop offset="0%" stop-color="#18E68A" stop-opacity=".22"/>
				<stop offset="100%" stop-color="#18E68A" stop-opacity="0"/>
			</radialGradient>

			<radialGradient id="cyanGlow">
				<stop offset="0%" stop-color="#3CF4FF" stop-opacity=".18"/>
				<stop offset="100%" stop-color="#3CF4FF" stop-opacity="0"/>
			</radialGradient>

			<filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
				<feGaussianBlur stdDeviation="12" result="blur"/>
				<feMerge>
					<feMergeNode in="blur"/>
					<feMergeNode in="SourceGraphic"/>
				</feMerge>
			</filter>

			<clipPath id="groupClip">
				<circle cx="155" cy="150" r="80"/>
			</clipPath>
		</defs>

		<rect width="${W}" height="${H}" fill="url(#bg)"/>
		<circle cx="280" cy="180" r="700" fill="url(#greenGlow)"/>
		<circle cx="1550" cy="230" r="650" fill="url(#cyanGlow)"/>

		${roundRect(18, 18, W - 36, H - 36, 34, "none", "rgba(60,244,255,.65)", 3)}
		${roundRect(28, 28, W - 56, H - 56, 28, "none", "rgba(255,214,107,.25)", 1)}

		<circle cx="155" cy="150" r="94"
			fill="none" stroke="${G}" stroke-width="5"
			filter="url(#glow)"/>
		<circle cx="155" cy="150" r="98"
			fill="none" stroke="${CY}" stroke-width="2"/>

		${groupImage
			? `<image x="75" y="70" width="160" height="160"
				href="data:image/png;base64,${groupImage.toString("base64")}"
				clip-path="url(#groupClip)" preserveAspectRatio="xMidYMid slice"/>`
			: `<circle cx="155" cy="150" r="80" fill="#111A1D"/>
				${makeText("G", 155, 169, 48, WH, true)}`}

		${fittedText(info.threadName || "Group Chat", 280, 135, 600, 46, 28, WH, true, "left")}

		${makeText(
			`${users.length} MEMBERS  •  ${admins.length} ADMINS`,
			280, 178, 21, G, true, "left"
		)}

		${makeText("GROUP COMMUNITY", 280, 211, 13, CY, true, "left")}
`);

/* ADMIN PANEL */

const px = 900;
const py = 50;
const pw = 820;
const ph = 255;

parts.push(`
	${roundRect(px, py, pw, ph, 28, "rgba(255,255,255,.035)", "rgba(255,214,107,.34)", 2)}
	${makeText(`ADMIN  •  ${admins.length}`, px + pw / 2, py + 38, 25, GD, true)}
`);

if (admins.length) {
	const cols = admins.length <= 3 ? admins.length : 6;
	const rows = Math.ceil(admins.length / cols);
	const top = py + 62;
	const bottom = py + ph - 10;
	const rowH = (bottom - top) / rows;
	const gapX = Math.min(175, (pw - 70) / cols);
	const startX = px + pw / 2 - (cols - 1) * gapX / 2;

	for (let i = 0; i < admins.length; i++) {
		const user = admins[i];
		const col = i % cols;
		const row = Math.floor(i / cols);
		const x = startX + col * gapX;
		const y = top + row * rowH + rowH / 2;

		let r = admins.length <= 3
			? 52
			: admins.length <= 6
				? 42
				: admins.length <= 12
					? 31
					: 24;

		r = Math.max(18, Math.min(r, rowH * .30, gapX * .30));

		parts.push(`
			<circle cx="${x}" cy="${y}" r="${r + 4}"
				fill="none" stroke="${GD}" stroke-width="3"
				filter="url(#glow)"/>
			<clipPath id="adminClip${i}">
				<circle cx="${x}" cy="${y}" r="${r}"/>
			</clipPath>
			${imageElement(
				adminImages[i],
				x - r,
				y - r,
				r * 2,
				`adminClip${i}`
			)}
			${fittedText(
				user.name,
				x,
				y + r + 19,
				Math.max(55, gapX - 8),
				r >= 45 ? 14 : r >= 35 ? 13 : r >= 27 ? 11 : 9,
				7,
				WH
			)}
		`);
	}
}

parts.push(`
	<path d="M75 320 H1725" stroke="rgba(60,244,255,.55)"
		stroke-width="2" filter="url(#glow)"/>

	${makeText(
		`GROUP MEMBERS  •  ${members.length}`,
		85, 370, 25, WH, true, "left"
	)}

	${makeText(
		"COMMUNITY MEMBERS",
		W - 85, 370, 13, "rgba(124,255,107,.65)", true, "right"
	)}
`);

/* DYNAMIC MEMBER GRID */

const n = members.length;

const cols = n <= 1 ? 1
	: n <= 2 ? 2
	: n <= 5 ? n
	: n <= 10 ? 5
	: n <= 18 ? 6
	: n <= 32 ? 8
	: n <= 50 ? 10
	: 12;

const rows = Math.max(1, Math.ceil(Math.max(n, 1) / cols));

const gl = 70;
const gr = W - 70;
const gt = 420;
const gb = 1010;

const cw = (gr - gl) / cols;
const ch = (gb - gt) / rows;

for (let i = 0; i < n; i++) {
	const user = members[i];
	const col = i % cols;
	const row = Math.floor(i / cols);

	const x = gl + cw * col + cw / 2;
	const y = gt + ch * row + ch / 2;

	let r = n <= 1 ? 92
		: n <= 2 ? 82
		: n <= 5 ? 62
		: n <= 10 ? 54
		: n <= 18 ? 46
		: n <= 32 ? 38
		: n <= 50 ? 31
		: 25;

	r = Math.max(17, Math.min(r, ch * .31, cw * .22));

	const tw = Math.max(70, cw - (n <= 10 ? 18 : 12));
	const th = Math.max(78, ch - (n <= 10 ? 14 : 10));

	parts.push(`
		${roundRect(
			x - tw / 2,
			y - th / 2,
			tw,
			th,
			18,
			"rgba(255,255,255,.030)",
			"rgba(60,244,255,.14)",
			1.2
		)}

		<circle cx="${x}" cy="${y - 8}" r="${r + 4}"
			fill="none" stroke="${G}"
			stroke-width="${n <= 10 ? 3 : 2.5}"
			filter="url(#glow)"/>

		<clipPath id="memberClip${i}">
			<circle cx="${x}" cy="${y - 8}" r="${r}"/>
		</clipPath>

		${imageElement(
			memberImages[i],
			x - r,
			y - 8 - r,
			r * 2,
			`memberClip${i}`
		)}

		${fittedText(
			user.name,
			x,
			y + r + 21,
			Math.max(50, tw - 18),
			Math.min(
				n <= 1 ? 25
					: n <= 2 ? 23
					: n <= 5 ? 20
					: n <= 10 ? 18
					: n <= 18 ? 16
					: n <= 32 ? 14
					: n <= 50 ? 12
					: 11,
				Math.max(9, ch * .14)
			),
			8,
			WH
		)}
	`);
}

parts.push(`
	<path d="M75 1060 H1725"
		stroke="rgba(60,244,255,.18)" stroke-width="1"/>

	${makeText(
		"GROUP COMMUNITY",
		80, 1087, 12, "rgba(124,255,107,.58)", true, "left"
	)}

	${makeText(
		"Powered By Tanvir143",
		W - 80, 1087, 12, "rgba(124,255,107,.58)", true, "right"
	)}

	</svg>
`);

return sharp(Buffer.from(parts.join("\n")))
	.png()
	.toBuffer();

}

module.exports = {
config: {
name: "gcimg",
aliases: ["groupimage", "groupcard", "gc"],
version: "14.0.0",
author: "Tanvir143",
cooldown: 5,
role: 0,
category: "Users cmd",
shortDescription: "Dynamic group card made by Tanvir143",
longDescription: "Shows group DP, name, admins and members with dynamic sizing.",
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
	let file;

	try {
		const threadID = String(event.threadID);

		const buffer = await buildCard(
			api,
			usersData,
			threadID
		);

		file = path.join(
			CACHE,
			`gcimg_${threadID}_${Date.now()}.png`
		);

		await fs.writeFile(file, buffer);

		return await message.reply(
			{
				attachment: fs.createReadStream(file)
			},
			() => {
				setTimeout(() => {
					fs.remove(file).catch(() => {});
				}, 30000);
			}
		);
	} catch (error) {
		console.error("[GCIMG ERROR]", error);

		if (file) {
			fs.remove(file).catch(() => {});
		}

		return message.reply(
			"❌ Group card তৈরি করা যায়নি। আবার চেষ্টা করুন।"
		);
	}
}

};
