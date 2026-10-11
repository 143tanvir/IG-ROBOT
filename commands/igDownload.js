/**
 * File Name: igDownload.js
 * ICA: igbot-api
 * Auhor: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */


"use strict";

/*
 * Tanvir143 Reel Downloader Module
 * ICA Bot Compatible Send System
 * Author: Tanvir143
 */

const tanvir143Module = require("@hiudyy/ytdl");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const {
    downloadInstagram: tanvirReelDownload,
    isValidInstagramURL: tanvir143igBot
} = tanvir143Module;

const tanvir143 = {
    MAX_VIDEO_SIZE: 50 * 1024 * 1024,
    YTDL_TIMEOUT: 90 * 1000,
    AXIOS_TIMEOUT: 60 * 1000
};

async function tanvir143SafeReply(message, payload) {
    try {
        return await message.reply(payload);
    } catch (error) {
        console.error(
            "[Tanvir143] Reply failed:",
            error?.message || error
        );
        return null;
    }
}

async function tanvir143SafeReact(api, event, emoji) {
    try {
        if (typeof api.setMessageReaction === "function") {
            await api.setMessageReaction(
                emoji,
                event.messageID,
                event.threadID
            );
        }
    } catch (error) {
        console.error(
            "[Tanvir143] Reaction failed:",
            error?.message || error
        );
    }
}

function tanvir143Timeout(promise, ms, label = "Operation") {
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

function tanvir143NormalizeURL(input) {
    let url = String(input || "").trim();

    url = url.replace(/^<+|>+$/g, "").trim();
    url = url.replace(/\s+/g, "");

    if (!url) {
        throw new Error("Please provide an Instagram Reel URL.");
    }

    let parsed;

    try {
        parsed = new URL(url);
    } catch {
        throw new Error("Invalid URL.");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Only HTTP/HTTPS URLs are supported.");
    }

    const host = parsed.hostname.toLowerCase();

    if (
        host !== "instagram.com" &&
        !host.endsWith(".instagram.com")
    ) {
        throw new Error("Please provide a valid Instagram URL.");
    }

    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
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

async function tanvirReelDownloadVideo(videoURL) {
    const response = await axios.get(videoURL, {
        responseType: "arraybuffer",
        timeout: tanvir143.AXIOS_TIMEOUT,
        maxContentLength: tanvir143.MAX_VIDEO_SIZE,
        maxBodyLength: tanvir143.MAX_VIDEO_SIZE,
        maxRedirects: 5,

        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/131.0.0.0 Safari/537.36",
            "Accept": "video/mp4,video/*,application/octet-stream,*/*",
            "Referer": "https://www.instagram.com/"
        },

        validateStatus: status => status >= 200 && status < 300
    });

    const contentType = String(
        response.headers?.["content-type"] || ""
    ).toLowerCase();

    if (
        contentType.includes("text/html") ||
        contentType.includes("application/json")
    ) {
        throw new Error(
            "Download server returned a webpage instead of a video."
        );
    }

    const buffer = Buffer.from(response.data);

    if (!buffer.length) {
        throw new Error("Downloaded video is empty.");
    }

    if (buffer.length > tanvir143.MAX_VIDEO_SIZE) {
        throw new Error("Video exceeds the 50 MB limit.");
    }

    // Basic MP4 signature check; some valid files use other containers.
    const isMp4 =
        buffer.length >= 8 &&
        buffer.toString("ascii", 4, 8) === "ftyp";

    if (
        contentType.includes("video/mp4") &&
        !isMp4
    ) {
        console.warn("[Tanvir143] MP4 signature not detected.");
    }

    return buffer;
}

async function tanvir143SendVideo(api, event, buffer) {
    const tempDir = path.join(__dirname, "tmp");
    await fs.ensureDir(tempDir);

    const filePath = path.join(
        tempDir,
        `reel_${Date.now()}_${Math.random()
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
                        "🎬 Instagram Reel\n" +
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

module.exports = {
    config: {
        name: "reel",
        aliases: ["reels", "igdl", "instadl", "igsave"],
        version: "3.2.0",
        author: "Tanvir143",
        role: 0,
        countDown: 5,
        category: "Users Cmd",

        shortDescription: "Instagram Reel Downloader",

        longDescription:
            "Download and send Instagram Reels using ICA attachment streams.",

        guide: {
            en: "{pn} <Instagram Reel URL>"
        }
    },

    onStart: async function ({ api, event, args, message }) {
        let loadingSent = false;

        try {
            const rawURL = args.join(" ").trim();

            if (!rawURL) {
                await tanvir143SafeReact(api, event, "❌");

                return tanvir143SafeReply(
                    message,
                    "❌ | Please provide an Instagram Reel URL.\n\n" +
                    "📌 Example:\n" +
                    ".reel https://www.instagram.com/reel/XXXXXXXX/"
                );
            }

            const url = tanvir143NormalizeURL(rawURL);

            let validURL = false;

            try {
                validURL = Boolean(tanvir143igBot(url));
            } catch (error) {
                console.error(
                    "[Tanvir143] URL validation error:",
                    error?.message || error
                );
            }

            if (!validURL) {
                await tanvir143SafeReact(api, event, "❌");

                return tanvir143SafeReply(
                    message,
                    "❌ | Invalid Instagram Reel URL.\n" +
                    "Please use a valid public Reel link."
                );
            }

            await tanvir143SafeReact(api, event, "⏳");

            await tanvir143SafeReply(
                message,
                "💿 | Reels Downloading...\n⏳ | Please wait 1-3 minutes."
            );

            loadingSent = true;

            const result = await tanvir143Timeout(
                tanvirReelDownload(url),
                tanvir143.YTDL_TIMEOUT,
                "Instagram downloader"
            );

            if (!result || !Array.isArray(result.medias)) {
                throw new Error("No media information was returned.");
            }

            if (!result.medias.length) {
                throw new Error("No media was found in this Reel.");
            }

            const video = tanvir143SelectVideo(result.medias);

            if (!video) {
                throw new Error("No downloadable video was found.");
            }

            const buffer = await tanvirReelDownloadVideo(video.url);

            if (!Buffer.isBuffer(buffer) || !buffer.length) {
                throw new Error("Downloaded video is invalid.");
            }

            // Send through ICA's sendMessage attachment stream.
            await tanvir143SendVideo(api, event, buffer);

            await tanvir143SafeReact(api, event, "✅");

            return null;
        } catch (error) {
            console.error(
                "[Tanvir143 Reel Error]",
                error?.stack || error?.message || error
            );

            await tanvir143SafeReact(api, event, "❌");

            await tanvir143SafeReply(
                message,
                "❌ | Reel download/send failed.\n\n" +
                `📝 ${error?.message || "Unknown error"}\n\n` +
                "💡 Make sure the Reel is public and the URL is correct."
            );

            return null;
        }
    }
};
