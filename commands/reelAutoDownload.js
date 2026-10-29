/**
 * File Name: reelAutoDownload.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

const axios = require("axios");

module.exports = {
    config: {
        name: "reelAutoDownload",
        version: "1.0.0",
        author: "Tanvir Ahmed",
        cooldown: 5,
        role: 0,
        shortDescription: "Auto download instagram reels",
        longDescription: "Automatically detects and downloads instagram reels using download API",
        category: "media",
        guide: {
            en: "{prefix}reelAutoDownload"
        }
    },

    onStart: async function () {
        // Event-based command, er jonno onStart faka rakha holo
    },

    onEvent: async function ({ event, api }) {
        try {
            const sharedData = event.sharing || event.clip || event.media_share || event.itemType === "media" || event.itemType === "link";

            if (sharedData) {
                let reelUrl = event.sharing?.url || event.clip?.video_url || event.attachments?.[0]?.url;

                if (!reelUrl && event.body) {
                    const match = event.body.match(/(https?:\/\/(?:www\.)?(?:instagram\.com\/(?:p|reel|tv)\/[^\s]+|instagr\.am\/[^\s]+))/gi);
                    if (match) reelUrl = match[0];
                }

                if (reelUrl) {
                    console.log("Reel URL paoya geche, API call kora hocche...", reelUrl);

                    const myApiUrl = `https://noobs-api.top/dipto/alldl?url=${encodeURIComponent(reelUrl)}`;
                    const apiRes = await axios.get(myApiUrl);
                    
                    const directVideoUrl = apiRes.data.result;[span_0](start_span)[span_0](end_span)

                    if (!directVideoUrl) {
                        console.log("API theke kono video link paoya jayni.");
                        return;
                    }

                    const videoRes = await axios.get(directVideoUrl, { responseType: "arraybuffer" });
                    const videoBuffer = Buffer.from(videoRes.data, "binary");

                    await api.sendMessage(
                        {
                            body: "Here is your auto-downloaded Reel! 🎬",
                            attachment: videoBuffer
                        },
                        event.threadID,
                        event.messageID
                    );

                    console.log("Reel sothikvabe group-e send kora hoyeche!");
                }
            }
        } catch (error) {
            console.error("Reel auto download error:", error);
        }
    }
};
