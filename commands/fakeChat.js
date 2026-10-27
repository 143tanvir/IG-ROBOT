
/**
 * File Name: fakechat.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * Instagram: @ig.tanvir_ahmed
 */

"use strict";

const axios = require("axios");
const sharp = require("sharp");

const BAR_URL = "https://i.imgur.com/zGfbY4Z.jpeg";

const WIDTH = 1000;
const FONT_SIZE = 34;
const LINE_HEIGHT = 44;
const MAX_TEXT = 3000;
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

function escapeXML(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

async function downloadImage(url) {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 20000,
        maxContentLength: MAX_IMAGE_SIZE,
        maxBodyLength: MAX_IMAGE_SIZE,
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const buffer = Buffer.from(response.data);

    if (!buffer.length) {
        throw new Error("Downloaded image is empty.");
    }

    if (buffer.length > MAX_IMAGE_SIZE) {
        throw new Error("Image exceeds 15 MB.");
    }

    return buffer;
}

function getProfile(api, userID) {
    return new Promise((resolve, reject) => {
        if (!userID || typeof api.getUserInfo !== "function") {
            return resolve(null);
        }

        let completed = false;

        const finish = (error, data) => {
            if (completed) return;
            completed = true;

            if (error) return reject(error);

            resolve(data?.[String(userID)] || data || null);
        };

        try {
            const result = api.getUserInfo(
                String(userID),
                finish
            );

            if (result && typeof result.then === "function") {
                result.then(data => finish(null, data))
                    .catch(error => finish(error));
            }
        } catch (error) {
            finish(error);
        }
    });
}

function getAvatarURL(profile) {
    if (!profile) return null;

    const url =
        profile.profilePicture ||
        profile.thumbSrc ||
        profile.profilePicUrl ||
        profile.profilePic ||
        profile.profile_pic_url ||
        profile.avatarUrl ||
        profile.photoURL ||
        profile.photoUrl ||
        profile.image ||
        profile.picture;

    return typeof url === "string" &&
        /^https?:\/\//i.test(url)
        ? url
        : null;
}

function estimateWidth(text) {
    let width = 0;

    for (const char of text) {
        if (/\s/.test(char)) {
            width += FONT_SIZE * 0.30;
        } else if (/[ilI.,'!:;|]/.test(char)) {
            width += FONT_SIZE * 0.30;
        } else if (/[MW@#%&]/.test(char)) {
            width += FONT_SIZE * 0.85;
        } else if (/[A-Z]/.test(char)) {
            width += FONT_SIZE * 0.62;
        } else if (/[a-z0-9]/.test(char)) {
            width += FONT_SIZE * 0.54;
        } else {
            width += FONT_SIZE * 0.95;
        }
    }

    return width;
}

function wrapText(text, maxWidth) {
    const lines = [];

    for (const paragraph of text.split(/\r?\n/)) {
        if (!paragraph.trim()) {
            lines.push("");
            continue;
        }

        let line = "";

        for (const word of paragraph.split(/\s+/)) {
            if (estimateWidth(word) > maxWidth) {
                if (line) {
                    lines.push(line);
                    line = "";
                }

                let part = "";

                for (const char of word) {
                    if (
                        part &&
                        estimateWidth(part + char) > maxWidth
                    ) {
                        lines.push(part);
                        part = "";
                    }

                    part += char;
                }

                line = part;
                continue;
            }

            const candidate = line
                ? `${line} ${word}`
                : word;

            if (
                line &&
                estimateWidth(candidate) > maxWidth
            ) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }

        if (line) lines.push(line);
    }

    return lines.length ? lines : [""];
}

async function makeCircleAvatar(buffer, size) {
    const mask = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${size}" height="${size}">
            <circle
                cx="${size / 2}"
                cy="${size / 2}"
                r="${size / 2}"
                fill="#ffffff"
            />
        </svg>
    `);

    return sharp(buffer)
        .resize(size, size, { fit: "cover" })
        .composite([{
            input: mask,
            blend: "dest-in"
        }])
        .png()
        .toBuffer();
}

async function createFakeChat(text, avatarBuffer, barBuffer) {
    const bar = await sharp(barBuffer)
        .resize({ width: WIDTH })
        .png()
        .toBuffer();

    const barInfo = await sharp(bar).metadata();

    const bubbleX = 135;
    const bubbleY = 28;
    const bubbleW = 835;
    const paddingX = 30;
    const paddingY = 28;
    const maxTextWidth = bubbleW - paddingX * 2;

    const lines = wrapText(text, maxTextWidth);

    const bubbleH = Math.max(
        100,
        paddingY * 2 + lines.length * LINE_HEIGHT
    );

    const avatarSize = 76;
    const gap = 28;
    const barY = bubbleY + bubbleH + gap;
    const height = barY + barInfo.height + 24;

    const textSVG = lines.map((line, index) => `
        <text
            x="${bubbleX + paddingX}"
            y="${bubbleY + paddingY + FONT_SIZE + index * LINE_HEIGHT}"
            font-family="Arial, sans-serif"
            font-size="${FONT_SIZE}px"
            fill="#F5F5F5"
        >${escapeXML(line)}</text>
    `).join("");

    const background = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${WIDTH}" height="${height}">
            <rect width="100%" height="100%" fill="#000000"/>

            <rect
                x="${bubbleX}"
                y="${bubbleY}"
                width="${bubbleW}"
                height="${bubbleH}"
                rx="45"
                fill="#262626"
            />

            ${textSVG}
        </svg>
    `);

    const layers = [
        { input: background, left: 0, top: 0 },
        { input: bar, left: 0, top: barY }
    ];

    if (avatarBuffer) {
        const avatar = await makeCircleAvatar(
            avatarBuffer,
            avatarSize
        );

        layers.push({
            input: avatar,
            left: 40,
            top: bubbleY + bubbleH - avatarSize
        });
    }

    return sharp({
        create: {
            width: WIDTH,
            height,
            channels: 4,
            background: "#000000"
        }
    })
        .composite(layers)
        .png()
        .toBuffer();
}

module.exports = {
    config: {
        name: "fakechat",
        aliases: ["fc"],
        version: "2.0.1",
        author: "Tanvir Ahmed (Tanvir143)",
        cooldown: 5,
        role: 0,
        shortDescription: "Create a fake chat image",
        longDescription: "Create an Instagram-style chat image without temporary files.",
        category: "Users Cmd",
        usage: ".fakechat <message> (reply to a message)"
    },

    onStart: async function ({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const text = (args || []).join(" ").trim();

        if (!text) {
            return api.sendMessage(
                "ব্যবহার: .fakechat তোমার মেসেজ\nকোনো মেসেজে Reply দিয়েও ব্যবহার করতে পারো।",
                threadID,
                messageID
            );
        }

        if (text.length > MAX_TEXT) {
            return api.sendMessage(
                `মেসেজ সর্বোচ্চ ${MAX_TEXT} অক্ষরের মধ্যে রাখো।`,
                threadID,
                messageID
            );
        }

        try {
            const targetID = String(
                event.messageReply?.senderID ||
                event.messageReply?.userID ||
                event.senderID ||
                ""
            );

            let avatarBuffer = null;

            try {
                const profile = await getProfile(api, targetID);
                const avatarURL = getAvatarURL(profile);

                if (avatarURL) {
                    avatarBuffer = await downloadImage(avatarURL);
                }
            } catch (error) {
                console.warn(
                    "[FAKECHAT] Avatar unavailable:",
                    error.message
                );
            }

            const barBuffer = await downloadImage(BAR_URL);

            const imageBuffer = await createFakeChat(
                text,
                avatarBuffer,
                barBuffer
            );

            api.sendMessage(
                {
                    body: "",
                    attachment: imageBuffer
                },
                threadID,
                (error) => {
                    if (error) {
                        console.error(
                            "[FAKECHAT] Send error:",
                            error.stack || error
                        );
                    }
                },
                messageID
            );

        } catch (error) {
            console.error(
                "[FAKECHAT] Error:",
                error.stack || error
            );

            return api.sendMessage(
                `❌ FakeChat তৈরি করা যায়নি: ${error.message || error}`,
                threadID,
                messageID
            );
        }
    }
};
