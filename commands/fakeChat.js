
/**
 * File Name: fakechat.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * Instagram: @ig.tanvir_ahmed
 * Bot: IG-ROBOT
 */

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const ica = require("../Tanvir143/ica");

const TOP_BAR_URL = "https://i.imgur.com/v6KSWg6.jpeg";
const BOTTOM_BAR_URL = "https://i.imgur.com/ZwbNx74.jpeg";

const W = 720;
const FONT = "Arial, sans-serif";
const FONT_SIZE = 26;
const LINE_HEIGHT = 34;
const PAD_X = 22;
const PAD_Y = 16;
const MAX_BUBBLE_W = 460;

module.exports = {
  config: {
    name: "fakechat",
    aliases: ["fchat"],
    version: "4.0.0",
    author: "EryXenX",
    cooldown: 5,
    role: 2,
    description: "Generate a fake Messenger chat screenshot",
    category: "utility",
    guide: {
      en: "Reply to a message with {pn} <your reply>"
    }
  },

  onStart: async function ({ event, message, usersData, args, api }) {
    const reply = event.messageReply;

    if (!reply) {
      return message.reply(
        "❌ | Reply to a message and write your reply after the command."
      );
    }

    const friendID = String(reply.senderID || "");
    const friendText = String(reply.body || "").trim();
    const myText = args.join(" ").trim();

    if (!friendID || !friendText || !myText) {
      return message.reply(
        "❌ | Replied message and your reply must both contain text."
      );
    }

    const cacheDir = path.join(__dirname, "cache");
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const files = {
      top: path.join(cacheDir, `fc_top_${id}.jpg`),
      bottom: path.join(cacheDir, `fc_bottom_${id}.jpg`),
      avatar: path.join(cacheDir, `fc_avatar_${id}.jpg`),
      circle: path.join(cacheDir, `fc_circle_${id}.png`),
      output: path.join(cacheDir, `fc_output_${id}.jpg`)
    };

    try {
      await fs.ensureDir(cacheDir);

      const friendName = await usersData
        .getName(friendID)
        .catch(() => "Instagram User");

      // Instagram profile picture via the installed ICA API.
      const avatarURL = await getInstagramAvatar(api, event, friendID);

      await Promise.all([
        downloadImage(TOP_BAR_URL, files.top),
        downloadImage(BOTTOM_BAR_URL, files.bottom),
        downloadImage(avatarURL, files.avatar)
      ]);

      const [topMeta, bottomMeta] = await Promise.all([
        sharp(files.top).metadata(),
        sharp(files.bottom).metadata()
      ]);

      if (!topMeta.width || !topMeta.height ||
          !bottomMeta.width || !bottomMeta.height) {
        throw new Error("Invalid template image dimensions");
      }

      const topH = Math.round(topMeta.height * W / topMeta.width);
      const bottomH = Math.round(bottomMeta.height * W / bottomMeta.width);

      // Prepare circular Instagram avatar.
      const avatarSize = 200;

      const circleSVG = Buffer.from(`
        <svg width="${avatarSize}" height="${avatarSize}"
             xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="circle">
              <circle cx="100" cy="100" r="100"/>
            </clipPath>
          </defs>
          <image href="avatar"
            x="0" y="0" width="200" height="200"
            preserveAspectRatio="xMidYMid slice"
            clip-path="url(#circle)"/>
        </svg>
      `);

      // Use Sharp's native circular crop for reliable output.
      await sharp(files.avatar)
        .rotate()
        .resize(avatarSize, avatarSize, {
          fit: "cover",
          position: "centre"
        })
        .composite([{
          input: Buffer.from(`
            <svg width="${avatarSize}" height="${avatarSize}"
                 xmlns="http://www.w3.org/2000/svg">
              <circle cx="100" cy="100" r="100" fill="white"/>
            </svg>
          `),
          blend: "dest-in"
        }])
        .png()
        .toFile(files.circle);

      const avatarBuffer = await fs.readFile(files.circle);
      const topBuffer = await sharp(files.top)
        .resize(W, topH)
        .jpeg()
        .toBuffer();

      const bottomBuffer = await sharp(files.bottom)
        .resize(W, bottomH)
        .jpeg()
        .toBuffer();

      const name = fitName(String(friendName || "Instagram User"), 290);
      const time = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Dhaka"
      });

      const measureText = (text, size = FONT_SIZE) =>
        [...text].reduce((width, char) => {
          if (/[ilI.,'!:;|]/.test(char)) return width + size * 0.28;
          if (/[MW@#%&]/.test(char)) return width + size * 0.85;
          if (char === " ") return width + size * 0.30;
          if (char.charCodeAt(0) > 255) return width + size;
          return width + size * 0.54;
        }, 0);

      const wrapText = (text, maxWidth) => {
        const output = [];

        for (const paragraph of String(text).split(/\r?\n/)) {
          const words = paragraph.split(/\s+/).filter(Boolean);
          let line = "";

          if (!words.length) {
            output.push("");
            continue;
          }

          for (const word of words) {
            let pieces = [word];

            while (pieces.some(piece => measureText(piece) > maxWidth)) {
              const current = pieces.shift();
              let part = "";

              for (const char of current) {
                if (part && measureText(part + char) > maxWidth) {
                  pieces.unshift(part);
                  part = char;
                  break;
                }
                part += char;
              }

              if (part) pieces.unshift(part);

              if (!pieces.length) break;

              // Prevent endless splitting of a single long word.
              if (pieces[0] === current) break;
            }

            for (const piece of pieces) {
              const test = line ? `${line} ${piece}` : piece;

              if (measureText(test) > maxWidth && line) {
                output.push(line);
                line = piece;
              } else {
                line = test;
              }
            }
          }

          if (line) output.push(line);
        }

        return output.length ? output : [""];
      };

      const friendLines = wrapText(friendText, MAX_BUBBLE_W - PAD_X * 2);
      const myLines = wrapText(myText, MAX_BUBBLE_W - PAD_X * 2);

      const bubbleWidth = lines =>
        Math.min(
          MAX_BUBBLE_W,
          Math.ceil(Math.max(...lines.map(line => measureText(line)))) +
            PAD_X * 2
        );

      const friendW = bubbleWidth(friendLines);
      const myW = bubbleWidth(myLines);
      const friendH = friendLines.length * LINE_HEIGHT + PAD_Y * 2;
      const myH = myLines.length * LINE_HEIGHT + PAD_Y * 2;

      const chatTop = 40;
      const gap = 30;
      const H = topH + chatTop + friendH + gap + myH + 50 + bottomH;

      const esc = value =>
        String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const svgText = (lines, x, y, color) =>
        lines.map((line, index) => `
          <text x="${x}" y="${y + (index + 1) * LINE_HEIGHT - 8}"
            fill="${color}" font-family="${FONT}" font-size="${FONT_SIZE}">
            ${esc(line)}
          </text>
        `).join("");

      const headerSize = 56;
      const headerX = 86;
      const headerY = topH - 45;

      const friendX = 40 + 44 + 12;
      const friendY = topH + chatTop;
      const myY = friendY + friendH + gap;
      const myX = W - 40 - myW;

      const overlaySVG = Buffer.from(`
        <svg width="${W}" height="${H}"
             xmlns="http://www.w3.org/2000/svg">
          <rect width="${W}" height="${H}" fill="#000"/>

          <text x="24" y="44" fill="#fff"
            font-family="${FONT}" font-size="20"
            font-weight="bold">${esc(time)}</text>

          <image href="avatar"
            x="${headerX}" y="${headerY - headerSize / 2}"
            width="${headerSize}" height="${headerSize}"/>

          <circle cx="${headerX + headerSize - 4}"
            cy="${headerY + headerSize / 2 - 4}"
            r="12" fill="#000"/>
          <circle cx="${headerX + headerSize - 4}"
            cy="${headerY + headerSize / 2 - 4}"
            r="9" fill="#31a24c"/>

          <text x="${headerX + headerSize + 14}" y="${headerY + 8}"
            fill="#fff" font-family="${FONT}" font-size="28"
            font-weight="bold">${esc(name)}</text>

          <rect x="${friendX}" y="${friendY}"
            width="${friendW}" height="${friendH}"
            rx="20" fill="#3a3b3c"/>

          ${svgText(friendLines, friendX + PAD_X, friendY + PAD_Y, "#fff")}

          <image href="avatar" x="40"
            y="${friendY + friendH / 2 - 22}"
            width="44" height="44"/>

          <rect x="${myX}" y="${myY}"
            width="${myW}" height="${myH}"
            rx="20" fill="#0084ff"/>

          ${svgText(myLines, myX + PAD_X, myY + PAD_Y, "#fff")}
        </svg>
      `);

      // Composite using Sharp; no Canvas dependency.
      await sharp({
        create: {
          width: W,
          height: H,
          channels: 3,
          background: "#000000"
        }
      })
        .composite([
          { input: topBuffer, left: 0, top: 0 },
          { input: bottomBuffer, left: 0, top: H - bottomH },
          {
            input: await buildOverlay(
              overlaySVG,
              avatarBuffer,
              W,
              H
            ),
            left: 0,
            top: 0
          }
        ])
        .jpeg({ quality: 92 })
        .toFile(files.output);

      await message.reply({
        attachment: fs.createReadStream(files.output)
      });
    } catch (error) {
      console.error("[IG-ROBOT] Fakechat error:", error.message);

      return message.reply(
        "❌ | Fakechat তৈরি করা যায়নি। Instagram DP resolver, template URL ও Sharp installation পরীক্ষা করো।"
      );
    } finally {
      await Promise.all(
        Object.values(files).map(file =>
          fs.remove(file).catch(() => {})
        )
      );
    }
  }
};

async function buildOverlay(svg, avatarBuffer, width, height) {
  // Embed avatar bytes as a data URI for SVG rendering.
  const base64 = avatarBuffer.toString("base64");
  const updated = svg.toString()
    .replace(/href="avatar"/g, `href="data:image/png;base64,${base64}"`);

  return sharp(Buffer.from(updated))
    .resize(width, height)
    .png()
    .toBuffer();
}

async function downloadImage(url, destination) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 20000,
    maxRedirects: 5
  });

  const type = String(response.headers["content-type"] || "");

  if (type && !type.toLowerCase().startsWith("image/")) {
    throw new Error("URL did not return an image");
  }

  await fs.writeFile(destination, Buffer.from(response.data));
}

