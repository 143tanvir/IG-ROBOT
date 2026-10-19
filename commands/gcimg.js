/**
 * File Name: gcimg.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 */

"use strict";

const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const WIDTH = 1600;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_AVATAR_CONCURRENCY = 5;
const CACHE_DIR = path.join(__dirname, "../cache");

fs.ensureDirSync(CACHE_DIR);

function escapeXML(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function roundedRect(x, y, width, height, radius, fill, stroke = "none", strokeWidth = 1) {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function callbackOrPromise(method, receiver, args) {
    return new Promise((resolve, reject) => {
        let settled = false;

        const done = (error, data) => {
            if (settled) return;
            settled = true;

            if (error) reject(error);
            else resolve(data);
        };

        try {
            const result = method.apply(receiver, [...args, done]);

            if (result && typeof result.then === "function") {
                result.then(data => done(null, data)).catch(done);
            } else if (
                result !== undefined &&
                result !== null &&
                method.length <= args.length
            ) {
                done(null, result);
            }
        } catch (error) {
            done(error);
        }
    });
}

async function getThreadInfo(api, threadID) {
    const info = await callbackOrPromise(
        api.getThreadInfo,
        api,
        [threadID]
    );

    if (info && info[threadID] && !info.participantIDs) {
        return info[threadID];
    }

    return info;
}

function normalizeIDs(list) {
    if (!Array.isArray(list)) return [];

    return [...new Set(list.map(item => {
        if (item && typeof item === "object") {
            return String(
                item.id ||
                item.userID ||
                item.uid ||
                item.pk ||
                ""
            );
        }

        return String(item == null ? "" : item);
    }).filter(Boolean))];
}

function getProfileAvatarURL(profile = {}) {
    const candidates = [
        profile.thumbSrc,
        profile.profilePicture,
        profile.profilePicUrl,
        profile.profile_pic_url_hd,
        profile.profile_pic_url,
        profile.avatar,
        profile.image,
        profile.photoUrl,
        profile.profilePictureUrl
    ];

    return candidates.find(value =>
        typeof value === "string" &&
        /^https?:\/\//i.test(value)
    ) || null;
}

function getGroupAvatarURL(info = {}) {
    const candidates = [
        info.imageSrc,
        info.imageUrl,
        info.threadImage,
        info.photo,
        info.image,
        info.groupPhotoUrl
    ];

    return candidates.find(value =>
        typeof value === "string" &&
        /^https?:\/\//i.test(value)
    ) || null;
}

function getName(profile = {}) {
    return String(
        profile.name ||
        profile.fullName ||
        profile.full_name ||
        profile.displayName ||
        profile.firstName ||
        ""
    ).trim();
}

function getUsername(profile = {}) {
    const value =
        profile.vanity ||
        profile.username ||
        profile.userName ||
        profile.handle ||
        profile.user_name ||
        "";

    return String(value).trim().replace(/^@+/, "");
}

async function downloadBuffer(url) {
    if (!url || typeof url !== "string") return null;

    try {
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 15000,
            maxContentLength: MAX_IMAGE_BYTES,
            headers: {
                "User-Agent": "Mozilla/5.0"
            },
            validateStatus: status =>
                status >= 200 && status < 300
        });

        const contentType = String(
            response.headers["content-type"] || ""
        ).toLowerCase();

        if (contentType && !contentType.startsWith("image/")) {
            return null;
        }

        return Buffer.from(response.data);
    } catch {
        return null;
    }
}

async function circularImage(buffer, size) {
    const resized = await sharp(buffer)
        .rotate()
        .resize(size, size, { fit: "cover" })
        .png()
        .toBuffer();

    const mask = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${size}" height="${size}">
            <circle cx="${size / 2}" cy="${size / 2}"
                    r="${size / 2}" fill="#ffffff"/>
        </svg>
    `);

    return sharp(resized)
        .composite([
            {
                input: mask,
                blend: "dest-in"
            }
        ])
        .png()
        .toBuffer();
}

function placeholderAvatar(size) {
    return Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${size}" height="${size}">
            <circle cx="${size / 2}" cy="${size / 2}"
                    r="${size / 2}" fill="#263449"/>
            <circle cx="${size / 2}" cy="${size * 0.36}"
                    r="${size * 0.18}" fill="#94a3b8"/>
            <ellipse cx="${size / 2}" cy="${size * 0.79}"
                     rx="${size * 0.3}" ry="${size * 0.23}"
                     fill="#94a3b8"/>
        </svg>
    `);
}

async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;

    async function run() {
        while (true) {
            const index = next++;

            if (index >= items.length) return;

            try {
                results[index] = await worker(items[index], index);
            } catch {
                results[index] = null;
            }
        }
    }

    await Promise.all(
        Array.from(
            { length: Math.min(limit, items.length) },
            run
        )
    );

    return results;
}

function profileMapFrom(data) {
    if (!data || typeof data !== "object") return {};

    if (data.users && typeof data.users === "object") {
        return data.users;
    }

    if (data.data && typeof data.data === "object") {
        return profileMapFrom(data.data);
    }

    return data;
}

