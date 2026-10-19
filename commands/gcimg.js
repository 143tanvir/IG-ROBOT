/**

* File Name: gcimg.js
* ICA: igbot-api
* Author: Tanvir Ahmed (Tanvir143)
* GitHub: www.github.com/143tanvir
  */

"use strict";

const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const WIDTH = 1600;
const HEIGHT = 1150;
const MAX_MEMBERS = 30;
const CACHE_DIR = path.join(__dirname, "../cache");

fs.ensureDirSync(CACHE_DIR);

function escapeXML(value = "") {
return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, "&quot;")
.replace(/'/g, "'");
}

function roundRect(x, y, w, h, r, fill, stroke = "none", sw = 1) {
return "<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>";
}

function getThreadInfo(api, threadID) {
return new Promise((resolve, reject) => {
let settled = false;

    const done = (err, data) => {
        if (settled) return;
        settled = true;

        if (err) reject(err);
        else resolve(data);
    };

    try {
        const result = api.getThreadInfo(threadID, done);

        if (result && typeof result.then === "function") {
            result.then(data => done(null, data)).catch(done);
        } else if (result && typeof result === "object") {
            done(null, result);
        }
    } catch (error) {
        done(error);
    }
});

}

function normalizeAdminIDs(adminIDs) {
if (!Array.isArray(adminIDs)) return [];

return adminIDs.map(item => {
    if (item && typeof item === "object") {
        return String(item.id || item.userID || item.uid || "");
    }

    return String(item);
}).filter(Boolean);

}

function getGroupImageURL(info) {
return info.imageSrc ||
info.imageUrl ||
info.threadImage ||
info.photo ||
null;
}

async function downloadBuffer(url, timeout = 12000) {
if (!url || typeof url !== "string") return null;

try {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout,
        maxContentLength: 10 * 1024 * 1024,
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    return Buffer.from(response.data);
} catch {
    return null;
}

}

async function prepareAvatar(url, size = 140) {
const buffer = await downloadBuffer(url);
if (!buffer) return null;

try {
    return await sharp(buffer)
        .rotate()
        .resize(size, size, {
            fit: "cover",
            position: "centre"
        })
        .png()
        .toBuffer();
} catch {
    return null;
}

}

async function getUserAvatar(api, usersData, userID, userInfo = {}) {
const possibleURLs = [
userInfo.thumbSrc,
userInfo.profilePicUrl,
userInfo.avatar,
userInfo.image
];

try {
    if (usersData && typeof usersData.getAvatarUrl === "function") {
        const url = await usersData.getAvatarUrl(userID);
        const image = await prepareAvatar(url);
        if (image) return image;
    }
} catch {}

for (const url of possibleURLs) {
    const image = await prepareAvatar(url);
    if (image) return image;
}

try {
    if (api && typeof api.getUserInfo === "function") {
        const info = await new Promise((resolve, reject) => {
            let settled = false;

            const done = (err, data) => {
                if (settled) return;
                settled = true;

                if (err) reject(err);
                else resolve(data);
            };

            const result = api.getUserInfo(userID, done);

            if (result && typeof result.then === "function") {
                result.then(data => done(null, data)).catch(done);
            } else if (result && typeof result === "object") {
                done(null, result);
            }
        });

        const user = info && (info[userID] || info);
        const url = user && (
            user.thumbSrc ||
            user.profilePicUrl ||
            user.avatar
        );

        const image = await prepareAvatar(url);
        if (image) return image;
    }
} catch {}

return null;

}

