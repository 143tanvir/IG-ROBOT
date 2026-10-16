/**
 * File Name: gen.js
 * ICA: igbot-api
 * Author: Tanvir Ahmed (Tanvir143)
 * GitHub: www.github.com/143tanvir
 * WhatsApp: +8801750079773
 * Note: Project metadata only; original source credits and license notices are retained.
 */

"use strict";

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const BASE_URL = "https://nkx-gen.neokex.xyz";
const API_KEY = "nkxgen";
const REQUEST_TIMEOUT = 300000;

const REACT_WAIT = "⏳";
const REACT_WORK = "⚙️";
const REACT_DONE = "✅";
const REACT_FAIL = "❌";

const RATIOS = [
  "1:1", "16:9", "9:16", "4:3", "3:4",
  "3:2", "2:3", "21:9", "4:5", "5:4"
];

const ALIASES = {
  nb2: "nano-banana-2",
  nanobanana: "nano-banana-2",
  nanobanana2: "nano-banana-2",
  nb2edit: "nano-banana-2-edit",
  gpt2: "gpt-image-2-low",
  gptimage2: "gpt-image-2-low",
  gpt2edit: "gpt-image-2-edit",
  flux2: "flux-2-dev",
  flux2dev: "flux-2-dev",
  flux2edit: "flux-2-dev-edit",
  flux2flex: "flux-2-flex",
  flux2pro: "flux-2-pro",
  flux2proedit: "flux-2-pro-edit",
  fluxkrea: "flux-krea",
  fluxkreaedit: "flux-krea-edit",
  kontext: "flux-kontext-dev",
  ideogram: "ideogram-v3-turbo",
  seedream4: "seedream-4",
  seedream4edit: "seedream-4-edit",
  seedream45: "seedream-4-5",
  seedream45edit: "seedream-4-5-edit",
  seedream5: "seedream-5",
  seedream5edit: "seedream-5-edit",
  qwen2: "qwen-image-2",
  qwen2pro: "qwen-image-2-pro",
  gemini25: "gemini-2-5-flash-image",
  gemini25edit: "gemini-2-5-flash-image-edit",
  flare: "gpt-image-2-5-flare-low",
  flareedit: "gpt-image-2-5-flare-low-edit",
  sunburst: "gpt-image-2-5-sunburst-low",
  sunbursted: "gpt-image-2-5-sunburst-low-edit",
  gpt25: "gpt-image-2-5-flare-low",
  gpt25flare: "gpt-image-2-5-flare-low",
  gpt25sunburst: "gpt-image-2-5-sunburst-low"
};

const client = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT,
  validateStatus: () => true,
  headers: { "X-API-Key": API_KEY }
});

let MODELS = {};

async function getModels() {
  if (Object.keys(MODELS).length) return MODELS;

  const res = await client.get("/api/models");

  if (
    res.status >= 400 ||
    !res.data ||
    !res.data.models ||
    typeof res.data.models !== "object"
  ) {
    throw new Error("Could not load the model list from NKX GEN API.");
  }

  MODELS = res.data.models;
  return MODELS;
}

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickModel(query) {
  const q = normalize(query);
  if (!q) return null;
  if (ALIASES[q]) return ALIASES[q];

  const keys = Object.keys(MODELS);
  const exact = keys.find(k => normalize(k) === q);
  if (exact) return exact;

  const aliasMatch = Object.keys(ALIASES).find(k =>
    normalize(ALIASES[k]) === q
  );

  if (aliasMatch) return ALIASES[aliasMatch];

  const starts = keys.filter(k => normalize(k).startsWith(q));
  if (starts.length) {
    return starts.sort((a, b) => a.length - b.length)[0];
  }

  const contains = keys.filter(k => normalize(k).includes(q));
  return contains.length
    ? contains.sort((a, b) => a.length - b.length)[0]
    : null;
}

function react(api, id, emoji) {
  try {
    api.setMessageReaction(emoji, id, () => {});
  } catch (_) {}
}

function findFlag(args, names) {
  for (let i = 0; i < args.length; i++) {
    if (names.includes(args[i].toLowerCase())) {
      const value = args[i + 1];

      return {
        found: true,
        value: !value || value.startsWith("+") ? null : value,
        index: i
      };
    }
  }

  return { found: false, value: null, index: -1 };
}

function extractImageUrl(event) {
  const sources = [
    event.messageReply?.attachments,
    event.attachments
  ];

  for (const attachments of sources) {
    if (!Array.isArray(attachments)) continue;

    const image = attachments.find(a =>
      ["photo", "image", "sticker"].includes(a.type)
    );

    if (image) {
      const url = image.url ||
        image.largePreviewUrl ||
        image.previewUrl;

      if (url) return url;
    }
  }

  return null;
}

