
"use strict";

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const tanvir143 = {
    api: "https://noobs-api.top/dipto/alldl?url=",
    emoji: { loading: "🧐", success: "✅", error: "❌" },
    cache: path.join(__dirname, "cache", "igvideo")
};

fs.ensureDirSync(tanvir143.cache);

module.exports = {
    config: {
        name: "autodl",
        aliases: ["ig", "reel"],
        version: "1.0",
        author: "Tanvir Ahmed (Tanvir143)",
        cooldown: 3,
        role: 0,
        category: "Users Cmd",
        shortDescription: { en: "Instagram video downloader" },
        guide: { en: "Send an Instagram Reel/video link." }
    },

    onChat: async function ({ api, event }) {
        const match = String(event.body || "").match(
            /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[^\s]+/i
        );
        if (!match || event.type === "message_reaction") return;

        const url = match[0].replace(/[)\]}>.,!?;:'"]+$/g, "");
        const { emoji, cache } = tanvir143;
        let file;

        const react = e => new Promise(resolve => {
            if (!event.messageID || !api.setMessageReaction) return resolve();
            try {
                api.setMessageReaction(e, event.messageID, () => resolve());
            } catch (_) { resolve(); }
        });

        const send = data => new Promise((resolve, reject) => {
            api.sendMessage(data, event.threadID, (err, info) =>
                err ? reject(err) : resolve(info), event.messageID
            );
        });

        try {
            await react(emoji.loading);

            const { data } = await axios.get(
                tanvir143.api + encodeURIComponent(url),
                { timeout: 30000 }
            );

            const videoURL = data?.result?.video;
            if (!videoURL || !/^https?:\/\//i.test(videoURL)) {
                throw new Error("Video URL পাওয়া যায়নি");
            }

            await react(emoji.success);

            const response = await axios.get(videoURL, {
                responseType: "arraybuffer",
                timeout: 180000,
                maxContentLength: 1024 * 1024 * 1024
            });

            const type = String(response.headers["content-type"] || "");
            if (type.includes("text/html") || !response.data?.length) {
                throw new Error("Invalid video response");
            }

            file = path.join(cache, `ig_${Date.now()}.mp4`);
            await fs.writeFile(file, response.data);

            await send({
                body: "📦 SENDING YOUR VIDEO",
                attachment: fs.createReadStream(file)
            });

            await react(emoji.success);
        } catch (_) {
            await react(emoji.error);
            try {
                await send(emoji.error + " Video download failed.");
            } catch (_) {}
        } finally {
            if (file) setTimeout(() => fs.remove(file).catch(() => {}), 10000);
        }
    }
};
