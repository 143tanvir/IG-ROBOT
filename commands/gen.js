
/**
 * File Name: gen.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 */

"use strict";

const tanvir143Axios = require("axios");
const tanvirrRobotFs = require("fs-extra");
const tanvir143Path = require("path");
const tanvir143Nkx = require("../src/nkxClient");

const tanvir143ConfigUrl =
	"https://raw.githubusercontent.com/goatbotnx/xalmanx210/refs/heads/main/apis.json";
const tanvir143ApiKey = "xalman-hub";
const tanvir143HistoryTTL = 30 * 60 * 1000;
const tanvir143MaxHistory = 20;

const tanvir143GenerateModels = [
	{ name: "Flux 2 Max", path: "/api/flux2max", hub: true, image: true },
	{ name: "GPT Image 2", path: "/api/gptimage2", hub: true, image: true },
	{ name: "GPT 2.5 Flare", path: "/api/gpt2.5-flare", hub: true, image: true },
	{ name: "GPT 2.5 Flare V2", path: "/api/gpt2.5-flare-v2", hub: true, image: true },
	{ name: "GPT 2.5 Sunburst", path: "/api/gpt2.5-sunburst", hub: true, image: true },
	{ name: "GPT Image 2.5 Sunburst V2", path: "/api/gptimage2.5-sunburst-v2", hub: true, image: true },
	{ name: "Grok", path: "/api/grok", hub: true, image: true },
	{ name: "Nano Banana", path: "/api/nb", hub: true, image: true },
	{ name: "Nano Banana 2", path: "/api/nanobanana2", hub: true, image: true },
	{ name: "Qwen Image 2", path: "/api/qwenimage2", hub: true, image: true },
	{ name: "Qwen Image", model: "qwen-image", image: false },
	{ name: "SeedDream 4", path: "/api/seedream4", hub: true, image: true },
	{ name: "Nano Banana 2", model: "nano-banana-2" },
	{ name: "GPT Image 2", model: "gpt-image-2-low" },
	{ name: "Flux 2 Dev", model: "flux-2-dev" },
	{ name: "Flux 2 Flex", model: "flux-2-flex" },
	{ name: "Flux 2 Pro", model: "flux-2-pro" },
	{ name: "Flux Krea", model: "flux-krea" },
	{ name: "Ideogram V3 Turbo", model: "ideogram-v3-turbo" },
	{ name: "SeedDream 4", model: "seedream-4" },
	{ name: "SeedDream 4.5", model: "seedream-4-5" },
	{ name: "SeedDream 5", model: "seedream-5" },
	{ name: "Qwen Image 2", model: "qwen-image-2" },
	{ name: "Qwen Image 2 Pro", model: "qwen-image-2-pro" },
	{ name: "Gemini 2.5 Flash Image", model: "gemini-2-5-flash-image" },
	{ name: "GPT 2.5 Flare", model: "gpt-image-2-5-flare-low" },
	{ name: "GPT 2.5 Sunburst", model: "gpt-image-2-5-sunburst-low" }
];

const tanvir143EditModels = [
	{ name: "Classic Edit", hub: true, maxImages: 1 },
	{ name: "Nano Banana 2 Edit", model: "nano-banana-2-edit", maxImages: 2 },
	{ name: "GPT Image 2 Edit", model: "gpt-image-2-edit", maxImages: 2 },
	{ name: "Flux 2 Dev Edit", model: "flux-2-dev-edit", maxImages: 2 },
	{ name: "Flux 2 Pro Edit", model: "flux-2-pro-edit", maxImages: 2 },
	{ name: "Flux Krea Edit", model: "flux-krea-edit", maxImages: 2 },
	{ name: "Flux Kontext Dev", model: "flux-kontext-dev", maxImages: 2 },
	{ name: "SeedDream 4 Edit", model: "seedream-4-edit", maxImages: 2 },
	{ name: "SeedDream 4.5 Edit", model: "seedream-4-5-edit", maxImages: 2 },
	{ name: "SeedDream 5 Edit", model: "seedream-5-edit", maxImages: 2 },
	{ name: "Gemini 2.5 Flash Edit", model: "gemini-2-5-flash-image-edit", maxImages: 2 },
	{ name: "GPT 2.5 Flare Edit", model: "gpt-image-2-5-flare-low-edit", maxImages: 2 },
	{ name: "GPT 2.5 Sunburst Edit", model: "gpt-image-2-5-sunburst-low-edit", maxImages: 2 }
];

