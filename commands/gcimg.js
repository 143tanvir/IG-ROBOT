/**

* File Name: gcimg.js
* ICA: igbot-api
* Author: Tanvir Ahmed (Tanvir143)
* GitHub: www.github.com/143tanvir
* Description: Group information image generator using Sharp.
  */

"use strict";

const sharp = require("sharp");
const axios = require("axios");

const { resolveProfile } = require("../src/utils");

const WIDTH = 1200;
const MAX_MEMBERS = 40;

function escapeXml(value = "") {
return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function getThreadInfo(api, threadID) {
return new Promise((resolve, reject) => {
try {
const result = api.getThreadInfo(threadID, (err, info) => {
if (err) return reject(err);
resolve(info);
});

  if (result && typeof result.then === "function") {
    result.then(resolve).catch(reject);
  }
} catch (error) {
  reject(error);
}

});
}

function getUserInfo(api, userID) {
return new Promise((resolve) => {
try {
const result = api.getUserInfo(String(userID), (err, info) => {
if (err || !info) return resolve(null);
resolve(info[String(userID)] || info);
});

  if (result && typeof result.then === "function") {
    result.then((info) => {
      resolve(info?.[String(userID)] || info || null);
    }).catch(() => resolve(null));
  }
} catch {
  resolve(null);
}

});
}

async function downloadImage(url) {
if (!url || typeof url !== "string") return null;

try {
const response = await axios.get(url, {
responseType: "arraybuffer",
timeout: 10000,
maxContentLength: 8 * 1024 * 1024,
maxBodyLength: 8 * 1024 * 1024,
validateStatus: (status) => status >= 200 && status < 300
});

return await sharp(Buffer.from(response.data))
  .rotate()
  .resize(180, 180, { fit: "cover" })
  .png()
  .toBuffer();

} catch {
return null;
}
}

async function getAvatar(api, userID, event) {
try {
const profile = await resolveProfile(
[String(userID)],
{
senderID: String(userID),
threadID: event.threadID,
mentions: {},
messageReply: null
},
api
);

const item = Array.isArray(profile) ? profile[0] : profile;
const url =
  item?.image ||
  item?.avatar ||
  item?.avatarUrl ||
  item?.profilePicUrl ||
  item?.photoUrl;

if (url) {
  const image = await downloadImage(url);
  if (image) return image;
}

} catch {}

const info = await getUserInfo(api, userID);
const url =
info?.thumbSrc ||
info?.avatarUrl ||
info?.profilePicUrl ||
info?.photoUrl;

return downloadImage(url);
}

function imageData(buffer) {
return buffer
? "data:image/png;base64,${buffer.toString("base64")}"
: "";
}

function createAvatarSvg(src, x, y, size, id) {
if (!src) {
return "<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="#303747"/> <text x="${x + size / 2}" y="${y + size / 2 + 10}" text-anchor="middle" font-size="28" fill="#ffffff">?</text>";
}

return "<defs> <clipPath id="avatar-${id}"> <circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}"/> </clipPath> </defs> <image href="${src}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-${id})"/>";
}

module.exports = {
config: {
name: "gcimg",
aliases: ["groupimg", "groupinfo"],
description: "Generate a group information image",
usage: ".gcimg",
category: "Group",
cooldown: 10,
role: 0
},

onStart: async function ({ message, event, api, usersData }) {
try {
const threadID = event.threadID;

  if (!threadID) {
    return message.reply("Group information পাওয়া যায়নি।");
  }

  const info = await getThreadInfo(api, threadID);

  if (!info) {
    return message.reply("Group information load করা যায়নি।");
  }

  const threadName = info.threadName || "Instagram Group";
  const participants = Array.isArray(info.participantIDs)
    ? info.participantIDs.map(String)
    : [];

  const adminIDs = new Set(
    (info.adminIDs || []).map((admin) =>
      String(admin.id || admin.userID || admin)
    )
  );

  const members = participants.slice(0, MAX_MEMBERS);
  const memberCount = participants.length;
  const adminCount = adminIDs.size;

  let groupImage = null;

  const groupImageUrl =
    info.imageSrc ||
    info.imageUrl ||
    info.threadImage ||
    info.photoUrl;

  if (groupImageUrl) {
    groupImage = await downloadImage(groupImageUrl);
  }

  const avatarResults = await Promise.all(
    members.map(async (uid) => {
      let name = "";

      try {
        if (usersData && typeof usersData.getName === "function") {
          name = await usersData.getName(uid);
        }
      } catch {}

      if (!name) {
        const userInfo = await getUserInfo(api, uid);
        name =
          userInfo?.name ||
          userInfo?.fullName ||
          `User ${uid}`;
      }

      const avatar = await getAvatar(api, uid, event);

      return {
        id: uid,
        name: String(name || `User ${uid}`),
        avatar: imageData(avatar),
        isAdmin: adminIDs.has(uid)
      };
    })
  );

  const cardWidth = WIDTH;
  const padding = 50;
  const avatarSize = 74;
  const rowHeight = 105;
  const columns = 2;
  const columnWidth = (cardWidth - padding * 2) / columns;
  const rows = Math.ceil(avatarResults.length / columns);

  const memberStart = 440;
  const footerHeight = 100;
  const height = Math.max(
    650,
    memberStart + rows * rowHeight + footerHeight
  );

  const groupAvatar = imageData(groupImage);

  const memberSvg = avatarResults.map((member, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + col * columnWidth;
    const y = memberStart + row * rowHeight;

    const safeName = escapeXml(member.name).slice(0, 34);
    const safeID = escapeXml(member.id);
    const avatar = createAvatarSvg(
      member.avatar,
      x,
      y,
      avatarSize,
      index
    );

    return `
      <rect x="${x}" y="${y}" width="${columnWidth - 14}"
        height="88" rx="18" fill="#202633"
        stroke="#343c4c" stroke-width="1"/>
      ${avatar}
      <text x="${x + avatarSize + 16}" y="${y + 32}"
        font-size="22" font-weight="600" fill="#ffffff">
        ${safeName}
      </text>
      <text x="${x + avatarSize + 16}" y="${y + 60}"
        font-size="15" fill="#aeb8ca">
        ID: ${safeID.slice(0, 22)}
      </text>
      ${
        member.isAdmin
          ? `<text x="${x + avatarSize + 16}" y="${y + 79}"
              font-size="13" fill="#8bc7ff">ADMIN</text>`
          : ""
      }
    `;
  }).join("");

  const groupAvatarSvg = groupAvatar
    ? `
      <defs>
        <clipPath id="group-avatar-clip">
          <circle cx="100" cy="100" r="82"/>
        </clipPath>
      </defs>
      <image href="${groupAvatar}" x="18" y="18"
        width="164" height="164"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#group-avatar-clip)"/>
      <circle cx="100" cy="100" r="84"
        fill="none" stroke="#7c9cff" stroke-width="4"/>
    `
    : `
      <circle cx="100" cy="100" r="82" fill="#303747"/>
      <text x="100" y="115" text-anchor="middle"
        font-size="48" fill="#ffffff">GC</text>
    `;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      width="${cardWidth}" height="${height}"
      viewBox="0 0 ${cardWidth} ${height}">
      <defs>
        <linearGradient id="background" x1="0" y1="0"
          x2="1" y2="1">
          <stop offset="0%" stop-color="#111722"/>
          <stop offset="100%" stop-color="#252d40"/>
        </linearGradient>
        <linearGradient id="header" x1="0" y1="0"
          x2="1" y2="1">
          <stop offset="0%" stop-color="#394b75"/>
          <stop offset="100%" stop-color="#654e91"/>
        </linearGradient>
      </defs>

      <rect width="100%" height="100%" rx="30"
        fill="url(#background)"/>

      <rect x="0" y="0" width="${cardWidth}" height="235"
        rx="30" fill="url(#header)"/>
      <rect x="0" y="205" width="${cardWidth}" height="30"
        fill="url(#header)"/>

      ${groupAvatarSvg}

      <text x="220" y="78" font-size="20"
        fill="#dce5ff">GROUP INFORMATION</text>

      <text x="220" y="125" font-size="32"
        font-weight="700" fill="#ffffff">
        ${escapeXml(threadName).slice(0, 36)}
      </text>

      <text x="220" y="164" font-size="19"
        fill="#e0e6f5">Powered by Tanvir143</text>

      <rect x="50" y="265" width="340" height="115"
        rx="22" fill="#202633"/>
      <rect x="430" y="265" width="340" height="115"
        rx="22" fill="#202633"/>
      <rect x="810" y="265" width="340" height="115"
        rx="22" fill="#202633"/>

      <text x="75" y="310" font-size="19"
        fill="#aeb8ca">TOTAL MEMBERS</text>
      <text x="75" y="355" font-size="35"
        font-weight="700" fill="#ffffff">${memberCount}</text>

      <text x="455" y="310" font-size="19"
        fill="#aeb8ca">GROUP ADMINS</text>
      <text x="455" y="355" font-size="35"
        font-weight="700" fill="#ffffff">${adminCount}</text>

      <text x="835" y="310" font-size="19"
        fill="#aeb8ca">DISPLAYED</text>
      <text x="835" y="355" font-size="35"
        font-weight="700" fill="#ffffff">${members.length}</text>

      <text x="50" y="418" font-size="24"
        font-weight="700" fill="#ffffff">GROUP MEMBERS</text>

      ${memberSvg}

      ${
        memberCount > MAX_MEMBERS
          ? `<text x="50" y="${memberStart + rows * rowHeight + 12}"
              font-size="17" fill="#c3cde0">
              Showing ${MAX_MEMBERS} of ${memberCount} members
            </text>`
          : ""
      }

      <text x="${cardWidth / 2}" y="${height - 35}"
        text-anchor="middle" font-size="17"
        fill="#aeb8ca">IG-ROBOT • Tanvir143</text>
    </svg>
  `;

  const card = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return message.reply({
    body: `🖼️ ${threadName}\n👥 Members: ${memberCount}\n👑 Admins: ${adminCount}`,
    attachment: card
  });
} catch (error) {
  console.error("[gcimg] Error:", error);

  return message.reply(
    "❌ Group image তৈরি করা যায়নি। Console log check করো।"
  );
}

}
};
