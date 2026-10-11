/**
 * File Name: gcScan.js
 * ICA: igbot-api
 * Auhor: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

/**
 * ╔══════════════════════════════════════════════╗
 * ║               Tanvir143 AI                  ║
 * ║          Group Message Analyzer             ║
 * ╠══════════════════════════════════════════════╣
 * ║ Maintained, Modified and Fixed:             ║
 * ║ Tanvir Ahmed (Tanvir143)                    ║
 * ║                                              ║
 * ║ WhatsApp: +8801750079773                    ║
 * ║ GitHub: www.github.com/143tanvir             ║
 * ╚══════════════════════════════════════════════╝
 *
 * Features:
 * - Group message analysis
 * - Maximum 50 messages
 * - Fast response
 * - Bangla AI response
 * - Sender name resolving
 * - No UID shown
 */

const tanvir143 =
    "https://kilwaapi.vercel.app";

const tanvirRobot = 50;
const tanvir143igRobot = 55000;
const instaBot143 = 18000;

function tanvir143bot(
    api,
    threadID
) {
    return new Promise((resolve) => {
        if (
            typeof api.getThreadHistory !==
            "function"
        ) {
            return resolve([]);
        }

        let tanvirDone = false;

        const tanvirFinish = (data) => {
            if (tanvirDone) return;

            tanvirDone = true;
            resolve(
                Array.isArray(data)
                    ? data
                    : []
            );
        };

        const tanvirTimer = setTimeout(() => {
            tanvirFinish([]);
        }, instaBot143);

        try {
            api.getThreadHistory(
                threadID,
                tanvirRobot,
                null,
                (error, data) => {
                    clearTimeout(tanvirTimer);

                    if (error) {
                        return tanvirFinish([]);
                    }

                    tanvirFinish(data);
                }
            );
        } catch (_) {
            clearTimeout(tanvirTimer);
            tanvirFinish([]);
        }
    });
}

function tanvir143Clean(
    tanvirMessages
) {
    return tanvirMessages
        .map((tanvirMessage) => ({
            id:
                tanvirMessage.messageID ||
                tanvirMessage.messageId ||
                tanvirMessage.id ||
                null,

            senderID:
                tanvirMessage.senderID ||
                tanvirMessage.userID ||
                tanvirMessage.sender_id ||
                null,

            senderName:
                tanvirMessage.senderName ||
                tanvirMessage.name ||
                tanvirMessage.username ||
                null,

            body: String(
                tanvirMessage.body ||
                tanvirMessage.text ||
                tanvirMessage.message ||
                ""
            ).trim(),

            timestamp:
                Number(
                    tanvirMessage.timestamp ||
                    tanvirMessage.time ||
                    tanvirMessage.createdAt
                ) || Date.now()
        }))
        .filter(
            (tanvirMessage) =>
                tanvirMessage.body
        );
}

function tanvirRobotUnique(
    tanvirMessages
) {
    const tanvirSeen = new Set();
    const tanvirResult = [];

    for (
        const tanvirMessage of
        tanvirMessages
    ) {
        const tanvirKey =
            tanvirMessage.id ||
            `${tanvirMessage.senderID || ""}|${tanvirMessage.timestamp}|${tanvirMessage.body}`;

        if (tanvirSeen.has(tanvirKey)) {
            continue;
        }

        tanvirSeen.add(tanvirKey);
        tanvirResult.push(
            tanvirMessage
        );
    }

    return tanvirResult
        .sort(
            (tanvirA, tanvirB) =>
                tanvirA.timestamp -
                tanvirB.timestamp
        )
        .slice(-tanvirRobot);
}

