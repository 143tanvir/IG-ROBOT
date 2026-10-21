/**
 * File Name: hack.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

const axios = require("axios");
const sharp = require("sharp");
const { resolveProfile } = require("../src/utils");

const TEMPLATE_URL = "https://i.imgur.com/a5kHNs2.png";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const USERNAME_FONT_SIZE = 34;

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

  return getReplyID(event) || null;
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

  if (typeof knownUsername === "string" && knownUsername.trim()) {
    return knownUsername.trim().replace(/^@/, "");
  }

  if (typeof api.getUserInfo === "function") {
    const info = await new Promise(resolve => {
      let settled = false;

      const finish = value => {
        if (settled) return;
        settled = true;
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
      user && (user.username || user.userName || user.vanity);

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

function escapeXML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createUsernameSVG(username, width, height, centerX, baselineY) {
  const text = escapeXML(
    String(username || "Instagram User")
      .replace(/^@/, "")
      .slice(0, 40)
  );

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${width}" height="${height}">
      <text
        x="${centerX}"
        y="${baselineY}"
        font-family="sans-serif"
        font-size="${USERNAME_FONT_SIZE}px"
        font-weight="600"
        fill="#FFFFFF"
        text-anchor="middle">${text}</text>
    </svg>
  `);
}

async function createHackImage(
  templateBuffer,
  avatarBuffer,
  username
) {
  const metadata = await sharp(templateBuffer).metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error("Template image-এর dimensions পাওয়া যায়নি।");
  }

  // DP slightly higher than the previous version.
  const avatarSize = Math.round(width * 0.22);
  const centerX = Math.round(width * 0.5);
  const centerY = Math.round(height * 0.448);

  const circleMask = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${avatarSize}" height="${avatarSize}">
      <circle
        cx="${avatarSize / 2}"
        cy="${avatarSize / 2}"
        r="${avatarSize / 2}"
        fill="#FFFFFF"/>
    </svg>
  `);

  const circularAvatar = await sharp(avatarBuffer)
    .rotate()
    .resize(avatarSize, avatarSize, {
      fit: "cover",
      position: "centre"
    })
    .composite([
      {
        input: circleMask,
        blend: "dest-in"
      }
    ])
    .png()
    .toBuffer();

  const avatarX = Math.round(centerX - avatarSize / 2);
  const avatarY = Math.round(centerY - avatarSize / 2);

  // Username in white, 34px.
  const usernameBaseline =
    avatarY + avatarSize + Math.round(height * 0.012) +
    USERNAME_FONT_SIZE;

  const usernameSVG = createUsernameSVG(
    username,
    width,
    height,
    centerX,
    usernameBaseline
  );

  return sharp(templateBuffer)
    .composite([
      {
        input: circularAvatar,
        left: avatarX,
        top: avatarY
      },
      {
        input: usernameSVG,
        left: 0,
        top: 0
      }
    ])
    .png()
    .toBuffer();
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
  version: "1.0.3",
  author: "Tanvir Ahmed (Tanvir143)",
  countDown: 5,
  role: 0,
  shortDescription: "Create a funny fake Instagram login image",
  longDescription: "Creates a joke image using a user's profile picture.",
  category: "fun",
  guide: {
    en:
      "{pn} @mention\n" +
      "{pn} @username\n" +
      "Reply to a message with {pn}"
  }
};

module.exports.onStart = async function ({ api, event }) {
  const threadID = event.threadID;
  const originalMessageID = event.messageID;

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
        originalMessageID
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

        if (info && info.messageID) {
          setReaction(
            api,
            { ...event, messageID: info.messageID },
            "✅"
          );
        }

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
      originalMessageID
    );
  }
};
