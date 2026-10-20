
/**
 * File Name: kiss.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

const axios = require("axios");
const Jimp = require("jimp");
const { resolveProfile } = require("../src/utils");

const TEMPLATE_URL = "https://i.imgur.com/3laJwc1.jpg";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const GAY_MESSAGE =
  "🌈 Gay Detected!\nদুইজনই ছেলে, তাই kiss image তৈরি করা হয়নি।";

const LESBIAN_MESSAGE =
  "🌈 Lesbian Detected!\nদুইজনই মেয়ে, তাই kiss image তৈরি করা হয়নি।";

const REGISTER_MESSAGE =
  "❌ Gender পাওয়া যায়নি!\nআগে `.pair boy` অথবা `.pair girl` দিয়ে gender register করো।";

function normalizeID(id) {
  return String(id || "").replace(/[^0-9]/g, "");
}

function getMentionIDs(event) {
  return Object.keys(event.mentions || {})
    .map(normalizeID)
    .filter(Boolean);
}

function getReplyID(event) {
  const reply = event.messageReply || {};

  return normalizeID(
    reply.senderID || reply.senderId || ""
  );
}

function getTargetIDs(event) {
  const mentions = [...new Set(getMentionIDs(event))];
  const senderID = normalizeID(event.senderID);

  if (mentions.length >= 2) {
    return mentions.slice(0, 2);
  }

  if (mentions.length === 1) {
    return [senderID, mentions[0]];
  }

  const replyID = getReplyID(event);

  if (replyID) {
    return [senderID, replyID];
  }

  return [];
}

async function getPairCollection() {
  const database = global.database;

  if (!database) {
    throw new Error("global.database পাওয়া যায়নি।");
  }

  if (database.ready) {
    await database.ready;
  }

  const usersCollection =
    database.users && database.users.collection;

  if (
    !usersCollection ||
    !usersCollection.db ||
    typeof usersCollection.db.collection !== "function"
  ) {
    throw new Error("MongoDB collection পাওয়া যায়নি।");
  }

  return usersCollection.db.collection("PairData");
}

async function getRegisteredGenders(threadID) {
  const collection = await getPairCollection();

  const data = await collection.findOne({
    _id: String(threadID)
  });

  return {
    boy: new Set(
      (data?.boy || []).map(normalizeID)
    ),
    girl: new Set(
      (data?.girl || []).map(normalizeID)
    )
  };
}

function getGender(userID, genderData) {
  const isBoy = genderData.boy.has(userID);
  const isGirl = genderData.girl.has(userID);

  if (isBoy && isGirl) {
    throw new Error(
      `User ${userID} boy এবং girl দুই list-এই আছে।`
    );
  }

  if (isBoy) return "boy";
  if (isGirl) return "girl";

  return null;
}

/**
 * Uses the same resolveProfile calling pattern as pair.js.
 */