async function tanvir143ResolveNames(
    api,
    tanvirMessages
) {
    const tanvirIDs = [
        ...new Set(
            tanvirMessages
                .map(
                    (tanvirMessage) =>
                        tanvirMessage.senderID
                )
                .filter(Boolean)
                .map(String)
        )
    ];

    if (!tanvirIDs.length) {
        return tanvirMessages.map(
            (tanvirMessage) => ({
                ...tanvirMessage,

                senderName:
                    tanvirMessage.senderName ||
                    "একজন সদস্য"
            })
        );
    }

    if (
        typeof api.getUserInfo !==
        "function"
    ) {
        return tanvirMessages.map(
            (tanvirMessage) => ({
                ...tanvirMessage,

                senderName:
                    tanvirMessage.senderName ||
                    "একজন সদস্য"
            })
        );
    }

    try {
        const tanvirUsers =
            await new Promise(
                (
                    tanvirResolve,
                    tanvirReject
                ) => {
                    api.getUserInfo(
                        tanvirIDs,
                        (
                            tanvirError,
                            tanvirData
                        ) => {
                            if (tanvirError) {
                                return tanvirReject(
                                    tanvirError
                                );
                            }

                            tanvirResolve(
                                tanvirData || {}
                            );
                        }
                    );
                }
            );

        return tanvirMessages.map(
            (tanvirMessage) => {
                const tanvirUser =
                    tanvirUsers[
                        String(
                            tanvirMessage.senderID
                        )
                    ];

                return {
                    ...tanvirMessage,

                    senderName:
                        tanvirMessage.senderName ||
                        tanvirUser?.name ||
                        tanvirUser?.fullName ||
                        tanvirUser?.full_name ||
                        tanvirUser?.username ||
                        "একজন সদস্য"
                };
            }
        );
    } catch (_) {
        return tanvirMessages.map(
            (tanvirMessage) => ({
                ...tanvirMessage,

                senderName:
                    tanvirMessage.senderName ||
                    "একজন সদস্য"
            })
        );
    }
}

function tanvir143Format(
    tanvirMessages
) {
    return tanvirMessages
        .map(
            (
                tanvirMessage,
                tanvirIndex
            ) => {
                return (
                    `${tanvirIndex + 1}. ` +
                    `${tanvirMessage.senderName || "একজন সদস্য"}: ` +
                    `${tanvirMessage.body}`
                );
            }
        )
        .join("\n");
}

async function tanvirRobotAI(
    tanvirQuestion,
    tanvirMessages
) {
    const tanvirController =
        new AbortController();

    const tanvirTimeout =
        setTimeout(() => {
            tanvirController.abort();
        }, tanvir143igRobot);

    try {
        const tanvirPrompt = `
তুমি Tanvir143 AI।

তোমার কাজ হলো Instagram group-এর
conversation ভালোভাবে analyse করে
ব্যবহারকারীর প্রশ্নের সবচেয়ে উপযুক্ত
উত্তর দেওয়া।

USER QUESTION:
${tanvirQuestion}

GROUP CONVERSATION:
${tanvir143Format(tanvirMessages)}

নিয়ম:

1. সবসময় বাংলায় উত্তর দেবে।
2. Group-এর messages ভালোভাবে analyse করবে।
3. User যে প্রশ্ন করেছে তার সরাসরি উত্তর দেবে।
4. শুধু দেওয়া messages-এর তথ্য ব্যবহার করবে।
5. কোনো message, ঘটনা বা তথ্য বানিয়ে বলবে না।
6. কোনো UID, sender ID, thread ID বা technical ID দেখাবে না।
7. Sender-এর নাম থাকলে নাম ব্যবহার করবে।
8. নাম না পাওয়া গেলে "একজন সদস্য" বলবে।
9. "কে কী বলেছে" জিজ্ঞেস করলে আসল কথাগুলো উল্লেখ করবে।
10. নির্দিষ্ট কারো কথা জিজ্ঞেস করলে তার messages খুঁজে উত্তর দেবে।
11. "কে কার সাথে ঝগড়া করেছে" জিজ্ঞেস করলে
    conversation-এর evidence দেখে বলবে।
12. "group e ki hoise", "এতক্ষণ কী হয়েছে",
    "কি কি হয়েছে" জিজ্ঞেস করলে গুরুত্বপূর্ণ
    ঘটনাগুলো ধারাবাহিকভাবে বলবে।
13. সাধারণ যেকোনো প্রশ্ন করলে group conversation-এর
    context অনুযায়ী উত্তর দেওয়ার চেষ্টা করবে।
14. তথ্য conversation-এ না থাকলে সেটা পরিষ্কারভাবে বলবে।
15. কোনো কিছু অনুমান করবে না।
16. অপ্রয়োজনীয় technical explanation দেবে না।
17. উত্তর natural Bangla হবে।

শুধু final answer দাও।
`;

        const tanvirURL =
            `${tanvir143}/kilwa-claude?text=${encodeURIComponent(
                tanvirPrompt
            )}`;

        const tanvirResponse =
            await fetch(
                tanvirURL,
                {
                    signal:
                        tanvirController.signal
                }
            );

        if (!tanvirResponse.ok) {
            throw new Error(
                `HTTP ${tanvirResponse.status}`
            );
        }

        const tanvirData =
            await tanvirResponse.json();

        if (
            tanvirData &&
            tanvirData.status ===
                "success" &&
            typeof tanvirData.reply ===
                "string"
        ) {
            return tanvirData.reply.trim();
        }

        return (
            "Group messages analyse করে " +
            "উত্তর পাওয়া যায়নি।"
        );
    } finally {
        clearTimeout(tanvirTimeout);
    }
}

