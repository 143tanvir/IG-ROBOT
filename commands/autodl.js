
/**
 * File Name: autodl.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * Bot: IG-ROBOT
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const API_URL = "https://ahm7xmakki.com/api/alldl";
const MAX_SIZE = 50 * 1024 * 1024;
const TIMEOUT = 60000;
const TEMP_DIR = path.join(os.tmpdir(), "ig-robot-autodl");

fs.mkdirSync(TEMP_DIR, { recursive: true });

function log(...args) {
    console.log("[IG-ROBOT AUTODL]", ...args);
}

function sendMessage(api, body, threadID, replyTo) {
    return new Promise((resolve, reject) => {
        api.sendMessage(
            {
                body,
                ...(replyTo ? { replyToMessageID: replyTo } : {})
            },
            threadID,
            (err, info) => err ? reject(err) : resolve(info)
        );
    });
}

function setReaction(api, emoji, messageID) {
    return new Promise(resolve => {
        if (!messageID || typeof api.setMessageReaction !== "function") {
            log("Reaction API unavailable.");
            return resolve(false);
        }

        api.setMessageReaction(emoji, messageID, err => {
            if (err) log("Reaction failed:", err.message || err);
            resolve(!err);
        });
    });
}

function extractUrls(text) {
    return (text.match(/https?:\/\/[^\s<>"']+/gi) || [])
        .map(url => url.replace(/[),.!?]+$/g, ""))
        .filter(url => {
            try {
                const host = new URL(url).hostname.toLowerCase();

                return host === "instagram.com" ||
                    host.endsWith(".instagram.com") ||
                    host === "instagr.am" ||
                    host.endsWith(".instagr.am");
            } catch {
                return false;
            }
        });
}

function findMediaUrls(data) {
    const keys = [
        "videoUrl", "video_url", "downloadUrl", "download_url",
        "play", "playUrl", "play_url", "mediaUrl", "media_url",
        "hd", "hdplay", "wmplay", "url", "src"
    ];

    const results = [];
    const seen = new Set();

    function walk(value, depth = 0) {
        if (!value || depth > 7) return;

        if (Array.isArray(value)) {
            for (const item of value) walk(item, depth + 1);
            return;
        }

        if (typeof value !== "object") return;

        for (const [key, item] of Object.entries(value)) {
            if (
                keys.includes(key) &&
                typeof item === "string" &&
                /^https?:\/\//i.test(item) &&
                !seen.has(item)
            ) {
                seen.add(item);
                results.push({ key, url: item });
            } else if (item && typeof item === "object") {
                walk(item, depth + 1);
            }
        }
    }

    walk(data);
    return results;
}

async function fetchMediaLink(url) {
    const response = await axios.get(API_URL, {
        params: { url },
        timeout: TIMEOUT,
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; IG-ROBOT/1.0)"
        }
    });

    const data = response.data;
    const info = data?.mediaInfo || data?.data || data;
    const media = findMediaUrls(info);

    const selected = media.find(item =>
        [
            "videoUrl", "video_url", "downloadUrl", "download_url",
            "play", "playUrl", "play_url", "mediaUrl", "media_url",
            "hd", "hdplay", "wmplay", "url", "src"
        ].includes(item.key)
    );

    if (!selected) {
        throw new Error(
            data?.message ||
            data?.error ||
            "Could not extract a direct media link from the API response."
        );
    }

    return selected.url;
}

function getExtension(contentType, url) {
    const type = (contentType || "").toLowerCase();

    if (type.includes("video/mp4")) return ".mp4";
    if (type.includes("video/webm")) return ".webm";
    if (type.includes("image/jpeg")) return ".jpg";
    if (type.includes("image/png")) return ".png";

    try {
        const ext = path.extname(new URL(url).pathname).toLowerCase();

        if ([".mp4", ".webm", ".jpg", ".png"].includes(ext)) {
            return ext;
        }
    } catch {}

    return ".mp4";
}

async function downloadMedia(url) {
    const response = await axios.get(url, {
        responseType: "stream",
        timeout: TIMEOUT,
        maxRedirects: 5,
        headers: {
            "User-Agent": "Mozilla/5.0"
        },
        validateStatus: status => status >= 200 && status < 300
    });

    const contentType = response.headers["content-type"] || "";

    if (
        contentType.includes("text/html") ||
        contentType.includes("application/json")
    ) {
        response.data.destroy();
        throw new Error("The media URL returned a webpage, not a media file.");
    }

    const declaredSize = Number(response.headers["content-length"] || 0);

    if (declaredSize > MAX_SIZE) {
        response.data.destroy();
        throw new Error("Media exceeds the 50 MB limit.");
    }

    const filePath = path.join(
        TEMP_DIR,
        `media_${Date.now()}_${Math.random().toString(36).slice(2)}` +
        getExtension(contentType, url)
    );

    let received = 0;

    try {
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(filePath);

            response.data.on("data", chunk => {
                received += chunk.length;

                if (received > MAX_SIZE) {
                    response.data.destroy(
                        new Error("Media exceeds the 50 MB limit.")
                    );
                }
            });

            response.data.on("error", error => {
                output.destroy();
                reject(error);
            });

            output.on("error", reject);
            output.on("finish", resolve);
            response.data.pipe(output);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Downloaded media file is empty.");
        }

        return filePath;
    } catch (error) {
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}

        throw error;
    }
}

function sendAttachment(api, filePath, threadID, messageID) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath);

        api.sendMessage(
            {
                body: "",
                attachment: stream,
                replyToMessageID: messageID
            },
            threadID,
            (err, info) => err ? reject(err) : resolve(info)
        );
    });
}

function cleanup(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        log("Cleanup failed:", error.message);
    }
}

function removeStatus(api, info) {
    if (info?.messageID && typeof api.unsendMessage === "function") {
        api.unsendMessage(info.messageID, () => {});
    }
}

module.exports = {
    config: {
        name: "autodl",
        aliases: ["reel", "ig"],
        version: "2.2.0",
        author: "Tanvir Ahmed (Tanvir143)",
        countDown: 5,
        role: 0,
        category: "Media",
        shortDescription: {
            en: "Automatically download Instagram video links."
        },
        longDescription: {
            en: "Detects Instagram links and sends downloaded media to the chat."
        },
        guide: {
            en: "Send a public Instagram Reel or video link in the group."
        }
    },

    onStart: async function ({ api, event, args }) {
        const url = extractUrls((args || []).join(" "))[0];

        if (!url) {
            return sendMessage(
                api,
                "Please provide a valid Instagram video link.",
                event.threadID,
                event.messageID
            );
        }

        return this.onChat({
            api,
            event: { ...event, body: url }
        });
    },

    onChat: async function ({ api, event }) {
        const url = extractUrls(event.body || "")[0];

        if (!url) return;

        const messageID = event.messageID;
        const threadID = event.threadID;

        let filePath = null;
        let statusMessage = null;
        let mediaUrlObtained = false;

        try {
            await setReaction(api, "🧐", messageID);

            log("Instagram link detected.");

            try {
                statusMessage = await sendMessage(
                    api,
                    "♻️",
                    threadID,
                    messageID
                );
            } catch (error) {
                log("Status message failed:", error.message);
            }

            const mediaUrl = await fetchMediaLink(url);
            mediaUrlObtained = true;

            // A usable media URL was received.
            await setReaction(api, "✅", messageID);

            filePath = await downloadMedia(mediaUrl);

            // If sending fails, the catch block changes the reaction to ❌.
            await sendAttachment(api, filePath, threadID, messageID);

            // Keep the success reaction after successful send.
            await setReaction(api, "✅", messageID);

            log("Media sent successfully.");
        } catch (error) {
            log("Download/send failed:", error.message || error);

            // Any error changes the original link reaction to ❌.
            await setReaction(api, "❌", messageID);

            try {
                await sendMessage(
                    api,
                    "❌ Download Failed\nReason: " +
                        (error.message || "An unexpected error occurred."),
                    threadID,
                    messageID
                );
            } catch (sendError) {
                log("Error message failed:", sendError.message);
            }
        } finally {
            cleanup(filePath);
            removeStatus(api, statusMessage);
        }
    }
};
