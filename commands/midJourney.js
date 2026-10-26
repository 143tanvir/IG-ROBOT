
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

const API_URL = "https://toshiro-api-editz6t9.vercel.app/api/image/mj";

module.exports = {
  config: {
    name: "midjourney",
    aliases: ["mj", "midj"],
    version: "1.0.0",
    author: "Tanvir Ahmed (API tushiro editz)",
    cooldown: 6,
    role: 0,
    category: "Users cmd",
    guide: {
      en: "{pn} <prompt>\nExample: {pn} a cute cat"
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const prompt = args.join(" ").trim();

    // React helper
    const react = (emoji) => {
      try {
        if (typeof api.setMessageReaction === "function") {
          api.setMessageReaction(emoji, messageID, () => {});
        }
      } catch (error) {
        // Ignore reaction errors
      }
    };

    // Validate prompt
    if (!prompt) {
      react("❌");
      return message.reply(
        "❌ Please provide an image prompt.\n\n" +
        "Example: .mj a cute cat"
      );
    }

    // Generating reaction
    react("⏳");

    let statusMessage;

    try {
      statusMessage = await new Promise((resolve, reject) => {
        api.sendMessage(
          "🍫 midjourney generating...",
          threadID,
          (error, info) => {
            if (error) return reject(error);
            resolve(info);
          }
        );
      });

      // Call MidJourney API
      const response = await axios.get(API_URL, {
        params: {
          prompt: prompt
        },
        timeout: 180000,
        headers: {
          Accept: "application/json"
        }
      });

      const data = response.data;

      if (!data || data.success !== true) {
        throw new Error(
          data?.error ||
          data?.message ||
          "Image generation failed."
        );
      }

      const result = data.result || {};

      // Support both image and images fields
      const imageUrl =
        result.image ||
        (Array.isArray(result.images) && result.images.length
          ? result.images[0]
          : null);

      if (
        typeof imageUrl !== "string" ||
        !/^https?:\/\//i.test(imageUrl)
      ) {
        throw new Error("API did not return a valid image URL.");
      }

      // Generation successful
      react("✅");

      // Download generated image
      const imageResponse = await axios.get(imageUrl, {
        responseType: "stream",
        timeout: 60000,
        maxRedirects: 5
      });

      // Send image to group with footer
      await new Promise((resolve, reject) => {
        api.sendMessage(
          {
            body: "Midjourney generation successful.",
            attachment: imageResponse.data
          },
          threadID,
          (error, info) => {
            if (error) return reject(error);
            resolve(info);
          }
        );
      });

      // Image sent successfully
      react("💋");

      // Remove generating message
      if (statusMessage && statusMessage.messageID) {
        try {
          api.unsendMessage(statusMessage.messageID, () => {});
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      react("❌");

      // Remove generating message after failure
      if (statusMessage && statusMessage.messageID) {
        try {
          api.unsendMessage(statusMessage.messageID, () => {});
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      console.error(
        "[TANVIR143 MJ ERROR]",
        error.response?.data || error.message
      );

      return message.reply(
        "❌ MidJourney image generate/send failed.\n" +
        "Please try again later."
      );
    }
  }
};
