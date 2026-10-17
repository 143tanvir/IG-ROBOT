
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
const API_CONFIG_URL =
  "https://raw.githubusercontent.com/goatbotnx/xalmanx210/refs/heads/main/apis.json";
const HUB_KEY = "xalman-hub";
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
  headers: { "X-API-Key": NKX_API_KEY }
});

const GEN_MODELS = [
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
  { name: "Qwen Image", model: "qwen-image" },
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
  { name: "Classic Edit (Hub)", hub: true },
  { name: "Nano Banana 2 Edit", model: "nano-banana-2-edit" },
  { name: "GPT Image 2 Edit", model: "gpt-image-2-edit" },
  { name: "Flux 2 Dev Edit", model: "flux-2-dev-edit" },
  { name: "Flux 2 Pro Edit", model: "flux-2-pro-edit" },
  { name: "Flux Krea Edit", model: "flux-krea-edit" },
  { name: "Flux Kontext Dev", model: "flux-kontext-dev" },
  { name: "SeedDream 4 Edit", model: "seedream-4-edit" },
  { name: "SeedDream 4.5 Edit", model: "seedream-4-5-edit" },
  { name: "SeedDream 5 Edit", model: "seedream-5-edit" },
  { name: "Gemini 2.5 Flash Edit", model: "gemini-2-5-flash-image-edit" },
  { name: "GPT 2.5 Flare Edit", model: "gpt-image-2-5-flare-low-edit" },
  { name: "GPT 2.5 Sunburst Edit", model: "gpt-image-2-5-sunburst-low-edit" }
];

function formatNKXError(res) {
  const d = res && res.data;

  if (d && typeof d === "object") {
    if (d.detail && typeof d.detail === "object" && !Array.isArray(d.detail)) {
      return d.detail.error || d.error || "Insufficient balance to run this generation.";
    }

    if (typeof d.detail === "string") return d.detail;

    if (Array.isArray(d.detail)) {
      return d.detail.map(x => x.msg || x).join("; ");
    }

    if (d.error) return d.error;
    if (d.hint) return d.hint;
    if (d.message) return d.message;
  }

  if (res.status === 401) return "The NKX API rejected its key.";
  if (res.status === 402) return "Not enough API credits.";
  if (res.status === 504) return "The job timed out.";
  if (res.status === 502 || res.status === 503) {
    return "The generation server is temporarily unavailable.";
  }

  return `NKX request failed (HTTP ${res.status}).`;
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

  if (response.status >= 400) {
    throw new Error(formatNKXError(response));
  }

  const data = response.data || {};
  const url = data.url || data.thumbnail;

  if (!url || typeof url !== "string") {
    throw new Error("NKX finished the job but returned no image URL.");
  }

  return url;
}

async function downloadToTemp(url, prefix = "genx") {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120000
  });

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
  const out = { ratio: null, images: [], words: [] };

  for (let i = 0; i < args.length; i++) {
    const value = String(args[i]);
    const low = value.toLowerCase();

    if (low === "--ar") {
      out.ratio = args[++i] || null;
    } else if (["--img", "--image", "--url"].includes(low)) {
      if (args[i + 1]) out.images.push(String(args[++i]));
    } else {
      out.words.push(value);
    }
  }

  out.prompt = out.words.join(" ").trim();
  return out;
}

function photosOf(attachments) {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .filter(a => a && (
      a.type === "photo" ||
      a.type === "sticker" ||
      a.type === "image"
    ))
    .map(a => a.url || a.largePreviewUrl || a.previewUrl)
    .filter(Boolean);
}

function sameFile(a, b) {
  try {
    return new URL(a).pathname === new URL(b).pathname;
  } catch (_) {
    return a === b;
  }
}

function getThreadID(event) {
  return event.threadID || event.threadId;
}

function getReply(event) {
  return event.messageReply || event.replyMessage || event.repliedMessage || null;
}

function getImages(event) {
  const current = Array.isArray(event.attachments) ? event.attachments : [];
  const replyAttachments = Array.isArray(getReply(event)?.attachments)
    ? getReply(event).attachments
    : [];

  return [...new Set([
    ...photosOf(current),
    ...photosOf(replyAttachments)
  ])];
}

async function getHubBaseURL() {
  const response = await axios.get(API_CONFIG_URL, { timeout: 20000 });
  const data = response.data || {};

  const base =
    data[HUB_KEY] ||
    data.api ||
    data.baseURL ||
    data.baseUrl ||
    data.url;

  if (typeof base !== "string" || !base.trim()) {
    throw new Error("Could not find the Hub API URL in apis.json.");
  }

  return base.replace(/\/+$/, "");
}

function getImageURL(data) {
  if (!data || typeof data !== "object") return null;

  return (
    data.url ||
    data.image ||
    data.imageUrl ||
    data.output ||
    data.result?.url ||
    data.result?.image ||
    data.data?.url ||
    data.data?.image ||
    null
  );
}

