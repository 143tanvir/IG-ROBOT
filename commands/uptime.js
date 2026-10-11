
/**
 * File Name: uptime.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

const os = require("os");

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);

  parts.push(`${seconds}s`);

  return parts.join(" ");
}

async function getCount(store) {
  if (!store) return null;

  if (typeof store.countDocuments === "function") {
    return await store.countDocuments();
  }

  if (typeof store.count === "function") {
    return await store.count();
  }

  return null;
}

module.exports = {
  name: "uptime",
  aliases: ["up", "status"],
  description: "Show bot uptime and database statistics",
  usage: "uptime",

  async execute({ api, event }) {
    const startedAt = global.instabotStartedAt || Date.now();
    const uptime = formatUptime(Date.now() - startedAt);

    let users = "Unavailable";
    let groups = "Unavailable";

    try {
      const db = global.database;

      if (db) {
        const [userCount, groupCount] = await Promise.all([
          getCount(db.users),
          getCount(db.threads)
        ]);

        if (userCount !== null) users = userCount;
        if (groupCount !== null) groups = groupCount;
      }
    } catch (error) {
      console.error("[UPTIME] Database count failed:", error.message);
    }

    const memory = process.memoryUsage();
    const ram = (memory.rss / 1024 / 1024).toFixed(1);

    const message = [
      "╭─〔 BOT STATUS 〕",
      `│ Uptime: ${uptime}`,
      `│ Groups: ${groups}`,
      `│ Users: ${users}`,
      `│ RAM: ${ram} MB`,
      "╰──────────────"
    ].join("\n");

    return api.sendMessage(message, event.threadID);
  }
};