module.exports = {
    config: {
        name: "GroupScan",

        aliases: [
            "gcScan",
            "ai",
            "detective",
            "police"
        ],
        author: "Tanvir143",
        category: "Users Cmd",
        cooldown: 2,
        role: 0,
        helpText: "group message analysisa",
        description: {
            en:
                "Analyze group conversation with Tanvir143 AI"
        },

        usage: {
            en:
                "{p}tanvir143 <question>"
        }
    },

    async onStart({
        message,
        args,
        event,
        api
    }) {
        const tanvirQuestion =
            args.join(" ").trim();

        if (!tanvirQuestion) {
            return message.reply(
                "Tanvir143 AI group conversation analyse করতে পারে।\n\n" +
                "Example:\n" +
                ".tanvir143 group e ki hoise?"
            );
        }

        /*
         * Question করার সাথে সাথেই
         * scanning message।
         */
        await message.reply(
            "🔍 Scanning Group Messages..."
        );

        const tanvirStarted =
            Date.now();

        try {
            /*
             * সর্বোচ্চ ৫০টা পুরোনো message।
             */
            let tanvirMessages =
                await tanvir143bot(
                    api,
                    event.threadID
                );

            tanvirMessages =
                tanvir143Clean(
                    tanvirMessages
                );

            tanvirMessages =
                tanvirRobotUnique(
                    tanvirMessages
                );

            /*
             * Sender ID → Name
             */
            tanvirMessages =
                await tanvir143ResolveNames(
                    api,
                    tanvirMessages
                );

            if (
                !tanvirMessages.length
            ) {
                return message.reply(
                    "সাম্প্রতিক group messages পাওয়া যায়নি, তাই প্রশ্নটির উত্তর দেওয়া সম্ভব হচ্ছে না।"
                );
            }

            /*
             * সর্বোচ্চ প্রায় ১ মিনিটের
             * মধ্যে final answer দেওয়ার চেষ্টা।
             */
            const tanvirRemaining =
                tanvir143igRobot -
                (Date.now() -
                    tanvirStarted);

            if (
                tanvirRemaining <= 3000
            ) {
                return message.reply(
                    "সাম্প্রতিক messages থেকে নিশ্চিতভাবে উত্তর দেওয়া সম্ভব হচ্ছে না।"
                );
            }

            const tanvirAnswer =
                await tanvirRobotAI(
                    tanvirQuestion,
                    tanvirMessages
                );

            return message.reply(
                tanvirAnswer ||
                "Group messages analyse করে উত্তর পাওয়া যায়নি।"
            );

        } catch (tanvirError) {
            return message.reply(
                "দুঃখিত, group messages analyse করতে সমস্যা হয়েছে।"
            );
        }
    }
};
