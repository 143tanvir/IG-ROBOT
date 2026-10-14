/**
 * File Name: igAutoDownload.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Original source credits and license notices are retained.
 */

"use strict";

const tanvir143Module = require("@hiudyy/ytdl");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const {
    downloadInstagram: tanvirReelDownload,
    isValidInstagramURL: tanvir143igBot
} = tanvir143Module;

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const DOWNLOAD_TIMEOUT = 90 * 1000;
const AXIOS_TIMEOUT = 60 * 1000;

const processedMessages = new Set();

function tanvir143SafeReact(api, event, emoji) {
    try {
        if (typeof api.setMessageReaction === "function") {
            return Promise.resolve(
                api.setMessageReaction(
                    emoji,
                    event.messageID,
                    event.threadID
                )
            ).catch(error => {
                console.error(
                    "[Tanvir143] Reaction failed:",
                    error?.message || error
                );
            });
        }
    } catch (error) {
        console.error(
            "[Tanvir143] Reaction failed:",
            error?.message || error
        );
    }

    return Promise.resolve();
}

function tanvir143NormalizeURL(input, depth = 0) {
    let url = String(input || "")
        .trim()
        .replace(/^<+|>+$/g, "")
        .replace(/[),.;\]}]+$/g, "");

    if (!url) {
        throw new Error("Instagram URL not found.");
    }

    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }

    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // Unwrap Instagram redirect links when possible.
    if (
        (host === "l.instagram.com" || host === "lm.instagram.com") &&
        depth < 3
    ) {
        const redirect =
            parsed.searchParams.get("u") ||
            parsed.searchParams.get("url");

        if (redirect) {
            return tanvir143NormalizeURL(redirect, depth + 1);
        }
    }

    if (
        host !== "instagram.com" &&
        !host.endsWith(".instagram.com") &&
        host !== "instagr.am"
    ) {
        throw new Error("Not an Instagram URL.");
    }

    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}

function tanvir143FindInstagramURL(root) {
    const strings = [];
    const visited = new WeakSet();

    function scan(value, depth = 0) {
        if (depth > 10 || value == null) return;

        if (typeof value === "string") {
            strings.push(value);
            return;
        }

        if (typeof value !== "object") return;
        if (visited.has(value)) return;

        visited.add(value);

        if (Array.isArray(value)) {
            for (const item of value.slice(0, 200)) {
                scan(item, depth + 1);
            }
            return;
        }

        for (const key of Object.keys(value).slice(0, 250)) {
            try {
                scan(value[key], depth + 1);
            } catch (_) {}
        }
    }

    scan(root);

    const pattern =
        /(?:https?:\/\/)?(?:[a-z\d-]+\.)*instagram\.com\/[^\s"'<>]+|(?:https?:\/\/)?instagr\.am\/[^\s"'<>]+/gi;

    for (const original of strings) {
        const variants = [original];
        let decoded = original;

        // Also inspect URL-encoded share metadata.
        for (let i = 0; i < 2; i++) {
            try {
                const next = decodeURIComponent(decoded);
                if (next === decoded) break;

                variants.push(next);
                decoded = next;
            } catch (_) {
                break;
            }
        }

        for (const text of variants) {
            pattern.lastIndex = 0;
            let match;

            while ((match = pattern.exec(text)) !== null) {
                try {
                    const url = tanvir143NormalizeURL(match[0]);

                    if (
                        typeof tanvir143igBot === "function" &&
                        tanvir143igBot(url)
                    ) {
                        return url;
                    }
                } catch (_) {}
            }
        }
    }

    return null;
}

function tanvir143Timeout(promise, ms, label) {
    let timer;

    return Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`${label} timed out.`));
            }, ms);
        })
    ]).finally(() => clearTimeout(timer));
}

function tanvir143SelectVideo(medias) {
    if (!Array.isArray(medias)) return null;

    const videos = medias.filter(media =>
        media &&
        typeof media === "object" &&
        String(media.type || "").toLowerCase() === "video" &&
        typeof media.url === "string" &&
        /^https?:\/\//i.test(media.url)
    );

    if (!videos.length) return null;

    videos.sort((a, b) => {
        const aResolution =
            (Number(a.width) || 0) *
            (Number(a.height) || 0);

        const bResolution =
            (Number(b.width) || 0) *
            (Number(b.height) || 0);

        if (aResolution !== bResolution) {
            return bResolution - aResolution;
        }

        return (
            (Number(b.bitrate) || 0) -
            (Number(a.bitrate) || 0)
        );
    });

    return videos[0];
}