function fallbackAvatar(size) {
return Buffer.from("<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"> <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#e2e8f0"/> <circle cx="${size / 2}" cy="${size * 0.35}" r="${size * 0.19}" fill="#ffffff"/> <ellipse cx="${size / 2}" cy="${size * 0.78}" rx="${size * 0.31}" ry="${size * 0.25}" fill="#ffffff"/> </svg>");
}

async function circleAvatar(buffer, size) {
const resized = await sharp(buffer)
.resize(size, size, {
fit: "cover"
})
.png()
.toBuffer();

const mask = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}"
                r="${size / 2}" fill="#ffffff"/>
    </svg>
`);

return sharp(resized)
    .composite([
        {
            input: mask,
            blend: "dest-in"
        }
    ])
    .png()
    .toBuffer();

}

async function createGroupCard(threadInfo, api, usersData) {
const threadName = String(
threadInfo.threadName || "Instagram Group"
);

const participantIDs = Array.isArray(threadInfo.participantIDs)
    ? [...new Set(threadInfo.participantIDs.map(String))]
    : [];

const adminIDs = normalizeAdminIDs(threadInfo.adminIDs);

const userInfoList = Array.isArray(threadInfo.userInfo)
    ? threadInfo.userInfo
    : [];

const members = participantIDs.slice(0, MAX_MEMBERS).map(id => {
    const info = userInfoList.find(item =>
        String(item.id || item.userID || item.uid) === id
    ) || {};

    return {
        id,
        info,
        isAdmin: adminIDs.includes(id)
    };
});

const memberCount = participantIDs.length;
const adminCount = adminIDs.length;

const groupAvatarSize = 140;
const avatarSize = 88;
const columns = 6;
const cellW = 205;
const cellH = 122;
const gapX = 24;
const gapY = 16;
const gridStartY = 320;

const gridWidth =
    columns * cellW + (columns - 1) * gapX;

const startX = (WIDTH - gridWidth) / 2;

const safeGroupName = threadName.length > 34
    ? threadName.slice(0, 31) + "..."
    : threadName;

const svg = [];

svg.push(`
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${WIDTH}" height="${HEIGHT}"
         viewBox="0 0 ${WIDTH} ${HEIGHT}">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0b1220"/>
                <stop offset="55%" stop-color="#111c35"/>
                <stop offset="100%" stop-color="#082f49"/>
            </linearGradient>

            <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#2dd4bf"/>
                <stop offset="100%" stop-color="#a3e635"/>
            </linearGradient>

            <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#152238"/>
                <stop offset="100%" stop-color="#0f172a"/>
            </linearGradient>
        </defs>

        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

        <circle cx="1480" cy="40" r="300"
                fill="#22d3ee" opacity="0.06"/>

        <circle cx="40" cy="1110" r="270"
                fill="#a3e635" opacity="0.05"/>

        ${roundRect(
            35, 35, WIDTH - 70, HEIGHT - 70,
            42, "#0d1526", "#263449", 2
        )}

        ${roundRect(
            70, 70, WIDTH - 140, 9,
            5, "url(#accent)"
        )}

        ${roundRect(
            75, 105, 1450, 170,
            28, "#111c30", "#29384e", 2
        )}

        <text x="280" y="182"
              fill="#ffffff"
              font-family="Arial, Helvetica, sans-serif"
              font-size="43"
              font-weight="700"
              textLength="900"
              lengthAdjust="spacingAndGlyphs">${escapeXML(safeGroupName)}</text>

        <text x="280" y="224"
              fill="#67e8f9"
              font-family="Arial, Helvetica, sans-serif"
              font-size="20"
              font-weight="600">GROUP</text>

        ${roundRect(1260, 125, 2, 105, 1, "#334155")}
        ${roundRect(1415, 125, 2, 105, 1, "#334155")}

        <text x="1280" y="173"
              fill="#ffffff"
              font-family="Arial, Helvetica, sans-serif"
              font-size="42"
              font-weight="700">${memberCount}</text>

        <text x="1280" y="205"
              fill="#94a3b8"
              font-family="Arial, Helvetica, sans-serif"
              font-size="16"
              font-weight="600">MEMBERS</text>

        <text x="1430" y="173"
              fill="#a3e635"
              font-family="Arial, Helvetica, sans-serif"
              font-size="42"
              font-weight="700">${adminCount}</text>

        <text x="1430" y="205"
              fill="#94a3b8"
              font-family="Arial, Helvetica, sans-serif"
              font-size="16"
              font-weight="600">ADMINS</text>

        ${roundRect(90, 300, 1420, 2, 1, "#334155")}
`);

for (let i = 0; i < members.length; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;

    const centerX =
        startX + col * (cellW + gapX) + cellW / 2;

    const cardY = gridStartY + row * (cellH + gapY);

    svg.push(roundRect(
        centerX - cellW / 2,
        cardY,
        cellW,
        cellH,
        24,
        "url(#card)",
        "#29384e",
        2
    ));
}

svg.push("</svg>");

const base = Buffer.from(svg.join("\n"));
const overlays = [];

const groupImage = await prepareAvatar(
    getGroupImageURL(threadInfo),
    groupAvatarSize
);

const groupAvatar = await circleAvatar(
    groupImage || fallbackAvatar(groupAvatarSize),
    groupAvatarSize
);

overlays.push({
    input: groupAvatar,
    left: 100,
    top: 115
});

const adminRings = [];

for (let i = 0; i < members.length; i++) {
    const member = members[i];

    const row = Math.floor(i / columns);
    const col = i % columns;

    const centerX =
        startX + col * (cellW + gapX) + cellW / 2;

    const centerY =
        gridStartY + row * (cellH + gapY) + cellH / 2;

    const x = Math.round(centerX - avatarSize / 2);
    const y = Math.round(centerY - avatarSize / 2);

    const avatar = await getUserAvatar(
        api,
        usersData,
        member.id,
        member.info
    ) || fallbackAvatar(avatarSize);

    overlays.push({
        input: await circleAvatar(avatar, avatarSize),
        left: x,
        top: y
    });

    if (member.isAdmin) {
        adminRings.push(`
            <circle cx="${centerX}" cy="${centerY}"
                    r="${avatarSize / 2 + 4}"
                    fill="none"
                    stroke="#22c55e"
                    stroke-width="6"/>
        `);
    }
}

if (adminRings.length) {
    const ringSVG = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${WIDTH}" height="${HEIGHT}"
             viewBox="0 0 ${WIDTH} ${HEIGHT}">
            ${adminRings.join("\n")}
        </svg>
    `);

    overlays.push({
        input: ringSVG,
        left: 0,
        top: 0
    });
}

