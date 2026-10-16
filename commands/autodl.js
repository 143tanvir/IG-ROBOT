
/**
 * File Name: autodl.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const CACHE_DIR = path.join(__dirname, "cache", "autodl");
const TIMEOUT = 180000;
const MAX_SIZE = 1024 * 1024 * 1024;
const API_TIMEOUT = 20000;

fs.ensureDirSync(CACHE_DIR);

function log(...args) {
    console.log("[IG-ROBOT AUTODL]", ...args);
}

function getURL(text) {
    if (!text) return null;

    const match = String(text).match(/https?:\/\/[^\s<>"']+/i);
    if (!match) return null;

    return match[0].replace(/[)\]}>.,!?;:'"]+$/g, "");
}

function isURL(url) {
    try {
        const u = new URL(url);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

function detectPlatform(url) {
    let host;

    try {
        host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return null;
    }

    if (
        host === "instagram.com" ||
        host.endsWith(".instagram.com") ||
        host === "instagr.am"
    ) return "instagram";

    if (
        host === "tiktok.com" ||
        host.endsWith(".tiktok.com") ||
        host === "vt.tiktok.com" ||
        host === "vm.tiktok.com"
    ) return "tiktok";

    if (
        host === "facebook.com" ||
        host.endsWith(".facebook.com") ||
        host === "fb.watch"
    ) return "facebook";

    if (
        host === "youtube.com" ||
        host.endsWith(".youtube.com") ||
        host === "youtu.be"
    ) return "youtube";

    if (
        host === "twitter.com" ||
        host.endsWith(".twitter.com") ||
        host === "x.com" ||
        host.endsWith(".x.com")
    ) return "twitter";

    if (
        host === "pinterest.com" ||
        host.endsWith(".pinterest.com") ||
        host === "pin.it"
    ) return "pinterest";

    if (
        host === "threads.net" ||
        host.endsWith(".threads.net") ||
        host === "threads.com" ||
        host.endsWith(".threads.com")
    ) return "threads";

    if (
        host === "soundcloud.com" ||
        host.endsWith(".soundcloud.com")
    ) return "soundcloud";

    if (
        host === "spotify.com" ||
        host.endsWith(".spotify.com")
    ) return "spotify";

    if (
        host === "mediafire.com" ||
        host.endsWith(".mediafire.com")
    ) return "mediafire";

    if (
        host === "capcut.com" ||
        host.endsWith(".capcut.com")
    ) return "capcut";

    if (host === "drive.google.com") return "gdrive";

    return "universal";
}

function platformName(platform) {
    const names = {
        instagram: "Instagram",
        tiktok: "TikTok",
        facebook: "Facebook",
        youtube: "YouTube",
        twitter: "Twitter / X",
        pinterest: "Pinterest",
        threads: "Threads",
        soundcloud: "SoundCloud",
        spotify: "Spotify",
        mediafire: "MediaFire",
        capcut: "CapCut",
        gdrive: "Google Drive",
        universal: "Web Media"
    };

    return names[platform] || "Unknown";
}

function sendMessage(api, data, threadID, replyToMessageID) {
    return new Promise((resolve, reject) => {
        api.sendMessage(
            data,
            threadID,
            (err, info) => {
                if (err) return reject(err);
                resolve(info || null);
            },
            replyToMessageID
        );
    });
}

function setReaction(api, emoji, messageID) {
    return new Promise(resolve => {
        if (
            !messageID ||
            typeof api.setMessageReaction !== "function"
        ) {
            log("Reaction API unavailable.");
            return resolve(false);
        }

        api.setMessageReaction(emoji, messageID, err => {
            if (err) {
                log("Reaction error:", err.message || err);
            }

            resolve(!err);
        });
    });
}

async function removeWaitMessage(api, info) {
    const messageID = info?.messageID || info?.messageId;

    if (!messageID || typeof api.unsendMessage !== "function") {
        return;
    }

    try {
        await new Promise(resolve => {
            api.unsendMessage(messageID, () => resolve());
            setTimeout(resolve, 3000);
        });
    } catch (_) {}
}

async function fetchMediaLink(url) {
    try {
        const apiURL =
            "https://ahm7xmakki.com/api/alldl?url=" +
            encodeURIComponent(url);

        const res = await axios.get(apiURL, {
            timeout: API_TIMEOUT
        });

        const data = res.data;
        const info = data?.mediaInfo || data?.data;

        if (data?.success && info) {
            const mediaURL =
                info.videoUrl ||
                info.video_url ||
                info.downloadUrl ||
                info.download_url ||
                (Array.isArray(info.qualities)
                    ? info.qualities.find(q => q?.url)?.url
                    : null) ||
                info.imageUrl ||
                info.audioUrl;

            if (mediaURL && isURL(mediaURL)) {
                return {
                    url: mediaURL,
                    type: detectMediaType(mediaURL)
                };
            }
        }

        log("Primary API returned no usable media URL.");
    } catch (error) {
        log("[PRIMARY API]", error.message);
    }

    // TikWM is retained for compatibility with the previous code.
    // It may not support Instagram URLs.
    try {
        const res = await axios.get(
            "https://tikwm.com/api/?url=" + encodeURIComponent(url),
            { timeout: 15000 }
        );

        const data = res.data?.data;

        if (data?.play && isURL(data.play)) {
            return {
                url: data.play,
                type: "video"
            };
        }

        if (Array.isArray(data?.images) && data.images.length) {
            const imageURL = data.images[0];

            if (isURL(imageURL)) {
                return {
                    url: imageURL,
                    type: "image"
                };
            }
        }
    } catch (error) {
        log("[FALLBACK API]", error.message);
    }

    if (
        /\.(mp4|m4v|webm|mov|jpg|jpeg|png|webp|gif|mp3|m4a|wav)(\?.*)?$/i
            .test(url)
    ) {
        return {
            url,
            type: detectMediaType(url)
        };
    }

    throw new Error(
        "Could not extract a direct media link. The platform may be unsupported."
    );
}

function detectMediaType(url) {
    let pathname = "";

    try {
        pathname = new URL(url).pathname.toLowerCase();
    } catch {}

    if (/\.(jpg|jpeg|png|webp|gif)$/.test(pathname)) {
        return "image";
    }

    if (/\.(mp3|m4a|wav|ogg)$/.test(pathname)) {
        return "audio";
    }

    return "video";
}

async function downloadFile(mediaData) {
    if (!isURL(mediaData.url)) {
        throw new Error("Invalid media URL.");
    }

    const response = await axios.get(mediaData.url, {
        responseType: "arraybuffer",
        timeout: TIMEOUT,
        maxContentLength: MAX_SIZE,
        maxBodyLength: MAX_SIZE,
        maxRedirects: 10,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/120.0.0.0 Safari/537.36",
            Accept: "*/*"
        }
    });

    const contentType = String(
        response.headers["content-type"] || ""
    ).toLowerCase();

    if (
        contentType.startsWith("text/html") ||
        contentType.includes("application/json")
    ) {
        throw new Error(
            "The downloader returned a webpage instead of a media file."
        );
    }

    const buffer = Buffer.from(response.data);

    if (!buffer.length) {
        throw new Error("The downloaded file is empty.");
    }

    if (buffer.length > MAX_SIZE) {
        throw new Error("The media exceeds the 1 GB file limit.");
    }

    let ext = "mp4";
    let format = "MP4";

    if (mediaData.type === "image" || contentType.startsWith("image/")) {
        if (contentType.includes("png")) {
            ext = "png";
        } else if (contentType.includes("webp")) {
            ext = "webp";
        } else if (contentType.includes("gif")) {
            ext = "gif";
        } else if (
            contentType.includes("jpeg") ||
            contentType.includes("jpg")
        ) {
            ext = "jpg";
        } else {
            ext = path.extname(new URL(mediaData.url).pathname).slice(1) || "jpg";
        }

        format = ext.toUpperCase();
    } else if (
        mediaData.type === "audio" ||
        contentType.startsWith("audio/")
    ) {
        if (contentType.includes("wav")) {
            ext = "wav";
        } else if (contentType.includes("ogg")) {
            ext = "ogg";
        } else if (contentType.includes("mp4")) {
            ext = "m4a";
        } else {
            ext = "mp3";
        }

        format = ext.toUpperCase();
    } else {
        const pathname = new URL(mediaData.url).pathname;
        const originalExt = path.extname(pathname).toLowerCase();

        if ([".webm", ".mov", ".m4v"].includes(originalExt)) {
            ext = originalExt.slice(1);
        }

        format = ext.toUpperCase();
    }

    const file = path.join(
        CACHE_DIR,
        `tanvir143_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}.${ext}`
    );

    await fs.writeFile(file, buffer);

    return { file, format };
}

