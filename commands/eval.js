
/**
 * File Name: eval.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * Bot: IG-ROBOT
 */

"use strict";

const { removeHomeDir, log } = global.utils;

module.exports = {
	config: {
		name: "eval",
		version: "1.0.0",
		author: "Tanvir143",
		cooldown: 5,
		role: 2,
		description: "Execute JavaScript code for testing",
		category: "admin cmds",
		guide: "{pn} <code to test>"
	},

	onStart: async function ({ args, message }) {
		if (!args || args.length === 0) {
			return message.reply(
				"⚠️ Usage: .eval <JavaScript code>"
			);
		}

		function mapToObj(map) {
			const obj = {};
			map.forEach((value, key) => {
				obj[key] = value;
			});
			return obj;
		}

		function output(value) {
			let result;

			if (typeof value === "undefined") {
				result = "undefined";
			}
			else if (typeof value === "function") {
				result = value.toString();
			}
			else if (typeof value === "bigint") {
				result = value.toString() + "n";
			}
			else if (value instanceof Map) {
				result = `Map(${value.size})\n` +
					JSON.stringify(mapToObj(value), null, 2);
			}
			else if (typeof value === "string") {
				result = value;
			}
			else if (typeof value === "symbol") {
				result = value.toString();
			}
			else {
				try {
					result = JSON.stringify(value, null, 2);
				}
				catch {
					result = String(value);
				}

				if (typeof result === "undefined") {
					result = String(value);
				}
			}

			return message.reply(String(result));
		}

		const code = args.join(" ");

		try {
			const AsyncFunction = Object.getPrototypeOf(
				async function () {}
			).constructor;

			const execute = new AsyncFunction(
				"global",
				"message",
				"output",
				"out",
				"log",
				"removeHomeDir",
				`
				"use strict";
				return await (async () => {
					${code}
				})();
				`
			);

			const result = await execute(
				global,
				message,
				output,
				output,
				log,
				removeHomeDir
			);

			if (typeof result !== "undefined") {
				await output(result);
			}
		}
		catch (err) {
			log.err("Tanvir143 | IG-ROBOT | eval", err);

			const errorText = err?.stack
				? removeHomeDir(err.stack)
				: String(err);

			await message.reply(
				"❌ Eval Error:\n" + errorText
			);
		}
	}
};
