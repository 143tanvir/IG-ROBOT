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
const HEIGHT = 1100;
const CACHE_DIR = path.join(__dirname, "../cache");

const FONT_REGULAR = require.resolve(
    "@fontsource/roboto/files/roboto-latin-400-normal.woff"
);

const FONT_BOLD = require.resolve(
    "@fontsource/roboto/files/roboto-latin-700-normal.woff"
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

function shorten(value, max = 24) {
    value = String(value || "Unknown");
    return value.length > max
        ? value.slice(0, max - 3) + "..."
        : value;
}

function textWidth(text, font, size) {
    try {
        const run = font.layout(String(text));
        return run.positions.reduce(
            (sum, position) => sum + position.xAdvance,
            0
        ) * size / font.unitsPerEm;
    } catch {
        return String(text).length * size * 0.55;
    }
}

function svgText(text, x, y, size = 30, color = "#ffffff", bold = false) {
    const font = bold ? boldFont : regularFont;
    const safeText = escapeXML(text);
    const width = textWidth(text, font, size);
    const fontFamily = "Roboto, Arial, sans-serif";

    return `
        <text
            x="${x}"
            y="${y}"
            fill="${color}"
            font-size="${size}"
            font-weight="${bold ? 700 : 400}"
            font-family="${fontFamily}"
            textLength="${Math.max(1, width)}"
            lengthAdjust="spacingAndGlyphs"
        >${safeText}</text>
    `;
}

function roundedRect(x, y, width, height, radius, fill, stroke = "none") {
    return `
        <rect
            x="${x}"
            y="${y}"
            width="${width}"
            height="${height}"
            rx="${radius}"
            fill="${fill}"
            stroke="${stroke}"
        />
    `;
}

function callbackCall(target, method, ...args) {
    return new Promise((resolve, reject) => {
        if (!target || typeof target[method] !== "function") {
            return reject(new Error(`${method} is not available`));
        }

        let finished = false;

        const done = (error, result) => {
            if (finished) return;
            finished = true;

            if (error) reject(error);
            else resolve(result);
        };

        try {
            const result = target[method](...args, (error, data) => {
                if (arguments.length === 1 && !(error instanceof Error)) {
                    done(null, error);
                } else {
                    done(error, data);
                }
            });

            if (result && typeof result.then === "function") {
                result.then(data => done(null, data)).catch(done);
            } else if (result !== undefined) {
                done(null, result);
            }
        } catch (error) {
            done(error);
        }
    });
}

async function downloadImage(url) {
    if (!url) return null;

    try {
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 15000,
            maxContentLength: 8 * 1024 * 1024,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        return await sharp(Buffer.from(response.data))
            .rotate()
            .resize(180, 180, {
                fit: "cover",
                position: "centre"
            })
            .png()
            .toBuffer();
    } catch {
        return null;
    }
}

async function getAvatar(api, usersData, userID, userInfo = {}) {
    try {
        if (usersData && typeof usersData.getAvatarUrl === "function") {
            const url = await usersData.getAvatarUrl(userID);
            const image = await downloadImage(url);
            if (image) return image;
        }
    } catch {}

    try {
        const info = await callbackCall(api, "getUserInfo", userID);
        const user = info && (info[userID] || info);

        if (user && user.thumbSrc) {
            const image = await downloadImage(user.thumbSrc);
            if (image) return image;
        }

        if (user && user.profilePicUrl) {
            const image = await downloadImage(user.profilePicUrl);
            if (image) return image;
        }
    } catch {}

    if (userInfo.thumbSrc) {
        const image = await downloadImage(userInfo.thumbSrc);
        if (image) return image;
    }

    return null;
}

async function makeCircleAvatar(buffer, size = 100) {
    if (!buffer) {
        const fallback = Buffer.from(`
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#374151"/>
                <text x="50%" y="58%" text-anchor="middle" font-size="${size * 0.42}" fill="#ffffff" font-family="Arial">?</text>
            </svg>
        `);

        return sharp(fallback).png().toBuffer();
    }

    const circleMask = Buffer.from(`
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/>
        </svg>
    `);

    return sharp(buffer)
        .resize(size, size, { fit: "cover" })
        .composite([{ input: circleMask, blend: "dest-in" }])
        .png()
        .toBuffer();
}

async function createGroupCard(threadInfo, api, usersData) {
    const threadName = threadInfo.threadName || "Instagram Group";
    const participants = Array.isArray(threadInfo.participantIDs)
        ? threadInfo.participantIDs
        : [];

    const adminIDs = Array.isArray(threadInfo.adminIDs)
        ? threadInfo.adminIDs.map(item =>
            typeof item === "object" ? item.id : item
        )
        : [];

    const userInfoList = Array.isArray(threadInfo.userInfo)
        ? threadInfo.userInfo
        : [];

    const members = participants.map(id => {
        const user = userInfoList.find(
            item => String(item.id) === String(id)
        );

        return {
            id,
            name: user ? user.name : `User ${String(id).slice(-5)}`,
            isAdmin: adminIDs.includes(id)
        };
    });

    const adminCount = members.filter(user => user.isAdmin).length;
    const memberCount = members.length;
    const displayedMembers = members.slice(0, 12);

    const elements = [];
    const avatarBuffers = [];

    elements.push(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${WIDTH}" height="${HEIGHT}"
             viewBox="0 0 ${WIDTH} ${HEIGHT}">
            <defs>
                <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#101827"/>
                    <stop offset="50%" stop-color="#172554"/>
                    <stop offset="100%" stop-color="#083344"/>
                </linearGradient>
                <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#22d3ee"/>
                    <stop offset="100%" stop-color="#a3e635"/>
                </linearGradient>
            </defs>

            <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
            <circle cx="1450" cy="100" r="230" fill="#22d3ee" opacity="0.08"/>
            <circle cx="100" cy="1050" r="260" fill="#a3e635" opacity="0.07"/>

            ${roundedRect(55, 55, 1490, 990, 40, "#111827", "#334155")}
            ${roundedRect(85, 85, 1430, 12, 6, "url(#accent)")}

            ${svgText("GROUP INFORMATION", 110, 155, 25, "#67e8f9", true)}
            ${svgText(shorten(threadName, 32), 110, 225, 54, "#ffffff", true)}
            ${svgText(`Members: ${memberCount}`, 110, 285, 27, "#cbd5e1")}
            ${svgText(`Admins: ${adminCount}`, 430, 285, 27, "#cbd5e1")}

            ${roundedRect(105, 325, 1390, 2, 1, "#334155")}
            ${svgText("GROUP MEMBERS", 110, 385, 28, "#a3e635", true)}
    `);

    const columns = 4;
    const cardWidth = 325;
    const cardHeight = 145;
    const startX = 105;
    const startY = 425;
    const gapX = 20;
    const gapY = 20;

    for (let i = 0; i < displayedMembers.length; i++) {
        const member = displayedMembers[i];
        const col = i % columns;
        const row = Math.floor(i / columns);

        const x = startX + col * (cardWidth + gapX);
        const y = startY + row * (cardHeight + gapY);

        elements.push(roundedRect(
            x, y, cardWidth, cardHeight, 22, "#1e293b", "#334155"
        ));

        const avatar = await getAvatar(
            api,
            usersData,
            member.id,
            userInfoList.find(item => String(item.id) === String(member.id)) || {}
        );

        const circle = await makeCircleAvatar(avatar, 88);

        avatarBuffers.push({
            input: circle,
            left: x + 18,
            top: y + 28
        });

        elements.push(svgText(
            shorten(member.name, 17),
            x + 122,
            y + 65,
            23,
            "#ffffff",
            true
        ));

        elements.push(svgText(
            member.isAdmin ? "ADMIN" : "MEMBER",
            x + 122,
            y + 103,
            17,
            member.isAdmin ? "#a3e635" : "#94a3b8",
            true
        ));
    }

    if (memberCount > displayedMembers.length) {
        elements.push(svgText(
            `+ ${memberCount - displayedMembers.length} more members`,
            110,
            965,
            23,
            "#cbd5e1"
        ));
    }

    elements.push(svgText(
        "Powered By Tanvir143",
        110,
        1005,
        21,
        "#67e8f9",
        true
    ));

    elements.push("</svg>");

    const svgBuffer = Buffer.from(elements.join("\n"));

    return sharp(svgBuffer)
        .composite(avatarBuffers)
        .png()
        .toBuffer();
}

module.exports = {
    config: {
        name: "gcimg",
        aliases: ["groupimage", "groupcard", "gc"],
        version: "2.0.0",
        author: "Tanvir Ahmed (Tanvir143)",
        countDown: 10,
        role: 0,
        shortDescription: "Create a group information image",
        longDescription: "Generates a group card with member and admin information.",
        category: "group",
        guide: "{pn}"
    },

    onStart: async function ({ api, event, message, usersData }) {
        const threadID = event.threadID;

        try {
            await message.reply("⏳ Group card তৈরি হচ্ছে...");

            const threadInfo = await callbackCall(
                api,
                "getThreadInfo",
                threadID
            );

            if (!threadInfo) {
                return message.reply("❌ Group information পাওয়া যায়নি।");
            }

            const card = await createGroupCard(
                threadInfo,
                api,
                usersData
            );

            const filePath = path.join(
                CACHE_DIR,
                `gcimg_${threadID}_${Date.now()}.png`
            );

            await fs.writeFile(filePath, card);

            try {
                await message.reply({
                    body: "🖼️ Group card তৈরি হয়েছে!",
                    attachment: fs.createReadStream(filePath)
                });
            } finally {
                setTimeout(() => {
                    fs.remove(filePath).catch(() => {});
                }, 30000);
            }
        } catch (error) {
            console.error("[GCIMG ERROR]", error);

            return message.reply(
                "❌ Group card তৈরি করা যায়নি। Console log পরীক্ষা করো।"
            );
        }
    }
};