module.exports = {
    config: {
        name: "autodl",
        aliases: ["reel", "ig", "tt"],
        version: "17.2",
        author: "Tanvir Ahmed (Tanvir143)",
        cooldown: 3,
        role: 0,
        category: "Users Cmd",
        shortDescription: {
            en: "Automatic media downloader"
        },
        longDescription: {
            en: "Detects media links and downloads supported images, videos and audio."
        },
        guide: {
            en: "{pn} — send a supported media link in chat."
        }
    },

    onStart: async function ({ api, message, event }) {
        const msg =
            "•━━━━━━━━━━━━━━━━━━•\n" +
            "   🚀 Powered By Tanvir143\n" +
            "•━━━━━━━━━━━━━━━━━━•\n\n" +
            "✅ Supported platforms\n\n" +
            "1. 🎵 TikTok\n" +
            "2. 📸 Instagram\n" +
            "3. 📘 Facebook\n" +
            "4. ▶️ YouTube\n" +
            "5. 🐦 Twitter / X\n" +
            "6. 📌 Pinterest\n" +
            "7. 🧵 Threads\n" +
            "8. 🎧 SoundCloud\n" +
            "9. 🎵 Spotify\n" +
            "10. 📁 MediaFire\n" +
            "11. ✂️ CapCut\n" +
            "12. ☁️ Google Drive\n\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "📌 How to use\n\n" +
            "Send a supported media URL in the chat.\n" +
            "The bot will try to detect and download it automatically.\n\n" +
            "•━━━━━━━━━━━━━━━━━━•";

        return message.reply(msg);
    },

    onChat: async function ({ api, event }) {
        if (!event || event.type === "message_reaction") return;

        const text = String(event.body || "").trim();
        if (!text) return;

        const url = getURL(text);
        if (!url || !isURL(url)) return;

        const platform = detectPlatform(url);
        if (!platform) return;

        let file = null;
        let waitMsgInfo = null;
        let mediaUrlObtained = false;

        try {
            await setReaction(api, "🧐", event.messageID);

            log("Link detected:", platform);

            waitMsgInfo = await sendMessage(
                api,
                "⏳ Downloading Started...\n🕛 Please wait 1-5 minutes.",
                event.threadID,
                event.messageID
            ).catch(error => {
                log("Status message failed:", error.message);
                return null;
            });

            const mediaData = await fetchMediaLink(url);

            // API supplied a usable media URL.
            mediaUrlObtained = true;
            await setReaction(api, "✅", event.messageID);

            const downloaded = await downloadFile(mediaData);
            file = downloaded.file;

            const caption =
                "♻️ SENDING YOUR VIDEO...\n\n" +
                "🎯 Platform: " + platformName(platform) + "\n" +
                "📦 Format: " + downloaded.format;

            await removeWaitMessage(api, waitMsgInfo);
            waitMsgInfo = null;

            await sendMessage(
                api,
                {
                    body: caption,
                    attachment: fs.createReadStream(file)
                },
                event.threadID,
                event.messageID
            );

            // Keep the success reaction on the original link message.
            await setReaction(api, "✅", event.messageID);

            log("Media sent successfully:", platform);
        } catch (error) {
            const reason = String(
                error?.message || error || "Unknown error"
            ).slice(0, 500);

            log("Download/send failed:", reason);

            // Any download or send error changes the reaction to ❌.
            await setReaction(api, "❌", event.messageID);

            await removeWaitMessage(api, waitMsgInfo);

            try {
                await sendMessage(
                    api,
                    "❌ Download Failed\n" +
                    "•━━━━━━━━━━━━━━━━━━•\n" +
                    "Reason: " + reason,
                    event.threadID,
                    event.messageID
                );
            } catch (sendError) {
                log("Error reply failed:", sendError.message);
            }
        } finally {
            if (file) {
                setTimeout(() => {
                    fs.remove(file).catch(() => {});
                }, 10000);
            }
        }
    }
};