async function getProfileImage(userID, event, api) {
  const fakeEvent = {
    ...event,
    senderID: String(userID),
    messageReply: null,
    mentions: {}
  };

  const profile = await resolveProfile(
    [String(userID)],
    fakeEvent,
    api
  );

  if (!profile) {
    throw new Error(
      `User ${userID}-এর profile পাওয়া যায়নি।`
    );
  }

  const imageURL =
    profile.profilePicture ||
    profile.avatar ||
    profile.photoURL ||
    profile.profilePic;

  if (!imageURL || typeof imageURL !== "string") {
    throw new Error(
      `User ${userID}-এর profile picture URL পাওয়া যায়নি।`
    );
  }

  const response = await axios.get(imageURL, {
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

async function loadTemplate() {
  const response = await axios.get(TEMPLATE_URL, {
    responseType: "arraybuffer",
    timeout: 20000,
    maxContentLength: MAX_IMAGE_SIZE,
    maxBodyLength: MAX_IMAGE_SIZE,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  return Jimp.read(Buffer.from(response.data));
}

async function loadAvatar(buffer, size) {
  const image = await Jimp.read(buffer);

  image.cover(size, size);

  const mask = new Jimp(size, size, 0x00000000);

  mask.scan(0, 0, size, size, function (x, y, idx) {
    const dx = x - size / 2;
    const dy = y - size / 2;
    const radius = size / 2;

    this.bitmap.data[idx + 3] =
      dx * dx + dy * dy <= radius * radius
        ? 255
        : 0;
  });

  image.mask(mask, 0, 0);

  return image;
}

async function createKissImage(boyBuffer, girlBuffer) {
  const template = await loadTemplate();

  const width = template.bitmap.width;
  const height = template.bitmap.height;

  const avatarSize = Math.round(
    Math.min(width, height) * 0.24
  );

  // Adjust these positions if your template uses other locations.
  const girlX = Math.round(
    width * 0.28 - avatarSize / 2
  );

  const girlY = Math.round(
    height * 0.23 - avatarSize / 2
  );

  const boyX = Math.round(
    width * 0.62 - avatarSize / 2
  );

  const boyY = Math.round(
    height * 0.57 - avatarSize / 2
  );

  const girlAvatar = await loadAvatar(
    girlBuffer,
    avatarSize
  );

  const boyAvatar = await loadAvatar(
    boyBuffer,
    avatarSize
  );

  template.composite(girlAvatar, girlX, girlY);
  template.composite(boyAvatar, boyX, boyY);

  return template.getBufferAsync(Jimp.MIME_PNG);
}

module.exports.config = {
  name: "kiss",
  aliases: ["k"],
  version: "1.1.0",
  author: "Tanvir Ahmed (Tanvir143)",
  countDown: 5,
  role: 0,
  shortDescription: "Create a kiss image",
  longDescription: "Create a kiss image using registered genders and profile pictures.",
  category: "fun",
  guide: {
    en: "{pn} @mention\n{pn} @user1 @user2\nReply to a message with {pn}"
  }
};

module.exports.onStart = async function ({
  api,
  event
}) {
  const threadID = event.threadID;
  const messageID = event.messageID;

  try {
    const targets = getTargetIDs(event);

    if (
      targets.length !== 2 ||
      !targets[0] ||
      !targets[1]
    ) {
      return api.sendMessage(
        "💋 ব্যবহার:\n.kiss @mention\n.kiss @user1 @user2\nঅথবা কারও message-এ reply দিয়ে .kiss লেখো।",
        threadID,
        messageID
      );
    }

    if (targets[0] === targets[1]) {
      return api.sendMessage(
        "❌ একই user-এর সঙ্গে kiss image তৈরি করা যাবে না।",
        threadID,
        messageID
      );
    }

    const genderData = await getRegisteredGenders(
      threadID
    );

    const gender1 = getGender(
      targets[0],
      genderData
    );

    const gender2 = getGender(
      targets[1],
      genderData
    );

    if (!gender1 || !gender2) {
      return api.sendMessage(
        REGISTER_MESSAGE,
        threadID,
        messageID
      );
    }

    if (gender1 === gender2) {
      return api.sendMessage(
        gender1 === "boy"
          ? GAY_MESSAGE
          : LESBIAN_MESSAGE,
        threadID,
        messageID
      );
    }

    const boyID =
      gender1 === "boy" ? targets[0] : targets[1];

    const girlID =
      gender1 === "girl" ? targets[0] : targets[1];

    const [boyBuffer, girlBuffer] = await Promise.all([
      getProfileImage(boyID, event, api),
      getProfileImage(girlID, event, api)
    ]);

    const imageBuffer = await createKissImage(
      boyBuffer,
      girlBuffer
    );

    return api.sendMessage(
      {
        body: "💋 Kiss time!",
        attachment: imageBuffer
      },
      threadID,
      messageID
    );
  } catch (error) {
    console.error(
      "[Tanvir143 | igBot] Kiss error:",
      error?.stack || error
    );

    const errorMessage = error?.response?.status
      ? `HTTP ${error.response.status}`
      : error?.message || String(error);

    return api.sendMessage(
      `❌ Kiss image error: ${errorMessage}`,
      threadID,
      messageID
    );
  }
};
