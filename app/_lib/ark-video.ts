const ARK_API_BASE =
  "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";

export const ARK_MODEL_ID = "doubao-seedance-2-5-260628";

const ALLOWED_RATIOS = new Set([
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
  "21:9",
  "adaptive",
]);

const TASK_ID_PATTERN = /^cgt-[A-Za-z0-9-]{4,160}$/;

export type ArkTaskStatus =
  | "queued"
  | "running"
  | "cancelled"
  | "succeeded"
  | "failed"
  | "expired"
  | "unknown";

export type CreateArkTaskInput = {
  prompt: string;
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  ratio: string;
  duration: number;
  generateAudio: boolean;
};

type ArkReferenceContent =
  | {
      type: "image_url";
      image_url: { url: string };
      role: "reference_image";
    }
  | {
      type: "video_url";
      video_url: { url: string };
      role: "reference_video";
    }
  | {
      type: "audio_url";
      audio_url: { url: string };
      role: "reference_audio";
    };

export type ArkTaskView = {
  id: string;
  model: string | null;
  status: ArkTaskStatus;
  error: { code: string | null; message: string } | null;
  videoUrl: string | null;
  lastFrameUrl: string | null;
  fileUrl: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  duration: number | null;
  ratio: string | null;
  resolution: string | null;
  generateAudio: boolean | null;
};

export class ArkRouteError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ArkRouteError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeHttpsUrl(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ArkRouteError(400, "INVALID_REFERENCE_URL", `${label}不能为空。`);
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ArkRouteError(
      400,
      "INVALID_REFERENCE_URL",
      `${label}不是有效网址。`,
    );
  }

  if (url.protocol !== "https:") {
    throw new ArkRouteError(
      400,
      "INVALID_REFERENCE_URL",
      `${label}必须使用 HTTPS 公网地址。`,
    );
  }

  return url.href;
}

function normalizeUrlList(
  value: unknown,
  label: string,
  maximum: number,
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new ArkRouteError(400, "INVALID_REQUEST", `${label}格式不正确。`);
  }

  const nonEmpty = value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
  if (nonEmpty.length > maximum) {
    throw new ArkRouteError(
      400,
      "TOO_MANY_REFERENCES",
      `${label}最多支持 ${maximum} 个。`,
    );
  }

  return nonEmpty.map((item, index) =>
    normalizeHttpsUrl(item, `${label}${index + 1}`),
  );
}

export function parseCreateArkTaskInput(value: unknown): CreateArkTaskInput {
  if (!isRecord(value)) {
    throw new ArkRouteError(400, "INVALID_REQUEST", "请求内容格式不正确。");
  }

  const prompt = typeof value.prompt === "string" ? value.prompt.trim() : "";
  if (!prompt) {
    throw new ArkRouteError(400, "PROMPT_REQUIRED", "请填写视频生成提示词。");
  }
  if (prompt.length > 12_000) {
    throw new ArkRouteError(
      400,
      "PROMPT_TOO_LONG",
      "视频生成提示词不能超过 12000 个字符。",
    );
  }

  const ratio = typeof value.ratio === "string" ? value.ratio : "16:9";
  if (!ALLOWED_RATIOS.has(ratio)) {
    throw new ArkRouteError(400, "INVALID_RATIO", "视频比例不受支持。");
  }

  const duration =
    typeof value.duration === "number"
      ? value.duration
      : Number(value.duration);
  if (!Number.isInteger(duration) || duration < 4 || duration > 30) {
    throw new ArkRouteError(
      400,
      "INVALID_DURATION",
      "视频时长必须是 4–30 秒之间的整数。",
    );
  }

  const imageUrls = normalizeUrlList(value.imageUrls, "参考图片", 9);
  if (prompt.includes("@产品图") && imageUrls.length === 0) {
    throw new ArkRouteError(
      400,
      "PRODUCT_IMAGE_REQUIRED",
      "提示词包含 @产品图，请先填写至少一个参考图片 HTTPS 地址。",
    );
  }

  return {
    prompt,
    imageUrls,
    videoUrls: normalizeUrlList(value.videoUrls, "参考视频", 3),
    audioUrls: normalizeUrlList(value.audioUrls, "参考音频", 3),
    ratio,
    duration,
    generateAudio:
      typeof value.generateAudio === "boolean" ? value.generateAudio : true,
  };
}

export function isArkConfigured(): boolean {
  return Boolean(process.env.ARK_API_KEY?.trim());
}

export function validateArkTaskId(value: string): string {
  if (!TASK_ID_PATTERN.test(value)) {
    throw new ArkRouteError(400, "INVALID_TASK_ID", "视频任务 ID 格式不正确。");
  }
  return value;
}

