"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import ArkVideoGenerator from "./ArkVideoGenerator";
import type {
  AnalysisResult,
  RewriteOptions,
  RewriteResponse,
  RewriteVariant,
} from "./_lib/viral-agent-types";

const nav = ["新建创作", "历史项目", "知识库", "API 设置"];
const steps = ["上传素材", "AI 拆解", "确认改写", "生成交付"];
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

type ServiceConfig = {
  configured: boolean;
  arkConfigured?: boolean;
  provider?: string;
  model?: string;
  maxVideoBytes?: number;
  minVideoSeconds?: number;
};

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

function textFingerprint(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

type VideoMetadata = {
  duration: number;
  width: number;
  height: number;
  ratio: string;
};

const SUPPORTED_VIDEO_RATIOS = [
  ["21:9", 21 / 9],
  ["16:9", 16 / 9],
  ["4:3", 4 / 3],
  ["1:1", 1],
  ["3:4", 3 / 4],
  ["9:16", 9 / 16],
] as const;

function nearestVideoRatio(width: number, height: number): string {
  const actual = width / height;
  return SUPPORTED_VIDEO_RATIOS.reduce((best, candidate) =>
    Math.abs(Math.log(actual / candidate[1])) <
    Math.abs(Math.log(actual / best[1]))
      ? candidate
      : best,
  )[0];
}

function videoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      URL.revokeObjectURL(url);
      if (Number.isFinite(duration) && width > 0 && height > 0) {
        resolve({ duration, width, height, ratio: nearestVideoRatio(width, height) });
      }
      else reject(new Error("无法读取视频时长。"));
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取视频，请换一个 MP4、MOV 或 WebM 文件。"));
    };
    video.src = url;
  });
}

function formatVariant(variant: RewriteVariant): string {
  return [
    `【${variant.title}】`,
    `【脚本定位】\n${variant.positioning}`,
    `【基础设定】\n${variant.basicSetting}`,
    "【分镜脚本】",
    ...variant.shots.map(
      (shot, index) =>
        `镜${index + 1} · ${shot.title}（${shot.timeRange}）\n景别/机位/运镜：${shot.camera}\n画面：${shot.visual}\n音效：${shot.audio} ｜ 转场：${shot.transition}`,
    ),
    "【合规终检】",
    ...variant.complianceChecks.map(
      (check) => `${check.status === "通过" ? "✅" : "⚠️"} ${check.label}：${check.detail}`,
    ),
    "【出片提醒】",
    ...variant.reminders.map((item) => `- ${item}`),
  ].join("\n\n");
}

function optionsWithCurrent(current: string, options: string[]): string[] {
  return Array.from(new Set([current, ...options].filter(Boolean)));
}

