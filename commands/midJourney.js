
/**
 * File Name: midjourney.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * Instagram: @ig.tanvir_ahmed
 * Bot: Tanvir143 | IG-ROBOT
 */

"use strict";

const axios = require("axios");

const toshiro_api_url =
  "https://toshiro-api-editz6t9.vercel.app/api/image/mj";

const tanvir_mj_results = new Map();

module.exports = {
  config: {
    name: "midjourney",
    aliases: ["mj", "midj"],
    version: "1.2.0",
    author: "Tanvir Ahmed (API BY Toshiro Editz)",
    cooldown: 7,
    role: 0,
    shortDescription: "Generate MidJourney AI images",
    description: "Generate an image and reply all for the remaining images.",
    category: "users cmd",
    guide: {
      en: "{pn} <prompt>\nExample: {pn} a cute cat\nReply all to get the remaining images."
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const prompt = args.join(" ").trim();

    const react = (emoji, targetID = messageID) => {
      try {
        api.setMessageReaction(emoji, targetID, () => {});
      } catch (error) {
        // Ignore reaction errors
      }
    };

    const sendMessage = (content) =>
      new Promise((resolve, reject) => {
        api.sendMessage(content, threadID, (error, info) => {
          if (error) return reject(error);
          resolve(info);
        });
      });

    if (!prompt) {
      react("❌");
      return message.reply(
        "❌ Please provide an image prompt.\n\n" +
        "Example: .mj a cute cat"
      );
    }

    react("⏳");

    let statusMessage;

    try {
      statusMessage = await sendMessage(
        "⏳ MJ GEN STARTED..."
      );

      const response = await axios.get(toshiro_api_url, {
        params: { prompt },
        timeout: 180000,
        headers: { Accept: "application/json" }
      });

      const data = response.data;

      if (!data || data.success !== true) {
        throw new Error(
          data?.error || data?.message || "Image generation failed."
        );
      }

      const result = data.result || {};

      // The API returns four URLs in result.images.
      const images = [
        ...(Array.isArray(result.images) ? result.images : []),
        ...(result.image ? [result.image] : [])
      ].filter(
        (url, index, list) =>
          typeof url === "string" &&
          /^https?:\/\//i.test(url) &&
          list.indexOf(url) === index
      );

      if (!images.length) {
        throw new Error("No valid image URLs returned by the API.");
      }

      // Send the first image only.
      const imageResponse = await axios.get(images[0], {
        responseType: "stream",
        timeout: 60000,
        maxRedirects: 5
      });

      const sentInfo = await sendMessage({
        body: "✅ sending MJ image.",
        attachment: imageResponse.data
      });

      react("💋");

      // Save remaining URLs against the generated image message.
      if (images.length > 1 && sentInfo?.messageID) {
        tanvir_mj_results.set(sentInfo.messageID, {
          author: String(event.senderID),
          threadID,
          images: images.slice(1)
        });

        console.log(
          `[TANVIR143 MJ] ${images.length} images received; ` +
          `${images.length - 1} remaining.`
        );
      }

      react("✅");
    } catch (error) {
      react("❌");

      console.error(
        "[TANVIR143 MJ ERROR]",
        error.response?.data || error.message
      );

      return message.reply(
        "❌ MidJourney image generate/send failed.\n" +
        "Please try again later."
      );
    } finally {
      if (statusMessage?.messageID) {
        try {
          api.unsendMessage(statusMessage.messageID, () => {});
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  },

  onReply: async function ({ api, event, message }) {
    if ((event.body || "").trim().toLowerCase() !== "all") {
      return;
    }

    // Match the reply to the original generated image.
    const replyID =
      event.messageReply?.messageID ||
      event.messageReply?.messageID;

    const saved = tanvir_mj_results.get(replyID);

    if (!saved) {
      return message.reply(
        "❌ Image session not found. Generate a new image with .mj."
      );
    }

    if (String(event.senderID) !== saved.author) {
      return message.reply(
        "❌ Only the person who generated this image can request all images."
      );
    }

    const remaining = saved.images.slice();

    if (!remaining.length) {
      tanvir_mj_results.delete(replyID);
      return message.reply("❌ No remaining images available.");
    }

    try {
      for (const url of remaining) {
        const imageResponse = await axios.get(url, {
          responseType: "stream",
          timeout: 60000,
          maxRedirects: 5
        });

        await new Promise((resolve, reject) => {
          api.sendMessage(
            {
              body: "✅ Sending MJ images...",
              attachment: imageResponse.data
            },
            saved.threadID,
            (error) => {
              if (error) return reject(error);
              resolve();
            }
          );
        });
      }

      tanvir_mj_results.delete(replyID);

      try {
        api.setMessageReaction("💋", event.messageID, () => {});
      } catch (error) {
        // Ignore reaction errors
      }
    } catch (error) {
      console.error(
        "[TANVIR143 MJ REPLY ERROR]",
        error.response?.data || error.message
      );

      try {
        api.setMessageReaction("❌", event.messageID, () => {});
      } catch (e) {
        // Ignore reaction errors
      }

      return message.reply(
        "❌ Failed to send all remaining images."
      );
    }
  }
};
