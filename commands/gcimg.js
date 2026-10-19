/**

* File Name: gcimg.js
* ICA: igbot-api
* Author: Tanvir Ahmed (Tanvir143)
* GitHub: www.github.com/143tanvir
* Description: Group information image generator using Sharp.
  */

"use strict";

const sharp = require("sharp");

const WIDTH = 1000;
const HEIGHT = 650;
const MAX_MEMBERS = 16;

/**

* Escape special XML characters safely.
  */
  function escapeXml(value = "") {
  const entities = {
  "&": "&",
  "<": "<",
  ">": ">",
  '"': """,
  "'": "'"
  };
  
  return String(value).replace(/[&<>"']/g, char => entities[char]);
  }

/**

* Get group information from ICA.
  */
  function getThreadInfo(api, threadID) {
  return new Promise((resolve, reject) => {
  try {
  api.getThreadInfo(threadID, (error, info) => {
  if (error) {
  return reject(error);
  }
  
           resolve(info || null);
     });
 } catch (error) {
     reject(error);
 }
  
  });
  }

/**

* Get a member's profile information.
  */
  function getUserInfo(api, userID) {
  return new Promise((resolve) => {
  try {
  api.getUserInfo(String(userID), (error, info) => {
  if (error || !info) {
  return resolve(null);
  }
  
           resolve(info[String(userID)] || null);
     });
 } catch (error) {
     resolve(null);
 }
  
  });
  }

/**

* Build the group information SVG.
  */
  function buildSvg(groupName, members, memberCount, adminCount) {
  const memberRows = members.map((member, index) => {
  const column = index < 6 ? 0 : 1;
  const row = index % 6;
  
   const x = column === 0 ? 55 : 515;
 const y = 350 + row * 42;

 return `
     <rect
         x="${x}"
         y="${y - 25}"
         width="430"
         height="34"
         rx="9"
         fill="#222b3a"
     />

     <text
         x="${x + 12}"
         y="${y}"
         font-family="Arial, sans-serif"
         font-size="16"
         fill="#ffffff"
     >${index + 1}. ${escapeXml(member).slice(0, 35)}</text>
 `;
  
  }).join("\n");
  
  return `
  <svg
xmlns="http://www.w3.org/2000/svg"
width="${WIDTH}"
height="${HEIGHT}"
viewBox="0 0 ${WIDTH} ${HEIGHT}"
>
  <defs>
  <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0%" stop-color="#101827"/>
  <stop offset="100%" stop-color="#354363"/>
  </linearGradient>
  
           <linearGradient id="header" x1="0" y1="0" x2="1" y2="0">
             <stop offset="0%" stop-color="#526caa"/>
             <stop offset="100%" stop-color="#8058a6"/>
         </linearGradient>
     </defs>

     <rect
         width="${WIDTH}"
         height="${HEIGHT}"
         rx="28"
         fill="url(#background)"
     />

     <rect
         width="${WIDTH}"
         height="200"
         rx="28"
         fill="url(#header)"
     />

     <rect
         y="175"
         width="${WIDTH}"
         height="25"
         fill="url(#header)"
     />

     <circle
         cx="105"
         cy="100"
         r="55"
         fill="#ffffff"
         opacity="0.18"
     />

     <text
         x="105"
         y="115"
         text-anchor="middle"
         font-family="Arial, sans-serif"
         font-size="42"
         font-weight="bold"
         fill="#ffffff"
     >GC</text>

     <text
         x="190"
         y="70"
         font-family="Arial, sans-serif"
         font-size="18"
         fill="#e6eaff"
     >GROUP INFORMATION</text>

     <text
         x="190"
         y="115"
         font-family="Arial, sans-serif"
         font-size="29"
         font-weight="bold"
         fill="#ffffff"
     >${escapeXml(groupName).slice(0, 35)}</text>

     <text
         x="190"
         y="155"
         font-family="Arial, sans-serif"
         font-size="17"
         fill="#f0eaff"
     >IG-ROBOT | Tanvir143</text>

     <rect x="50" y="220" width="280" height="75" rx="15" fill="#222b3a"/>
     <rect x="360" y="220" width="280" height="75" rx="15" fill="#222b3a"/>
     <rect x="670" y="220" width="280" height="75" rx="15" fill="#222b3a"/>

     <text x="70" y="249" font-family="Arial, sans-serif" font-size="15" fill="#b9c5df">
         TOTAL MEMBERS
     </text>

     <text x="70" y="279" font-family="Arial, sans-serif" font-size="27" font-weight="bold" fill="#ffffff">
         ${memberCount}
     </text>

     <text x="380" y="249" font-family="Arial, sans-serif" font-size="15" fill="#b9c5df">
         GROUP ADMINS
     </text>

     <text x="380" y="279" font-family="Arial, sans-serif" font-size="27" font-weight="bold" fill="#ffffff">
         ${adminCount}
     </text>

     <text x="690" y="249" font-family="Arial, sans-serif" font-size="15" fill="#b9c5df">
         MEMBERS SHOWN
     </text>

     <text x="690" y="279" font-family="Arial, sans-serif" font-size="27" font-weight="bold" fill="#ffffff">
         ${members.length}
     </text>

     <text
         x="55"
         y="325"
         font-family="Arial, sans-serif"
         font-size="19"
         font-weight="bold"
         fill="#ffffff"
     >MEMBER LIST</text>

     ${memberRows}

     <text
         x="500"
         y="635"
         text-anchor="middle"
         font-family="Arial, sans-serif"
         font-size="14"
         fill="#c3cde0"
     >Created by Tanvir143</text>
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

        const participantIDs = Array.isArray(info.participantIDs)
            ? info.participantIDs
            : [];

        const adminIDs = Array.isArray(info.adminIDs)
            ? info.adminIDs.map((admin) => {
                if (admin && typeof admin === "object") {
                    return String(admin.id || admin.userID || "");
                }

                return String(admin);
            }).filter(Boolean)
            : [];

        const selectedIDs = participantIDs.slice(0, MAX_MEMBERS);

        const memberNames = await Promise.all(
            selectedIDs.map(async (userID, index) => {
                const user = await getUserInfo(api, userID);

                if (user && user.name) {
                    return user.name;
                }

                return `Member ${index + 1}`;
            })
        );

        const svg = buildSvg(
            info.threadName || "Group Information",
            memberNames,
            participantIDs.length,
            adminIDs.length
        );

        const imageBuffer = await sharp(Buffer.from(svg))
            .png()
            .toBuffer();

        return message.reply({
            body:
                `🖼️ ${info.threadName || "Group"}\n` +
                `👥 Members: ${participantIDs.length}\n` +
                `👑 Admins: ${adminIDs.length}`,
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
