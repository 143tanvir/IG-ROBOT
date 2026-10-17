
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

const API_CONFIG_URL =
  "https://raw.githubusercontent.com/goatbotnx/xalmanx210/refs/heads/main/apis.json";

const API_KEY = "xalman-hub";
const AUTHOR = "Tanvir143";
const TEMP_DIR = path.join(os.tmpdir(), "igbot-genx");

const GENERATE_MODELS = [
  { name: "Flux 2 Max", path: "/api/flux2max", hub: true },
  { name: "GPT Image 2", path: "/api/gptimage2", hub: true },
  { name: "GPT 2.5 Flare", path: "/api/gpt2.5-flare", hub: true },
  { name: "GPT 2.5 Flare V2", path: "/api/gpt2.5-flare-v2", hub: true },
  { name: "GPT 2.5 Sunburst", path: "/api/gpt2.5-sunburst", hub: true },
  { name: "GPT Image 2.5 Sunburst V2", path: "/api/gptimage2.5-sunburst-v2", hub: true },
  { name: "Grok", path: "/api/grok", hub: true },
  { name: "Nano Banana", path: "/api/nb", hub: true },
  { name: "Nano Banana 2", path: "/api/nanobanana2", hub: true },
  { name: "Qwen Image 2", path: "/api/qwenimage2", hub: true },
  { name: "Qwen Image 2 (NKX)", model: "qwen-image" },
  { name: "SeedDream 4", path: "/api/seedream4", hub: true },
  { name: "Nano Banana 2", model: "nano-banana-2" },
  { name: "GPT Image 2 Low", model: "gpt-image-2-low" },
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
  { name: "GPT 2.5 Flare Low", model: "gpt-image-2-5-flare-low" },
  { name: "GPT 2.5 Sunburst Low", model: "gpt-image-2-5-sunburst-low" }
];

const EDIT_MODELS = [
  { name: "Classic Edit (Hub)", hub: true, maxImages: 1 },
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

function getThreadID(event) {
  return event.threadID || event.threadId;
}

function getSenderID(event) {
  return event.senderID || event.userID;
}

function getReply(event) {
  return event.messageReply || event.replyMessage || event.repliedMessage || null;
}

function getAttachments(event) {
  const list = [];
  const sources = [
    event.attachments,
    getReply(event)?.attachments
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;

    for (const item of source) {
      if (!item) continue;
      const type = String(item.type || "").toLowerCase();
      const url = item.url || item.src || item.uri;

      if (
        url &&
        (!type || type.includes("photo") || type.includes("image"))
      ) {
        list.push(url);
      }
    }
  }

  return [...new Set(list)].slice(0, 2);
}

function helpText() {
  let text = `🖼️ GEN\n\n`;
  text += "GENERATION MODELS\n";

  GENERATE_MODELS.forEach((model, index) => {
    text += `${index + 1}. ${model.name}\n`;
  });

  text += "\nEDIT MODELS\n";

  EDIT_MODELS.forEach((model, index) => {
    text += `${index + 1}. ${model.name}\n`;
  });

  text += "\nEXAMPLES\n";
  text += ".genx +1 a cute cat\n";
  text += ".genx +2 a beautiful village\n";
  text += ".genx +edit1 make the photo brighter (reply to photo)\n";
  text += ".genx +edit2+2 combine these two photos (reply to photo)\n";

  text += "\n+edit1 supports one image; other edit models are configured for up to two images.";
  return text;
}

async function getHubBaseURL() {
  const response = await axios.get(API_CONFIG_URL, { timeout: 15000 });
  const data = response.data;

  const base =
    data[API_KEY] ||
    data.api ||
    data.baseURL ||
    data.baseUrl ||
    data.url;

  if (!base || typeof base !== "string") {
    throw new Error("API base URL was not found in the API configuration.");
  }

  return base.replace(/\/+$/, "");
}

function isImageResponse(response) {
  const type = String(response.headers["content-type"] || "").toLowerCase();
  return type.startsWith("image/");
}

async function saveImageResponse(response, prefix) {
  if (isImageResponse(response)) {
    const ext = response.headers["content-type"].includes("jpeg")
      ? ".jpg"
      : response.headers["content-type"].includes("webp")
        ? ".webp"
        : ".png";

    await fs.ensureDir(TEMP_DIR);
    const file = path.join(TEMP_DIR, `${prefix}-${Date.now()}${ext}`);
    await fs.writeFile(file, Buffer.from(response.data));
    return file;
  }

  let body = response.data;

  if (Buffer.isBuffer(body)) {
    body = body.toString("utf8");
  }

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      throw new Error("API did not return an image or valid JSON.");
    }
  }

  const url =
    body?.url ||
    body?.image ||
    body?.imageUrl ||
    body?.result?.url ||
    body?.data?.url ||
    body?.data?.image;

  if (!url || typeof url !== "string") {
    throw new Error(body?.message || body?.error || "API returned no image URL.");
  }

  const imageResponse = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120000
  });

  if (!isImageResponse(imageResponse)) {
    throw new Error("The returned URL did not provide an image.");
  }

  const ext = String(imageResponse.headers["content-type"]).includes("jpeg")
    ? ".jpg"
    : String(imageResponse.headers["content-type"]).includes("webp")
      ? ".webp"
      : ".png";

  await fs.ensureDir(TEMP_DIR);
  const file = path.join(TEMP_DIR, `${prefix}-${Date.now()}${ext}`);
  await fs.writeFile(file, Buffer.from(imageResponse.data));
  return file;
}

