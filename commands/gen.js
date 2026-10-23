/**
 * File Name: genx.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

const AUTHOR = "Tanvir143";
const NKX_BASE_URL = "https://nkx-gen.neokex.xyz";
const NKX_API_KEY = "nkxgen";
const TEMP_DIR = path.join(os.tmpdir(), "igbot-genx");

const RATIOS = [
	"1:1", "16:9", "9:16", "4:3", "3:4",
	"3:2", "2:3", "21:9", "4:5", "5:4"
];

const nkxClient = axios.create({
	baseURL: NKX_BASE_URL,
	timeout: 300000,
	validateStatus: () => true,
	headers: {
		"X-API-Key": NKX_API_KEY
	}
});

const GEN_MODELS = [
	{ name: "🧠 NKX Qwen Image", model: "qwen-image" },
	{ name: "🍌 NKX Nano Banana 2", model: "nano-banana-2" },
	{ name: "🖼️ NKX GPT Image 2 Low", model: "gpt-image-2-low" },
	{ name: "⚡ NKX Flux 2 Dev", model: "flux-2-dev" },
	{ name: "⚡ NKX Flux 2 Flex", model: "flux-2-flex" },
	{ name: "⚡ NKX Flux 2 Pro", model: "flux-2-pro" },
	{ name: "🎨 NKX Flux Krea", model: "flux-krea" },
	{ name: "🪄 NKX Ideogram V3 Turbo", model: "ideogram-v3-turbo" },
	{ name: "🎬 NKX SeedDream 4", model: "seedream-4" },
	{ name: "🎬 NKX SeedDream 4.5", model: "seedream-4-5" },
	{ name: "🎬 NKX SeedDream 5", model: "seedream-5" },
	{ name: "🧠 NKX Qwen Image 2", model: "qwen-image-2" },
	{ name: "🧠 NKX Qwen Image 2 Pro", model: "qwen-image-2-pro" },
	{ name: "✨ NKX Gemini 2.5 Flash Image", model: "gemini-2-5-flash-image" },
	{ name: "🌟 NKX GPT 2.5 Flare Low", model: "gpt-image-2-5-flare-low" },
	{ name: "☀️ NKX GPT 2.5 Sunburst Low", model: "gpt-image-2-5-sunburst-low" }
];

const EDIT_MODELS = [
	{ name: "🍌 NKX Nano Banana 2 Edit", model: "nano-banana-2-edit" },
	{ name: "🖼️ NKX GPT Image 2 Edit", model: "gpt-image-2-edit" },
	{ name: "⚡ NKX Flux 2 Dev Edit", model: "flux-2-dev-edit" },
	{ name: "⚡ NKX Flux 2 Pro Edit", model: "flux-2-pro-edit" },
	{ name: "🎨 NKX Flux Krea Edit", model: "flux-krea-edit" },
	{ name: "🪄 NKX Flux Kontext Dev", model: "flux-kontext-dev" },
	{ name: "🎬 NKX SeedDream 4 Edit", model: "seedream-4-edit" },
	{ name: "🎬 NKX SeedDream 4.5 Edit", model: "seedream-4-5-edit" },
	{ name: "🎬 NKX SeedDream 5 Edit", model: "seedream-5-edit" },
	{ name: "✨ NKX Gemini 2.5 Flash Edit", model: "gemini-2-5-flash-image-edit" },
	{ name: "🌟 NKX GPT 2.5 Flare Edit", model: "gpt-image-2-5-flare-low-edit" },
	{ name: "☀️ NKX GPT 2.5 Sunburst Edit", model: "gpt-image-2-5-sunburst-low-edit" }
];

function formatNKXError(response) {
	const data = response && response.data;

	if (data && typeof data === "object") {
		if (
			data.detail &&
			typeof data.detail === "object" &&
			!Array.isArray(data.detail)
		) {
			return data.detail.error ||
				data.error ||
				"Insufficient balance to run this generation.";
		}

		if (typeof data.detail === "string") {
			return data.detail;
		}

		if (Array.isArray(data.detail)) {
			return data.detail.map(item => item.msg || item).join("; ");
		}

		if (data.error) return data.error;
		if (data.hint) return data.hint;
		if (data.message) return data.message;
	}

	if (response.status === 401) {
		return "The NKX API rejected its key.";
	}

	if (response.status === 402) {
		return "Not enough API credits.";
	}

	if (response.status === 504) {
		return "The generation job timed out.";
	}

	if (response.status === 502 || response.status === 503) {
		return "The generation server is temporarily unavailable.";
	}

	return `Request failed (HTTP ${response.status}).`;
}

async function runNKXJob(payload) {
	let response = await nkxClient.post("/api/generate", payload);

	if (
		(response.status === 400 || response.status === 422) &&
		!payload.ratio &&
		/ratio/i.test(JSON.stringify(response.data || ""))
	) {
		response = await nkxClient.post("/api/generate", {
			...payload,
			ratio: "1:1"
		});
	}

	if (response.status < 200 || response.status >= 300) {
		throw new Error(formatNKXError(response));
	}

	const data = response.data || {};
	const url = data.url || data.thumbnail;

	if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
		throw new Error("NKX returned no valid image URL.");
	}

	return url;
}

async function downloadToTemp(url, prefix = "genx") {
	const response = await axios.get(url, {
		responseType: "arraybuffer",
		timeout: 120000,
		validateStatus: () => true
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Image download failed (HTTP ${response.status}).`);
	}

	const contentType = String(
		response.headers["content-type"] || ""
	).toLowerCase();

	if (!contentType.startsWith("image/")) {
		throw new Error("The download URL did not return an image.");
	}

	const ext = contentType.includes("png")
		? ".png"
		: contentType.includes("webp")
			? ".webp"
			: contentType.includes("jpeg")
				? ".jpg"
				: ".jpg";

	await fs.ensureDir(TEMP_DIR);

	const file = path.join(
		TEMP_DIR,
		`${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`
	);

	await fs.writeFile(file, Buffer.from(response.data));

	return file;
}

function parseArgs(args) {
	const result = {
		ratio: null,
		images: [],
		words: []
	};

	for (let i = 0; i < args.length; i++) {
		const value = String(args[i]);
		const lower = value.toLowerCase();

		if (lower === "--ar") {
			if (args[i + 1]) {
				result.ratio = String(args[++i]);
			}
		} else if (["--img", "--image", "--url"].includes(lower)) {
			if (args[i + 1]) {
				result.images.push(String(args[++i]));
			}
		} else {
			result.words.push(value);
		}
	}

	result.prompt = result.words.join(" ").trim();

	return result;
}

function photosOf(attachments) {
	if (!Array.isArray(attachments)) return [];

	return attachments
		.filter(item => item && (
			item.type === "photo" ||
			item.type === "sticker" ||
			item.type === "image"
		))
		.map(item =>
			item.url ||
			item.largePreviewUrl ||
			item.previewUrl
		)
		.filter(Boolean);
}

function getThreadID(event) {
	return event.threadID || event.threadId;
}

function getReply(event) {
	return event.messageReply ||
		event.replyMessage ||
		event.repliedMessage ||
		null;
}

function getImages(event) {
	const currentAttachments = Array.isArray(event.attachments)
		? event.attachments
		: [];

	const reply = getReply(event);
	const replyAttachments = Array.isArray(reply?.attachments)
		? reply.attachments
		: [];

	return [...new Set([
		...photosOf(currentAttachments),
		...photosOf(replyAttachments)
	])];
}

async function generateNKX(model, prompt, ratio) {
	const payload = {
		prompt,
		model: model.model,
		resolution: "2k",
		wait: true
	};

	if (ratio) {
		payload.ratio = ratio;
	}

	const url = await runNKXJob(payload);

	return downloadToTemp(url, "genx");
}

async function editNKX(model, prompt, imageURL, ratio) {
	const payload = {
		prompt,
		model: model.model,
		image_urls: [imageURL],
		resolution: "2k",
		wait: true
	};

	if (ratio) {
		payload.ratio = ratio;
	}

	const url = await runNKXJob(payload);

	return downloadToTemp(url, "genx-edit");
}

function helpText() {
	let text = `🖼️ ${AUTHOR} | NKX GEN\n\n`;
	text += "🎨 GENERATE MODELS\n";

	GEN_MODELS.forEach((model, index) => {
		text += `${index + 1}. ${model.name}\n`;
	});

	text += "\n🪄 EDIT MODELS\n";

	EDIT_MODELS.forEach((model, index) => {
		text += `${index + 1}. ${model.name}\n`;
	});

	text += "\n📝 USAGE\n";
	text += ".gen +1 a cute cat\n";
	text += ".gen +4 a futuristic city --ar 16:9\n";
	text += ".gen +edit1 make this photo cinematic\n";
	text += ".gen +edit2 add sunglasses\n";
	text += "\n📐 RATIOS: " + RATIOS.join(", ");
	text += "\n📷 For Edit, reply to a photo with the command.";

	return text;
}

module.exports = {
	config: {
		name: "gen",
		aliases: ["genx", "imagegen"],
		version: "3.4.0",
		author: "Tanvir Ahmed (Tanvir143)",
		cooldown: 6,
		role: 0,
		description: "Generate and edit images using NKX models.",
		category: "image",
		guide: ".gen help | .gen +1 prompt | .gen +edit1 prompt"
	},

	onStart: async function ({ api, event, args }) {
		const threadID = getThreadID(event);

		if (!threadID) return;

		const input = (Array.isArray(args) ? args : []).join(" ").trim();

		if (!input || input.toLowerCase() === "help") {
			return api.sendMessage(helpText(), threadID);
		}

		const editMatch = input.match(/^\+edit(\d+)(?:\s+|$)/i);
		const genMatch = input.match(/^\+(\d+)(?:\s+|$)/);

		if (!editMatch && !genMatch) {
			return api.sendMessage(
				"❌ Invalid command. Use .gen help",
				threadID
			);
		}

		const isEdit = Boolean(editMatch);
		const number = Number(isEdit ? editMatch[1] : genMatch[1]);
		const modelList = isEdit ? EDIT_MODELS : GEN_MODELS;
		const model = modelList[number - 1];

		if (!model) {
			return api.sendMessage(
				`❌ Invalid model number. Choose 1-${modelList.length}.`,
				threadID
			);
		}

		const rest = input.replace(
			isEdit ? /^\+edit\d+\s*/i : /^\+\d+\s*/,
			""
		);

		const parsed = parseArgs(rest.split(/\s+/));
		const prompt = parsed.prompt;

		if (!prompt) {
			return api.sendMessage(
				"❌ Please enter a prompt.",
				threadID
			);
		}

		if (parsed.ratio && !RATIOS.includes(parsed.ratio)) {
			return api.sendMessage(
				`❌ Invalid ratio.\nAvailable: ${RATIOS.join(", ")}`,
				threadID
			);
		}

		let filePath = null;

		try {
			if (isEdit) {
				const images = [
					...getImages(event),
					...parsed.images
				].filter(url =>
					typeof url === "string" &&
					/^https?:\/\//i.test(url)
				);

				const imageURL = images[0];

				if (!imageURL) {
					return api.sendMessage(
						"❌ Reply to a photo or provide one using --img IMAGE_URL.",
						threadID
					);
				}

				await api.sendMessage(
					`⏳ ${AUTHOR}: Editing with ${model.name}...`,
					threadID
				);

				filePath = await editNKX(
					model,
					prompt,
					imageURL,
					parsed.ratio
				);
			} else {
				await api.sendMessage(
					`⏳ ${AUTHOR}: Generating with ${model.name}...`,
					threadID
				);

				filePath = await generateNKX(
					model,
					prompt,
					parsed.ratio
				);
			}

			await api.sendMessage({
				body: `✅ ${AUTHOR} | ${model.name}`,
				attachment: fs.createReadStream(filePath)
			}, threadID);
		} catch (error) {
			console.error(
				`[${AUTHOR} NKX GEN ERROR]`,
				error.stack || error.message
			);

			try {
				await api.sendMessage(
					`❌ ${isEdit ? "Image editing" : "Image generation"} failed.\n${error.message || "Unknown NKX API error."}`,
					threadID
				);
			} catch (_) {}
		} finally {
			if (filePath) {
				setTimeout(() => {
					fs.remove(filePath).catch(() => {});
				}, 30000);
			}
		}
	}
};
