"use client";

import { useEffect, useState } from "react";

const MODEL_ID = "doubao-seedance-2-5-260628";
const STORAGE_KEY = "boomlab:ark-video-task-id";

type TaskStatus =
  | "queued"
  | "running"
  | "cancelled"
  | "succeeded"
  | "failed"
  | "expired"
  | "unknown";

type TaskView = {
  id: string;
  model: string | null;
  status: TaskStatus;
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

type ServiceConfig = {
  configured: boolean;
  arkConfigured: boolean;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: "排队中",
  running: "生成中",
  cancelled: "已取消",
  succeeded: "生成完成",
  failed: "生成失败",
  expired: "任务超时",
  unknown: "等待状态",
};

const TERMINAL_STATUSES = new Set<TaskStatus>([
  "cancelled",
  "succeeded",
  "failed",
  "expired",
]);

function promptFingerprint(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function readError(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

export default function ArkVideoGenerator({
  defaultPrompt,
  productImage,
  sourceRatio,
  sourceDurationSeconds,
}: {
  defaultPrompt: string;
  productImage: File | null;
  sourceRatio: string;
  sourceDurationSeconds: number;
}) {
  const duration = Math.max(4, Math.min(30, Math.round(sourceDurationSeconds)));
  const storageKey = `${STORAGE_KEY}:${promptFingerprint(
    `${defaultPrompt}|${sourceRatio}|${duration}`,
  )}`;
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [task, setTask] = useState<TaskView | null>(null);
  const [config, setConfig] = useState<ServiceConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    fetch("/api/seedance/config", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (
          !response.ok ||
          typeof payload !== "object" ||
          payload === null ||
          !("configured" in payload)
        ) {
          throw new Error("无法读取视频服务配置。");
        }
        return payload as ServiceConfig;
      })
      .then((nextConfig) => {
        if (!disposed) setConfig(nextConfig);
      })
      .catch(() => {
        if (!disposed) {
          setConfig({
            configured: false,
            arkConfigured: false,
          });
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const storedTaskId = window.localStorage.getItem(storageKey);
      window.localStorage.removeItem(STORAGE_KEY);
      if (storedTaskId) setTaskId(storedTaskId);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [storageKey]);

  useEffect(() => {
    if (!taskId) return;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const poll = async () => {
      if (disposed) return;
      attempts += 1;

      try {
        const response = await fetch(
          `/api/seedance/tasks/${encodeURIComponent(taskId)}`,
          { cache: "no-store" },
        );
        const payload: unknown = await response.json();
        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            window.localStorage.removeItem(storageKey);
            setTaskId(null);
            setTask(null);
            setError("该视频任务已不存在或已过期，可以重新创建任务。");
            return;
          }
          throw new Error(readError(payload, "查询视频任务失败。"));
        }

        const nextTask = payload as TaskView;
        if (disposed) return;
        setTask(nextTask);
        setError("");

        if (TERMINAL_STATUSES.has(nextTask.status)) return;
      } catch (pollError) {
        if (disposed) return;
        setError(
          pollError instanceof Error
            ? pollError.message
            : "查询视频任务失败，请稍后重试。",
        );
      }

      if (attempts >= 240) {
        setError("页面轮询已暂停；可以保留任务 ID 稍后查看，或清除后重新创建。");
        return;
      }

      timer = setTimeout(poll, 10_000);
    };

    timer = setTimeout(poll, 1_200);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [storageKey, taskId]);

  const clearTask = () => {
    window.localStorage.removeItem(storageKey);
    setTaskId(null);
    setTask(null);
    setError("");
  };

  const submit = async () => {
    if (!config?.arkConfigured) {
      setError("服务端尚未配置火山方舟 ARK_API_KEY，暂时不能创建任务。");
      return;
    }
    if (!productImage) {
      setError("请先在上传素材步骤添加产品白底图。");
      return;
    }

    setSubmitting(true);
    setError("");
    setTask(null);
    setTaskId(null);
    window.localStorage.removeItem(storageKey);

    try {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("productImage", productImage);
      form.append("ratio", sourceRatio);
      form.append("duration", String(duration));
      form.append("generateAudio", String(generateAudio));
      const response = await fetch("/api/seedance/tasks", {
        method: "POST",
        body: form,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(readError(payload, "创建视频任务失败。"));
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("id" in payload) ||
        typeof payload.id !== "string"
      ) {
        throw new Error("视频服务没有返回任务 ID。");
      }

      const createdTask: TaskView = {
        id: payload.id,
        model: MODEL_ID,
        status: "queued",
        error: null,
        videoUrl: null,
        lastFrameUrl: null,
        fileUrl: null,
        createdAt: null,
        updatedAt: null,
        duration,
        ratio: sourceRatio,
        resolution: "720p",
        generateAudio,
      };
      setTask(createdTask);
      setTaskId(payload.id);
      window.localStorage.setItem(storageKey, payload.id);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "创建视频任务失败，请稍后重试。",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const active =
    task?.status === "queued" ||
    task?.status === "running" ||
    task?.status === "unknown";

  const connectionLabel =
    config === null
      ? "正在检测"
      : config.configured
        ? "火山方舟已连接"
        : "方舟 Key 待配置";

  return (
    <section className="card arkGenerator">
      <div className="arkHeading">
        <div>
          <em>VIDEO GENERATION</em>
          <h3>火山方舟 · Seedance 2.5</h3>
          <p>产品白底图由服务端编码后直接随提示词提交到火山方舟。</p>
        </div>
        <span
          className={`arkConnected ${config?.configured === false ? "arkDisconnected" : ""}`}
        >
          {connectionLabel}
        </span>
      </div>

      <div className="arkModelRow">
        <span>模型</span>
        <code>{MODEL_ID}</code>
      </div>

      <label className="arkPrompt">
        视频生成提示词
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={8}
        />
      </label>

      <div className="arkSourceSpecs">
        <div>
          <small>产品参考图</small>
          <b>{productImage?.name ?? "尚未上传"}</b>
          <span>{productImage ? "创建任务时直接提交到火山方舟" : "返回第 1 步添加产品白底图"}</span>
        </div>
        <div>
          <small>画面比例</small>
          <b>{sourceRatio}</b>
          <span>锁定参考原视频</span>
        </div>
        <div>
          <small>视频时长</small>
          <b>{duration} 秒</b>
          <span>锁定参考原视频</span>
        </div>
      </div>

      <label className="arkAudioToggle arkAudioControl">
        <input
          type="checkbox"
          checked={generateAudio}
          onChange={(event) => setGenerateAudio(event.target.checked)}
        />
        生成同步音频
      </label>

      <div className="arkSubmitRow">
        <div>
          <b>720p · MP4 · 无平台水印</b>
          <small>点击创建会调用方舟并产生模型费用。</small>
        </div>
        <button
          type="button"
          disabled={
            submitting ||
            active ||
            config?.configured !== true ||
            !productImage
          }
          onClick={submit}
        >
          {submitting
            ? "正在上传并创建任务…"
            : active && task
              ? STATUS_LABELS[task.status]
              : "创建视频任务 →"}
        </button>
      </div>

      {(task || error) && (
        <div className="arkTask" aria-live="polite">
          {task && (
            <div className="arkTaskMeta">
              <span className={`arkStatus arkStatus-${task.status}`}>
                {STATUS_LABELS[task.status]}
              </span>
              <div>
                <b>任务 ID</b>
                <code>{task.id}</code>
              </div>
              {task.resolution && (
                <small>
                  {task.resolution} · {task.ratio} · {task.duration} 秒
                </small>
              )}
            </div>
          )}

          {task && (
            <button type="button" className="arkClearTask" onClick={clearTask}>
              清除任务记录
            </button>
          )}

          {error && <p className="arkError">{error}</p>}
          {task?.error && <p className="arkError">{task.error.message}</p>}

          {task?.status === "succeeded" && task.videoUrl && (
            <div className="arkVideoResult">
              <video controls preload="metadata" src={task.videoUrl}>
                <track
                  kind="captions"
                  srcLang="zh-CN"
                  label="暂无独立字幕文件"
                  src="data:text/vtt;charset=utf-8,WEBVTT%0A%0A"
                />
              </video>
              <div>
                <b>视频已返回页面</b>
                <p>方舟结果链接可能过期，请及时保存原文件。</p>
                <a href={task.videoUrl} target="_blank" rel="noreferrer">
                  打开原始视频 ↗
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="arkSecurityNote">
        方舟 API Key 仅由服务端环境变量读取，不会进入浏览器或提交到仓库。
      </p>
    </section>
  );
}