async function getInstagramAvatar(api, event, userID) {
  const candidates = [];

  if (typeof ica.resolveProfile === "function") {
    candidates.push(async () =>
      ica.resolveProfile([String(userID)], event, api)
    );
  }

  if (api && typeof api.resolveProfile === "function") {
    candidates.push(async () =>
      api.resolveProfile(String(userID))
    );
  }

  if (api && typeof api.getUserInfo === "function") {
    candidates.push(async () =>
      api.getUserInfo(String(userID))
    );
  }

  for (const resolve of candidates) {
    try {
      const result = await resolve();

      const user =
        result?.[userID] ||
        (Array.isArray(result) ? result[0] : result) ||
        result;

      const urls = [
        user?.profilePicture,
        user?.profile_pic_url_hd,
        user?.profile_pic_url,
        user?.profilePicUrl,
        user?.profile_picture_url,
        user?.avatarUrl,
        user?.avatar,
        user?.thumbSrc
      ];

      const url = urls.find(
        value =>
          typeof value === "string" &&
          /^https?:\/\//i.test(value)
      );

      if (url) return url;
    } catch (error) {
      console.error("[IG-ROBOT] Profile lookup:", error.message);
    }
  }

  throw new Error("Instagram profile picture unavailable through ICA");
}

function fitName(text, maxWidth) {
  let name = text;

  const estimate = value => [...value].reduce(
    (sum, char) => sum + (char.charCodeAt(0) > 255 ? 28 : 15),
    0
  );

  while (name.length > 1 && estimate(name) > maxWidth) {
    name = name.slice(0, -1);
  }

  return name === text ? name : `${name}...`;
}
