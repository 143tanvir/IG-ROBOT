
/**
 * File Name: midjourney.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

const axios = require("axios");

const toshiro_api_url =
  "https://toshiro-api-editz6t9.vercel.app/api/image/mj";

module.exports = {
  config: {
    name: "midjourney",
    aliases: ["mj", "midj"],
    version: "1.2.0",
    author: "Tanvir Ahmed (API BY Toshiro Editz)",
    cooldown: 7,
    role: 0,
    shortDescription: "Generate MidJourney images",
    description: "Generate images and reply all for the remaining images",
    category: "users cmd",
    guide: {
      en: "{pn} <prompt>\nReply all to the generated image for remaining images."
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const prompt = args.join(" ").trim();
    const threadID = event.threadID;
    const react = emoji =>
      api.setMessageReaction(emoji, event.messageID, () => {});

    if (!prompt) {
      react("❌");
      return message.reply("❌ Example: .mj a cute cat");
    }

    let status;

    try {
      react("⏳");

      status = await new Promise((resolve, reject) =>
        api.sendMessage("⏳ MJ GEN STARTED...", threadID,
          (err, info) => err ? reject(err) : resolve(info))
      );

      const { data } = await axios.get(toshiro_api_url, {
        params: { prompt },
        timeout: 180000
      });

      if (data?.success !== true)
        throw new Error(data?.message || "API failed");

      const result = data.result || {};
      const images = [...new Set([
        ...(Array.isArray(result.images) ? result.images : []),
        ...(result.image ? [result.image] : [])
      ].filter(url => typeof url === "string" && /^https?:\/\//i.test(url)))];

      if (!images.length) throw new Error("No image URLs returned");

      const stream = await axios.get(images[0], {
        responseType: "stream",
        timeout: 60000
      });

      const sent = await new Promise((resolve, reject) =>
        api.sendMessage({
          body: "✅ SENDING MJ IMAGE...",
          attachment: stream.data
        }, threadID, (err, info) => err ? reject(err) : resolve(info))
      );

      react("💋");

      // Register remaining images for GoatBot V2 reply handling.
      if (images.length > 1 && sent?.messageID && global.GoatBot?.onReply?.set) {
        global.GoatBot.onReply.set(sent.messageID, {
          commandName: "midjourney",
          messageID: sent.messageID,
          author: event.senderID,
          threadID,
          images: images.slice(1)
        });
      } else if (images.length > 1) {
        console.error("[TANVIR143 MJ] Reply handler registry unavailable.");
      }

      react("✅");
    } catch (error) {
      react("❌");
      console.error("[TANVIR143 MJ ERROR]", error.response?.data || error.message);
      return message.reply("❌ MidJourney image generate/send failed.");
    } finally {
      if (status?.messageID) {
        api.unsendMessage(status.messageID, () => {});
      }
    }
  },

  onReply: async function ({ api, event, Reply, message }) {
    if ((event.body || "").trim().toLowerCase() !== "all") return;

    if (String(event.senderID) !== String(Reply.author))
      return message.reply("❌ Only the image creator can use all.");

    const images = Reply.images || [];
    if (!images.length)
      return message.reply("❌ No remaining images.");

    // Remove registration before sending to prevent duplicate sends.
    global.GoatBot?.onReply?.delete(Reply.messageID);

    try {
      for (const url of images) {
        const response = await axios.get(url, {
          responseType: "stream",
          timeout: 60000
        });

        await new Promise((resolve, reject) =>
          api.sendMessage({
            body: "Enjoy using tanvir143 robot.",
            attachment: response.data
          }, event.threadID, err => err ? reject(err) : resolve())
        );
      }

      api.setMessageReaction("💋", event.messageID, () => {});
    } catch (error) {
      console.error("[TANVIR143 MJ REPLY ERROR]", error.message);
      api.setMessageReaction("❌", event.messageID, () => {});
      return message.reply("❌ Failed to send all remaining images.");
    }
  }
};
