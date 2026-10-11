/**
 * File Name: bby.js
 * ICA: igbot-api
 * Auhor: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

const API_BASE = "https://noobs-api.top/dipto";
const API_PATH = "/baby";

const tanvir143 = {
  timeout: 8000,
  retries: 1,
  greetings: [
    "😏 আবার ডাকছো? বলো শুনি!",
    "😂 কি হলো, এতবার baby ডাকো কেন?",
    "🙈 হুমম, baby হাজির! এবার বলো!",
    "😎 ডাক শুনে চলে আসলাম, কী খবর?",
    "🤭 এই যে! আমাকে আবার মনে পড়লো?",
    "🥹 Baby ডাকলে তো আসতেই হয়!",
    "😜 এত আদর করে ডাকলে কিন্তু কথা বলতে হবে!",
    "😂 Baby online, drama শুরু করো!",
    "😌 বলো baby শুনছে...",
    "🤣 আবার শুরু হলো! কী বলতে চাও?",
    "😴 ঘুমাচ্ছিলাম, কে ডাকলো?",
    "🙄 song sunba? eta lekho:  .song Sesh Kanna",
    "🫣 এভাবে ডাকলে তো আসতেই হবে!",
    "😎 Baby উপস্থিত, command দাও!",
    "😂 বলো দেখি, আজকে কী drama?"
  ]
};

function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function randomGreeting() {
  return tanvir143.greetings[
    Math.floor(Math.random() * tanvir143.greetings.length)
  ];
}

async function request(params = {}, retry = false) {
  const url = new URL(`${API_BASE}${API_PATH}`);

  for (const [key, value] of Object.entries(params)) {
    if (value != null && String(value) !== "")
      url.searchParams.set(key, String(value));
  }

  const attempts = retry ? tanvir143.retries + 1 : 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      tanvir143.timeout
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Tanvir143-BBY/1.0"
        }
      });

      let data = {};

      try {
        data = await response.json();
      } catch {}

      if (!response.ok) {
        const detail =
          data?.error ||
          data?.message ||
          "";

        throw new Error(
          `Baby API HTTP ${response.status}${detail ? `: ${detail}` : ""}`
        );
      }

      return data || {};
    } catch (error) {
      if (attempt >= attempts) {
        if (error?.name === "AbortError")
          throw new Error("Baby API timeout");

        throw new Error(
          error?.message || "Baby API request failed"
        );
      }

      await new Promise(resolve =>
        setTimeout(resolve, 300)
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function textOf(
  data,
  fallback = "The baby API returned no reply."
) {
  const value =
    data?.reply != null
      ? data.reply
      : data?.message != null
        ? data.message
        : data?.data;

  return value == null
    ? fallback
    : String(value);
}

function userName(usersData, userID) {
  try {
    const user =
      usersData &&
      typeof usersData.get === "function"
        ? usersData.get(userID)
        : null;

    return clean(
      user?.name ||
      user?.username ||
      String(userID || "Friend")
    );
  } catch {
    return String(userID || "Friend");
  }
}

async function answer(event, value, usersData) {
  const text = clean(value);

  if (!text)
    return "Say something to bby.";

  const data = await request({
    text: text.toLowerCase(),
    senderID: event?.senderID || "",
    font: 0
  });

  return textOf(data);
}

/*
 * IMPORTANT:
 * This reply-handler structure is kept compatible
 * with the original working Dipto command.
 */
function armReply(setReplyHandler, sent) {
  if (
    typeof setReplyHandler !== "function" ||
    !sent ||
    !sent.messageID
  )
    return;

  setReplyHandler(
    async ({
      api,
      message,
      event,
      usersData,
      setReplyHandler: nextSetReplyHandler
    }) => {
      if (
        event?.type &&
        event.type !== "message_reply"
      )
        return;

      try {
        const selfID =
          api &&
          typeof api.getCurrentUserID === "function"
            ? api.getCurrentUserID()
            : null;

        if (
          selfID &&
          String(selfID) === String(event?.senderID)
        )
          return;

        const body =
          typeof event?.body === "string"
            ? event.body.trim()
            : "";

        if (!body)
          return message.reply("Say something to bby.");

        const reply = await answer(
          event,
          body,
          usersData
        );

        const next = await message.reply(reply);

        /*
         * Keep the chain alive.
         */
        armReply(
          nextSetReplyHandler || setReplyHandler,
          next
        );

        return next;
      } catch (error) {
        console.error(
          "[Tanvir143 BBY Reply]",
          error?.message || error
        );

        return message.reply(
          `❌ Error: ${error?.message || error}`
        );
      }
    },
    sent.messageID
  );
}

async function replyAndArm(
  message,
  text,
  setReplyHandler
) {
  const sent = await message.reply(text);

  armReply(
    setReplyHandler,
    sent
  );

  return sent;
}

