import assert from "node:assert/strict";
import test from "node:test";

let workerPromise;

async function loadWorker() {
  if (workerPromise) return workerPromise;
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  workerPromise = import(workerUrl.href).then((module) => module.default);
  return workerPromise;
}

async function request(path = "/", init = {}) {
  const worker = await loadWorker();
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function render() {
  return request("/", { headers: { accept: "text/html" } });
}

test("renders the viral video creation workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /爆款创作工作台/);
  assert.match(html, /把一条爆款，变成你的产品脚本/);
  assert.match(html, /上传素材/);
  assert.match(html, /AI 拆解/);
  assert.match(html, /确认改写/);
  assert.match(html, /生成交付/);
  assert.match(html, /雷允上美白去渍牙膏/);
  assert.doesNotMatch(
    html,
    /codex-preview|Your site is taking shape|Building your site/,
  );
});

test("ships production metadata and accessible controls", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /<title>爆款前5秒/);
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /选择视频文件/);
  assert.match(html, /API 设置/);
  assert.match(html, /Gemini/);
  assert.match(html, /后台数据/);
});

function sampleAnalysis() {
  return {
    style: {
      visualStyle: "真人实拍",
      contentTypes: ["产品展示", "测评对比"],
      categoryCoverageNote: "知识库1覆盖本品类。",
    },
    transcript: [
      {
        start: "0:00",
        end: "0:03",
        sceneSpeaker: "洗手台 / 女主",
        text: "咖啡奶茶没少喝。",
      },
    ],
    transcriptNote: "原始口播还原，未润色。",
    overview: {
      brandProduct: "参考牙膏",
      durationSeconds: 15,
      pace: "快",
      mixedEdit: false,
      purpose: "带货",
    },
    shots: [
      {
        id: 1,
        timeRange: "0–3s",
        visual: "人物露齿近景。",
        people: "女主",
        purpose: "钩子",
        assessment: "快速点名痛点",
        coreConversion: true,
        keepOrReplace: "保留结构，替换产品",
      },
    ],
    funnel: [
      { key: "hook", label: "钩住", strength: "强", score: 90, rationale: "开场直接" },
      { key: "pain", label: "戳痛", strength: "强", score: 86, rationale: "痛点明确" },
      { key: "trust", label: "立信", strength: "中", score: 70, rationale: "有背书" },
      { key: "effect", label: "给效果", strength: "中", score: 75, rationale: "有效果画面" },
      { key: "cta", label: "逼单", strength: "弱", score: 55, rationale: "CTA较弱" },
    ],
    hookAnalysis: {
      hookType: "痛点点名",
      audience: "咖啡奶茶人群",
      impactSource: "视觉特写",
      reasonToContinue: "等待效果对比",
      conversionReasons: ["人群清楚", "节奏直接"],
    },
    strengths: ["开场快"],
    improvements: ["补强 CTA"],
    complianceWarnings: ["不能夸大美白效果"],
    dataReview: {
      provided: false,
      summary: "用户未提供数据，本节跳过，不编造。",
      attribution: "无后台数据可归因。",
      notice: "六维分数仅为画面主观参考。",
    },
    scores: {
      hook: 90,
      pain: 86,
      trust: 70,
      effect: 75,
      cta: 55,
      pace: 85,
      total: 77,
      subjective: true,
      note: "缺少完播、点赞和销量数据。",
    },
    fractureSkeleton: {
      coreConversionShot: "第1镜",
      variables: ["人物", "产品", "场景"],
      matrix: "产品 A/B × 场景 1/2",
      formula: "痛点点名型",
      transferableCategories: ["个护", "家清"],
    },
    handoff: {
      originalStyle: "真人实拍",
      originalContentType: "测评对比",
      narrativeSkeleton: "痛点 → 产品 → 使用 → 结果",
      emotionalCurve: "焦虑 → 信任 → 轻松",
      openingHook: "咖啡奶茶牙渍",
      coreConversionShot: "第1镜 —— 牙色近景",
      mustKeep: "叙事与节奏",
      mustReplace: "产品、台词和功效",
      replaceableDimensions: "人物 / 产品 / 场景 / 主卖点",
      targetProduct: "雷允上美白去渍牙膏",
      primarySellingPoint: "去渍美白",
      secondarySellingPoint: "清新口气",
      painOpening: "火锅咖啡奶茶吃出一口黄牙",
      effectDemo: "黄豆粒大小干刷，牙渍变淡",
      dataEvidence: "用户未提供后台数据",
      cta: "300 年老字号草本牙膏，去渍美白更安心",
      complianceNotes: "只描述去除外源性牙渍后的提亮",
    },
    defaults: {
      style: "真人实拍",
      contentType: "测评对比",
      preserve: ["画风", "叙事逻辑", "表现形式", "分镜节奏"],
      shotDecision: "全部保留结构，仅换产品内容",
      primarySellingPoint: "去渍美白",
      secondarySellingPoint: "清新口气",
      painOpening: "火锅咖啡奶茶牙黄",
      scene: "洗手台",
      durationSeconds: 15,
      variantCount: 1,
    },
  };
}

