
/**
 * File Name: gender.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

const MAX_TARGETS = 50;

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

  return normalizeID(
    reply.senderID || reply.senderId || ""
  );
}

function getCommandArgs(event) {
  return String(event.body || "")
    .trim()
    .split(/\s+/)
    .slice(1)
    .filter(Boolean);
}

function getAdminIDs() {
  const possibleLists = [
    global.config?.adminBot,
    global.GoatBot?.config?.adminBot,
    global.botConfig?.adminBot
  ];

  for (const list of possibleLists) {
    if (Array.isArray(list)) {
      return list.map(normalizeID).filter(Boolean);
    }
  }

  return [];
}

function isAdmin(userID) {
  return getAdminIDs().includes(normalizeID(userID));
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

async function getGenderData(collection, threadID) {
  const data = await collection.findOne({
    _id: String(threadID)
  });

  return {
    boy: (data?.boy || []).map(normalizeID),
    girl: (data?.girl || []).map(normalizeID)
  };
}

async function getAllGenderData(collection) {
  const documents = await collection.find({}).toArray();

  const boys = new Set();
  const girls = new Set();

  for (const document of documents) {
    for (const id of document.boy || []) {
      const normalized = normalizeID(id);
      if (normalized) boys.add(normalized);
    }

    for (const id of document.girl || []) {
      const normalized = normalizeID(id);
      if (normalized) girls.add(normalized);
    }
  }

  return {
    boys: [...boys],
    girls: [...girls]
  };
}

async function setGender(collection, threadID, userID, gender) {
  const otherGender = gender === "boy" ? "girl" : "boy";

  await collection.updateOne(
    { _id: String(threadID) },
    {
      $addToSet: {
        [gender]: userID
      },
      $pull: {
        [otherGender]: userID
      }
    },
    { upsert: true }
  );
}

async function removeGender(
  collection,
  threadID,
  userID,
  gender
) {
  const update = gender
    ? { $pull: { [gender]: userID } }
    : { $pull: { boy: userID, girl: userID } };

  const result = await collection.updateOne(
    { _id: String(threadID) },
    update
  );

  return result.modifiedCount > 0;
}

function formatList(title, users) {
  if (!users.length) {
    return `${title} (0)\nকেউ register করেনি।`;
  }

  return (
    `${title} (${users.length})\n` +
    users.map((id, index) => `${index + 1}. ${id}`).join("\n")
  );
}

module.exports.config = {
  name: "gender",
  aliases: ["gen"],
  version: "1.1.0",
  author: "Tanvir Ahmed (Tanvir143)",
  countDown: 3,
  role: 0,
  shortDescription: "Manage group gender list",
  longDescription:
    "Register, remove and view gender records.",
  category: "group",
  guide: {
    en:
      "{pn} boy\n" +
      "{pn} girl\n" +
      "{pn} boy rmv\n" +
      "{pn} girl rmv\n" +
      "{pn} boy @user1 @user2\n" +
      "{pn} boy rmv @user\n" +
      "{pn} list\n" +
      "{pn} list all"
  }
};

module.exports.onStart = async function ({ api, event }) {
  const threadID = event.threadID;
  const messageID = event.messageID;
  const senderID = normalizeID(event.senderID);

  try {
    const args = getCommandArgs(event);
    const action = String(args[0] || "").toLowerCase();
    const secondArg = String(args[1] || "").toLowerCase();

    const collection = await getPairCollection();

    // All groups: globally unique IDs across PairData.
    if (action === "list" && secondArg === "all") {
      if (!isAdmin(senderID)) {
        return api.sendMessage(
          "❌ .gender list all শুধু bot admin ব্যবহার করতে পারবে।",
          threadID,
          messageID
        );
      }

      const allData = await getAllGenderData(collection);

      return api.sendMessage(
        "🌐 ALL GROUPS — GENDER LIST\n\n" +
        formatList("👦 BOY", allData.boys) +
        "\n\n" +
        formatList("👧 GIRL", allData.girls) +
        "\n\n⚠️ একই user একাধিক group-এ থাকলেও এখানে একবার গণনা করা হয়েছে।",
        threadID,
        messageID
      );
    }

    // Current group only.
    if (action === "list") {
      const data = await getGenderData(collection, threadID);

      return api.sendMessage(
        "⚧️ GROUP GENDER LIST\n\n" +
        formatList("👦 BOY", data.boy) +
        "\n\n" +
        formatList("👧 GIRL", data.girl),
        threadID,
        messageID
      );
    }

    if (action !== "boy" && action !== "girl") {
      return api.sendMessage(
        "⚧️ Gender Commands\n\n" +
        ".gender boy\n" +
        ".gender girl\n" +
        ".gender boy rmv\n" +
        ".gender girl rmv\n" +
        ".gender boy @user1 @user2\n" +
        ".gender boy rmv @user\n" +
        "Reply দিয়ে .gender girl\n" +
        ".gender list\n" +
        ".gender list all (bot admin only)",
        threadID,
        messageID
      );
    }

    const gender = action;
    const removing = secondArg === "rmv";

    const mentions = getMentionIDs(event);
    const replyID = getReplyID(event);

    let targets;

    if (mentions.length) {
      targets = mentions;
    } else if (replyID) {
      targets = [replyID];
    } else {
      targets = [senderID];
    }

    targets = [
      ...new Set(targets.map(normalizeID).filter(Boolean))
    ];

    if (!targets.length) {
      return api.sendMessage(
        "❌ কোনো valid user পাওয়া যায়নি।",
        threadID,
        messageID
      );
    }

    if (targets.length > MAX_TARGETS) {
      return api.sendMessage(
        `❌ একবারে সর্বোচ্চ ${MAX_TARGETS} জনকে process করা যাবে।`,
        threadID,
        messageID
      );
    }

    // Removing other users requires bot-admin permission.
    const removingOthers = targets.some(id => id !== senderID);

    if (removing && removingOthers && !isAdmin(senderID)) {
      return api.sendMessage(
        "❌ অন্য user-এর gender remove করতে bot admin permission লাগবে।",
        threadID,
        messageID
      );
    }

    // Register or remove.
    const results = [];

    for (const userID of targets) {
      const current = await getGenderData(
        collection,
        threadID
      );

      const isBoy = current.boy.includes(userID);
      const isGirl = current.girl.includes(userID);

      if (removing) {
        if (!isBoy && !isGirl) {
          results.push(
            `⚠️ ${userID}: gender registered নেই।`
          );
          continue;
        }

        if (userID === senderID) {
          await removeGender(
            collection,
            threadID,
            userID
          );

          results.push(
            `✅ ${userID}: নিজের gender registration remove হয়েছে।`
          );
          continue;
        }

        const wasRegistered = gender === "boy" ? isBoy : isGirl;

        if (!wasRegistered) {
          results.push(
            `⚠️ ${userID}: ${gender.toUpperCase()} হিসেবে registered নয়।`
          );
          continue;
        }

        await removeGender(
          collection,
          threadID,
          userID,
          gender
        );

        results.push(
          `✅ ${userID}: ${gender.toUpperCase()} list থেকে remove হয়েছে।`
        );

        continue;
      }

      if (isBoy || isGirl) {
        const existingGender = isBoy ? "BOY" : "GIRL";

        results.push(
          `⚠️ ${userID}: আগে থেকেই ${existingGender} হিসেবে registered আছে।\n` +
          `পরিবর্তন করতে হলে আগে .gender ${existingGender.toLowerCase()} rmv ব্যবহার করো।`
        );

        continue;
      }

      await setGender(
        collection,
        threadID,
        userID,
        gender
      );

      results.push(
        `✅ ${userID}: ${gender.toUpperCase()} হিসেবে registered হয়েছে।`
      );
    }

    return api.sendMessage(
      results.join("\n\n"),
      threadID,
      messageID
    );
  } catch (error) {
    console.error(
      "[Tanvir143 | igBot] Gender command error:",
      error?.stack || error
    );

    return api.sendMessage(
      `❌ Gender command error: ${error?.message || String(error)}`,
      threadID,
      messageID
    );
  }
};
