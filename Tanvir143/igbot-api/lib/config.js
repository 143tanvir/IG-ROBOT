/**
 * File Name: config.js
 * ICA: igbot-api
 * Auhor: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

/*
 * @lazyneoaz/ig-chat-api
 * Author: Saifullah Al Neoaz
 * GitHub: https://github.com/lazyneoaz
 */
"use strict";

/**
 * Client configuration.
 *
 * This package is a remote-server client, not a local Instagram engine.
 * Never silently send account cookies to a bundled third-party endpoint. A
 * server URL and API key must be explicitly supplied by the operator.
 */
const DEFAULT_SERVER_URL = process.env.CHAT_API_URL || "";
const DEFAULT_API_KEY = process.env.CHAT_API_KEY || "";

function resolve(options) {
        options = options || {};
        const serverUrl = (options.serverUrl || options.url || process.env.CHAT_API_URL || DEFAULT_SERVER_URL).replace(/\/+$/, "");
        const apiKey = options.apiKey || options.key || process.env.CHAT_API_KEY || DEFAULT_API_KEY;

        if (!serverUrl) {
                throw new Error("No ICA server URL configured. igbot-api is remote-server-only; it cannot run local-only without a local engine implementation.");
        }
        let parsed;
        try { parsed = new URL(serverUrl); }
        catch (_) { throw new Error("Invalid ICA server URL. Set CHAT_API_URL to a valid http(s) URL."); }
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
                throw new Error("Invalid ICA server URL protocol. Use http or https.");
        }
        if (!apiKey) {
                throw new Error("No ICA API key configured. Set CHAT_API_KEY for a server you trust.");
        }

        return {
                serverUrl,
                apiKey,
                timeoutMs: Number(options.timeoutMs || process.env.CHAT_API_TIMEOUT_MS || 30000),
                maxRetries: Number(options.maxRetries || 2),
                engineOptions: options.engineOptions || {}
        };
}

module.exports = { resolve, DEFAULT_SERVER_URL, DEFAULT_API_KEY };