function formatError(res) {
  const d = res.data;

  if (d && typeof d === "object") {
    if (
      d.detail &&
      typeof d.detail === "object" &&
      !Array.isArray(d.detail)
    ) {
      return d.detail.error || d.error ||
        "Insufficient balance to run this generation.";
    }

    if (typeof d.detail === "string") return d.detail;

    if (Array.isArray(d.detail)) {
      return d.detail.map(x => x.msg || x).join("; ");
    }

    if (d.error) return d.error;
    if (d.hint) return d.hint;
  }

  if (res.status === 401) return "The API rejected its key.";
  if (res.status === 402) return "Not enough credits. Try again later.";
  if (res.status === 504) return "Generation timed out. Try again.";

  if ([502, 503].includes(res.status)) {
    return "The generation server is unavailable. Try again shortly.";
  }

  return `Request failed (status ${res.status}).`;
}

async function download(url) {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Invalid download URL.");
  }

  const cacheDir = path.join(__dirname, "cache");
  await fs.ensureDir(cacheDir);

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120000
  });

  const contentType = String(response.headers["content-type"] || "");
  const urlPath = new URL(url).pathname;
  const extFromUrl = path.extname(urlPath).toLowerCase();

  const ext = /^\.(jpg|jpeg|png|webp|gif|mp3|wav|ogg|m4a)$/.test(extFromUrl)
    ? extFromUrl
    : contentType.includes("png") ? ".png"
    : contentType.includes("webp") ? ".webp"
    : contentType.includes("audio") ? ".mp3"
    : ".jpg";

  const filePath = path.join(
    cacheDir,
    `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`
  );

  await fs.writeFile(filePath, Buffer.from(response.data));
  return filePath;
}

function sendFile(api, message, event, filePath, body = "") {
  return new Promise((resolve, reject) => {
    api.sendMessage(
      {
        body,
        attachment: fs.createReadStream(filePath)
      },
      event.threadID,
      (err, info) => {
        if (err) return reject(err);
        resolve(info);
      },
      event.messageID
    );
  });
}