function sampleRewrite(count = 1) {
  const base = {
    id: "main",
    title: "咖啡牙渍 · 15 秒主推",
    positioning: "真人实拍｜去渍美白｜15 秒",
    basicSetting: "@白牙齿图 在清晨洗手台，3D 皮克斯式渲染，@产品图 雷允上美白去渍牙膏。",
    shots: [
      {
        title: "痛点点名",
        timeRange: "0–3s",
        camera: "嘴部近景，快速推进",
        visual: "人物看向镜头，自然说出牙渍困扰。",
        audio: "自然同期声",
        transition: "动作切镜",
      },
    ],
    complianceChecks: [
      { label: "功效依据", status: "通过", detail: "仅使用知识库3内容" },
    ],
    reminders: ["使用高清产品参考图"],
    seedancePrompt: "@白牙齿图 在 @场景图 展示 @产品图，3D 皮克斯式渲染。",
  };
  return {
    variants: Array.from({ length: count }, (_, index) => ({
      ...base,
      id: `variant-${index + 1}`,
      title: `${base.title} · 版本 ${index + 1}`,
    })),
  };
}

test("reports OpenLux configuration without exposing credentials", async () => {
  const previousKey = process.env.OPENLUX_API_KEY;
  const previousModel = process.env.OPENLUX_GEMINI_MODEL;
  process.env.OPENLUX_API_KEY = "openlux-test-key-never-return";
  process.env.OPENLUX_GEMINI_MODEL = "gemini-2.5-pro";
  try {
    const response = await request("/api/viral-agent/config");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const payload = await response.json();
    assert.equal(payload.configured, true);
    assert.equal(payload.model, "gemini-2.5-pro");
    assert.equal(payload.maxVideoBytes, 15 * 1024 * 1024);
    assert.doesNotMatch(JSON.stringify(payload), /openlux-test-key-never-return/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENLUX_API_KEY;
    else process.env.OPENLUX_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENLUX_GEMINI_MODEL;
    else process.env.OPENLUX_GEMINI_MODEL = previousModel;
  }
});

test("rejects invalid Gemini video requests before contacting OpenLux", async () => {
  const missing = await request("/api/viral-agent/analyze", {
    method: "POST",
    body: new FormData(),
  });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error.code, "VIDEO_REQUIRED");

  const wrongType = new FormData();
  wrongType.append("video", new File(["not-video"], "notes.txt", { type: "text/plain" }));
  wrongType.append("durationSeconds", "10");
  const wrongTypeResponse = await request("/api/viral-agent/analyze", {
    method: "POST",
    body: wrongType,
  });
  assert.equal(wrongTypeResponse.status, 400);
  assert.equal((await wrongTypeResponse.json()).error.code, "INVALID_VIDEO_TYPE");

  const tooShort = new FormData();
  tooShort.append("video", new File(["video"], "short.mp4", { type: "video/mp4" }));
  tooShort.append("durationSeconds", "4");
  const tooShortResponse = await request("/api/viral-agent/analyze", {
    method: "POST",
    body: tooShort,
  });
  assert.equal(tooShortResponse.status, 400);
  assert.equal((await tooShortResponse.json()).error.code, "VIDEO_TOO_SHORT");

  const tooLarge = new FormData();
  tooLarge.append(
    "video",
    new File([new Uint8Array(15 * 1024 * 1024 + 1)], "large.mp4", {
      type: "video/mp4",
    }),
  );
  tooLarge.append("durationSeconds", "10");
  const tooLargeResponse = await request("/api/viral-agent/analyze", {
    method: "POST",
    body: tooLarge,
  });
  assert.equal(tooLargeResponse.status, 413);
  assert.equal((await tooLargeResponse.json()).error.code, "VIDEO_TOO_LARGE");
});