async function saveHubResponse(response, prefix) {
  const contentType = String(
    response.headers["content-type"] || ""
  ).toLowerCase();

  if (contentType.startsWith("image/")) {
    await fs.ensureDir(TEMP_DIR);

    const ext = contentType.includes("jpeg")
      ? ".jpg"
      : contentType.includes("webp")
        ? ".webp"
        : ".png";

    const file = path.join(TEMP_DIR, `${prefix}_${Date.now()}${ext}`);
    await fs.writeFile(file, Buffer.from(response.data));
    return file;
  }

  let data = response.data;

  if (Buffer.isBuffer(data)) data = data.toString("utf8");

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (_) {
      throw new Error("Hub API returned an unsupported response.");
    }
  }

  const url = getImageURL(data);

  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    throw new Error(
      data?.detail || data?.error || data?.message ||
      "Hub API returned no image URL."
    );
  }

  return downloadToTemp(url, prefix);
}

async function generateHub(baseURL, model, prompt, ratio) {
  const response = await axios.get(`${baseURL}${model.path}`, {
    params: { prompt, ...(ratio ? { ratio } : {}) },
    responseType: "arraybuffer",
    timeout: 240000,
    validateStatus: () => true
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Hub generation failed (HTTP ${response.status}).`);
  }

  return saveHubResponse(response, "genx");
}

async function editHub(baseURL, imageURL, prompt) {
  const response = await axios.get(`${baseURL}/api/edit`, {
    params: { img: imageURL, prompt },
    responseType: "arraybuffer",
    timeout: 240000,
    validateStatus: () => true
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Hub edit failed (HTTP ${response.status}).`);
  }

  return saveHubResponse(response, "genx-edit");
}

async function generateNKX(model, prompt, ratio) {
  const payload = {
    prompt,
    model: model.model,
    resolution: "2k",
    wait: true
  };

  if (ratio) payload.ratio = ratio;

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

  if (ratio) payload.ratio = ratio;

  const url = await runNKXJob(payload);
  return downloadToTemp(url, "genx-edit");
}

function helpText() {
  let text = `🖼️ ${AUTHOR} GENX\n\nGENERATION MODELS\n`;

  GEN_MODELS.forEach((model, i) => {
    text += `${i + 1}. ${model.name}\n`;
  });

  text += "\nEDIT MODELS\n";

  EDIT_MODELS.forEach((model, i) => {
    text += `${i + 1}. ${model.name}\n`;
  });

  text += "\nEXAMPLES\n";
  text += ".genx +1 a cute cat\n";
  text += ".genx +11 a beautiful village --ar 16:9\n";
  text += ".genx +edit1 make this photo cinematic\n";
  text += ".genx +edit2 add sunglasses\n";
  text += "\nRatios: " + RATIOS.join(", ");

  return text;
}

module.exports = {
  config: {
    name: "genx",
    aliases: ["gen", "imagegen"],
    version: "3.1.0",
    author: "Tanvir Ahmed (Tanvir143)",
    cooldown: 6,
    role: 2,
    description: "Generate and edit images with AI models.",
    category: "image",
    guide: ".genx help | .genx +1 prompt | .genx +edit1 prompt"
  },

  onStart: async function ({ api, event, args }) {
    const threadID = getThreadID(event);
    if (!threadID) return;

    const input = args.join(" ").trim();

    if (!input || input.toLowerCase() === "help") {
      return api.sendMessage(helpText(), threadID);
    }

    const editMatch = input.match(/^\+edit(\d+)(?:\s+|$)/i);
    const genMatch = input.match(/^\+(\d+)(?:\s+|$)/);

    if (!editMatch && !genMatch) {
      return api.sendMessage(
        "❌ Invalid command. Use .genx help",
        threadID
      );
    }

    const isEdit = Boolean(editMatch);
    const number = Number(isEdit ? editMatch[1] : genMatch[1]);
    const list = isEdit ? EDIT_MODELS : GEN_MODELS;
    const model = list[number - 1];

    if (!model) {
      return api.sendMessage(
        `❌ Invalid model number. Choose 1-${list.length}.`,
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
      return api.sendMessage("❌ Please enter a prompt.", threadID);
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
        ].filter(url => (
          typeof url === "string" &&
          /^https?:\/\//i.test(url)
        ));

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

        if (model.hub) {
          filePath = await editHub(
            await getHubBaseURL(),
            imageURL,
            prompt
          );
        } else {
          filePath = await editNKX(
            model,
            prompt,
            imageURL,
            parsed.ratio
          );
        }
      } else {
        await api.sendMessage(
          `⏳ ${AUTHOR}: Generating with ${model.name}...`,
          threadID
        );

        if (model.hub) {
          filePath = await generateHub(
            await getHubBaseURL(),
            model,
            prompt,
            parsed.ratio
          );
        } else {
          filePath = await generateNKX(
            model,
            prompt,
            parsed.ratio
          );
        }
      }

      await api.sendMessage({
        body: `✅ ${AUTHOR} | ${model.name}`,
        attachment: fs.createReadStream(filePath)
      }, threadID);
    } catch (error) {
      console.error(`[${AUTHOR} GENX ERROR]`, error.stack || error.message);

      try {
        await api.sendMessage(
          `❌ ${isEdit ? "Image editing" : "Image generation"} failed.\n${error.message || "Unknown API error."}`,
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
