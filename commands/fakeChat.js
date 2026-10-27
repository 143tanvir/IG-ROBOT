/**
 * File Name: fakechat.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * Instagram: @ig.tanvir_ahmed
 */

"use strict";

const axios = require("axios");
const sharp = require("sharp");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { Readable } = require("stream");

const WIDTH = 1200;
const HEIGHT = 900;
const BAR_URL = "https://i.imgur.com/zGfbY4Z.jpeg";

let barCache = null;

module.exports = {
  config: {
    name: "fakechat",
    aliases: ["fc"],
    version: "4.0.0",
    author: "Tanvir143",
    countDown: 5,
    role: 0,
    shortDescription: "Create a fake chat image",
    category: "Users Cmd",
    guide: "{pn} message text"
  },

  onStart: async function ({ api, event, args, message }) {
    try {
      const text = args.join(" ").trim();

      if (!text) {
        return message.reply("ব্যবহার: .fakechat তোমার মেসেজ");
      }

      // Fixed 4:3 canvas — never stretch the final image.
      const canvas = createCanvas(WIDTH, HEIGHT);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const bubbleX = 145;
      const bubbleY = 90;
      const bubbleW = 1010;
      const maxBubbleH = 665;
      const textX = bubbleX + 30;
      const textMaxW = bubbleW - 60;
      const barH = 105;

      let fontSize = 32;
      let lineHeight;
      let lines;
      let bubbleH;

      function wrapText(value, maxWidth) {
        const result = [];

        for (const paragraph of value.split("\n")) {
          if (!paragraph.trim()) {
            result.push("");
            continue;
          }

          let line = "";

          for (const word of paragraph.split(/\s+/)) {
            // Split very long words by measured width.
            let part = "";

            for (const char of word) {
              const next = part + char;

              if (ctx.measureText(next).width > maxWidth && part) {
                if (line) {
                  result.push(line);
                  line = "";
                }

                result.push(part);
                part = char;
              } else {
                part = next;
              }
            }

            if (!part) continue;

            const candidate = line ? `${line} ${part}` : part;

            if (ctx.measureText(candidate).width <= maxWidth) {
              line = candidate;
            } else {
              if (line) result.push(line);
              line = part;
            }
          }

          if (line) result.push(line);
        }

        return result.length ? result : [""];
      }

      // Fit text by changing font size, not image dimensions.
      do {
        lineHeight = Math.round(fontSize * 1.4);
        ctx.font = `${fontSize}px sans-serif`;
        lines = wrapText(text, textMaxW);
        bubbleH = Math.max(100, 46 + lines.length * lineHeight);

        if (bubbleH <= maxBubbleH) break;
        fontSize -= 1;
      } while (fontSize >= 17);

      // Draw bubble.
      ctx.fillStyle = "#303030";
      ctx.beginPath();
      ctx.roundRect(bubbleX, bubbleY, bubbleW, Math.min(bubbleH, maxBubbleH), 30);
      ctx.fill();

      // Draw readable text inside the bubble.
      ctx.fillStyle = "#ffffff";
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textBaseline = "top";

      lines.forEach((line, index) => {
        const y = bubbleY + 24 + index * lineHeight;

        if (y + lineHeight < bubbleY + maxBubbleH - 8) {
          ctx.fillText(line, textX, y);
        }
      });

      // Replied user's avatar, or sender's avatar by default.
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
          ctx.arc(80, 132, 38, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatar, 42, 94, 76, 76);
          ctx.restore();
        }
      } catch (error) {
        console.log("[FakeChat] Avatar unavailable:", error.message);
      }

      // Cache input bar in memory; no temporary files.
      if (!barCache) {
        try {
          const response = await axios.get(BAR_URL, {
            responseType: "arraybuffer",
            timeout: 12000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });

          barCache = Buffer.from(response.data);
        } catch (error) {
          console.log("[FakeChat] Input bar unavailable:", error.message);
        }
      }

      if (barCache) {
        try {
          const bar = await loadImage(barCache);

          // Fit the bar without distorting its aspect ratio.
          const scale = Math.min(WIDTH / bar.width, barH / bar.height);
          const drawW = bar.width * scale;
          const drawH = bar.height * scale;

          ctx.fillStyle = "#080808";
          ctx.fillRect(0, HEIGHT - barH, WIDTH, barH);

          ctx.drawImage(
            bar,
            (WIDTH - drawW) / 2,
            HEIGHT - barH + (barH - drawH) / 2,
            drawW,
            drawH
          );
        } catch (error) {
          console.log("[FakeChat] Input bar render failed:", error.message);
        }
      }

      const output = await sharp(canvas.toBuffer("image/png"))
        .jpeg({ quality: 92 })
        .toBuffer();

      // ICA-style image attachment reply.
      return api.sendMessage(
        { body: "", attachment: Readable.from([output]) },
        event.threadID,
        err => {
          if (err) console.error("[FakeChat] Send failed:", err);
        },
        event.messageID
      );
    } catch (error) {
      console.error("[FakeChat] Error:", error);
      return message.reply("❌ FakeChat error: " + error.message);
    }
  }
};
