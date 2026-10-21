/**
 * File Name: hack.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

const axios = require("axios");
const { Jimp } = require("jimp");
const { resolveProfile } = require("../src/utils");

const TEMPLATE_URL = "https://i.imgur.com/a5kHNs2.png";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function normalizeID(id) {
  return String(id || "").replace(/[^0-9]/g, "");
}

function getMentionIDs(event) {
  return [
    ...new Set(
      Object.keys(event.mentions || {})
        .map(normalizeID)
        .filter(Boolean)
    )
  ];
}

function getReplyID(event) {
  const reply = event.messageReply || {};
  return normalizeID(reply.senderID || reply.senderId || "");
}

function extractUsernames(body) {
  const matches =
    String(body || "").match(/@([a-zA-Z0-9._]+)/g) || [];

  return [...new Set(matches.map(name => name.slice(1)))];
}

async function resolveUsername(username, api) {
  const cleanName = String(username || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[,\s]+$/, "");

  if (!cleanName || typeof api.getUserID !== "function") {
    return null;
  }

  const result = await new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve(value);
    };

    try {
      const returned = api.getUserID(cleanName, (error, data) => {
        if (error) return finish(error);
        finish(null, data);
      });

      if (returned && typeof returned.then === "function") {
        returned.then(
          value => finish(null, value),
          error => finish(error)
        );
      } else if (returned !== undefined && returned !== null) {
        finish(null, returned);
      }
    } catch (error) {
      finish(error);
    }
  });

  if (typeof result === "string" || typeof result === "number") {
    return normalizeID(result) || null;
  }

  if (Array.isArray(result) && result.length) {
    const first = result[0];

    if (typeof first === "string" || typeof first === "number") {
      return normalizeID(first) || null;
    }

    if (first && typeof first === "object") {
      return normalizeID(first.userID || first.id) || null;
    }
  }

  if (result && typeof result === "object") {
    return normalizeID(
      result.userID || result.userId || result.id || result.ID
    ) || null;
  }

  return null;
}

async function getTarget(event, api) {
  const mentions = getMentionIDs(event);

  if (mentions.length) {
    return mentions[0];
  }

  const usernames = extractUsernames(event.body);

  if (usernames.length) {
    const id = await resolveUsername(usernames[0], api);

    if (!id) {
      throw new Error(
        `@${usernames[0]} username থেকে user ID পাওয়া যায়নি।`
      );
    }

    return id;
  }

  const replyID = getReplyID(event);

  if (replyID) {
    return replyID;
  }

  return null;
}

async function downloadImage(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 20000,
    maxContentLength: MAX_IMAGE_SIZE,
    maxBodyLength: MAX_IMAGE_SIZE,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  return Buffer.from(response.data);
}

async function getProfileData(userID, event, api) {
  const profile = await resolveProfile(
    [String(userID)],
    {
      ...event,
      senderID: String(userID),
      messageReply: null,
      mentions: {}
    },
    api
  );

  const data = Array.isArray(profile) ? profile[0] : profile;

  if (!data) {
    throw new Error("ব্যবহারকারীর profile পাওয়া যায়নি।");
  }

  return data;
}

async function getUsername(userID, profile, api) {
  const knownUsername =
    profile.username ||
    profile.userName ||
    profile.instagramUsername ||
    profile.handle;

  if (
    typeof knownUsername === "string" &&
    knownUsername.trim()
  ) {
    return knownUsername.trim().replace(/^@/, "");
  }

  if (typeof api.getUserInfo === "function") {
    const info = await new Promise(resolve => {
      let done = false;

      const finish = value => {
        if (done) return;
        done = true;
        resolve(value);
      };

      try {
        const returned = api.getUserInfo(userID, (error, data) => {
          finish(error ? null : data);
        });

        if (returned && typeof returned.then === "function") {
          returned.then(finish, () => finish(null));
        } else if (returned && typeof returned === "object") {
          finish(returned);
        }
      } catch {
        finish(null);
      }
    });

    const user =
      info && (info[userID] || info[String(userID)] || info);

    const username =
      user &&
      (user.username || user.userName || user.vanity);

    if (typeof username === "string" && username.trim()) {
      return username.trim().replace(/^@/, "");
    }
  }

  return String(userID);
}

async function getAvatarBuffer(profile) {
  const url =
    profile.profilePicture ||
    profile.avatar ||
    profile.photoURL ||
    profile.profilePic;

  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    throw new Error("Profile picture URL পাওয়া যায়নি।");
  }

  return downloadImage(url);
}

/**
 * Auhor: Tanvir Ahmed (tanvid143) do not replace it.
 * Places a circular avatar inside the white circular area.
 * Coordinates are proportional to the template dimensions.
 */
