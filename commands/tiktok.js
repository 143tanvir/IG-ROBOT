/**
 * File Name: tiktok.js
 * ICA: igbot-api
 * Auhor: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

const axios = require("axios");

module.exports = {
  config: {
    name: "tiktok",
    aliases: ["ttinfo", "tt"],
    author: "Tanvi143",
    category: "Users Cmd",
    cooldown: 5,
    role: 0,
    description: {
      en: "Get TikTok profile information"
    },
    usage: {
      en: "{p}tiktokinfo <username>"
    }
  },

  onStart: async function ({ message, args }) {
    if (!args[0]) {
      return message.reply(
        "❌ | Username দিন!\n\nExample:\ntiktokinfo @username"
      );
    }

    const username = args[0].replace(/^@/, "").trim();

    let findingMsg;

    try {
      findingMsg = await message.reply(
        `🔎 | Finding your TikTok account...\n\n👤 Searching: @${username}`
      );
    } catch (e) {}

    try {
      const apiUrl =
        `https://apis.davidcyril.name.ng/tiktokStalk?q=${encodeURIComponent(username)}`;

      const res = await axios.get(apiUrl, {
        timeout: 30000
      });

      const json = res.data;

      if (!json.status || !json.data) {
        if (findingMsg?.messageID) {
          try {
            await message.unsend(findingMsg.messageID);
          } catch (e) {}
        }

        return message.reply(
          `❌ | TikTok user পাওয়া যায়নি!\n\n👤 Username: @${username}`
        );
      }

      const user = json.data.user || {};
      const stats = json.data.stats || {};

      const name = user.nickname || "Unknown";
      const uniqueId = user.uniqueId || username;
      const bio = user.signature || "No bio";
      const verified = user.verified ? "✅ Yes" : "❌ No";

      const followers = stats.followerCount || 0;
      const following = stats.followingCount || 0;
      const likes = stats.heart || 0;
      const videos = stats.videoCount || 0;
      const digg = stats.diggCount || 0;
      const friends = stats.friendCount || 0;

      const text = `╭━━━〔 🎵 TIKTOK INFO 〕━━━╮

👤 Name: ${name}
🔖 Username: @${uniqueId}

👥 Followers: ${followers}
👤 Following: ${following}
❤️ Likes: ${likes}
🎬 Videos: ${videos}
🤝 Friends: ${friends}
👍 Own Liked: ${digg} video

☑️ Verified: ${verified}

📝 Bio:
${bio}

╰━━━━━━━━━━━━━━━━━━━━╯`;

      if (findingMsg?.messageID) {
        try {
          await message.unsend(findingMsg.messageID);
        } catch (e) {}
      }

      if (user.avatarLarger) {
        try {
          const image = await axios.get(user.avatarLarger, {
            responseType: "stream",
            timeout: 30000
          });

          return message.reply({
            body: text,
            attachment: image.data
          });
        } catch (e) {}
      }

      return message.reply(text);

    } catch (error) {
      console.error("TikTok Info Error:", error);

      if (findingMsg?.messageID) {
        try {
          await message.unsend(findingMsg.messageID);
        } catch (e) {}
      }

      return message.reply(
        `❌ | TikTok information পাওয়া যায়নি!\n\n👤 Username: @${username}`
      );
    }
  }
};