async function callHubGeneration(baseURL, model, prompt) {
  const response = await axios.get(`${baseURL}${model.path}`, {
    params: { prompt },
    responseType: "arraybuffer",
    timeout: 180000,
    validateStatus: status => status >= 200 && status < 500
  });

  if (response.status >= 400) {
    throw new Error(`Generation API returned HTTP ${response.status}.`);
  }

  return saveImageResponse(response, "genx");
}

async function callHubEdit(baseURL, imageURL, prompt) {
  const response = await axios.get(`${baseURL}/api/edit`, {
    params: { img: imageURL, prompt },
    responseType: "arraybuffer",
    timeout: 180000,
    validateStatus: status => status >= 200 && status < 500
  });

  if (response.status >= 400) {
    throw new Error(`Edit API returned HTTP ${response.status}.`);
  }

  return saveImageResponse(response, "genx-edit");
}

module.exports = {
  config: {
    name: "gen",
    aliases: ["genx", "imagegen"],
    version: "1.0.0",
    author: "Tanvir Ahmed (Tanvir143)",
    cooldown: 6,
    role: 0,
    description: "Generate and edit images using available image models.",
    category: "image",
    guide: ".genx help | .genx +1 prompt | .genx +edit1 prompt"
  },

  onStart: async function ({ api, event, args }) {
    const threadID = getThreadID(event);
    const input = args.join(" ").trim();

    if (!threadID) return;

    if (!input || input.toLowerCase() === "help") {
      return api.sendMessage(helpText(), threadID);
    }

    const editMatch = input.match(/^\+edit(\d+)(\+2)?(?:\s+|$)/i);
    const genMatch = input.match(/^\+(\d+)(?:\s+|$)/);

    if (!editMatch && !genMatch) {
      return api.sendMessage(
        "❌ Invalid format.\nUse .genx help to see models and examples.",
        threadID
      );
    }

    const isEdit = Boolean(editMatch);
    const modelNumber = Number(isEdit ? editMatch[1] : genMatch[1]);
    const models = isEdit ? EDIT_MODELS : GENERATE_MODELS;
    const model = models[modelNumber - 1];

    if (!model) {
      return api.sendMessage(
        `❌ Invalid model number. Available: 1-${models.length}`,
        threadID
      );
    }

    let prompt = input.replace(
      isEdit ? /^\+edit\d+(?:\+2)?\s*/i : /^\+\d+\s*/,
      ""
    ).trim();

    if (!prompt) {
      return api.sendMessage("❌ Please provide a prompt.", threadID);
    }

    let filePath;

    try {
      await api.sendMessage(
        `Model Name: ${model.name}...`,
        threadID
      );

      if (!isEdit) {
        if (model.hub) {
          const baseURL = await getHubBaseURL();
          filePath = await callHubGeneration(baseURL, model, prompt);
        } else {
          return api.sendMessage(
            `⚠️ ${model.name} requires its NKX job API endpoint. This standalone file does not have that endpoint configured yet.`,
            threadID
          );
        }
      } else {
        const images = getAttachments(event);
        const maxImages = model.maxImages || 1;

        if (!images.length) {
          return api.sendMessage(
            "❌ Reply to a photo and use the edit command.",
            threadID
          );
        }

        if (model.hub) {
          filePath = await callHubEdit(
            await getHubBaseURL(),
            images[0],
            prompt
          );
        } else {
          return api.sendMessage(
            `⚠️ ${model.name} requires its NKX job API endpoint. This standalone file does not have that endpoint configured yet.`,
            threadID
          );
        }
      }

      await api.sendMessage(
        {
          body: `✅ Sendig Your Image\n✅ Model: ${model.name}`,
          attachment: fs.createReadStream(filePath)
        },
        threadID
      );
    } catch (error) {
      console.error(`[${AUTHOR} GENX ERROR]`, error.message);

      await api.sendMessage(
        `❌ ${isEdit ? "Image editing" : "Image generation"} failed.\nReason: ${error.message}`,
        threadID
      );
    } finally {
      if (filePath) {
        setTimeout(() => {
          fs.remove(filePath).catch(() => {});
        }, 20000);
      }
    }
  }
};