function getArkApiKey(): string {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    throw new ArkRouteError(
      503,
      "ARK_API_KEY_NOT_CONFIGURED",
      "视频生成服务尚未配置，请联系管理员。",
    );
  }
  return apiKey;
}

function readUpstreamError(payload: unknown): {
  code: string;
  message: string;
} {
  if (isRecord(payload)) {
    const nested = isRecord(payload.error) ? payload.error : null;
    const code =
      asString(nested?.code) ?? asString(payload.code) ?? "ARK_UPSTREAM_ERROR";
    const message =
      asString(nested?.message) ??
      asString(payload.message) ??
      "火山方舟暂时无法处理该请求。";
    return { code, message };
  }
  return { code: "ARK_UPSTREAM_ERROR", message: "火山方舟返回了未知错误。" };
}

async function arkFetch(path: string, init: RequestInit): Promise<unknown> {
  const response = await globalThis.fetch(`${ARK_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getArkApiKey()}`,
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const upstream = readUpstreamError(payload);
    throw new ArkRouteError(
      response.status >= 400 && response.status < 500 ? response.status : 502,
      upstream.code,
      upstream.message,
    );
  }
  return payload;
}

function referenceContent(input: CreateArkTaskInput): ArkReferenceContent[] {
  return [
    ...input.imageUrls.map(
      (url): ArkReferenceContent => ({
        type: "image_url",
        image_url: { url },
        role: "reference_image",
      }),
    ),
    ...input.videoUrls.map(
      (url): ArkReferenceContent => ({
        type: "video_url",
        video_url: { url },
        role: "reference_video",
      }),
    ),
    ...input.audioUrls.map(
      (url): ArkReferenceContent => ({
        type: "audio_url",
        audio_url: { url },
        role: "reference_audio",
      }),
    ),
  ];
}

export async function createArkTask(
  input: CreateArkTaskInput,
): Promise<{ id: string }> {
  const references = referenceContent(input);
  const payload = await arkFetch("", {
    method: "POST",
    body: JSON.stringify({
      model: ARK_MODEL_ID,
      content: [{ type: "text", text: input.prompt }, ...references],
      ...(references.length > 0
        ? { omni_reference_task_type: "reference" }
        : {}),
      resolution: "720p",
      ratio: input.ratio,
      duration: input.duration,
      generate_audio: input.generateAudio,
      watermark: false,
      output_format: "mp4",
      return_last_frame: false,
      service_tier: "default",
      execution_expires_after: 7_200,
    }),
  });

  const id = isRecord(payload) ? asString(payload.id) : null;
  if (!id) {
    throw new ArkRouteError(
      502,
      "ARK_INVALID_RESPONSE",
      "火山方舟没有返回视频任务 ID。",
    );
  }
  return { id };
}

function normalizeStatus(value: unknown): ArkTaskStatus {
  switch (value) {
    case "queued":
    case "running":
    case "cancelled":
    case "succeeded":
    case "failed":
    case "expired":
      return value;
    default:
      return "unknown";
  }
}

export async function getArkTask(taskId: string): Promise<ArkTaskView> {
  const id = validateArkTaskId(taskId);
  const payload = await arkFetch(`/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  if (!isRecord(payload)) {
    throw new ArkRouteError(
      502,
      "ARK_INVALID_RESPONSE",
      "火山方舟返回了无法识别的任务信息。",
    );
  }

  const content = isRecord(payload.content) ? payload.content : null;
  const error = isRecord(payload.error) ? payload.error : null;

  return {
    id: asString(payload.id) ?? id,
    model: asString(payload.model),
    status: normalizeStatus(payload.status),
    error: error
      ? {
          code: asString(error.code),
          message: asString(error.message) ?? "视频生成失败。",
        }
      : null,
    videoUrl: asString(content?.video_url),
    lastFrameUrl: asString(content?.last_frame_url),
    fileUrl: asString(content?.file_url),
    createdAt: asNumber(payload.created_at),
    updatedAt: asNumber(payload.updated_at),
    duration: asNumber(payload.duration),
    ratio: asString(payload.ratio),
    resolution: asString(payload.resolution),
    generateAudio:
      typeof payload.generate_audio === "boolean"
        ? payload.generate_audio
        : null,
  };
}

export function arkErrorResponse(error: unknown): Response {
  if (error instanceof ArkRouteError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const message =
    error instanceof Error && error.name === "TimeoutError"
      ? "连接火山方舟超时，请稍后重试。"
      : "视频生成服务暂时不可用，请稍后重试。";
  return Response.json(
    { error: { code: "ARK_PROXY_ERROR", message } },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}