module.exports = {
  config: {
    name: "gen",
    aliases: ["create", "generate"],
    version: "2.4",
    author: "nkx",
    cooldown: 10,
    role: 0,
    shortDescription: {
      en: "Generate images and music with NKX GEN"
    },
    longDescription: {
      en: "Generate or edit images and generate music using NKX GEN models."
    },
    category: "Users Cmd",
    guide: {
      en:
        "{pn} +models\n" +
        "{pn} +nb2 a cat\n" +
        "{pn} +gpt2 a robot +ar 16:9\n" +
        "{pn} +seedream5 a city at night\n" +
        "(Reply to a photo) {pn} +nb2 make it watercolor\n" +
        "{pn} +music a lo-fi beat\n" +
        "{pn} +music +version v4.0 relaxing song\n" +
        "{pn} +nb2 a cat +ar 9:16\n" +
        "{pn} +nb2 a cat +image https://example.com/photo.jpg"
    }
  },

  onStart: async function ({ api, message, event, args }) {
    if (!args.length) {
      return message.reply(
        "IG-ROBOT GEN COMMAND\n\n" +
        ".gen +models - Show models\n" +
        ".gen +nb2 a cat - Square image (default)\n" +
        ".gen +nb2 a cat +ar 16:9 - Landscape\n" +
        ".gen +nb2 a cat +ar 9:16 - Portrait\n" +
        "Reply to a photo: .gen +nb2 make it watercolor\n" +
        ".gen +music a lo-fi beat - Music\n" +
        ".gen +music +version v4.0 relaxing song\n\n" +
        "Ratios: " + RATIOS.join(", ")
      );
    }

    if (args[0].toLowerCase() === "+models") {
      react(api, event.messageID, REACT_WAIT);

      try {
        await getModels();

        const lines = Object.entries(MODELS)
          .map(([name, id]) => `${name} → ${id}`)
          .slice(0, 40);

        react(api, event.messageID, REACT_DONE);

        return message.reply(
          "NKX GEN MODELS\n\n" +
          lines.join("\n") +
          "\n\nUse: .gen +<model> <prompt>"
        );
      } catch (e) {
        react(api, event.messageID, REACT_FAIL);
        return message.reply(e.message);
      }
    }

    const isMusic = args.some(a =>
      ["+music", "+audio"].includes(a.toLowerCase())
    );

    const modelFlag = args.find(a =>
      a.startsWith("+") &&
      ![
        "+ar", "+music", "+audio", "+image",
        "+img", "+url", "+version"
      ].includes(a.toLowerCase())
    );

    if (!modelFlag && !isMusic) {
      return message.reply(
        "Select a model.\nExample: .gen +nb2 a cat\nUse .gen +models to see available models."
      );
    }

    const arFlag = findFlag(args, ["+ar"]);
    const imageFlag = findFlag(args, ["+image", "+img", "+url"]);
    const versionFlag = findFlag(args, ["+version"]);

    const skip = new Set();

    if (modelFlag) skip.add(modelFlag);

    for (const flag of [arFlag, imageFlag, versionFlag]) {
      if (flag.found) {
        skip.add(args[flag.index]);

        if (flag.value !== null) {
          skip.add(args[flag.index + 1]);
        }
      }
    }

    for (const arg of args) {
      if (["+music", "+audio"].includes(arg.toLowerCase())) {
        skip.add(arg);
      }
    }

    const prompt = args
      .filter(a => !skip.has(a) && !a.startsWith("+"))
      .join(" ")
      .trim();

    if (!prompt) {
      return message.reply("Please provide a prompt.");
    }

    const reference = extractImageUrl(event) || imageFlag.value;

    react(api, event.messageID, REACT_WAIT);

    try {
      await getModels();
    } catch (e) {
      react(api, event.messageID, REACT_FAIL);
      return message.reply(e.message);
    }

    if (isMusic) {
      return generateMusic({
        api, message, event, prompt, versionFlag
      });
    }

    const model = pickModel(modelFlag.slice(1));

    if (!model) {
      react(api, event.messageID, REACT_FAIL);
      return message.reply(
        `Unknown model "${modelFlag.slice(1)}". Use .gen +models.`
      );
    }

    const ratio = RATIOS.includes(arFlag.value)
      ? arFlag.value
      : "1:1";

    const payload = {
      prompt,
      model,
      ratio,
      resolution: "2k",
      wait: true
    };

    if (reference) {
      if (!/^https?:\/\//i.test(reference)) {
        react(api, event.messageID, REACT_FAIL);
        return message.reply(
          "Could not read the reference image. Reply to a photo or provide a valid image URL."
        );
      }

      payload.image_urls = [reference];
    }

    let filePath;

    try {
      react(api, event.messageID, REACT_WORK);

      const res = await client.post("/api/generate", payload);

      if (res.status >= 400) {
        react(api, event.messageID, REACT_FAIL);
        return message.reply(formatError(res));
      }

      const url = res.data?.url || res.data?.thumbnail;

      if (!url) {
        react(api, event.messageID, REACT_FAIL);
        return message.reply("Generation finished but returned no image URL.");
      }

      filePath = await download(url);
      await sendFile(api, message, event, filePath);

      react(api, event.messageID, REACT_DONE);
    } catch (e) {
      console.error(
        "[Tanvir143 GEN ERROR]",
        e?.response?.data || e.message || e
      );

      react(api, event.messageID, REACT_FAIL);
      return message.reply("Image generation failed. Please try again.");
    } finally {
      if (filePath) {
        await fs.remove(filePath).catch(() => {});
      }
    }
  }
};

async function generateMusic({
  api, message, event, prompt, versionFlag
}) {
  const version = versionFlag.value || "v3.5";

  if (!["v3.5", "v4.0"].includes(version)) {
    react(api, event.messageID, REACT_FAIL);
    return message.reply(
      `Unknown music version "${version}". Available: v3.5, v4.0`
    );
  }

  let filePath;

  try {
    react(api, event.messageID, REACT_WORK);

    const res = await client.post("/api/music", {
      prompt,
      model: version,
      wait: true
    });

    if (res.status >= 400) {
      react(api, event.messageID, REACT_FAIL);
      return message.reply(formatError(res));
    }

    const data = res.data;
    const url = data.audio_url || data.cover;

    if (!url) {
      react(api, event.messageID, REACT_FAIL);
      return message.reply("Music generation returned no audio URL.");
    }

    filePath = await download(url);

    await sendFile(
      api,
      message,
      event,
      filePath,
      data.title || prompt
    );

    react(api, event.messageID, REACT_DONE);
  } catch (e) {
    console.error(
      "[Tanvir143 GEN MUSIC ERROR]",
      e?.response?.data || e.message || e
    );

    react(api, event.messageID, REACT_FAIL);
    return message.reply("Music generation failed. Please try again.");
  } finally {
    if (filePath) {
      await fs.remove(filePath).catch(() => {});
    }
  }
}
