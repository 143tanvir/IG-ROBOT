
/**
 * File Name: genx.js
 * ICA: igbot-api
 * Original Author: Neoaz 🐊 (credits retained)
 * Integration: Tanvir143 | IG-ROBOT
 */

"use strict";

const axios = require("axios");
const { getStreamFromURL } = global.utils;

const API = "https://myimg-api.vercel.app";

const MODELS = {
  imagine: {
    gen: "/generate/text-to-image",
    ar: "size",
    style: "style",
    params: ["prompt", "style", "width", "height"],
    required: { gen: ["prompt"] }
  },
  flux: {
    gen: "/generate/flux-text-to-image",
    ar: "flux",
    params: ["prompt", "size"],
    required: { gen: ["prompt"] }
  },
  styledit: {
    edit: "/generate/image-to-image",
    ar: "size",
    style: "style",
    params: ["style", "width", "height", "styleId"]
  },
  image: {
    edit: "/generate/image-to-image-v2",
    params: ["prompt", "maxSize"],
    required: { edit: ["prompt"] }
  },
  edit: {
    edit: "/generate/edit",
    style: "preset",
    params: ["preset", "prompt", "tune"]
  },
  enhance: { edit: "/generate/enhance" },
  pretty: { edit: "/generate/pretty", params: ["level"] },
  restore: { edit: "/generate/restore" },
  animation: { edit: "/generate/animation" },
  eyeopen: { edit: "/generate/eye-open" },
  age: {
    edit: "/generate/change-age",
    params: ["targetAge"],
    required: { edit: ["targetAge"] }
  },
  hair: {
    edit: "/generate/change-hair",
    params: ["hairType"],
    required: { edit: ["hairType"] }
  },
  emotion: {
    edit: "/generate/change-emotion",
    params: ["emotionType"],
    required: { edit: ["emotionType"] }
  },
  clothes: {
    edit: "/generate/change-clothes",
    params: ["modelUrl", "clothesUrl", "preset", "modelPreset"]
  },
  segment: { edit: "/generate/segment" },
  cartoon: { edit: "/generate/cartoonized", params: ["index"] },
  repaint: {
    edit: "/generate/repaint",
    style: "style",
    params: ["style"]
  },
  cosplay: {
    edit: "/generate/cosplay",
    params: ["templateUrl", "index"],
    required: { edit: ["templateUrl"] }
  },
  upscale: {
    edit: "/generate/scale",
    params: ["scale", "outputFormat"]
  },
  faceswap: {
    edit: "/generate/face-swap",
    imageParam: "source",
    params: ["source", "target"],
    required: { edit: ["target"] }
  },
  nsfw: {
    gen: "/generate/nsfw-text-to-image",
    edit: "/generate/nsfw-image-to-image",
    ar: "size",
    style: "stylePreset",
    params: ["prompt", "style", "stylePreset", "width", "height"],
    required: { gen: ["prompt"] }
  },
  video: {
    edit: "/generate/video",
    params: ["duration", "prompt", "model", "bgmUrl"]
  },
  videoenhance: {
    edit: "/generate/video-enhance",
    imageParam: "videoUrl",
    params: ["videoUrl", "free"]
  },
  subtitle: {
    edit: "/generate/remove-subtitle",
    imageParam: "videoUrl",
    params: ["videoUrl", "bx", "by", "bw", "bh"],
    required: { edit: ["bx", "by", "bw", "bh"] }
  }
};

const ALIASES = {
  targetage: "targetAge",
  hairtype: "hairType",
  emotiontype: "emotionType",
  modelurl: "modelUrl",
  clothesurl: "clothesUrl",
  modelpreset: "modelPreset",
  templateurl: "templateUrl",
  videourl: "videoUrl",
  maxsize: "maxSize",
  stylepreset: "stylePreset",
  outputformat: "outputFormat",
  generateaudio: "generateAudio",
  firstframe: "firstFrameUrl",
  firstframeurl: "firstFrameUrl",
  lastframe: "lastFrameUrl",
  lastframeurl: "lastFrameUrl",
  bgmurl: "bgmUrl",
  styleid: "styleId"
};

const CONTROL = new Set(["models", "styles", "m", "help", "h"]);
const COMMON = ["i", "img", "imgurl", "image", "wait", "upload"];

const GUIDE =
  "🐊 NEOKEX GENX\n\n" +
  "🖼️ Generate:\n" +
  "• gen +imagine a cute cat\n" +
  "• gen +flux a futuristic robot\n\n" +
  "✏️ Edit (reply to an image):\n" +
  "• gen +image +maxSize 1024 add a girl beside me\n" +
  "• gen +age +targetAge 50\n" +
  "• gen +hair +hairType curly\n" +
  "• gen +emotion +emotionType happy\n" +
  "• gen +enhance\n\n" +
  "📋 Other:\n" +
  "• gen +models\n" +
  "• gen +styles\n" +
  "• gen +s\n\n" +
  "Use + instead of -- for parameters.";