async function createHackImage(templateBuffer, avatarBuffer, username) {
  const template = await Jimp.read(templateBuffer);
  const avatar = await Jimp.read(avatarBuffer);

  const width = template.bitmap.width;
  const height = template.bitmap.height;

  /*
   * Template reference:
   * The white circle is approximately centered horizontally.
   * These proportions are based on the uploaded 1432x3264 screenshot.
   */
  const centerX = Math.round(width * 0.5);
  const centerY = Math.round(height * 0.446);
  const avatarSize = Math.round(width * 0.278);

  avatar.cover({
    w: avatarSize,
    h: avatarSize
  });

  // Transparent square; copy only the pixels inside the circle.
  const circularAvatar = new Jimp({
    width: avatarSize,
    height: avatarSize,
    color: 0x00000000
  });

  const src = avatar.bitmap.data;
  const dst = circularAvatar.bitmap.data;
  const center = (avatarSize - 1) / 2;
  const radius = avatarSize / 2;
  const radiusSquared = radius * radius;

  for (let y = 0; y < avatarSize; y++) {
    for (let x = 0; x < avatarSize; x++) {
      const dx = x - center;
      const dy = y - center;

      if (dx * dx + dy * dy <= radiusSquared) {
        const i = (y * avatarSize + x) * 4;

        dst[i] = src[i];
        dst[i + 1] = src[i + 1];
        dst[i + 2] = src[i + 2];
        dst[i + 3] = src[i + 3];
      }
    }
  }

  const avatarX = Math.round(centerX - avatarSize / 2);
  const avatarY = Math.round(centerY - avatarSize / 2);

  template.composite(circularAvatar, avatarX, avatarY);

  /*
   * Username is placed below the DP, without @.
   * Use Jimp's built-in font; shrink text to fit the available width.
   */
  const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

  const label = String(username || "")
    .replace(/^@/, "")
    .slice(0, 40);

  const textWidth = Jimp.measureText(font, label);
  const textHeight = Jimp.measureTextHeight(font, label, width);

  const textX = Math.max(0, Math.round((width - textWidth) / 2));
  const textY = Math.round(avatarY + avatarSize + height * 0.008);

  if (textY + textHeight < height) {
    template.print({
      font,
      x: textX,
      y: textY,
      text: label
    });
  }

  return template.getBuffer("image/png");
}

function setReaction(api, event, emoji) {
  if (
    typeof api.setMessageReaction !== "function" ||
    !event.messageID
  ) {
    return;
  }

  try {
    api.setMessageReaction(
      emoji,
      event.messageID,
      error => {
        if (error) {
          console.warn(
            "[Tanvir143 | igBot] Reaction failed:",
            error.message || error
          );
        }
      },
      true
    );
  } catch (error) {
    console.warn(
      "[Tanvir143 | igBot] Reaction failed:",
      error.message || error
    );
  }
}

module.exports.config = {
  name: "hack",
  aliases: ["fakehack"],
  version: "1.0.0",
  author: "Tanvir Ahmed (Tanvir143)",
  cooldown: 5,
  role: 0,
  category: "users Cmd",
  guide: {
    en:
      "{pn} @mention\n" +
      "{pn} @username\n" +
      "Reply to a message with {pn}"
  }
};

module.exports.onStart = async function ({ api, event }) {
  const threadID = event.threadID;
  const replyMessageID = event.messageID;

  setReaction(api, event, "🎭");

  try {
    const targetID = await getTarget(event, api);

    if (!targetID) {
      return api.sendMessage(
        "🎭 ব্যবহার:\n" +
          ".hack @mention\n" +
          ".hack @username\n" +
          "অথবা কারও মেসেজে reply দিয়ে .hack লেখো।",
        threadID,
        replyMessageID
      );
    }

    const profile = await getProfileData(targetID, event, api);

    const [username, avatarBuffer, templateBuffer] =
      await Promise.all([
        getUsername(targetID, profile, api),
        getAvatarBuffer(profile),
        downloadImage(TEMPLATE_URL)
      ]);

    const imageBuffer = await createHackImage(
      templateBuffer,
      avatarBuffer,
      username
    );

    // Send the generated image first.
    api.sendMessage(
      {
        body: "",
        attachment: imageBuffer
      },
      threadID,
      (error, info) => {
        if (error) {
          console.error(
            "[Tanvir143 | igBot] Hack image send failed:",
            error.message || error
          );

          return;
        }

        // React only after the image has been sent successfully.
        if (info && info.messageID) {
          setReaction(
            api,
            { ...event, messageID: info.messageID },
            "✅"
          );
        }

        // Send the success text one second after the image.
        setTimeout(() => {
          api.sendMessage(
            "🎭 Hacked Succesfull",
            threadID
          );
        }, 1000);
      }
    );
  } catch (error) {
    console.error(
      "[Tanvir143 | igBot] Hack command error:",
      error.stack || error
    );

    return api.sendMessage(
      `❌ Hack image তৈরি করা যায়নি: ${
        error.message || error
      }`,
      threadID,
      replyMessageID
    );
  }
};