export default function ViralWorkbench() {
  const [page, setPage] = useState(0);
  const [step, setStep] = useState(1);
  const [video, setVideo] = useState<File | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [videoRatio, setVideoRatio] = useState("16:9");
  const [images, setImages] = useState<File[]>([]);
  const [performanceData, setPerformanceData] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [options, setOptions] = useState<RewriteOptions | null>(null);
  const [result, setResult] = useState<RewriteResponse | null>(null);
  const [activeVariant, setActiveVariant] = useState(0);
  const [busy, setBusy] = useState<"analyze" | "rewrite" | "">("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [openLuxConfig, setOpenLuxConfig] = useState<ServiceConfig | null>(null);
  const [arkConfig, setArkConfig] = useState<ServiceConfig | null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let disposed = false;
    Promise.all([
      fetch("/api/viral-agent/config", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/seedance/config", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
    ])
      .then(([openLux, ark]) => {
        if (disposed) return;
        setOpenLuxConfig(openLux as ServiceConfig);
        setArkConfig(ark as ServiceConfig);
      })
      .catch(() => {
        if (!disposed) {
          setOpenLuxConfig({ configured: false });
          setArkConfig({ configured: false });
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const resetDownstream = () => {
    setAnalysis(null);
    setOptions(null);
    setResult(null);
    setActiveVariant(0);
    setStep(1);
  };

  const chooseVideo = async (file: File | null) => {
    setError("");
    resetDownstream();
    if (!file) {
      setVideo(null);
      setDurationSeconds(0);
      setVideoWidth(0);
      setVideoHeight(0);
      return;
    }
    if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) {
      setVideo(null);
      setError("仅支持 MP4、MOV 或 WebM 视频。");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setVideo(null);
      setError("视频不能超过 15MB，请先压缩后再上传。");
      return;
    }
    try {
      const metadata = await videoMetadata(file);
      const duration = metadata.duration;
      if (duration < 5) {
        setVideo(null);
        setDurationSeconds(0);
        setError("当前视频不足 5 秒，建议上传 10 秒以上视频。");
        return;
      }
      if (duration > 30) {
        setVideo(null);
        setDurationSeconds(0);
        setError("Seedance 2.5 最长生成 30 秒，请上传不超过 30 秒的原视频。");
        return;
      }
      setVideo(file);
      setDurationSeconds(duration);
      setVideoWidth(metadata.width);
      setVideoHeight(metadata.height);
      setVideoRatio(metadata.ratio);
    } catch (durationError) {
      setVideo(null);
      setDurationSeconds(0);
      setVideoWidth(0);
      setVideoHeight(0);
      setError(
        durationError instanceof Error
          ? durationError.message
          : "无法读取视频时长。",
      );
    }
  };

  const analyze = async () => {
    if (!video || durationSeconds < 5) return;
    setBusy("analyze");
    setError("");
    const form = new FormData();
    form.append("video", video);
    form.append("durationSeconds", String(durationSeconds));
    form.append("performanceData", performanceData);
    try {
      const response = await fetch("/api/viral-agent/analyze", {
        method: "POST",
        body: form,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(readError(payload, "Gemini 视频分析失败，请手动重试。"));
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("analysis" in payload)
      ) {
        throw new Error("Gemini 没有返回可用的分析结果。");
      }
      const nextAnalysis = payload.analysis as AnalysisResult;
      setAnalysis(nextAnalysis);
      setOptions({
        ...nextAnalysis.defaults,
        durationSeconds: Math.max(5, Math.min(30, Math.round(durationSeconds))),
      });
      setResult(null);
      setStep(2);
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Gemini 视频分析失败，请手动重试。",
      );
    } finally {
      setBusy("");
    }
  };

  const rewrite = async () => {
    if (!analysis || !options) return;
    setBusy("rewrite");
    setError("");
    try {
      const response = await fetch("/api/viral-agent/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, options }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(readError(payload, "Gemini 脚本改写失败，请手动重试。"));
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("variants" in payload) ||
        !Array.isArray(payload.variants)
      ) {
        throw new Error("Gemini 没有返回可用的分镜脚本。");
      }
      setResult(payload as RewriteResponse);
      setActiveVariant(0);
      setStep(4);
    } catch (rewriteError) {
      setError(
        rewriteError instanceof Error
          ? rewriteError.message
          : "Gemini 脚本改写失败，请手动重试。",
      );
    } finally {
      setBusy("");
    }
  };

  const copyActive = async () => {
    const variant = result?.variants[activeVariant];
    if (!variant) return;
    await navigator.clipboard.writeText(formatVariant(variant));
    notify("当前脚本已复制");
  };

  const downloadAll = () => {
    if (!result) return;
    const text = result.variants.map(formatVariant).join("\n\n====================\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "雷允上爆款视频改写脚本.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span>B</span>
          <div><b>BOOMLAB</b><small>爆款创作工作台</small></div>
        </div>
        <nav aria-label="主导航">
          {nav.map((item, index) => (
            <button
              type="button"
              key={item}
              className={page === index ? "active" : ""}
              onClick={() => setPage(index)}
            >
              <i>{["✦", "▱", "K", "⚙"][index]}</i>{item}
            </button>
          ))}
        </nav>
        <div className="sideBottom">
          <div className="kbMini"><span>K</span><div><b>4 份知识已连接</b><small>雷允上产品库</small></div></div>
          <div className="profile"><span>海</span><div><b>海尼创作团队</b><small>本地工作区</small></div></div>
        </div>
      </aside>
      <main className="main">
        <header className="top">
          <div><small>当前项目</small><b>雷允上 · 爆款改写</b></div>
          <span>✓ 结果仅保留在当前会话</span>
        </header>
        <div className="content">
          {page === 0 && (
            <>
              {step === 1 && (
                <UploadStep
                  video={video}
                  durationSeconds={durationSeconds}
                  videoWidth={videoWidth}
                  videoHeight={videoHeight}
                  videoRatio={videoRatio}
                  images={images}
                  performanceData={performanceData}
                  setImages={setImages}
                  setPerformanceData={setPerformanceData}
                  chooseVideo={chooseVideo}
                  videoRef={videoRef}
                  imageRef={imageRef}
                  busy={busy === "analyze"}
                  configured={openLuxConfig?.configured ?? null}
                  error={error}
                  analyze={analyze}
                />
              )}
              {step === 2 && analysis && (
                <AnalysisStep
                  analysis={analysis}
                  setStep={setStep}
                  clearError={() => setError("")}
                />
              )}
              {step === 3 && analysis && options && (
                <RewriteStep
                  analysis={analysis}
                  options={options}
                  setOptions={setOptions}
                  setStep={setStep}
                  rewrite={rewrite}
                  busy={busy === "rewrite"}
                  error={error}
                />
              )}
              {step === 4 && result && result.variants[activeVariant] && (
                <DeliveryStep
                  result={result}
                  activeVariant={activeVariant}
                  setActiveVariant={setActiveVariant}
                  setStep={setStep}
                  copyActive={copyActive}
                  downloadAll={downloadAll}
                  productImage={images[0] ?? null}
                  sourceRatio={videoRatio}
                  sourceDurationSeconds={durationSeconds}
                />
              )}
            </>
          )}
          {page === 1 && (
            <History
              analysis={analysis}
              result={result}
              onContinue={() => {
                setPage(0);
                setStep(result ? 4 : analysis ? 2 : 1);
              }}
            />
          )}
          {page === 2 && <Knowledge />}
          {page === 3 && (
            <Settings openLux={openLuxConfig} ark={arkConfig} />
          )}
        </div>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="steps">
      {steps.map((item, index) => (
        <div
          key={item}
          className={`${step === index + 1 ? "current" : ""} ${step > index + 1 ? "done" : ""}`}
        >
          <span>{step > index + 1 ? "✓" : index + 1}</span>
          <div><b>{item}</b><small>{["提供参考与产品", "提取爆点骨架", "选择卖点参数", "脚本与视频提示词"][index]}</small></div>
        </div>
      ))}
    </div>
  );
}

function Heading({ eyebrow, title, desc, badge }: { eyebrow: string; title: string; desc?: string; badge?: string }) {
  return (
    <div className="heading">
      <div><em>{eyebrow}</em><h1>{title}</h1>{desc && <p>{desc}</p>}</div>
      {badge && <span className="badge">● {badge}</span>}
    </div>
  );
}

function UploadStep({
  video,
  durationSeconds,
  videoWidth,
  videoHeight,
  videoRatio,
  images,
  performanceData,
  setImages,
  setPerformanceData,
  chooseVideo,
  videoRef,
  imageRef,
  busy,
  configured,
  error,
  analyze,
}: {
  video: File | null;
  durationSeconds: number;
  videoWidth: number;
  videoHeight: number;
  videoRatio: string;
  images: File[];
  performanceData: string;
  setImages: (files: File[]) => void;
  setPerformanceData: (value: string) => void;
  chooseVideo: (file: File | null) => Promise<void>;
  videoRef: RefObject<HTMLInputElement | null>;
  imageRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  configured: boolean | null;
  error: string;
  analyze: () => Promise<void>;
}) {
  return (
    <>
      <Heading
        eyebrow="NEW CREATION"
        title="把一条爆款，变成你的产品脚本"
        desc="上传参考视频，Gemini 会读取画面与声音，先拆结构，确认后再改写。"
        badge={configured === null ? "正在检测 Gemini" : configured ? "Gemini 已连接" : "Gemini 待配置"}
      />
      <Stepper step={1} />
      <div className="uploadGrid">
        <button type="button" className={`drop ${video ? "filled" : ""}`} onClick={() => videoRef.current?.click()}>
          <input
            ref={videoRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            hidden
            onChange={(event) => void chooseVideo(event.target.files?.[0] ?? null)}
          />
          <span>{video ? "▶" : "↑"}</span>
          <h2>{video ? video.name : "拖入一条爆款短视频"}</h2>
          <p>
            {video
              ? `${(video.size / 1024 / 1024).toFixed(1)} MB · ${videoWidth}×${videoHeight} · ${videoRatio} · ${durationSeconds.toFixed(1)} 秒`
              : "支持 MP4、MOV、WebM · 5–30 秒 · 最大 15MB"}
          </p>
          <strong>{video ? "重新选择视频" : "选择视频文件"}</strong>
        </button>
        <div className="sideCards">
          <section className="card">
            <div className="cardTitle"><div><em>PRODUCT ASSETS</em><h3>产品图片</h3></div><small>{images.length}/6</small></div>
            <p className="muted">第 1 张产品白底图会由服务端直接提交给 Seedance，并作为视频参考图。</p>
            <div className="imageList">
              {images.map((file, index) => (
                <div key={`${file.name}-${index}`} title={file.name}>
                  {file.name.slice(0, 7)}
                  <button type="button" aria-label={`移除 ${file.name}`} onClick={() => setImages(images.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                </div>
              ))}
              <button type="button" className="add" onClick={() => imageRef.current?.click()}>＋<small>添加图片</small></button>
              <input
                ref={imageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => setImages([...images, ...Array.from(event.target.files ?? [])].slice(0, 6))}
              />
            </div>
          </section>
          <section className="card knowledgeActive"><span>K</span><div><em>ACTIVE KNOWLEDGE</em><h3>雷允上美白去渍牙膏</h3><p>总指令 + 拆解库 + Seedance 库 + 产品库</p></div><b>已加载</b></section>
        </div>
      </div>
      <section className="card performanceCard">
        <div><em>OPTIONAL PERFORMANCE DATA</em><h3>后台数据（选填）</h3><p className="muted">有真实数据再填写；留空时 Gemini 会明确标注“未提供、不编造”。</p></div>
        <textarea
          value={performanceData}
          onChange={(event) => setPerformanceData(event.target.value.slice(0, 5000))}
          rows={3}
          placeholder="例如：3 秒完播 42%，5 秒完播 31%，点赞 1.2w，商品点击率 8%……"
        />
      </section>
      {error && <div className="agentError" role="alert">{error}</div>}
      <div className="bottomAction">
        <div><b>{busy ? "Gemini 正在完整观看视频" : "准备开始真实拆解"}</b><small>{busy ? "正在识别画面、声音、口播和时间码，请勿关闭页面" : "单次调用可能产生模型费用；失败不会自动重试"}</small></div>
        <button type="button" disabled={!video || busy || configured === false} onClick={() => void analyze()}>
          {busy ? "正在分析视频…" : "开始 Gemini 智能拆解 →"}
        </button>
      </div>
    </>
  );
}

function AnalysisStep({ analysis, setStep, clearError }: { analysis: AnalysisResult; setStep: (step: number) => void; clearError: () => void }) {
  const hook = analysis.hookAnalysis;
  return (
    <>
      <Heading eyebrow="VIDEO INTELLIGENCE" title="爆款结构拆解" desc="已按画面、声音和时间码完成阶段一，并生成改写交接单。" badge="Gemini 2.5 Pro" />
      <Stepper step={2} />
      <section className="summary">
        <div className="score"><b>{Math.round(analysis.scores.total)}</b><small>{analysis.scores.subjective ? "主观参考分" : "数据综合分"}</small></div>
        <div><em>STYLE & FORMAT</em><h2>{analysis.style.visualStyle} · {analysis.style.contentTypes.join(" · ")}</h2><p>{analysis.overview.durationSeconds.toFixed(1)} 秒 · {analysis.overview.pace} · {analysis.overview.mixedEdit ? "混剪" : "非混剪"} · {analysis.overview.purpose}</p></div>
        <div><small>前 3–5 秒钩子</small><p>{hook.hookType}：{hook.reasonToContinue}</p></div>
      </section>
      {analysis.style.categoryCoverageNote && <div className="notice"><b>品类覆盖</b>{analysis.style.categoryCoverageNote}</div>}
      <div className="twoCols">
        <section className="card"><h3>五环转化漏斗</h3>{analysis.funnel.map((item) => (
          <div className="metric" key={item.key}><div><b>{item.label} · {item.strength}</b><span>{Math.round(item.score)}</span></div><i><span style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }} /></i><p className="metricNote">{item.rationale}</p></div>
        ))}</section>
        <section className="card"><h3>为什么会爆</h3>{hook.conversionReasons.map((reason, index) => <div className="reason" key={`${reason}-${index}`}><b>0{index + 1}</b><p>{reason}</p></div>)}<div className="skeleton"><small>钩子证据</small><p>人群：{hook.audience}<br />冲击来源：{hook.impactSource}</p></div></section>
      </div>
      <section className="card agentSection"><div className="cardTitle"><h3>视频口播逐字稿</h3><small>{analysis.transcript.length} 段</small></div>{analysis.transcript.length ? analysis.transcript.map((segment, index) => (
        <div className="transcriptRow" key={`${segment.start}-${index}`}><strong>{segment.start}–{segment.end}</strong><small>{segment.sceneSpeaker}</small><p>{segment.text}</p></div>
      )) : <p className="muted">{analysis.transcriptNote}</p>}<p className="sourceNote">{analysis.transcriptNote}</p></section>
      <section className="card agentSection"><div className="cardTitle"><h3>全程分镜拆解</h3><small>{analysis.shots.length} 个镜头</small></div><div className="shotTable detailedShots">{analysis.shots.map((shot) => (
        <div key={`${shot.id}-${shot.timeRange}`}><b>{String(shot.id).padStart(2, "0")}</b><strong>{shot.timeRange}</strong><p><b className="shotPurpose">{shot.purpose}</b>{shot.visual}<small>{shot.people} · {shot.assessment}</small></p><span>{shot.coreConversion ? "核心转化" : shot.keepOrReplace}</span></div>
      ))}</div></section>
      <div className="twoCols">
        <section className="card"><h3>好在哪 / 怎么优化</h3><h4>有效点</h4>{analysis.strengths.map((item) => <p className="check" key={item}>✓ {item}</p>)}<h4>可优化</h4>{analysis.improvements.map((item) => <p className="reviewItem" key={item}>{item}</p>)}</section>
        <section className="card"><h3>数据复盘与合规</h3><p>{analysis.dataReview.summary}</p><p className="muted">{analysis.dataReview.attribution}</p><div className="skeleton"><small>数据说明</small><p>{analysis.dataReview.notice}</p></div>{analysis.complianceWarnings.map((item) => <p className="warningItem" key={item}>⚠️ {item}</p>)}</section>
      </div>
      <section className="card agentSection"><h3>裂变骨架</h3><div className="handoffGrid"><div><small>核心转化画面</small><p>{analysis.fractureSkeleton.coreConversionShot}</p></div><div><small>变量位</small><p>{analysis.fractureSkeleton.variables.join(" · ")}</p></div><div><small>裂变矩阵</small><p>{analysis.fractureSkeleton.matrix}</p></div><div><small>爆点公式</small><p>{analysis.fractureSkeleton.formula}</p></div></div></section>
      <div className="actions"><button type="button" className="secondary" onClick={() => { clearError(); setStep(1); }}>返回修改素材</button><button type="button" onClick={() => { clearError(); setStep(3); }}>确认拆解，进入改写 →</button></div>
    </>
  );
}

function RewriteStep({ analysis, options, setOptions, setStep, rewrite, busy, error }: { analysis: AnalysisResult; options: RewriteOptions; setOptions: (options: RewriteOptions) => void; setStep: (step: number) => void; rewrite: () => Promise<void>; busy: boolean; error: string }) {
  const update = <K extends keyof RewriteOptions>(key: K, value: RewriteOptions[K]) => setOptions({ ...options, [key]: value });
  const togglePreserve = (item: string) => update("preserve", options.preserve.includes(item) ? options.preserve.filter((value) => value !== item) : [...options.preserve, item]);
  const handoff = analysis.handoff;
  return (
    <>
      <Heading eyebrow="REWRITE BRIEF" title="确认改写方向" desc="十项默认值已经根据原片和产品库填好，确认后才会生成脚本。" badge="阶段二 · 等你确认" />
      <Stepper step={3} />
      <div className="twoCols rewrite">
        <section className="card"><em>HANDOFF</em><h3>改写交接单</h3>{[
          ["原片画风", handoff.originalStyle], ["内容类型", handoff.originalContentType], ["叙事骨架", handoff.narrativeSkeleton], ["情绪曲线", handoff.emotionalCurve], ["开场钩子", handoff.openingHook], ["核心画面", handoff.coreConversionShot], ["必须保留", handoff.mustKeep], ["必须替换", handoff.mustReplace], ["目标产品", handoff.targetProduct], ["合规注意", handoff.complianceNotes],
        ].map(([label, value]) => <div className="handoff" key={label}><small>{label}</small><p>{value}</p></div>)}</section>
        <section className="card"><em>10-ITEM CHECKLIST</em><h3>改写需求勾选卡</h3><div className="formGrid">
          <label>1 · 画风<select value={options.style} onChange={(event) => update("style", event.target.value)}>{optionsWithCurrent(options.style, ["真人实拍", "2D 动画", "3D 动画", "定格", "MG 图形", "混合"]).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>2 · 内容类型<input value={options.contentType} onChange={(event) => update("contentType", event.target.value)} /></label>
          <label className="fullField">3 · 保留哪些<div className="checks inlineChecks">{["画风", "叙事逻辑", "表现形式", "分镜节奏"].map((item) => <span key={item}><input type="checkbox" checked={options.preserve.includes(item)} onChange={() => togglePreserve(item)} /> {item}</span>)}</div></label>
          <label className="fullField">4 · 逐镜取舍<textarea rows={2} value={options.shotDecision} onChange={(event) => update("shotDecision", event.target.value)} /></label>
          <label>5 · 主打卖点<select value={options.primarySellingPoint} onChange={(event) => update("primarySellingPoint", event.target.value)}>{optionsWithCurrent(options.primarySellingPoint, ["去渍美白", "清新口气", "草本护龈"]).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>6 · 副卖点<select value={options.secondarySellingPoint} onChange={(event) => update("secondarySellingPoint", event.target.value)}>{optionsWithCurrent(options.secondarySellingPoint, ["不使用副卖点", "清新口气", "草本护龈"]).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>7 · 痛点开场<select value={options.painOpening} onChange={(event) => update("painOpening", event.target.value)}>{optionsWithCurrent(options.painOpening, ["烟茶酒牙黄", "火锅咖啡奶茶牙黄", "牙面黄渍", "晨起口气", "冷热酸敏感"]).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>8 · 场景<select value={options.scene} onChange={(event) => update("scene", event.target.value)}>{optionsWithCurrent(options.scene, ["洗手台", "抽烟或喝咖啡后", "晨起", "社交见人前"]).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>9 · 目标时长<input type="number" min={5} max={30} value={options.durationSeconds} readOnly title="已锁定参考原视频时长" /><small className="lockedFieldNote">跟随原视频</small></label>
          <label>10 · 出稿数量<select value={options.variantCount} onChange={(event) => update("variantCount", Number(event.target.value) as 1 | 3)}><option value={1}>1 条主推</option><option value={3}>主推 + 2 个变体</option></select></label>
        </div></section>
      </div>
      <div className="recommend"><span>✦</span><div><b>AI 推荐</b><p>{handoff.primarySellingPoint}为主线；{handoff.secondarySellingPoint || "不带副卖点"}。功效演示：{handoff.effectDemo}</p></div></div>
      {error && <div className="agentError" role="alert">{error}</div>}
      <div className="actions"><button type="button" className="secondary" onClick={() => setStep(2)}>返回查看拆解</button><button type="button" disabled={busy} onClick={() => void rewrite()}>{busy ? "Gemini 正在组合知识库…" : "按此方向生成脚本 →"}</button></div>
    </>
  );
}

function DeliveryStep({ result, activeVariant, setActiveVariant, setStep, copyActive, downloadAll, productImage, sourceRatio, sourceDurationSeconds }: { result: RewriteResponse; activeVariant: number; setActiveVariant: (index: number) => void; setStep: (step: number) => void; copyActive: () => Promise<void>; downloadAll: () => void; productImage: File | null; sourceRatio: string; sourceDurationSeconds: number }) {
  const variant = result.variants[activeVariant];
  return (
    <>
      <Heading eyebrow="FINAL DELIVERY" title="可直接使用的生成脚本" badge="Gemini 改写 · 方舟生成" />
      <Stepper step={4} />
      {result.variants.length > 1 && <div className="variantTabs" role="tablist" aria-label="脚本版本">{result.variants.map((item, index) => <button type="button" role="tab" aria-selected={activeVariant === index} className={activeVariant === index ? "active" : ""} key={item.id} onClick={() => setActiveVariant(index)}>版本 {index + 1} · {item.title}</button>)}</div>}
      <section className="resultHead"><div><em>GEMINI DELIVERY</em><h2>{variant.title}</h2><p>{variant.positioning}</p></div><div><button type="button" className="secondary" onClick={() => void copyActive()}>复制当前版</button><button type="button" onClick={downloadAll}>导出全部 TXT</button></div></section>
      <section className="paper"><div><em>01</em><article><h3>脚本定位</h3><p>{variant.positioning}</p></article></div><div><em>02</em><article><h3>基础设定</h3><p>{variant.basicSetting}</p></article></div><div><em>03</em><article><h3>专业分镜脚本</h3>{variant.shots.map((shot, index) => <div className="scriptShot" key={`${shot.title}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><div><h4>{shot.title} · {shot.timeRange}</h4><p><strong>{shot.camera}</strong><br />{shot.visual}</p><small>音效：{shot.audio} ｜ 转场：{shot.transition}</small></div></div>)}</article></div></section>
      <div className="twoCols"><section className="card"><h3>合规终检 <span className={variant.complianceChecks.every((item) => item.status === "通过") ? "ok" : "reviewBadge"}>{variant.complianceChecks.every((item) => item.status === "通过") ? "全部通过" : "存在存疑项"}</span></h3>{variant.complianceChecks.map((item) => <p className={item.status === "通过" ? "check" : "warningItem"} key={`${item.label}-${item.detail}`}>{item.status === "通过" ? "✓" : "⚠️"} {item.label}：{item.detail}</p>)}</section><section className="card"><h3>出片提醒</h3>{variant.reminders.map((item) => <p className="reviewItem" key={item}>{item}</p>)}</section></div>
      <ArkVideoGenerator key={`${variant.id}:${textFingerprint(variant.seedancePrompt)}`} defaultPrompt={variant.seedancePrompt} productImage={productImage} sourceRatio={sourceRatio} sourceDurationSeconds={sourceDurationSeconds} />
      <div className="actions"><button type="button" className="secondary" onClick={() => setStep(3)}>← 调整改写参数</button></div>
    </>
  );
}

function History({ analysis, result, onContinue }: { analysis: AnalysisResult | null; result: RewriteResponse | null; onContinue: () => void }) {
  return <><Heading eyebrow="PROJECTS" title="当前会话" desc="本次接入不新增数据库，刷新页面后结果不会保留。" />{analysis ? <section className="empty"><span>▱</span><h2>雷允上 · 本次爆款改写</h2><p>{analysis.style.visualStyle} · {analysis.overview.durationSeconds.toFixed(1)} 秒 · {result ? `${result.variants.length} 个脚本版本` : "已完成拆解"}</p><button type="button" onClick={onContinue}>继续本次创作</button></section> : <section className="empty"><span>▱</span><h2>当前还没有分析记录</h2><p>上传一条视频并完成 Gemini 拆解后，会在本次会话中显示。</p><button type="button" onClick={onContinue}>新建创作</button></section>}</>;
}

function Knowledge() {
  const rows = [["01", "智能体总指令", "三阶段工作流、输出格式、提示注入防护与合规红线"], ["02", "带货视频拆解库", "五环漏斗、钩子、背书、效果与评分卡"], ["03", "Seedance 提示词库", "分镜、时间码、运镜、画质与素材码规则"], ["04", "雷允上产品卖点库", "产品事实、卖点、成分、场景与合规边界"]];
  return <><Heading eyebrow="KNOWLEDGE BASE" title="创作知识库" desc="四份原始 Markdown 已编译进服务端提示词；换产品只替换第 4 份。" /><section className="productBanner"><div><em>CURRENT PRODUCT</em><h2>雷允上美白去渍牙膏</h2><p>300 年中华老字号 · 主卖点：去渍美白</p></div><span>本地知识优先</span></section><div className="knowledgeList">{rows.map((row) => <section key={row[0]}><b>{row[0]}</b><div><h3>{row[1]}</h3><p>{row[2]}</p></div><span>服务端已加载</span></section>)}</div></>;
}

function Settings({ openLux, ark }: { openLux: ServiceConfig | null; ark: ServiceConfig | null }) {
  const services = [
    { number: "01", title: "视频理解与脚本改写", desc: "读取视频画面与声音，输出拆解、交接单和 Seedance 分镜。", label: "OpenLux · Gemini", model: openLux?.model ?? "gemini-2.5-pro", configured: openLux?.configured },
    { number: "02", title: "视频生成 API", desc: "将产品白底图由服务端直接提交到方舟，创建异步任务并轮询结果。", label: "火山方舟 · Seedance 2.5", model: ark?.model ?? "doubao-seedance-2-5-260628", configured: ark?.configured },
  ];
  return <><Heading eyebrow="MODEL CONNECTIONS" title="API 设置" desc="所有密钥均由服务端环境读取，浏览器只显示连接状态。" /><div className="security"><b>密钥安全</b><p>页面、HTML、接口响应和导出文件中都不会包含 API Key。</p></div>{services.map((service) => <section className="card apiCard managedApi" key={service.number}><b>{service.number}</b><div><h2>{service.title}</h2><p>{service.desc}</p><div className="serverManaged"><b>{service.label}</b><code>{service.model}</code><small>服务端托管 · 本地环境配置</small></div></div><span className={service.configured ? "connectedBadge" : ""}>{service.configured === undefined ? "正在检测" : service.configured ? "已连接" : "待配置"}</span></section>)}</>;
}