const tanvir143ImageHistory = new Map();

function tanvir143Send(api, message, threadID, callback) {
	return api.sendMessage(message, threadID, callback);
}

function tanvir143GetThreadHistory(threadID) {
	const now = Date.now();
	let history = tanvir143ImageHistory.get(String(threadID)) || [];

	history = history.filter(item => now - item.time < tanvir143HistoryTTL);
	tanvir143ImageHistory.set(String(threadID), history);

	return history;
}

function tanvir143RememberImages(event) {
	if (!event || !event.threadID) return;

	const photos = tanvir143Nkx.photosOf(event.attachments || []);
	if (!Array.isArray(photos) || !photos.length) return;

	const threadID = String(event.threadID);
	const history = tanvir143GetThreadHistory(threadID);

	for (const photo of photos) {
		const url = typeof photo === "string"
			? photo
			: photo && (photo.url || photo.src || photo.uri);

		if (!url || !/^https?:\/\//i.test(String(url))) continue;

		if (history.some(item => item.url === String(url))) continue;

		history.push({
			url: String(url),
			time: Date.now(),
			messageID: event.messageID || null
		});
	}

	while (history.length > tanvir143MaxHistory) history.shift();

	tanvir143ImageHistory.set(threadID, history);
}

function tanvir143GetReplyImages(event) {
	const result = [];
	const reply = event && (
		event.messageReply ||
		event.replyMessage ||
		event.repliedMessage
	);

	if (!reply) return result;

	const photos = tanvir143Nkx.photosOf(reply.attachments || []);
	for (const photo of photos || []) {
		const url = typeof photo === "string"
			? photo
			: photo && (photo.url || photo.src || photo.uri);

		if (url && /^https?:\/\//i.test(String(url))) {
			result.push(String(url));
		}
	}

	return result;
}

function tanvir143UniqueImages(images) {
	const result = [];

	for (const image of images) {
		if (!image || !/^https?:\/\//i.test(String(image))) continue;
		if (!result.includes(String(image))) result.push(String(image));
	}

	return result;
}

function tanvir143Help() {
	const generate = tanvir143GenerateModels
		.map((model, index) => `${index + 1}. ${model.name}`)
		.join("\n");

	const edit = tanvir143EditModels
		.map((model, index) => `${index + 1}. ${model.name}${model.maxImages === 1 ? " (1 image)" : " (up to 2 images)"}`)
		.join("\n");

	return (
		"🎨 TANVIR143 GENX HELP\n\n" +
		"━━ IMAGE GENERATION (27) ━━\n" +
		generate +
		"\n\n━━ IMAGE EDITING (13) ━━\n" +
		edit +
		"\n\n━━ EXAMPLES ━━\n" +
		".genx +1 a cute cat\n" +
		".genx +8 a realistic sunset\n" +
		"Reply to a photo: .genx +edit1 add sunglasses\n" +
		"Reply to a photo: .genx +edit2+2 combine both people\n\n" +
		"Generation: +1 to +27\n" +
		"Editing: +edit1 to +edit13\n" +
		"Two-image editing requires an edit model that supports 2 images.\n\n" +
		"Note: Image history is temporary and is cleared when the bot restarts."
	);
}

async function tanvir143GetHubBase() {
	const response = await tanvir143Axios.get(tanvir143ConfigUrl, {
		timeout: 15000
	});

	const data = response.data;
	const base = data && (
		data[tanvir143ApiKey] ||
		data.api ||
		data.baseURL ||
		data.baseUrl ||
		data.url
	);

	if (!base || typeof base !== "string") {
		throw new Error("API base URL পাওয়া যায়নি। apis.json configuration check করো।");
	}

	return base.replace(/\/+$/, "");
}

function tanvir143GetImageUrl(data) {
	if (typeof data === "string" && /^https?:\/\//i.test(data)) return data;

	if (!data || typeof data !== "object") return null;

	const candidates = [
		data.url,
		data.image,
		data.imageUrl,
		data.result,
		data.output,
		data.download,
		data.data && data.data.url,
		data.data && data.data.image,
		data.data && data.data.imageUrl,
		data.result && data.result.url,
		data.result && data.result.image
	];

	return candidates.find(value =>
		typeof value === "string" && /^https?:\/\//i.test(value)
	) || null;
}

async function tanvir143SaveHubImage(response, prefix) {
	const contentType = String(response.headers && response.headers["content-type"] || "").toLowerCase();

	if (contentType.includes("image/") || Buffer.isBuffer(response.data)) {
		const buffer = Buffer.isBuffer(response.data)
			? response.data
			: Buffer.from(response.data);

		if (buffer.length > 0 && (contentType.includes("image/") || buffer[0] === 0x89 || buffer[0] === 0xFF)) {
			const filePath = tanvir143Path.join(
				require("os").tmpdir(),
				`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
			);

			await tanvirrRobotFs.writeFile(filePath, buffer);
			return filePath;
		}
	}

	let data = response.data;

	if (Buffer.isBuffer(data)) {
		try {
			data = JSON.parse(data.toString("utf8"));
		} catch (_) {
			throw new Error("API response image বা valid JSON নয়।");
		}
	}

	const imageUrl = tanvir143GetImageUrl(data);

	if (!imageUrl) {
		const detail = data && (data.message || data.error || data.msg);
		throw new Error(detail || "API response থেকে image URL পাওয়া যায়নি।");
	}

	const imageResponse = await tanvir143Axios.get(imageUrl, {
		responseType: "arraybuffer",
		timeout: 120000
	});

	const filePath = tanvir143Path.join(
		require("os").tmpdir(),
		`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
	);

	await tanvirrRobotFs.writeFile(filePath, Buffer.from(imageResponse.data));
	return filePath;
}

function tanvir143ParseCommand(args) {
	const raw = Array.isArray(args) ? args.join(" ") : String(args || "");

	const editMatch = raw.match(/^\+edit(\d+)(\+2)?(?:\s+|$)/i);
	if (editMatch) {
		return {
			type: "edit",
			id: Number(editMatch[1]),
			twoImages: Boolean(editMatch[2]),
			prompt: raw.slice(editMatch[0].length).trim()
		};
	}

	const generationMatch = raw.match(/^\+(\d+)(?:\s+|$)/);
	if (generationMatch) {
		return {
			type: "generate",
			id: Number(generationMatch[1]),
			twoImages: false,
			prompt: raw.slice(generationMatch[0].length).trim()
		};
	}

	return null;
}

async function tanvir143GenerateImage(model, prompt, ratio, referenceImage) {
	if (model.hub) {
		const baseURL = await tanvir143GetHubBase();
		const params = { prompt };

		if (ratio) params.ratio = ratio;
		if (referenceImage && model.image) params.image = referenceImage;

		const response = await tanvir143Axios.get(baseURL + model.path, {
			params,
			responseType: "arraybuffer",
			timeout: 180000,
			validateStatus: status => status >= 200 && status < 300
		});

		return tanvir143SaveHubImage(response, "genx");
	}

	const result = await tanvir143Nkx.runJob({
		prompt,
		model: model.model,
		ratio: ratio || undefined,
		resolution: "2k",
		wait: true,
		image_urls: referenceImage ? [referenceImage] : undefined
	});

	const imageURL = typeof result === "string"
		? result
		: tanvir143GetImageUrl(result);

	if (!imageURL) {
		throw new Error("NKX generation result থেকে image URL পাওয়া যায়নি।");
	}

	return tanvir143Nkx.downloadToTemp(imageURL, "genx");
}

async function tanvir143EditImage(model, prompt, images, ratio) {
	if (model.hub) {
		if (!images.length) throw new Error("Classic Edit-এর জন্য একটি ছবি প্রয়োজন।");

		const baseURL = await tanvir143GetHubBase();
		const response = await tanvir143Axios.get(baseURL + "/api/edit", {
			params: {
				img: images[0],
				prompt
			},
			responseType: "arraybuffer",
			timeout: 180000,
			validateStatus: status => status >= 200 && status < 300
		});

		return tanvir143SaveHubImage(response, "edited");
	}

	const result = await tanvir143Nkx.runJob({
		prompt,
		model: model.model,
		image_urls: images,
		resolution: "2k",
		ratio: ratio || undefined,
		wait: true
	});

	const imageURL = typeof result === "string"
		? result
		: tanvir143GetImageUrl(result);

	if (!imageURL) {
		throw new Error("NKX edit result থেকে image URL পাওয়া যায়নি।");
	}

	return tanvir143Nkx.downloadToTemp(imageURL, "edited");
}

module.exports = {
	config: {
		name: "gen",
		aliases: ["genx", "imgen", "imgedit"],
		version: "1.0.0",
		author: "Tanvir Ahmed (Tanvir143)",
		cooldown: 10,
		role: 0,
		shortDescription: "Generate and edit images",
		longDescription: "27 image generation models and 13 image editing models.",
		category: "Users Cmd",
		guide: {
			en: "{pn} help\n{pn} +1 a cute cat\n{pn} +edit1 add sunglasses (reply to a photo)\n{pn} +edit2+2 combine two photos"
		}
	},

	/*
	 * This hook remembers images only if the command loader calls onChat
	 * for ordinary incoming messages. If your loader does not call it,
	 * image history must be recorded by the event dispatcher.
	 */
	onChat: async function ({ event }) {
		try {
			tanvir143RememberImages(event);
		} catch (error) {
			console.error("[Tanvir143 genx history]", error.message);
		}
	},

	onStart: async function ({ api, event, args, message }) {
		const tanvir143ThreadID = event.threadID;
		const tanvir143Text = Array.isArray(args) ? args.join(" ").trim() : "";

		if (!tanvir143Text || /^help$/i.test(tanvir143Text)) {
			return tanvir143Send(api, tanvir143Help(), tanvir143ThreadID);
		}

		const tanvir143Parsed = tanvir143ParseCommand(args);

		if (!tanvir143Parsed) {
			return tanvir143Send(
				api,
				"❌ সঠিক syntax ব্যবহার করো:\n" +
				".genx +1 a cute cat\n" +
				".genx +edit1 add sunglasses\n" +
				".genx +edit2+2 combine two photos\n" +
				".genx help",
				tanvir143ThreadID
			);
		}

		if (!tanvir143Parsed.prompt) {
			return tanvir143Send(api, "❌ Image prompt লিখো।", tanvir143ThreadID);
		}

		const tanvir143RatioMatch = tanvir143Parsed.prompt.match(/(?:^|\s)--ratio\s+([0-9:]+)/i);
		const tanvir143Ratio = tanvir143RatioMatch ? tanvir143RatioMatch[1] : undefined;
		const tanvir143Prompt = tanvir143Parsed.prompt
			.replace(/(?:^|\s)--ratio\s+[0-9:]+/ig, " ")
			.replace(/\s+/g, " ")
			.trim();

		if (!tanvir143Prompt) {
			return tanvir143Send(api, "❌ Image prompt লিখো।", tanvir143ThreadID);
		}

		let tanvir143FilePath = null;

		try {
			if (tanvir143Parsed.type === "generate") {
				const model = tanvir143GenerateModels[tanvir143Parsed.id - 1];

				if (!model) {
					return tanvir143Send(api, "❌ Generation model ID 1 থেকে 27 পর্যন্ত। .genx help দেখো।", tanvir143ThreadID);
				}

				const tanvir143ReplyImages = tanvir143GetReplyImages(event);
				const tanvir143History = tanvir143GetThreadHistory(tanvir143ThreadID);
				const tanvir143Reference = tanvir143ReplyImages[0] ||
					(tanvir143History.length ? tanvir143History[tanvir143History.length - 1].url : null);

				if (model.image === false && tanvir143Reference) {
					return tanvir143Send(api, `ℹ️ ${model.name} reference image support করে না।`, tanvir143ThreadID);
				}

				await tanvir143Send(api, `⏳ Tanvir143 | ${model.name} দিয়ে image তৈরি হচ্ছে...`, tanvir143ThreadID);

				tanvir143FilePath = await tanvir143GenerateImage(
					model,
					tanvir143Prompt,
					tanvir143Ratio,
					model.image ? tanvir143Reference : null
				);
			} else {
				const model = tanvir143EditModels[tanvir143Parsed.id - 1];

				if (!model) {
					return tanvir143Send(api, "❌ Edit model ID 1 থেকে 13 পর্যন্ত। .genx help দেখো।", tanvir143ThreadID);
				}

				let tanvir143Images = [];

				// Photos attached to the command itself.
				const tanvir143CurrentPhotos = tanvir143Nkx.photosOf(event.attachments || []);
				for (const photo of tanvir143CurrentPhotos || []) {
					const url = typeof photo === "string"
						? photo
						: photo && (photo.url || photo.src || photo.uri);
					if (url) tanvir143Images.push(String(url));
				}

				// Photos in the message being replied to.
				tanvir143Images.push(...tanvir143GetReplyImages(event));

				// Explicit image URLs, if the command uses --img URL.
				const tanvir143UrlMatches = tanvir143Parsed.prompt.match(/--img\s+(https?:\/\/\S+)/ig) || [];
				for (const item of tanvir143UrlMatches) {
					const match = item.match(/--img\s+(https?:\/\/\S+)/i);
					if (match) tanvir143Images.push(match[1]);
				}

				// If two images are requested, use the recent images from this thread.
				if (tanvir143Parsed.twoImages) {
					const tanvir143History = tanvir143GetThreadHistory(tanvir143ThreadID);
					for (let i = tanvir143History.length - 1; i >= 0; i--) {
						tanvir143Images.push(tanvir143History[i].url);
					}
				}

				tanvir143Images = tanvir143UniqueImages(tanvir143Images);

				if (!tanvir143Images.length) {
					return tanvir143Send(
						api,
						"❌ Edit করার জন্য একটি photo attach করো অথবা photo-তে reply দিয়ে command দাও।",
						tanvir143ThreadID
					);
				}

				if (tanvir143Parsed.twoImages && model.maxImages < 2) {
					return tanvir143Send(
						api,
						`❌ ${model.name} একটিমাত্র ছবি নেয়। দুটি ছবি edit করতে .genx +edit2+2 ব্যবহার করো।`,
						tanvir143ThreadID
					);
				}

				const tanvir143Needed = tanvir143Parsed.twoImages ? 2 : 1;

				if (tanvir143Images.length < tanvir143Needed) {
					return tanvir143Send(
						api,
						`❌ দুটি ছবি পাওয়া যায়নি। একই গ্রুপে আগে দুটি photo পাঠাও, তারপর দ্বিতীয় photo-তে reply দিয়ে .genx +edit2+2 prompt ব্যবহার করো।`,
						tanvir143ThreadID
					);
				}

				tanvir143Images = tanvir143Images.slice(0, Math.min(tanvir143Needed, model.maxImages));

				const tanvir143CleanPrompt = tanvir143Prompt
					.replace(/(?:^|\s)--img\s+https?:\/\/\S+/ig, " ")
					.replace(/\s+/g, " ")
					.trim();

				if (!tanvir143CleanPrompt) {
					return tanvir143Send(api, "❌ কী edit করতে হবে prompt-এ লিখো।", tanvir143ThreadID);
				}

				await tanvir143Send(
					api,
					`⏳ Tanvir143 | ${model.name} দিয়ে ${tanvir143Images.length}টি ছবি edit হচ্ছে...`,
					tanvir143ThreadID
				);

				tanvir143FilePath = await tanvir143EditImage(
					model,
					tanvir143CleanPrompt,
					tanvir143Images,
					tanvir143Ratio
				);
			}

			if (!tanvir143FilePath || !(await tanvirrRobotFs.pathExists(tanvir143FilePath))) {
				throw new Error("Generated image file পাওয়া যায়নি।");
			}

			await tanvir143Send(
				api,
				{
					body: "✅ Tanvir143 | Image ready.",
					attachment: tanvirrRobotFs.createReadStream(tanvir143FilePath)
				},
				tanvir143ThreadID
			);
		} catch (error) {
			console.error("[Tanvir143 genx]", error && (error.stack || error.message) || error);

			const detail = error && error.message ? error.message : "Unknown error";
			await tanvir143Send(
				api,
				`❌ Image operation failed.\n${detail}`,
				tanvir143ThreadID
			);
		} finally {
			if (tanvir143FilePath) {
				setTimeout(() => {
					tanvirrRobotFs.remove(tanvir143FilePath).catch(() => {});
				}, 20000);
			}
		}
	}
};
