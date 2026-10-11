/**
 * File Name: tanvir143Memory.js
 * ICA: igbot-api
 * Auhor: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

/**
 * Tanvir143 AI - Realtime Group Memory
 *
 * Maintained, Modified and Fixed:
 * Tanvir Ahmed (Tanvir143)
 *
 * WhatsApp: +8801750079773
 * GitHub: www.github.com/143tanvir
 *
 * Realtime memory:
 * - Maximum 50 messages per group
 * - RAM only
 * - Bot restart হলে memory reset
 */

const MAX_MESSAGES = 50;

const memory = new Map();

function getThreadMemory(threadID) {
    if (!memory.has(threadID)) {
        memory.set(threadID, []);
    }

    return memory.get(threadID);
}

function saveMessage(event) {
    if (!event || !event.threadID) return;

    if (
        event.type !== "message" &&
        event.type !== "message_reply"
    ) {
        return;
    }

    const body = String(event.body || "").trim();

    if (!body) return;

    const list = getThreadMemory(event.threadID);

    const item = {
        messageID: event.messageID || null,
        senderID: event.senderID || event.userID || null,
        senderName: event.senderName || null,
        body,
        timestamp:
            Number(event.timestamp) || Date.now()
    };

    if (
        item.messageID &&
        list.some(
            msg => msg.messageID === item.messageID
        )
    ) {
        return;
    }

    list.push(item);

    if (list.length > MAX_MESSAGES) {
        list.splice(
            0,
            list.length - MAX_MESSAGES
        );
    }
}

module.exports = {
    config: {
        name: "tanvir143Memory",
        eventType: [
            "message",
            "message_reply"
        ],
        author: "Tanvir143",
        category: "system"
    },

    onEvent({ event }) {
        saveMessage(event);
    },

    getMessages(threadID, limit = MAX_MESSAGES) {
        const list =
            memory.get(threadID) || [];

        return list
            .slice(-Math.min(limit, MAX_MESSAGES))
            .map(item => ({ ...item }));
    },

    clear(threadID) {
        if (threadID) {
            memory.delete(threadID);
        } else {
            memory.clear();
        }
    },

    _memory: memory
};