return sharp(base)
    .composite(overlays)
    .png()
    .toBuffer();

}

module.exports = {
config: {
name: "gcimg",
aliases: ["groupimage", "groupcard", "gc"],
version: "4.0.1",
author: "Tanvir Ahmed (Tanvir143)",
countDown: 10,
role: 0,
shortDescription: "Create a group DP card",
longDescription:
"Create a group card with group DP, name, member count, admin count and up to 30 member DPs.",
category: "group",
guide: "{pn}"
},

onStart: async function ({ api, event, message, usersData }) {
    const threadID = event.threadID;
    let filePath;

    try {
        await message.reply("⏳ Group card তৈরি হচ্ছে...");

        const threadInfo = await getThreadInfo(api, threadID);

        if (!threadInfo) {
            return message.reply(
                "❌ Group information পাওয়া যায়নি।"
            );
        }

        const image = await createGroupCard(
            threadInfo,
            api,
            usersData
        );

        filePath = path.join(
            CACHE_DIR,
            `gcimg_${threadID}_${Date.now()}.png`
        );

        await fs.writeFile(filePath, image);

        await message.reply({
            body: "🖼️ Group card তৈরি হয়েছে!",
            attachment: fs.createReadStream(filePath)
        });
    } catch (error) {
        console.error("[GCIMG ERROR]", error);

        return message.reply(
            "❌ Group card তৈরি করা যায়নি। Railway console-এর [GCIMG ERROR] দেখো।"
        );
    } finally {
        if (filePath) {
            setTimeout(() => {
                fs.remove(filePath).catch(() => {});
            }, 30000);
        }
    }
}

};
