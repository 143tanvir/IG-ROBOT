
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
    version: "1.3.0",
    author: "Tanvir Ahmed (API BY Toshiro Editz)",
    cooldown: 7,
    role: 0,
    shortDescription: "Generate MidJourney images",
    description: "Generate images and reply all for remaining images",
    category: "users cmd",
    guide: "{pn} <prompt> | Reply all for remaining images"
  },

  onStart: async function ({
    api,
    event,
    args,
    message,
    setReplyHandler
  }) {
    const tanvir143_prompt = args.join(" ").trim();

    const tanvir143_react = emoji =>
      api.setMessageReaction(emoji, event.messageID, () => {});

    if (!tanvir143_prompt) {
      tanvir143_react("❌");
      return message.reply("❌ Example: .mj a cute cat");
    }

    let tanvir143_status;

    try {
      tanvir143_react("⏳");

      tanvir143_status = await new Promise((resolve, reject) =>
        api.sendMessage(
          "⏳ MJ GEN STARTED...",
          event.threadID,
          (err, info) => err ? reject(err) : resolve(info)
        )
      );

      const { data } = await axios.get(toshiro_api_url, {
        params: { prompt: tanvir143_prompt },
        timeout: 180000
      });

      if (data?.success !== true)
        throw new Error(data?.message || "API failed");

      const result = data.result || {};

      const tanvir143_images = [...new Set([
        ...(Array.isArray(result.images) ? result.images : []),
        ...(result.image ? [result.image] : [])
      ].filter(url =>
        typeof url === "string" && /^https?:\/\//i.test(url)
      ))];

      if (!tanvir143_images.length)
        throw new Error("No images returned");

      const tanvir143_stream = await axios.get(
        tanvir143_images[0],
        {
          responseType: "stream",
          timeout: 60000
        }
      );

      const tanvir143_sent = await message.reply({
        body: "✅ MJ IMAGE GENERATED\n\nReply to this message within   all   to see all image.",
        attachment: tanvir143_stream.data
      });

      tanvir143_react("✅");

      if (
        tanvir143_images.length > 1 &&
        typeof setReplyHandler === "function" &&
        tanvir143_sent?.messageID
      ) {
        setReplyHandler(async ({
          event: replyEvent,
          message: replyMessage
        }) => {
          if (
            String(replyEvent.senderID) !== String(event.senderID)
          ) {
            return replyMessage.reply(
              "❌ Only the image creator can use all."
            );
          }

          if (
            (replyEvent.body || "").trim().toLowerCase() !== "all"
          ) return;

          const tanvir143_remaining = tanvir143_images.slice(1);

          try {
            for (const url of tanvir143_remaining) {
              const response = await axios.get(url, {
                responseType: "stream",
                timeout: 60000
              });

              await replyMessage.reply({
                body: "",
                attachment: response.data
              });
            }

            api.setMessageReaction(
              "💋",
              replyEvent.messageID,
              () => {}
            );
          } catch (error) {
            console.error(
              "[TANVIR143 MJ REPLY ERROR]",
              error.message
            );

            replyMessage.reply(
              "❌ Failed to send all remaining images."
            );
          }
        }, tanvir143_sent.messageID);
      } else if (tanvir143_images.length > 1) {
        console.error(
          "[TANVIR143 MJ] ICA reply handler unavailable."
        );
      }
    } catch (error) {
      tanvir143_react("❌");

      console.error(
        "[TANVIR143 MJ ERROR]",
        error.response?.data || error.message
      );

      return message.reply(
        "❌ MidJourney image generate/send failed."
      );
    } finally {
      if (tanvir143_status?.messageID) {
        api.unsendMessage(tanvir143_status.messageID, () => {});
      }
    }
  }
};
