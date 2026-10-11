
module.exports = {
  config: {
    name: "uptime",
    aliases: ["up", "status"],
    version: "2.0.0",
    author: "Tanvir Ahmed (Tanvir143)",
    countDown: 5,
    role: 0,
    shortDescription: "Show bot status",
    category: "system"
  },

  onStart: async function ({ message, api }) {
    const formatTime = (seconds) => {
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);

      return `${d}d ${h}h ${m}m ${s}s`;
    };

    let users = "Unavailable";
    let threads = "Unavailable";

    try {
      const db = global.database;

      if (db) {
        if (db.ready) await db.ready;

        if (db.users && typeof db.users.count === "function") {
          users = await db.users.count();
        }

        if (db.threads && typeof db.threads.count === "function") {
          threads = await db.threads.count();
        }
      }
    } catch (err) {
      console.error("[UPTIME DATABASE]", err);
    }

    const uptime = formatTime(process.uptime());

    return message.reply(
      `╭───〔 BOT STATUS 〕\n` +
      `│ Status: Online 🟢\n` +
      `│ Uptime: ${uptime}\n` +
      `├───〔 DATABASE 〕\n` +
      `│ Users: ${users}\n` +
      `│ Threads: ${threads}\n` +
      `│ Groups: ${threads}\n` +
      `╰────────────────`
    );
  }
};
