/**
 * File Name: fakechat.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 */

"use strict";

const sharp = require("sharp");
const axios = require("axios");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { Readable } = require("stream");

const W = 1200;
const H = 900;
const BAR_URL = "https://i.imgur.com/zGfbY4Z.jpeg";

let barCache = null;

module.exports = {
  config: {
    name: "fakechat",
    aliases: ["fc"],
    version: "3.0.0",
    author: "Tanvir143v2",
    cooldown: 5,
    role: 0,
    shortDescription: "Create a fake DM chat image",
    category: "Users Cmd",
    guide: "{pn} message text"
  },

  onStart: async function ({ args, event, message, api }) {
    try {
      const text = args.join(" ").trim();

      if (!text) {
        return message.reply("ব্যবহার: .fakechat তোমার মেসেজ");
      }

      // Base image: black background, 4:3 ratio.
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);

      // Wrap text by measured width, not character count.
      const fontSize = 32;
      const lineHeight = 46;
      const maxWidth = 900;

      ctx.font = `${fontSize}px sans-serif`;

      const lines = [];
      let current = "";

      for (const word of text.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;

        if (ctx.measureText(candidate).width <= maxWidth) {
          current = candidate;
        } else {
          if (current) lines.push(current);

          // Split unusually long words safely.
          current = "";
          for (const char of word) {
            const next = current + char;

            if (ctx.measureText(next).width > maxWidth && current) {
              lines.push(current);
              current = char;
            } else {
              current = next;
            }
          }
        }
      }

      if (current) lines.push(current);

      const bubbleX = 150;
      const bubbleY = 95;
      const bubbleW = 1000;
      const bubbleH = Math.max(100, 52 + lines.length * lineHeight);
      const barH = 105;
      const maxBubbleH = H - barH - bubbleY - 25;

      // Scale long messages to fit the image.
      const scale = Math.min(1, maxBubbleH / bubbleH);

      ctx.save();
      ctx.translate(bubbleX, bubbleY);
      ctx.scale(scale, scale);

      // Gray message bubble.
      ctx.fillStyle = "#303030";
      ctx.beginPath();
      ctx.roundRect(0, 0, bubbleW, bubbleH, 32);
      ctx.fill();

      // Message text.
      ctx.fillStyle = "#ffffff";
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textBaseline = "top";

      lines.forEach((line, i) => {
        ctx.fillText(line, 30, 28 + i * lineHeight);
      });

      ctx.restore();

      // Profile picture of replied-to person, otherwise sender.
      const targetID = event.messageReply?.senderID || event.senderID;

      try {
        const info = await new Promise((resolve, reject) => {
          api.getUserInfo(targetID, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });

        const user = info?.[targetID];
        const avatarURL =
          user?.thumbSrc ||
          user?.profilePicture ||
          user?.profilePicUrl;

        if (avatarURL) {
          const response = await axios.get(avatarURL, {
            responseType: "arraybuffer",
            timeout: 10000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });

          const avatar = await loadImage(Buffer.from(response.data));

          ctx.save();
          ctx.beginPath();
          ctx.arc(80, 140, 38, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatar, 42, 102, 76, 76);
          ctx.restore();
        }
      } catch (err) {
        console.log("[FakeChat] Avatar:", err.message);
      }

      // Cache the supplied input-bar image in RAM.
      if (!barCache) {
        try {
          const response = await axios.get(BAR_URL, {
            responseType: "arraybuffer",
            timeout: 12000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });
          barCache = Buffer.from(response.data);
        } catch (err) {
          console.log("[FakeChat] Input bar:", err.message);
        }
      }

      if (barCache) {
        try {
          const bar = await loadImage(barCache);
          ctx.drawImage(bar, 0, H - barH, W, barH);
        } catch (err) {
          console.log("[FakeChat] Bar render:", err.message);
        }
      }

      const imageBuffer = await sharp(canvas.toBuffer("image/png"))
        .resize(W, H)
        .jpeg({ quality: 92 })
        .toBuffer();

      return message.reply({
        attachment: Readable.from([imageBuffer])
      });
    } catch (err) {
      console.error("[FakeChat] Error:", err);

      return message.reply(
        "❌ FakeChat তৈরি করা যায়নি: " + err.message
      );
    }
  }
};
