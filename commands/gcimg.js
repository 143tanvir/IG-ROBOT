/**
 * File Name: gcimg.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

const sharp = require("sharp");
const fontkit = require("fontkit");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const WIDTH = 1600;
const HEIGHT = 1150;
const MAX_MEMBERS = 30;
const CACHE_DIR = path.join(__dirname, "../cache");

const FONT_REGULAR = require.resolve(
    "@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-400-normal.woff"
);

const FONT_BOLD = require.resolve(
    "@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-700-normal.woff"
);

const regularFont = fontkit.openSync(FONT_REGULAR);
const boldFont = fontkit.openSync(FONT_BOLD);

fs.ensureDirSync(CACHE_DIR);

function escapeXML(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function roundRect(x, y, w, h, r, fill, stroke = "none", sw = 1) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function textPath(text, x, baseline, size, color, bold = false) {
    const font = bold ? boldFont : regularFont;
    const scale = size / font.unitsPerEm;
    const run = font.layout(String(text));
    let cursorX = x;
    let paths = "";

    for (let i = 0; i < run.glyphs.length; i++) {
        const glyph = run.glyphs[i];
        const position = run.positions[i];

        if (glyph.path && glyph.path.toSVG()) {
            paths += `<path d="${glyph.path.toSVG()}" transform="translate(${cursorX + position.xOffset * scale} ${baseline - position.yOffset * scale}) scale(${scale} ${-scale})" fill="${color}"/>`;
        }

        cursorX += position.xAdvance * scale;
    }

    return paths;
}

function textSvg(text, x, y, size, color, bold = false) {
    return textPath(text, x, y, size, color, bold);
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

async function prepareAvatar(url, size = 150) {
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
    try {
        if (usersData && typeof usersData.getAvatarUrl === "function") {
            const url = await usersData.getAvatarUrl(userID);
            const image = await prepareAvatar(url);
            if (image) return image;
        }
    } catch {}

    const possibleURLs = [
        userInfo.thumbSrc,
        userInfo.profilePicUrl,
        userInfo.avatar,
        userInfo.image
    ];

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
                }
            });

            const user = info && (info[userID] || info);
            const url = user && (user.thumbSrc || user.profilePicUrl);

            const image = await prepareAvatar(url);
            if (image) return image;
        }
    } catch {}

    return null;
}

async function getThreadInfo(api, threadID) {
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

function getGroupImageURL(threadInfo) {
    return threadInfo.imageSrc ||
        threadInfo.imageUrl ||
        threadInfo.threadImage ||
        threadInfo.photo ||
        null;
}

async function createGroupCard(threadInfo, api, usersData) {
    const threadName = String(
        threadInfo.threadName || "Instagram Group"
    );

    const participantIDs = Array.isArray(threadInfo.participantIDs)
        ? threadInfo.participantIDs.map(String)
        : [];

    const adminIDs = normalizeAdminIDs(threadInfo.adminIDs);
    const userInfoList = Array.isArray(threadInfo.userInfo)
        ? threadInfo.userInfo
        : [];

    const members = participantIDs.slice(0, MAX_MEMBERS).map(id => {
        const info = userInfoList.find(
            item => String(item.id || item.userID) === id
        ) || {};

        return {
            id,
            info,
            isAdmin: adminIDs.includes(id)
        };
    });

    const memberCount = participantIDs.length;
    const adminCount = adminIDs.length;

    const margin = 70;
    const headerY = 65;
    const groupAvatarSize = 150;
    const gridStartY = 320;
    const avatarSize = 118;
    const cellW = 190;
    const cellH = 155;
    const columns = 6;
    const gapX = 35;
    const gapY = 30;
    const totalGridWidth = columns * cellW + (columns - 1) * gapX;
    const startX = (WIDTH - totalGridWidth) / 2;

    const groupImageURL = getGroupImageURL(threadInfo);
    const groupAvatar = await prepareAvatar(
        groupImageURL,
        groupAvatarSize
    );

    const overlays = [];

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
                    <stop offset="0%" stop-color="#1e293b"/>
                    <stop offset="100%" stop-color="#172033"/>
                </linearGradient>
            </defs>

            <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
            <circle cx="1480" cy="40" r="300" fill="#22d3ee" opacity="0.06"/>
            <circle cx="40" cy="1110" r="270" fill="#a3e635" opacity="0.05"/>

            ${roundRect(35, 35, WIDTH - 70, HEIGHT - 70, 42, "#0d1526", "#263449", 2)}
            ${roundRect(70, 70, WIDTH - 140, 9, 5, "url(#accent)")}

            ${roundRect(75, 105, 1450, 170, 28, "#111c30", "#29384e", 2)}
        </svg>
    `);

    const base = Buffer.from(svg.join("\n"));

    const headerOverlays = [];

    if (groupAvatar) {
        const mask = Buffer.from(`
            <svg width="${groupAvatarSize}" height="${groupAvatarSize}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${groupAvatarSize / 2}" cy="${groupAvatarSize / 2}" r="${groupAvatarSize / 2}" fill="#fff"/>
            </svg>
        `);

        const circleAvatar = await sharp(groupAvatar)
            .resize(groupAvatarSize, groupAvatarSize)
            .composite([{ input: mask, blend: "dest-in" }])
            .png()
            .toBuffer();

        headerOverlays.push({
            input: circleAvatar,
            left: 100,
            top: 115
        });
    }

    const groupNameSize = 44;
    const safeGroupName = threadName.length > 27
        ? threadName.slice(0, 24) + "..."
        : threadName;

    const titleSVG = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
            ${textSvg(safeGroupName, 300, 185, groupNameSize, "#ffffff", true)}
            ${textSvg("GROUP", 300, 225, 19, "#67e8f9", true)}
            ${textSvg(String(memberCount), 1275, 175, 43, "#ffffff", true)}
            ${textSvg("MEMBERS", 1275, 205, 17, "#94a3b8", true)}
            ${textSvg(String(adminCount), 1430, 175, 43, "#a3e635", true)}
            ${textSvg("ADMINS", 1430, 205, 17, "#94a3b8", true)}
            ${roundRect(1260, 125, 2, 105, 1, "#334155")}
            ${roundRect(1415, 125, 2, 105, 1, "#334155")}
            ${roundRect(90, 300, 1420, 2, 1, "#334155")}
        </svg>
    `);

    const memberSVG = [];

    memberSVG.push(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${WIDTH}" height="${HEIGHT}"
             viewBox="0 0 ${WIDTH} ${HEIGHT}">
    `);

    const avatarOverlays = [];

    for (let i = 0; i < members.length; i++) {
        const member = members[i];

        const row = Math.floor(i / columns);
        const col = i % columns;

        const centerX = startX + col * (cellW + gapX) + cellW / 2;
        const centerY = gridStartY + row * (cellH + gapY) + 65;

        const x = Math.round(centerX - avatarSize / 2);
        const y = Math.round(centerY - avatarSize / 2);

        memberSVG.push(`
            ${roundRect(
                centerX - cellW / 2,
                gridStartY + row * (cellH + gapY),
                cellW,
                cellH,
                25,
                "url(#card)",
                "#29384e",
                2
            )}
        `);

        const avatar = await getUserAvatar(
            api,
            usersData,
            member.id,
            member.info
        );

        let avatarBuffer = avatar;

        if (!avatarBuffer) {
            const fallback = Buffer.from(`
                <svg xmlns="http://www.w3.org/2000/svg" width="${avatarSize}" height="${avatarSize}">
                    <circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="#374151"/>
                    <circle cx="${avatarSize / 2}" cy="42" r="23" fill="#9ca3af"/>
                    <ellipse cx="${avatarSize / 2}" cy="94" rx="38" ry="27" fill="#9ca3af"/>
                </svg>
            `);

            avatarBuffer = await sharp(fallback).png().toBuffer();
        }

        const mask = Buffer.from(`
            <svg xmlns="http://www.w3.org/2000/svg" width="${avatarSize}" height="${avatarSize}">
                <circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2 - 3}" fill="#ffffff"/>
            </svg>
        `);

        const circleAvatar = await sharp(avatarBuffer)
            .resize(avatarSize, avatarSize, { fit: "cover" })
            .composite([{ input: mask, blend: "dest-in" }])
            .png()
            .toBuffer();

        avatarOverlays.push({
            input: circleAvatar,
            left: x,
            top: y
        });

        if (member.isAdmin) {
            memberSVG.push(`
                <circle
                    cx="${centerX}"
                    cy="${centerY}"
                    r="${avatarSize / 2 + 5}"
                    fill="none"
                    stroke="#22c55e"
                    stroke-width="6"
                />
            `);
        }
    }

    memberSVG.push("</svg>");

    const memberDecoration = Buffer.from(memberSVG.join("\n"));

    const finalImage = await sharp(base)
        .composite([
            ...headerOverlays,
            { input: titleSVG, left: 0, top: 0 },
            { input: memberDecoration, left: 0, top: 0 },
            ...avatarOverlays
        ])
        .png()
        .toBuffer();

    return finalImage;
}

module.exports = {
    config: {
        name: "gcimg",
        aliases: ["groupimage", "groupcard", "gc"],
        version: "3.0.0",
        author: "Tanvir Ahmed (Tanvir143)",
        countDown: 10,
        role: 0,
        shortDescription: "Create a group DP card",
        longDescription: "Create a group image with group DP, name, member count, admin count and up to 30 member DPs.",
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
                return message.reply("❌ Group information পাওয়া যায়নি।");
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