async function tanvir143DownloadVideo(videoURL) {
    const response = await axios.get(videoURL, {
        responseType: "arraybuffer",
        timeout: AXIOS_TIMEOUT,
        maxContentLength: MAX_VIDEO_SIZE,
        maxBodyLength: MAX_VIDEO_SIZE,
        maxRedirects: 5,

        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/131.0.0.0 Safari/537.36",
            "Accept": "video/mp4,video/*,application/octet-stream,*/*",
            "Referer": "https://www.instagram.com/"
        },

        validateStatus: status =>
            status >= 200 && status < 300
    });

    const contentType = String(
        response.headers?.["content-type"] || ""
    ).toLowerCase();

    if (
        contentType.includes("text/html") ||
        contentType.includes("application/json")
    ) {
        throw new Error("Video URL returned a webpage instead of a video.");
    }

    const buffer = Buffer.from(response.data);

    if (!buffer.length) {
        throw new Error("Downloaded video is empty.");
    }

    if (buffer.length > MAX_VIDEO_SIZE) {
        throw new Error("Video exceeds the 50 MB limit.");
    }

    return buffer;
}

async function tanvir143SendVideo(api, event, buffer) {
    const tempDir = path.join(__dirname, "..", "tmp");
    await fs.ensureDir(tempDir);

    const filePath = path.join(
        tempDir,
        `igbot143_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}.mp4`
    );

    try {
        await fs.writeFile(filePath, buffer);

        await new Promise((resolve, reject) => {
            const stream = fs.createReadStream(filePath);

            stream.on("error", reject);

            api.sendMessage(
                {
                    body:
                        "🎬 Instagram Video\n" +
                        "😘 Enjoy Using Tanvir143 Robot..",
                    attachment: stream
                },
                event.threadID,
                error => {
                    if (error) return reject(error);
                    resolve();
                },
                event.messageID
            );
        });
    } finally {
        await fs.remove(filePath).catch(() => {});
    }
}

async function tanvir143HandleMessage(api, event) {
    if (!event || event.isGroup !== true) return;

    const messageID = String(event.messageID || "");

    if (!messageID || processedMessages.has(messageID)) {
        return;
    }

    const url = tanvir143FindInstagramURL(event);

    if (!url) {
        /*
         * Your direct-share log shows:
         * body: ""
         * itemType: "link"
         * attachments: []
         *
         * Inspect the event when no Instagram URL is exposed.
         */
        if (
            String(event.itemType || "").toLowerCase() === "link" &&
            !String(event.body || "").trim()
        ) {
            processedMessages.add(messageID);

            if (processedMessages.size > 500) {
                processedMessages.clear();
            }

            await tanvir143SafeReact(api, event, "❌");

            console.warn(
                "[igBot143 | TanvirAhmed] Direct share has no detectable Instagram URL."
            );

            console.dir(event, { depth: 8 });

            return;
        }

        return;
    }

    processedMessages.add(messageID);

    if (processedMessages.size > 500) {
        processedMessages.clear();
    }

    try {
        console.log(
            "[Tanvir143 | tanvirRobot] Instagram URL detected:",
            url
        );

        // ⏳ Download started.
        await tanvir143SafeReact(api, event, "⏳");

        const result = await tanvir143Timeout(
            tanvirReelDownload(url),
            DOWNLOAD_TIMEOUT,
            "Instagram downloader"
        );

        if (!result || !Array.isArray(result.medias)) {
            throw new Error("No media information was returned.");
        }

        const video = tanvir143SelectVideo(result.medias);

        if (!video) {
            throw new Error("No downloadable video was found.");
        }

        const buffer = await tanvir143DownloadVideo(video.url);

        await tanvir143SendVideo(api, event, buffer);

        // ✅ Video sent successfully.
        await tanvir143SafeReact(api, event, "✅");

        console.log(
            "[Tanvir143 | igBot143] Instagram video sent successfully."
        );
    } catch (error) {
        // ❌ Download or send failed.
        await tanvir143SafeReact(api, event, "❌");

        console.error(
            "[Tanvir143 | TanvirAhmed] AUTO DOWNLOAD ERROR:",
            error?.stack || error?.message || error
        );
    }
}

module.exports = {
    config: {
        name: "igAutoDownload",
        eventType: ["message"],
        author: "Tanvir Ahmed (Tanvir143)"
    },

    onStart: async function ({ api, event }) {
        try {
            await tanvir143HandleMessage(api, event);
        } catch (error) {
            console.error(
                "[igBot143] Event handler error:",
                error?.stack || error?.message || error
            );

            await tanvir143SafeReact(api, event, "❌");
        }
    }
};