async function fetchUserMap(api, ids) {
    if (
        !ids.length ||
        !api ||
        typeof api.getUserInfo !== "function"
    ) {
        return {};
    }

    try {
        const data = await callbackOrPromise(
            api.getUserInfo,
            api,
            [ids]
        );

        return profileMapFrom(data);
    } catch (error) {
        console.error(
            "[GCIMG USER INFO]",
            error.message || error
        );

        return {};
    }
}

async function createGroupCard(threadInfo, api) {
    const participantIDs = normalizeIDs(
        threadInfo.participantIDs ||
        threadInfo.userIDs
    );

    if (!participantIDs.length) {
        throw new Error(
            "No participant IDs returned by getThreadInfo()."
        );
    }

    const adminIDs = normalizeIDs(
        threadInfo.adminIDs ||
        threadInfo.admins
    );

    const threadUsers = Array.isArray(threadInfo.userInfo)
        ? threadInfo.userInfo
        : [];

    const initialProfiles = {};

    for (const user of threadUsers) {
        if (!user || typeof user !== "object") continue;

        const id = String(
            user.id ||
            user.userID ||
            user.uid ||
            user.pk ||
            ""
        );

        if (id) initialProfiles[id] = user;
    }

    const missingIDs = participantIDs.filter(id => {
        const profile = initialProfiles[id] || {};

        return (
            !getProfileAvatarURL(profile) ||
            !getName(profile) ||
            !getUsername(profile)
        );
    });

    const fetchedProfiles = await fetchUserMap(
        api,
        missingIDs
    );

    function profileFor(id) {
        const initial = initialProfiles[id] || {};
        const fetched = fetchedProfiles[id] || {};
        const keyed = fetchedProfiles[String(id)] || {};

        return {
            ...initial,
            ...fetched,
            ...keyed,
            userID: id
        };
    }

    const members = await mapLimit(
        participantIDs,
        MAX_AVATAR_CONCURRENCY,
        async id => {
            const profile = profileFor(id);
            const avatarURL = getProfileAvatarURL(profile);
            const avatarBuffer = await downloadBuffer(avatarURL);

            let avatar = null;

            if (avatarBuffer) {
                try {
                    avatar = await circularImage(
                        avatarBuffer,
                        104
                    );
                } catch {}
            }

            return {
                id,
                profile,
                avatar,
                name: getName(profile),
                username: getUsername(profile),
                isAdmin: adminIDs.includes(id)
            };
        }
    );

    const groupImageBuffer = await downloadBuffer(
        getGroupAvatarURL(threadInfo)
    );

    let groupAvatar = null;

    if (groupImageBuffer) {
        try {
            groupAvatar = await circularImage(
                groupImageBuffer,
                180
            );
        } catch {}
    }

    if (!groupAvatar) {
        groupAvatar = await circularImage(
            placeholderAvatar(180),
            180
        );
    }

    const columns = 5;
    const cardW = 286;
    const cardH = 188;
    const gapX = 18;
    const gapY = 20;
    const headerH = 320;

    const rows = Math.max(
        1,
        Math.ceil(members.length / columns)
    );

    const gridW =
        columns * cardW +
        (columns - 1) * gapX;

    const startX = Math.round(
        (WIDTH - gridW) / 2
    );

    const startY = headerH;

    const height =
        headerH +
        rows * cardH +
        (rows - 1) * gapY +
        65;

    const memberCount = participantIDs.length;
    const adminCount = adminIDs.length;

    const groupName = String(
        threadInfo.threadName ||
        threadInfo.name ||
        "Our Group Members"
    );

    const shownGroupName = groupName.length > 31
        ? `${groupName.slice(0, 28)}...`
        : groupName;

    const parts = [];

    parts.push(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${WIDTH}" height="${height}"
             viewBox="0 0 ${WIDTH} ${height}">

            <defs>
                <linearGradient id="bg"
                    x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#08111f"/>
                    <stop offset="55%" stop-color="#14213b"/>
                    <stop offset="100%" stop-color="#073449"/>
                </linearGradient>

                <linearGradient id="accent"
                    x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#2dd4bf"/>
                    <stop offset="100%" stop-color="#a3e635"/>
                </linearGradient>
            </defs>

            <rect width="${WIDTH}" height="${height}"
                  fill="url(#bg)"/>

            <circle cx="1510" cy="50" r="300"
                    fill="#22d3ee" opacity="0.05"/>

            ${roundedRect(
                28, 28, WIDTH - 56, height - 56,
                36, "#0c1526", "#29384e", 2
            )}

            ${roundedRect(
                65, 60, WIDTH - 130, 8,
                4, "url(#accent)"
            )}

            <text x="${WIDTH / 2}" y="130"
                  text-anchor="middle"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="54"
                  font-weight="700"
                  fill="#ffffff">Our Group Members</text>

            ${roundedRect(
                75, 158, WIDTH - 150, 132,
                24, "#111c30", "#29384e", 2
            )}

            <text x="290" y="207"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="27"
                  font-weight="700"
                  fill="#ffffff">${escapeXML(shownGroupName)}</text>

            <text x="290" y="247"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="18"
                  font-weight="600"
                  fill="#67e8f9">GROUP PROFILE</text>

            <line x1="1070" y1="180"
                  x2="1070" y2="266"
                  stroke="#334155" stroke-width="2"/>

            <line x1="1305" y1="180"
                  x2="1305" y2="266"
                  stroke="#334155" stroke-width="2"/>

            <text x="1110" y="214"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="38"
                  font-weight="700"
                  fill="#ffffff">${memberCount}</text>

            <text x="1110" y="247"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="17"
                  font-weight="600"
                  fill="#94a3b8">MEMBERS</text>

            <text x="1340" y="214"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="38"
                  font-weight="700"
                  fill="#a3e635">${adminCount}</text>

            <text x="1340" y="247"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="17"
                  font-weight="600"
                  fill="#94a3b8">ADMINS</text>
    `);

    const overlays = [
        {
            input: groupAvatar,
            left: 88,
            top: 134
        }
    ];

    const adminRings = [];

    members.forEach((member, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;

        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);
        const centerX = x + cardW / 2;
        const avatarY = y + 10;

        parts.push(
            roundedRect(
                x, y, cardW, cardH,
                20, "#111c30", "#29384e", 2
            )
        );

        if (member.avatar) {
            overlays.push({
                input: member.avatar,
                left: Math.round(centerX - 52),
                top: avatarY
            });

            if (member.isAdmin) {
                adminRings.push(`
                    <circle cx="${centerX}"
                            cy="${avatarY + 52}"
                            r="56"
                            fill="none"
                            stroke="#22c55e"
                            stroke-width="5"/>
                `);
            }

            const name = member.name || "";
            const username = member.username
                ? `@${member.username}`
                : "";

            const safeName = name.length > 27
                ? `${name.slice(0, 24)}...`
                : name;

            const safeUsername = username.length > 34
                ? `${username.slice(0, 31)}...`
                : username;

            if (safeName) {
                parts.push(`
                    <text x="${centerX}" y="${y + 132}"
                          text-anchor="middle"
                          font-family="Arial, Helvetica, sans-serif"
                          font-size="17"
                          font-weight="700"
                          fill="#ffffff">${escapeXML(safeName)}</text>
                `);
            }

            if (safeUsername) {
                parts.push(`
                    <text x="${centerX}" y="${y + 161}"
                          text-anchor="middle"
                          font-family="Arial, Helvetica, sans-serif"
                          font-size="14"
                          fill="#67e8f9">${escapeXML(safeUsername)}</text>
                `);
            }
        } else {
            // No real profile photo: hide the name and username.
            overlays.push({
                input: placeholderAvatar(104),
                left: Math.round(centerX - 52),
                top: avatarY
            });
        }
    });

    if (adminRings.length) {
        parts.push(adminRings.join("\n"));
    }

    parts.push("</svg>");

    const svgBuffer = Buffer.from(parts.join("\n"));

    return sharp(svgBuffer)
        .composite(overlays)
        .png()
        .toBuffer();
}

module.exports = {
    config: {
        name: "gcimg",
        aliases: ["groupimage", "groupcard", "gc"],
        version: "6.0.0",
        author: "Tanvir Ahmed (Tanvir143)",
        countDown: 10,
        role: 0,
        shortDescription: "Create a group members card",
        longDescription: "Create a group card with group DP, member/admin counts, profile pictures, names and usernames.",
        category: "group",
        guide: "{pn}"
    },

    onStart: async function ({ api, event, message }) {
        let filePath;

        try {
            await message.reply(
                "⏳ Our Group Members card তৈরি হচ্ছে..."
            );

            const threadInfo = await getThreadInfo(
                api,
                String(event.threadID)
            );

            if (!threadInfo) {
                return message.reply(
                    "❌ Group information পাওয়া যায়নি।"
                );
            }

            const image = await createGroupCard(
                threadInfo,
                api
            );

            const safeThreadID = String(event.threadID)
                .replace(/[^a-zA-Z0-9_-]/g, "_");

            filePath = path.join(
                CACHE_DIR,
                `gcimg_${safeThreadID}_${Date.now()}.png`
            );

            await fs.writeFile(filePath, image);

            await message.reply({
                body: "🖼️ Our Group Members",
                attachment: fs.createReadStream(filePath)
            });
        } catch (error) {
            console.error("[GCIMG ERROR]", error);

            return message.reply(
                `❌ Group card তৈরি করা যায়নি: ${String(
                    error.message || error
                ).slice(0, 250)}`
            );
        } finally {
            if (filePath) {
                setTimeout(() => {
                    fs.remove(filePath).catch(() => {});
                }, 30000);
            }
        }
    }
};
