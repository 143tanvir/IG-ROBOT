/**

* File Name: gcimg.js
* ICA: igbot-api
* Author: Tanvir Ahmed (Tanvir143)
* GitHub: www.github.com/143tanvir
* Description: Group information image generator.
  */

"use strict";

const sharp = require("sharp");

const WIDTH = 1000;
const HEIGHT = 620;

function xml(value) {
let text = String(value == null ? "" : value);
text = text.split("&").join("&");
text = text.split("<").join("<");
text = text.split(">").join(">");
text = text.split('"').join(""");
text = text.split("'").join("'");
return text;
}

function getThreadInfo(api, threadID) {
return new Promise((resolve, reject) => {
api.getThreadInfo(threadID, (error, info) => {
if (error) return reject(error);
resolve(info);
});
});
}

function getUserInfo(api, userID) {
return new Promise((resolve) => {
api.getUserInfo(String(userID), (error, info) => {
if (error || !info) return resolve(null);
resolve(info[String(userID)] || null);
});
});
}

function makeSvg(info, memberNames, adminCount) {
const groupName = xml(info.threadName || "Group Information");
const members = Array.isArray(info.participantIDs)
? info.participantIDs
: [];

const shownMembers = memberNames.slice(0, 12);

const memberLines = shownMembers.map((member, index) => {
const column = index < 6 ? 0 : 1;
const row = index % 6;
const x = column === 0 ? 65 : 525;
const y = 330 + row * 42;

return `
  <rect x="${x}" y="${y - 25}" width="410" height="35"
    rx="10" fill="#222b3a"/>
  <text x="${x + 14}" y="${y}"
    font-family="Arial, sans-serif"
    font-size="17" fill="#f5f7ff">
    ${index + 1}. ${xml(member).slice(0, 35)}
  </text>
`;

}).join("");

return `
<svg xmlns="http://www.w3.org/2000/svg"
width="${WIDTH}" height="${HEIGHT}"
viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#101827"/>
<stop offset="100%" stop-color="#354363"/>
</linearGradient>
<linearGradient id="top" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#526caa"/>
<stop offset="100%" stop-color="#8058a6"/>
</linearGradient>
</defs>

  <rect width="1000" height="620" rx="28" fill="url(#bg)"/>
  <rect width="1000" height="205" rx="28" fill="url(#top)"/>
  <rect y="175" width="1000" height="30" fill="url(#top)"/>

  <circle cx="105" cy="100" r="55" fill="#ffffff" opacity="0.16"/>
  <text x="105" y="116" text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="43" font-weight="bold" fill="#ffffff">GC</text>

  <text x="190" y="75" font-family="Arial, sans-serif"
    font-size="19" fill="#e6eaff">GROUP INFORMATION</text>
  <text x="190" y="120" font-family="Arial, sans-serif"
    font-size="29" font-weight="bold" fill="#ffffff">
    ${groupName.slice(0, 34)}
  </text>
  <text x="190" y="157" font-family="Arial, sans-serif"
    font-size="17" fill="#f0eaff">IG-ROBOT | Tanvir143</text>

  <rect x="50" y="225" width="280" height="70" rx="16" fill="#222b3a"/>
  <rect x="360" y="225" width="280" height="70" rx="16" fill="#222b3a"/>
  <rect x="670" y="225" width="280" height="70" rx="16" fill="#222b3a"/>

  <text x="70" y="252" font-family="Arial, sans-serif"
    font-size="15" fill="#b9c5df">TOTAL MEMBERS</text>
  <text x="70" y="280" font-family="Arial, sans-serif"
    font-size="27" font-weight="bold" fill="#ffffff">${members.length}</text>

  <text x="380" y="252" font-family="Arial, sans-serif"
    font-size="15" fill="#b9c5df">GROUP ADMINS</text>
  <text x="380" y="280" font-family="Arial, sans-serif"
    font-size="27" font-weight="bold" fill="#ffffff">${adminCount}</text>

  <text x="690" y="252" font-family="Arial, sans-serif"
    font-size="15" fill="#b9c5df">MEMBERS SHOWN</text>
  <text x="690" y="280" font-family="Arial, sans-serif"
    font-size="27" font-weight="bold" fill="#ffffff">${shownMembers.length}</text>

  <text x="60" y="320" font-family="Arial, sans-serif"
    font-size="18" font-weight="bold" fill="#ffffff">MEMBER LIST</text>

  ${memberLines}

  <text x="500" y="600" text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="15" fill="#c3cde0">Created by Tanvir143</text>
</svg>

`;
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

onStart: async function ({ message, event, api }) {
try {
if (!event || !event.threadID) {
return message.reply("Group ID পাওয়া যায়নি।");
}

  const info = await getThreadInfo(api, event.threadID);

  if (!info) {
    return message.reply("Group information পাওয়া যায়নি।");
  }

  const participants = Array.isArray(info.participantIDs)
    ? info.participantIDs
    : [];

  const admins = Array.isArray(info.adminIDs)
    ? info.adminIDs
    : [];

  const adminCount = admins.length;
  const selected = participants.slice(0, 12);

  const results = await Promise.all(
    selected.map(async (id, index) => {
      const user = await getUserInfo(api, id);
      return user && user.name
        ? user.name
        : "Member " + (index + 1);
    })
  );

  const svg = makeSvg(info, results, adminCount);

  const imageBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return message.reply({
    body:
      "🖼️ " + (info.threadName || "Group") +
      "\n👥 Members: " + participants.length +
      "\n👑 Admins: " + adminCount,
    attachment: imageBuffer
  });
} catch (error) {
  console.error("[gcimg] Error:", error);
  return message.reply(
    "❌ Group image তৈরি করা যায়নি। Railway console-এর error দেখো।"
  );
}

}
};
