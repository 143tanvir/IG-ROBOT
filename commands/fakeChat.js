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

const BAR_URL = "https://i.imgur.com/zGfbY4Z.jpeg";
const WIDTH = 1200;
const HEIGHT = 900;
const PADDING = 42;
const FONT_SIZE = 31;
const LINE_HEIGHT = 43;

let cachedBar = null;

module.exports = {
  config: {
    name: "fakechat",
    aliases: ["fc"],
    version: "2.0.0",
    author: "Tanvir143",
    countDown: 5,
    role: 0,
    shortDescription: "Create a fake DM chat image",
    category: "Users Cmd",
    guide: "{pn} message text"
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;

    try {
      const messageText = args.join(" ").trim();

      if (!messageText) {
        return api.sendMessage(
          "ব্যবহার: .fakechat তোমার মেসেজ লিখো",
          threadID,
          messageID
        );
      }

      let avatarBuffer = null;
      const replyID = event.messageReply?.senderID;

      // Use the replied person's avatar when available.
      const targetID = replyID || senderID;

      try {
        const info = await api.getUserInfo(targetID);
        const user = info?.[targetID];
        const avatarURL = user?.thumbSrc || user?.profileUrl;

        if (avatarURL) {
          const response = await axios.get(avatarURL, {
            responseType: "arraybuffer",
            timeout: 12000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });
          avatarBuffer = Buffer.from(response.data);
        }
      } catch (error) {
        console.log("[FakeChat] Avatar unavailable:", error.message);
      }

      // Download the bottom input bar once and cache it in RAM.
      if (!cachedBar) {
        try {
          const response = await axios.get(BAR_URL, {
            responseType: "arraybuffer",
            timeout: 15000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });
          cachedBar = Buffer.from(response.data);
        } catch (error) {
          console.log("[FakeChat] Input bar download failed:", error.message);
        }
      }

      // Wrap text by approximate character width.
      // Avoid SVG text rendering, which may show missing-glyph boxes.
      const maxChars = 46;
      const words = messageText.split(/\s+/);
      const lines = [];

      let line = "";

      for (const word of words) {
        if (word.length > maxChars) {
          if (line) {
            lines.push(line);
            line = "";
          }

          for (let i = 0; i < word.length; i += maxChars) {
            lines.push(word.slice(i, i + maxChars));
          }
          continue;
        }

        const next = line ? `${line} ${word}` : word;

        if (next.length > maxChars) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }

      if (line) lines.push(line);

      const bubbleX = 145;
      const bubbleY = 100;
      const bubbleW = WIDTH - bubbleX - PADDING;
      const textX = bubbleX + 30;
      const textY = bubbleY + 48;
      const bubbleH = Math.max(100, 64 + lines.length * LINE_HEIGHT);

      // Keep the entire image at 4:3.
      const barHeight = 105;
      const usableBottom = HEIGHT - barHeight - 25;
      const scale = Math.min(
        1,
        (usableBottom - bubbleY) / bubbleH
      );

      const finalBubbleW = Math.round(bubbleW * scale);
      const finalBubbleH = Math.round(bubbleH * scale);
      const finalBubbleX = bubbleX;
      const finalBubbleY = bubbleY;

      const svgLines = lines.map((text, index) => {
        const safeText = escapeXml(text);
        const y = textY + index * LINE_HEIGHT;

        return `
          <text x="${textX}" y="${y}"
            font-family="Noto Sans, DejaVu Sans, Arial, sans-serif"
            font-size="${FONT_SIZE}"
            fill="#ffffff">${safeText}</text>`;
      }).join("");

      const bubbleSvg = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${WIDTH}" height="${HEIGHT}">
          <rect x="${finalBubbleX}" y="${finalBubbleY}"
            width="${finalBubbleW}" height="${finalBubbleH}"
            rx="34" fill="#303030"/>
          ${svgLines}
        </svg>
      `);

      let image = sharp({
        create: {
          width: WIDTH,
          height: HEIGHT,
          channels: 3,
          background: "#000000"
        }
      }).composite([
        {
          input: await sharp(bubbleSvg)
            .png()
            .toBuffer()
        }
      ]);

      // Circular profile picture, if available.
      if (avatarBuffer) {
        try {
          const avatarSize = 76;
          const circleMask = Buffer.from(`
            <svg width="${avatarSize}" height="${avatarSize}">
              <circle cx="${avatarSize / 2}" cy="${avatarSize / 2}"
                r="${avatarSize / 2}" fill="white"/>
            </svg>
          `);

          const avatar = await sharp(avatarBuffer)
            .resize(avatarSize, avatarSize, { fit: "cover" })
            .composite([{ input: circleMask, blend: "dest-in" }])
            .png()
            .toBuffer();

          image = image.composite([
            { input: avatar, left: 42, top: 108 }
          ]);
        } catch (error) {
          console.log("[FakeChat] Avatar processing failed:", error.message);
        }
      }

      // Use the supplied input bar image when available.
      if (cachedBar) {
        try {
          const bar = await sharp(cachedBar)
            .resize(WIDTH, barHeight, { fit: "fill" })
            .png()
            .toBuffer();

          image = image.composite([
            { input: bar, left: 0, top: HEIGHT - barHeight }
          ]);
        } catch (error) {
          console.log("[FakeChat] Input bar processing failed:", error.message);
        }
      }

      const output = await image
        .jpeg({ quality: 92 })
        .toBuffer();

      return api.sendMessage(
        { body: "", attachment: output },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("[FakeChat] Error:", error);

      return api.sendMessage(
        "❌ FakeChat তৈরি করা যায়নি। আবার চেষ্টা করো।",
        threadID,
        messageID
      );
    }
  }
};

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