function parse(args) {
  const flags = {};
  const rest = [];
  let modelChosen = false;

  for (let i = 0; i < args.length; i++) {
    const token = args[i];

    if (token.startsWith("+") && token.length > 1) {
      const key = token.slice(1).toLowerCase();

      // First +word selects the model or a control action.
      if (!modelChosen) {
        modelChosen = true;

        if (key === "models" || key === "styles") {
          flags[key] = true;
          continue;
        }

        if (key === "help" || key === "h") {
          flags.help = true;
          continue;
        }

        if (key === "s") {
          flags.s = true;
          continue;
        }

        flags.m = key;
        continue;
      }

      // Subsequent +word tokens are parameters.
      const next = args[i + 1];

      if (next !== undefined &&
          !next.startsWith("+") &&
          !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }

      continue;
    }

    // Backward compatibility with --flags.
    if (token.startsWith("--")) {
      const key = token.slice(2).toLowerCase();
      const next = args[i + 1];

      if (next !== undefined &&
          !next.startsWith("--") &&
          !next.startsWith("+")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }

      continue;
    }

    rest.push(token);
  }

  return { flags, rest };
}

function findImage(flags, event) {
  let image = flags.i || flags.img || flags.imgurl || flags.image;

  if (typeof image !== "string") image = undefined;

  const replied = event && event.messageReply;

  if (!image && replied && Array.isArray(replied.attachments)) {
    const att = replied.attachments.find(a =>
      a.url && (
        ["photo", "image", "animated_image", "gif", "video"].includes(a.type) ||
        /\.(png|jpe?g|webp|gif|mp4|mov)$/i.test(a.url)
      )
    );

    if (att) image = att.url;
  }

  return image;
}

function ratioToSize(ar, base = 1024) {
  const m = /^(\d+)\s*[:x/]\s*(\d+)$/i.exec(String(ar).trim());
  if (!m) return null;

  const rw = Number(m[1]);
  const rh = Number(m[2]);

  if (!rw || !rh) return null;

  if (rw >= rh) {
    return {
      width: base,
      height: Math.round(base * rh / rw)
    };
  }

  return {
    width: Math.round(base * rw / rh),
    height: base
  };
}

function applyAr(model, ar, params) {
  const size = ratioToSize(ar);
  if (!size) return false;

  if (model.ar === "flux") {
    params.size = `${size.width}x${size.height}`;
  } else {
    params.width = size.width;
    params.height = size.height;
  }

  return true;
}

async function callApi(path, params) {
  const res = await axios.get(API + path, {
    params,
    timeout: 600000,
    validateStatus: () => true
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`API HTTP ${res.status}`);
  }

  return res.data;
}

function react(api, message, messageID, emoji) {
  try {
    if (api && typeof api.setMessageReaction === "function") {
      api.setMessageReaction(emoji, messageID, () => {}, true);
      return;
    }
  } catch (_) {}

  try {
    if (typeof message.reaction === "function") {
      message.reaction(emoji, messageID);
    }
  } catch (_) {}
}

function resultUrl(data) {
  const r = data && data.result || {};

  return r.resultUrl ||
    r.url ||
    (data && (data.resultUrl || data.url));
}

async function sendMedia(message, data) {
  const url = resultUrl(data);
  if (!url) return false;

  const stream = await getStreamFromURL(url);
  if (!stream) return false;

  const match = url.split("?")[0].match(/\.(png|jpe?g|webp|gif|mp4|mov)$/i);
  const ext = match ? match[1] : "png";

  if (typeof stream === "object") {
    stream.path = `genx.${ext}`;
  }

  await message.reply({ attachment: stream });
  return true;
}

async function listModels(message) {
  const lines = Object.entries(MODELS).map(([name, model]) => {
    const types = [
      model.gen ? "gen" : "",
      model.edit ? "edit" : ""
    ].filter(Boolean).join("/");

    return `• ${name} — ${types}`;
  });

  return message.reply(
    `🧠 NEOKEX GENX Models (${lines.length})\n\n${lines.join("\n")}`
  );
}

async function listStyles(message) {
  const data = await callApi("/nsfw-styles", {});

  if (!data || !Array.isArray(data.styles)) {
    return message.reply("❌ Styles পাওয়া যায়নি। API পরীক্ষা করো।");
  }

  const lines = data.styles.map(s =>
    `• ${typeof s === "string" ? s : s.name || s.id}`
  );

  return message.reply(`🔞 Styles (${lines.length})\n\n${lines.join("\n")}`);
}

async function listPresets(message) {
  const data = await callApi("/edit-presets", {});

  if (!data || !Array.isArray(data.presets)) {
    return message.reply("❌ Edit presets পাওয়া যায়নি।");
  }

  const lines = data.presets.map(p => `• ${p.styleId} — ${p.label}`);

  return message.reply(`🧩 Edit Presets (${lines.length})\n\n${lines.join("\n")}`);
}

