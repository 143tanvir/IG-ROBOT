
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
const { Readable } = require("stream");

const BAR_URL = "https://i.imgur.com/zGfbY4Z.jpeg";

const WIDTH = 1000;
const FONT_SIZE = 34;
const LINE_HEIGHT = 43;
const MAX_TEXT = 3000;

function escapeXML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function charWidth(char) {
  if (/\s/.test(char)) return FONT_SIZE * 0.30;

  if (/[ilI.,'!:;|]/.test(char)) {
    return FONT_SIZE * 0.30;
  }

  if (/[MW@#%&]/.test(char)) {
    return FONT_SIZE * 0.85;
  }

  if (/[A-Z]/.test(char)) {
    return FONT_SIZE * 0.62;
  }

  if (/[a-z0-9]/.test(char)) {
    return FONT_SIZE * 0.54;
  }

  return FONT_SIZE * 0.95;
}

function wrapText(text, maxWidth) {
  const lines = [];

  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    let line = "";
    let width = 0;

    for (const word of paragraph.split(/\s+/)) {
      const chars = [...word];
      const wordWidth = chars.reduce(
        (sum, char) => sum + charWidth(char),
        0
      );

      if (wordWidth > maxWidth) {
        if (line) {
          lines.push(line);
          line = "";
          width = 0;
        }

        let part = "";
        let partWidth = 0;

        for (const char of chars) {
          const cw = charWidth(char);

          if (part && partWidth + cw > maxWidth) {
            lines.push(part);
            part = "";
            partWidth = 0;
          }

          part += char;
          partWidth += cw;
        }

        line = part;
        width = partWidth;
        continue;
      }

      const spaceWidth = line ? FONT_SIZE * 0.30 : 0;

      if (line && width + spaceWidth + wordWidth > maxWidth) {
        lines.push(line);
        line = word;
        width = wordWidth;
      } else {
        line += (line ? " " : "") + word;
        width += spaceWidth + wordWidth;
      }
    }

    if (line) lines.push(line);
  }

  return lines.length ? lines : [""];
}

async function downloadBuffer(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 20000,
    maxContentLength: 15 * 1024 * 1024,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  return Buffer.from(response.data);
}

async function getAvatar(api, userID) {
  if (!userID || !api?.getUserInfo) return null;

  try {
    const info = await new Promise((resolve, reject) => {
      let finished = false;

      const done = (err, data) => {
        if (finished) return;
        finished = true;
        err ? reject(err) : resolve(data);
      };

      try {
        const result = api.getUserInfo(userID, (err, data) => {
          if (err) return done(err);
          done(null, data?.[userID] || data);
        });

        if (result && typeof result.then === "function") {
          result.then(data => {
            done(null, data?.[userID] || data);
          }).catch(done);
        }
      } catch (err) {
        done(err);
      }
    });

    const url =
      info?.profilePicture ||
      info?.thumbSrc ||
      info?.profilePicUrl ||
      info?.profileUrl;

    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      return await downloadBuffer(url);
    }
  } catch (err) {
    console.error("[FAKECHAT] Avatar:", err.message);
  }

  return null;
}

module.exports = {
  config: {
    name: "fakechat",
    aliases: ["fc"],
    version: "1.0.0",
    author: "Tanvir143",
    cooldown: 5,
    role: 2,
    shortDescription: "Create Instagram-style fake chat",
    longDescription: "Generate a chat image from custom text.",
    category: "utility",
    guide: "{pn} <message> (reply to a message)"
  },

  onStart: async function ({ args, message, event, api }) {
    const text = args.join(" ").trim();

    if (!text) {
      return message.reply(
        "Usage: .fakechat Your message\nReply to a message to use that user's profile picture."
      );
    }

    if (text.length > MAX_TEXT) {
      return message.reply(
        `Maximum message length is ${MAX_TEXT} characters.`
      );
    }

    try {
      const replyUserID =
        event?.messageReply?.senderID ||
        event?.messageReply?.userID ||
        event?.senderID;

      const [barBuffer, avatarBuffer] = await Promise.all([
        downloadBuffer(BAR_URL),
        getAvatar(api, replyUserID)
      ]);

      const bar = await sharp(barBuffer)
        .resize({
          width: WIDTH,
          withoutEnlargement: false
        })
        .png()
        .toBuffer();

      const barMeta = await sharp(bar).metadata();
      const barHeight = barMeta.height;

      const bubbleX = 135;
      const bubbleY = 28;
      const bubbleW = 835;
      const padX = 30;
      const padY = 28;
      const textMaxWidth = bubbleW - padX * 2;

      const lines = wrapText(text, textMaxWidth);

      const bubbleH = Math.max(
        100,
        padY * 2 + lines.length * LINE_HEIGHT
      );

      const avatarSize = 76;
      const gap = 28;

      const barY = bubbleY + bubbleH + gap;
      const canvasHeight = barY + barHeight + 24;

      const textSVG = lines.map((line, index) => {
        const y =
          bubbleY + padY + FONT_SIZE + index * LINE_HEIGHT;

        return `
          <text
            x="${bubbleX + padX}"
            y="${y}"
            font-family="Arial, sans-serif"
            font-size="${FONT_SIZE}px"
            fill="#F5F5F5"
            xml:space="preserve"
          >${escapeXML(line)}</text>
        `;
      }).join("");

      const backgroundSVG = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg"
          width="${WIDTH}" height="${canvasHeight}">
          <rect width="100%" height="100%" fill="#000000"/>
          <rect
            x="${bubbleX}"
            y="${bubbleY}"
            width="${bubbleW}"
            height="${bubbleH}"
            rx="62"
            ry="62"
            fill="#262626"
          />
          ${textSVG}
        </svg>
      `);

      const layers = [
        {
          input: backgroundSVG,
          left: 0,
          top: 0
        }
      ];

      if (avatarBuffer) {
        const mask = Buffer.from(`
          <svg xmlns="http://www.w3.org/2000/svg"
            width="${avatarSize}" height="${avatarSize}">
            <circle
              cx="${avatarSize / 2}"
              cy="${avatarSize / 2}"
              r="${avatarSize / 2}"
              fill="#ffffff"
            />
          </svg>
        `);

        const avatar = await sharp(avatarBuffer)
          .resize(avatarSize, avatarSize, {
            fit: "cover"
          })
          .composite([
            {
              input: mask,
              blend: "dest-in"
            }
          ])
          .png()
          .toBuffer();

        layers.push({
          input: avatar,
          left: 40,
          top: bubbleY + bubbleH - avatarSize
        });
      }

      // Original message input bar supplied by Tanvir143.
      layers.push({
        input: bar,
        left: 0,
        top: barY
      });

      // Generate directly in RAM. No temporary files.
      const imageBuffer = await sharp({
        create: {
          width: WIDTH,
          height: canvasHeight,
          channels: 4,
          background: "#000000"
        }
      })
        .composite(layers)
        .png()
        .toBuffer();

      // Send the generated image without writing it to disk.
      await message.reply({
        attachment: Readable.from([imageBuffer])
      });

    } catch (err) {
      console.error("[FAKECHAT]", err);

      return message.reply(
        "Fake chat image তৈরি করা যায়নি। Image URL, sharp অথবা attachment API চেক করো।"
      );
    }
  }
};