async function specialReply(
  args,
  event,
  usersData
) {
  const raw = clean(args.join(" "));
  const lower = raw.toLowerCase();
  const senderID = event?.senderID;

  if (lower.startsWith("remove ")) {
    const key = clean(
      raw.slice("remove ".length)
    );

    if (!key)
      return "Usage: bby remove <message>";

    return textOf(
      await request({
        remove: key,
        senderID
      })
    );
  }

  if (lower.startsWith("rm ")) {
    const parts = raw
      .slice(3)
      .split(/\s*-\s*/)
      .map(part => part.trim());

    if (
      parts.length < 2 ||
      !parts[0] ||
      !parts[1]
    )
      return "Usage: bby rm <message> - <index>";

    return textOf(
      await request({
        remove: parts[0],
        index: parts[1]
      })
    );
  }

  if (lower === "list") {
    const data = await request(
      { list: "all" },
      true
    );

    const teachers =
      Array.isArray(
        data?.teacher?.teacherList
      )
        ? data.teacher.teacherList
        : [];

    return (
      `📚 Total Teach = ${teachers.length}\n` +
      `💬 Total Response = ${data?.responseLength || "api off"}`
    );
  }

  if (lower.startsWith("list all")) {
    const parts = raw.split(/\s+/);

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number(parts[2]) || 100
      )
    );

    const data = await request(
      { list: "all" },
      true
    );

    const list =
      Array.isArray(
        data?.teacher?.teacherList
      )
        ? data.teacher.teacherList
        : [];

    const output = list
      .slice(0, limit)
      .map((item, index) => {
        const id =
          Object.keys(item || {})[0];

        return (
          `${index + 1}/ ` +
          `${userName(usersData, id)}: ` +
          `${id ? item[id] : 0}`
        );
      })
      .join("\n");

    return (
      `📋 List of Teachers of baby\n` +
      `${output || "No teachers found."}`
    );
  }

  if (lower.startsWith("msg ")) {
    const key = clean(
      raw.slice(4)
    );

    if (!key)
      return "Usage: bby msg <message>";

    return (
      `💬 Message ${key} = ` +
      textOf(
        await request({
          list: key
        }),
        "Not found"
      )
    );
  }

  if (lower.startsWith("edit ")) {
    const parts = raw
      .slice(5)
      .split(/\s*-\s*/)
      .map(part => part.trim());

    if (
      parts.length < 2 ||
      !parts[0] ||
      !parts[1]
    )
      return "Use: bby edit <message> - <new reply>";

    return (
      `✏️ changed ` +
      textOf(
        await request({
          edit: parts[0],
          replace: parts.slice(1).join(" - "),
          senderID
        })
      )
    );
  }

  if (lower.startsWith("teach react ")) {
    const parts = raw
      .slice("teach react".length)
      .split(/\s*-\s*/)
      .map(part => part.trim());

    if (
      parts.length < 2 ||
      !parts[0] ||
      !parts[1]
    )
      return "Use: bby teach react <message> - <reaction>";

    return (
      `🎭 Replies added ` +
      textOf(
        await request({
          teach: parts[0],
          react: parts.slice(1).join(" - ")
        })
      )
    );
  }

  if (lower.startsWith("teach amar ")) {
    const parts = raw
      .slice("teach amar".length)
      .split(/\s*-\s*/)
      .map(part => part.trim());

    if (
      parts.length < 2 ||
      !parts[0] ||
      !parts[1]
    )
      return "Use: bby teach amar <message> - <reply>";

    return (
      `🎓 Replies added ` +
      textOf(
        await request({
          teach: parts[0],
          reply: parts.slice(1).join(" - "),
          key: "intro"
        })
      )
    );
  }

  if (lower.startsWith("teach ")) {
    const parts = raw
      .slice(6)
      .split(/\s*-\s*/)
      .map(part => part.trim());

    if (
      parts.length < 2 ||
      !parts[0] ||
      !parts[1]
    )
      return "Use: bby teach <message> - <reply>";

    const data = await request({
      teach: parts[0],
      reply: parts.slice(1).join(" - "),
      senderID,
      threadID: event?.threadID
    });

    return (
      `🎓 Replies added ${textOf(data)}\n` +
      `👤 Teacher: ${userName(usersData, senderID)}\n` +
      `📚 Teachs: ${data?.teachs || "-"}`
    );
  }

  if (
    [
      "amar name ki",
      "amr nam ki",
      "amar nam ki",
      "amr name ki",
      "whats my name"
    ].includes(lower)
  ) {
    return textOf(
      await request({
        text: "amar name ki",
        senderID,
        key: "intro"
      })
    );
  }

  return null;
}

module.exports = {
  config: {
    name: "bby",
    aliases: [
      "baby",
      "bbe",
      "babe",
      "sam",
      "nai",
      "acho",
      "janu",
      "jan",
      "hi",
      "hello"
    ],
    author: "Tanvir143",
    cooldown: 0,
    role: 0,
    noPrefix: true,
    noPrefixRole: 0,
    category: "Users Cmd",
    description: {
      en: "Chat with baby and teach custom replies"
    },
    usage: {
      en:
        "{p}bby <message> | " +
        "{p}bby teach <message> - <reply> | " +
        "{p}bby list"
    }
  },

  onStart: async function ({
    message,
    args,
    event,
    usersData,
    setReplyHandler
  }) {
    try {
      /*
       * No text:
       * Random funny message + reply handler.
       */
      if (!args.length) {
        return replyAndArm(
          message,
          randomGreeting(),
          setReplyHandler
        );
      }

      /*
       * Special commands.
       */
      const special = await specialReply(
        args,
        event,
        usersData
      );

      /*
       * IMPORTANT:
       * Special/API response-এর উপরেও
       * reply handler চালু রাখা হচ্ছে।
       */
      if (special != null) {
        return replyAndArm(
          message,
          special,
          setReplyHandler
        );
      }

      /*
       * Normal baby API chat.
       */
      const reply = await answer(
        event,
        args.join(" "),
        usersData
      );

      return replyAndArm(
        message,
        reply,
        setReplyHandler
      );
    } catch (error) {
      console.error(
        "[Tanvir143 BBY]",
        error?.message || error
      );

      return message.reply(
        `❌ Error: ${error?.message || error}`
      );
    }
  }
};
