"use client";

import { useEffect, useState } from "react";

const MODEL_ID = "doubao-seedance-2-5-260628";
const STORAGE_KEY = "boomlab:ark-video-task-id";

const SAMPLE_PROMPT =
  "全程使用视频1的第一视角构图，全程使用音频1作为背景音乐。第一人称视角果茶宣传广告，seedance牌「苹苹安安」苹果果茶限定款；首帧为图片1，你的手摘下一颗带晨露的阿克苏红苹果，轻脆的苹果碰撞声；2-4 秒：快速切镜，你的手将苹果块投入雪克杯，加入冰块与茶底，用力摇晃，冰块碰撞声与摇晃声卡点轻快鼓点，背景音：「鲜切现摇」；4-6 秒：第一人称成品特写，分层果茶倒入透明杯，你的手轻挤奶盖在顶部铺展，在杯身贴上粉红包标，镜头拉近看奶盖与果茶的分层纹理；6-8 秒：第一人称手持举杯，你将图片2中的果茶举到镜头前（模拟递到观众面前的视角），杯身标签清晰可见，背景音「来一口鲜爽」，尾帧定格为图片2。背景声音统一为女生音色。";

const SAMPLE_REFERENCES = {
  images: [
    "https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic1.jpg",
    "https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic2.jpg",
  ],
  video:
    "https://ark-project.tos-cn-beijing.volces.com/doc_video/r2v_tea_video1.mp4",
  audio:
    "https://ark-project.tos-cn-beijing.volces.com/doc_audio/r2v_tea_audio1.mp3",
};

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
}: {
  defaultPrompt: string;
}) {
  const storageKey = `${STORAGE_KEY}:${promptFingerprint(defaultPrompt)}`;
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [imageUrls, setImageUrls] = useState(["", ""]);
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [ratio, setRatio] = useState("16:9");
  const [duration, setDuration] = useState(15);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [task, setTask] = useState<TaskView | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    fetch("/api/seedance/config", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        return (
          response.ok &&
          typeof payload === "object" &&
          payload !== null &&
          "configured" in payload &&
          payload.configured === true
        );
      })
      .then((isConfigured) => {
        if (!disposed) setConfigured(isConfigured);
      })
      .catch(() => {
        if (!disposed) setConfigured(false);
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
        setError(
          "页面轮询已暂停；可以保留任务 ID 稍后查看，或清除后重新创建。",
        );
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

  const loadOfficialSample = () => {
    setPrompt(SAMPLE_PROMPT);
    setImageUrls(SAMPLE_REFERENCES.images);
    setVideoUrl(SAMPLE_REFERENCES.video);
    setAudioUrl(SAMPLE_REFERENCES.audio);
    setRatio("16:9");
    setDuration(11);
    setGenerateAudio(true);
    setError("");
  };

  const updateImageUrl = (index: number, value: string) => {
    setImageUrls((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  const submit = async () => {
    if (configured !== true) {
      setError("服务端尚未配置视频生成密钥，暂时不能创建任务。");
      return;
    }
    if (
      prompt.includes("@产品图") &&
      !imageUrls.some((url) => Boolean(url.trim()))
    ) {
      setError("提示词包含 @产品图，请先填写至少一个参考图片 HTTPS 地址。");
      return;
    }

    setSubmitting(true);
    setError("");
    setTask(null);
    setTaskId(null);
    window.localStorage.removeItem(storageKey);

    try {
      const response = await fetch("/api/seedance/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          imageUrls,
          videoUrls: [videoUrl],
          audioUrls: [audioUrl],
          ratio,
          duration,
          generateAudio,
        }),
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
        ratio,
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

  return (
    <section className="card arkGenerator">
      <div className="arkHeading">
        <div>
          <em>VIDEO GENERATION</em>
          <h3>火山方舟 · Seedance 2.5</h3>
          <p>
            服务端安全提交任务，页面每 10 秒查询一次；完成后会直接在这里播放。
          </p>
        </div>
        <span
          className={`arkConnected ${configured === false ? "arkDisconnected" : ""}`}
        >
          {configured === null
            ? "正在检测"
            : configured
              ? "服务端已连接"
              : "服务端待配置"}
        </span>
      </div>

      <div className="arkModelRow">
        <span>模型</span>
        <code>{MODEL_ID}</code>
        <button type="button" onClick={loadOfficialSample}>
          载入官方示例
        </button>
      </div>

      <label className="arkPrompt">
        视频生成提示词
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={8}
        />
      </label>

      <details className="arkReferences" open>
        <summary>参考素材 URL</summary>
        <p>方舟必须能访问 HTTPS 公网地址；此前在本机选择的文件不会自动上传。</p>
        <div className="arkReferenceGrid">
          {imageUrls.map((value, index) => (
            <label key={`image-${index}`}>
              图片 {index + 1}
              <input
                type="url"
                value={value}
                onChange={(event) => updateImageUrl(index, event.target.value)}
                placeholder="https://…/product.jpg"
              />
            </label>
          ))}
          <label>
            参考视频 1
            <input
              type="url"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="https://…/reference.mp4"
            />
          </label>
          <label>
            参考音频 1
            <input
              type="url"
              value={audioUrl}
              onChange={(event) => setAudioUrl(event.target.value)}
              placeholder="https://…/music.mp3"
            />
          </label>
        </div>
      </details>

      <div className="arkOptions">
        <label>
          画面比例
          <select
            value={ratio}
            onChange={(event) => setRatio(event.target.value)}
          >
            <option value="16:9">16:9 横屏</option>
            <option value="9:16">9:16 竖屏</option>
            <option value="1:1">1:1 方形</option>
            <option value="4:3">4:3</option>
            <option value="3:4">3:4</option>
            <option value="21:9">21:9</option>
            <option value="adaptive">自动适配</option>
          </select>
        </label>
        <label>
          视频时长
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          >
            {[4, 5, 6, 8, 10, 11, 12, 15, 20, 25, 30].map((seconds) => (
              <option value={seconds} key={seconds}>
                {seconds} 秒
              </option>
            ))}
          </select>
        </label>
        <label className="arkAudioToggle">
          <input
            type="checkbox"
            checked={generateAudio}
            onChange={(event) => setGenerateAudio(event.target.checked)}
          />
          生成同步音频
        </label>
      </div>

      <div className="arkSubmitRow">
        <div>
          <b>720p · MP4 · 无平台水印</b>
          <small>点击创建会调用方舟并产生模型费用。</small>
        </div>
        <button
          type="button"
          disabled={submitting || active || configured !== true}
          onClick={submit}
        >
          {submitting
            ? "正在创建任务…"
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
        API Key 仅由服务端环境变量读取，不会进入浏览器或提交到仓库。
      </p>
    </section>
  );
}