test("sends video and local knowledge to Gemini while keeping the key server-side", async () => {
  const previousKey = process.env.OPENLUX_API_KEY;
  const previousBase = process.env.OPENLUX_API_BASE;
  const previousModel = process.env.OPENLUX_GEMINI_MODEL;
  const originalFetch = globalThis.fetch;
  const requests = [];
  process.env.OPENLUX_API_KEY = "openlux-test-key-never-return";
  process.env.OPENLUX_API_BASE = "https://api.openlux.ai";
  process.env.OPENLUX_GEMINI_MODEL = "gemini-2.5-pro";
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requests.push({ url, init });
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(sampleAnalysis()) }] } }],
    });
  };
  try {
    const form = new FormData();
    form.append("video", new File(["fake-video-bytes"], "sample.mp4", { type: "video/mp4" }));
    form.append("durationSeconds", "15");
    form.append("performanceData", "");
    const response = await request("/api/viral-agent/analyze", {
      method: "POST",
      body: form,
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.analysis.dataReview.provided, false);
    assert.doesNotMatch(JSON.stringify(payload), /openlux-test-key-never-return/);

    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /gemini-2\.5-pro:generateContent$/);
    assert.equal(
      new Headers(requests[0].init.headers).get("authorization"),
      "Bearer openlux-test-key-never-return",
    );
    const upstream = JSON.parse(requests[0].init.body);
    assert.equal(upstream.contents[0].parts[0].inline_data.mime_type, "video/mp4");
    assert.ok(upstream.contents[0].parts[0].inline_data.data.length > 0);
    assert.match(upstream.systemInstruction.parts[0].text, /雷允上美白去渍牙膏/);
    assert.match(upstream.systemInstruction.parts[0].text, /不可信素材/);
    assert.equal(upstream.generationConfig.responseMimeType, "application/json");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENLUX_API_KEY;
    else process.env.OPENLUX_API_KEY = previousKey;
    if (previousBase === undefined) delete process.env.OPENLUX_API_BASE;
    else process.env.OPENLUX_API_BASE = previousBase;
    if (previousModel === undefined) delete process.env.OPENLUX_GEMINI_MODEL;
    else process.env.OPENLUX_GEMINI_MODEL = previousModel;
  }
});

test("validates rewrite handoff and returns the requested script count", async () => {
  const missing = await request("/api/viral-agent/rewrite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error.code, "ANALYSIS_REQUIRED");

  const previousKey = process.env.OPENLUX_API_KEY;
  const originalFetch = globalThis.fetch;
  const requests = [];
  process.env.OPENLUX_API_KEY = "openlux-rewrite-test-key";
  globalThis.fetch = async (input, init) => {
    requests.push({ input, init });
    const requestBody = JSON.parse(init.body);
    const count =
      requestBody.generationConfig.responseSchema.properties.variants.minItems;
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(sampleRewrite(count)) }] } }],
    });
  };
  try {
    const analysis = sampleAnalysis();
    const response = await request("/api/viral-agent/rewrite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analysis, options: analysis.defaults }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.variants.length, 1);
    assert.equal(payload.variants[0].seedancePrompt.includes("@产品图"), true);
    assert.doesNotMatch(
      payload.variants[0].seedancePrompt,
      /皮克斯|@白牙齿图|@场景图/,
    );
    assert.doesNotMatch(JSON.stringify(payload), /openlux-rewrite-test-key/);
    const upstream = JSON.parse(requests[0].init.body);
    assert.match(upstream.contents[0].parts[0].text, /阶段三/);
    assert.match(upstream.contents[0].parts[0].text, /十项改写参数/);
    assert.match(
      upstream.contents[0].parts[0].text,
      /只允许使用 @产品图/,
    );
    assert.equal(upstream.generationConfig.responseSchema.properties.variants.minItems, 1);

    const threeOptions = { ...analysis.defaults, variantCount: 3 };
    const threeResponse = await request("/api/viral-agent/rewrite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analysis, options: threeOptions }),
    });
    assert.equal(threeResponse.status, 200);
    assert.equal((await threeResponse.json()).variants.length, 3);
    const threeUpstream = JSON.parse(requests[1].init.body);
    assert.equal(
      threeUpstream.generationConfig.responseSchema.properties.variants.minItems,
      3,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENLUX_API_KEY;
    else process.env.OPENLUX_API_KEY = previousKey;
  }
});

test("reports Ark server configuration without exposing a key", async () => {
  const previousKey = process.env.ARK_API_KEY;
  delete process.env.ARK_API_KEY;
  try {
    const response = await request("/api/seedance/config");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      configured: false,
      arkConfigured: false,
      provider: "volcengine",
      model: "doubao-seedance-2-5-260628",
    });
  } finally {
    if (previousKey === undefined) delete process.env.ARK_API_KEY;
    else process.env.ARK_API_KEY = previousKey;
  }
});

