
/**
 * File Name: mj.js
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

module.exports = {
  config: {
    name: "midjourney",
    aliases: ["mj", "midj"],
    version: "1.1.0",
    author: "Tanvir Ahmed (API BY Toshiro Editz)",
    cooldown: 7,
    role: 0,
    category: "users cmd",
    guide: {
      en: "{pn} <prompt>\nExample: {pn} a cute cat\nReply all to get the remaining images."
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const prompt = args.join(" ").trim();

    const tanvir_react = (emoji) => {
      try {
        if (typeof api.setMessageReaction === "function") {
          api.setMessageReaction(emoji, messageID, () => {});
        }
      } catch (error) {
        // Ignore reaction errors
      }
    };

    if (!prompt) {
      tanvir_react("❌");
      return message.reply(
        "❌ Please provide an image prompt.\n\n" +
        "Example: .mj a cute cat"
      );
    }

    tanvir_react("⏳");

    let statusMessage;

    try {
      statusMessage = await new Promise((resolve, reject) => {
        api.sendMessage(
          "⏳ MJ GEN STARTER...",
          threadID,
          (error, info) => {
            if (error) return reject(error);
            resolve(info);
          }
        );
      });

      const response = await axios.get(tosh iro_api_url, {
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

      const tanvir_images = [
        ...(Array.isArray(result.images) ? result.images : []),
        ...(result.image ? [result.image] : [])
      ].filter(
        (url, index, list) =>
          typeof url === "string" &&
          /^https?:\/\//i.test(url) &&
          list.indexOf(url) === index
      );

      if (!tanvir_images.length) {
        throw new Error("API did not return any valid image URLs.");
      }

      const imageUrl = tanvir_images[0];

      tanvir_react("✅");

      const imageResponse = await axios.get(imageUrl, {
        responseType: "stream",
        timeout: 60000,
        maxRedirects: 5
      });

      const sentInfo = await new Promise((resolve, reject) => {
        api.sendMessage(
          {
            body: "✅ sending midjourney image.",
            attachment: imageResponse.data
          },
          threadID,
          (error, info) => {
            if (error) return reject(error);
            resolve(info);
          }
        );
      });

      tanvir_react("💋");

      // Keep the remaining image URLs for reply handling.
      if (tanvir_images.length > 1 && sentInfo?.messageID) {
        console.log(
          `[TANVIR143 MJ] ${tanvir_images.length} images available; ` +
          `${tanvir_images.length - 1} remaining.`
        );

        // Your ICA loader's onReply registration must be connected here
        // to make replying "all" send the remaining images.
      }
    } catch (error) {
      tanvir_react("❌");

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
  }
};