module.exports = {
  config: {
    name: "gen",
    version: "2.3.0",
    author: "Neoaz 🐊",
    cooldown: 5,
    role: 0,
    shortDescription: {
      en: "NEOKEX GENX image and video generator"
    },
    longDescription: {
      en: "Generate and edit images and video through the NEOKEX GENX API."
    },
    category: "users cmd",
    guide: {
      en: "{pn} +imagine a cute cat\n" +
          "{pn} +flux a futuristic robot\n" +
          "Reply to an image: {pn} +image add a girl beside me\n" +
          "Reply to an image: {pn} +age +targetAge 50\n" +
          "{pn} +models | {pn} +styles | {pn} +s"
    }
  },

  onStart: async function ({ api, message, args, event }) {
    const messageID = event && event.messageID;
    const { flags, rest } = parse(args);

    if (!args.length || flags.help || flags.h) {
      return message.reply(GUIDE);
    }

    if (flags.models) return listModels(message);
    if (flags.styles) {
      try {
        return await listStyles(message);
      } catch (e) {
        return message.reply(`❌ Styles error: ${e.message}`);
      }
    }

    if (flags.s === true && !flags.m) {
      try {
        return await listPresets(message);
      } catch (e) {
        return message.reply(`❌ Presets error: ${e.message}`);
      }
    }

    const modelName = typeof flags.m === "string"
      ? flags.m.toLowerCase()
      : "";

    if (modelName && !MODELS[modelName]) {
      return message.reply(
        `❌ Unknown model: ${modelName}\nUse: gen +models`
      );
    }

    const style = typeof flags.s === "string" ? flags.s : undefined;
    const prompt = rest.join(" ").trim();

    let image = findImage(flags, event);
    let model = MODELS[modelName];

    if (!model && style && image) model = MODELS.edit;
    if (!model) model = image ? MODELS.image : MODELS.imagine;

    const ip = model.imageParam || "imgurl";

    if (!image && typeof flags[ip.toLowerCase()] === "string") {
      image = flags[ip.toLowerCase()];
    }

    const label = modelName || (image ? "image" : "imagine");
    let styleValue = style;
    let promptValue = prompt;

    if (model === MODELS.edit && styleValue) {
      styleValue = [styleValue, promptValue].filter(Boolean).join(" ").trim();
      promptValue = "";
    }

    if (image && !model.edit) {
      return message.reply(`❌ ${label} image editing সমর্থন করে না।`);
    }

    if (!image && !model.gen) {
      return message.reply(
        `❌ ${label} মডেলের জন্য ছবিতে Reply দাও অথবা +i <imgurl> দাও।`
      );
    }

    if (style && !model.style) {
      return message.reply(`❌ ${label} +s সমর্থন করে না।`);
    }

    if (typeof flags.ar === "string" && !model.ar) {
      return message.reply(`❌ ${label} +ar সমর্থন করে না।`);
    }

    const allowed = new Set([
      ...(model.params || []),
      ...COMMON,
      ip
    ].map(k => k.toLowerCase()));

    if (model.ar) allowed.add("ar");
    if (model.style) allowed.add("s");

    for (const key of Object.keys(flags)) {
      if (CONTROL.has(key) || allowed.has(key)) continue;

      return message.reply(
        `❌ Unknown parameter: +${key}\n` +
        `Allowed: ${[...allowed].map(k => "+" + k).join(" ")}`
      );
    }

    const mode = image ? "edit" : "gen";
    const path = mode === "edit" ? model.edit : model.gen;

    if (!path) {
      return message.reply(`❌ ${label} এই কাজ সমর্থন করে না।`);
    }

    const params = {};

    if (image) params[ip] = image;
    if (promptValue) params.prompt = promptValue;
    if (styleValue && model.style) params[model.style] = styleValue;

    if (typeof flags.ar === "string") {
      if (!applyAr(model, flags.ar, params)) {
        return message.reply("❌ Aspect ratio ভুল। উদাহরণ: +ar 16:9");
      }
    }

    for (const key of Object.keys(flags)) {
      if (
        CONTROL.has(key) ||
        key === "s" ||
        key === "ar" ||
        key === "m" ||
        key === ip.toLowerCase()
      ) {
        continue;
      }

      const value = flags[key];
      if (value === true) continue;

      params[ALIASES[key] || key] = value;
    }

    const required = (model.required && model.required[mode]) || [];
    const missing = required.filter(p =>
      params[p] === undefined || params[p] === ""
    );

    if (missing.length) {
      return message.reply(
        `❌ প্রয়োজনীয় তথ্য নেই: ${missing.map(p => "+" + p).join(", ")}`
      );
    }

    react(api, message, messageID, "⌛");

    try {
      const data = await callApi(path, params);
      const sent = data && data.ok !== false
        ? await sendMedia(message, data)
        : false;

      if (!sent) {
        react(api, message, messageID, "❌");
        return message.reply(
          "❌ ছবি/ভিডিও পাওয়া যায়নি। API response ও parameter পরীক্ষা করো।"
        );
      }

      react(api, message, messageID, "✅");
    } catch (err) {
      console.error("[Tanvir143 | genx]", err.message);
      react(api, message, messageID, "❌");

      return message.reply(`❌ Generation ব্যর্থ: ${err.message}`);
    }
  }
};