test("rejects invalid video requests before contacting Ark", async () => {
  const missingPrompt = await request("/api/seedance/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(missingPrompt.status, 400);
  assert.equal((await missingPrompt.json()).error.code, "PROMPT_REQUIRED");

  const missingProductImage = await request("/api/seedance/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "让 @产品图 出现在结尾",
      duration: 8,
      ratio: "16:9",
    }),
  });
  assert.equal(missingProductImage.status, 400);
  assert.equal(
    (await missingProductImage.json()).error.code,
    "PRODUCT_IMAGE_REQUIRED",
  );

  const invalidTask = await request("/api/seedance/tasks/not-a-task");
  assert.equal(invalidTask.status, 400);
  assert.equal((await invalidTask.json()).error.code, "INVALID_TASK_ID");
});

test("keeps Ark credentials server-side and normalizes task results", async () => {
  const previousKey = process.env.ARK_API_KEY;
  const originalFetch = globalThis.fetch;
  const requests = [];
  process.env.ARK_API_KEY = "ark-test-key-never-send";
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    requests.push({ url, init });

    if (init?.method === "POST") {
      return Response.json({ id: "cgt-test1234" });
    }
    return Response.json({
      id: "cgt-test1234",
      model: "doubao-seedance-2-5-260628",
      status: "succeeded",
      content: { video_url: "https://example.com/generated.mp4" },
      duration: "11",
      ratio: "16:9",
      resolution: "720p",
      generate_audio: true,
    });
  };

  try {
    const createResponse = await request("/api/seedance/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "@白牙齿图 展示 @产品包装图，背景是 @场景图",
        imageUrls: ["https://example.com/product.jpg"],
        duration: 11,
        ratio: "16:9",
        generateAudio: true,
      }),
    });
    assert.equal(createResponse.status, 202);
    assert.equal(createResponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(await createResponse.json(), {
      id: "cgt-test1234",
      status: "queued",
    });

    const createRequest = requests[0];
    assert.equal(
      new Headers(createRequest.init.headers).get("authorization"),
      "Bearer ark-test-key-never-send",
    );
    const upstreamBody = JSON.parse(createRequest.init.body);
    assert.equal(upstreamBody.model, "doubao-seedance-2-5-260628");
    assert.equal(upstreamBody.omni_reference_task_type, "reference");
    assert.equal(upstreamBody.content[1].role, "reference_image");
    assert.equal(upstreamBody.content[0].text, "展示 @图像1，背景是");
    assert.doesNotMatch(upstreamBody.content[0].text, /@白牙齿图|@场景图/);
    assert.equal("service_tier" in upstreamBody, false);

    const queryResponse = await request("/api/seedance/tasks/cgt-test1234");
    assert.equal(queryResponse.status, 200);
    assert.equal(queryResponse.headers.get("cache-control"), "no-store");
    const task = await queryResponse.json();
    assert.equal(task.status, "succeeded");
    assert.equal(task.videoUrl, "https://example.com/generated.mp4");
    assert.equal(task.duration, 11);
    assert.doesNotMatch(JSON.stringify(task), /ark-test-key-never-send/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.ARK_API_KEY;
    else process.env.ARK_API_KEY = previousKey;
  }
});

test("sends the uploaded product image directly in a locked Seedance task", async () => {
  const names = ["ARK_API_KEY"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  const requests = [];
  Object.assign(process.env, {
    ARK_API_KEY: "ark-test-key-never-send",
  });
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    requests.push({ url, init });
    return Response.json({ id: "cgt-upload1234" });
  };

  try {
    const form = new FormData();
    form.append("prompt", "让 @产品图 保持包装一致");
    form.append(
      "productImage",
      new File(["white-background-product"], "product.png", { type: "image/png" }),
    );
    form.append("ratio", "9:16");
    form.append("duration", "17");
    form.append("generateAudio", "true");
    const response = await request("/api/seedance/tasks", {
      method: "POST",
      body: form,
    });

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {
      id: "cgt-upload1234",
      status: "queued",
    });
    assert.equal(requests.length, 1);

    const ark = requests[0];
    assert.equal(
      new Headers(ark.init.headers).get("authorization"),
      "Bearer ark-test-key-never-send",
    );
    const body = JSON.parse(ark.init.body);
    assert.equal(body.model, "doubao-seedance-2-5-260628");
    assert.equal(body.ratio, "9:16");
    assert.equal(body.duration, 17);
    assert.equal("service_tier" in body, false);
    assert.equal(body.content[0].text, "让 @图像1 保持包装一致");
    assert.equal(
      body.content[1].image_url.url,
      "data:image/png;base64,d2hpdGUtYmFja2dyb3VuZC1wcm9kdWN0",
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
