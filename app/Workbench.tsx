"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useRef, useState } from "react";
import ArkVideoGenerator from "./ArkVideoGenerator";

const nav = ["新建创作", "历史项目", "知识库", "API 设置"];
const steps = ["上传素材", "AI 拆解", "确认改写", "生成交付"];
const shotRows = [
  ["0–1.2s", "咖啡杯落桌，镜头急推至露齿特写", "视觉钩子"],
  ["1.2–3s", "牙色状态快速对照，锁定烟茶咖啡人群", "戳痛点"],
  ["3–6s", "产品从画面右侧推入，包装定格", "产品亮相"],
  ["6–10s", "膏体微距与刷牙动作交替", "功效演示"],
  ["10–13s", "草本与龙井香意象叠化", "建立信任"],
  ["13–15s", "人物清爽露齿笑，产品落版", "情绪落点"],
];
const script = [
  [
    "镜1 · 痛点点名（0–2.2s）",
    "咖啡杯从画面左上方落到木桌，镜头急推到人物嘴部近景。她略带无奈地说：『咖啡奶茶没少喝，一张嘴牙比脸还抢镜？』自然日光照出门齿表面的真实外源性色渍。",
  ],
  [
    "镜2 · 产品亮相（2.2–4.5s）",
    "画面切到洗手台，@产品图 雷允上美白去渍牙膏从右侧进入画面中央。镜头缓慢推进包装，她说道：『我最近换成了这支三百年老字号草本牙膏。』",
  ],
  [
    "镜3 · 膏体与使用（4.5–8s）",
    "微距镜头跟随牙膏挤出黄豆粒大小的细腻膏体，她随即开始直接干刷。刷毛贴合门齿唇面轻柔移动，动作连贯自然。",
  ],
  [
    "镜4 · 草本记忆（8–11.5s）",
    "膏体微距叠化为龙井茶叶、铁皮石斛与茯苓的草本意象。旁白自然说道：『淡淡龙井香，刷完整个口腔都很清爽。』",
  ],
  [
    "镜5 · 自信收尾（11.5–15s）",
    "镜头回到窗边，她放下咖啡杯，自然露齿笑。@产品图 套装在右下方定格，她说：『去除外源性牙渍，笑起来更自在。』",
  ],
];

export default function Workbench() {
  const [page, setPage] = useState(0);
  const [step, setStep] = useState(1);
  const [video, setVideo] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const videoRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const notify = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2200);
  };
  const advance = (next: number) => {
    setBusy(true);
    setTimeout(() => {
      setStep(next);
      setBusy(false);
    }, 650);
  };
  const copyScript = async () => {
    await navigator.clipboard.writeText(
      script.map((x) => x.join("\n")).join("\n\n"),
    );
    notify("脚本已复制");
  };
  const downloadScript = () => {
    const url = URL.createObjectURL(
      new Blob([script.map((x) => x.join("\n")).join("\n\n")], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "雷允上爆款视频脚本.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span>B</span>
          <div>
            <b>BOOMLAB</b>
            <small>爆款创作工作台</small>
          </div>
        </div>
        <nav>
          {nav.map((item, i) => (
            <button
              key={item}
              className={page === i ? "active" : ""}
              onClick={() => setPage(i)}
            >
              <i>{["✦", "▱", "K", "⚙"][i]}</i>
              {item}
            </button>
          ))}
        </nav>
        <div className="sideBottom">
          <div className="kbMini">
            <span>K</span>
            <div>
              <b>4 份知识已连接</b>
              <small>雷允上产品库</small>
            </div>
          </div>
          <div className="profile">
            <span>海</span>
            <div>
              <b>海尼创作团队</b>
              <small>在线工作区</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="top">
          <div>
            <small>当前项目</small>
            <b>雷允上 · 爆款改写 01⌄</b>
          </div>
          <span>✓ 草稿自动保存</span>
        </header>
        <div className="content">
          {page === 0 && (
            <>
              {step === 1 && (
                <Upload
                  video={video}
                  images={images}
                  setVideo={setVideo}
                  setImages={setImages}
                  videoRef={videoRef}
                  imageRef={imageRef}
                  advance={advance}
                  busy={busy}
                />
              )}{" "}
              {step === 2 && <Analysis setStep={setStep} />}{" "}
              {step === 3 && (
                <Rewrite setStep={setStep} advance={advance} busy={busy} />
              )}{" "}
              {step === 4 && (
                <Delivery
                  setStep={setStep}
                  copyScript={copyScript}
                  downloadScript={downloadScript}
                />
              )}
            </>
          )}
          {page === 1 && <History onCreate={() => setPage(0)} />}{" "}
          {page === 2 && <Knowledge />}{" "}
          {page === 3 && <Settings notify={notify} />}
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="steps">
      {steps.map((item, i) => (
        <div
          key={item}
          className={`${step === i + 1 ? "current" : ""} ${step > i + 1 ? "done" : ""}`}
        >
          <span>{step > i + 1 ? "✓" : i + 1}</span>
          <div>
            <b>{item}</b>
            <small>
              {
                [
                  "提供参考与产品",
                  "提取爆点骨架",
                  "选择卖点参数",
                  "脚本与视频提示词",
                ][i]
              }
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  desc,
  badge,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  badge?: string;
}) {
  return (
    <div className="heading">
      <div>
        <em>{eyebrow}</em>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {badge && <span className="badge">● {badge}</span>}
    </div>
  );
}

function Upload({
  video,
  images,
  setVideo,
  setImages,
  videoRef,
  imageRef,
  advance,
  busy,
}: {
  video: File | null;
  images: File[];
  setVideo: Dispatch<SetStateAction<File | null>>;
  setImages: Dispatch<SetStateAction<File[]>>;
  videoRef: RefObject<HTMLInputElement | null>;
  imageRef: RefObject<HTMLInputElement | null>;
  advance: (next: number) => void;
  busy: boolean;
}) {
  return (
    <>
      <Heading
        eyebrow="NEW CREATION"
        title="把一条爆款，变成你的产品脚本"
        desc="上传参考视频与产品素材，AI 将抽取节奏和情绪骨架，再填入真实产品卖点。"
        badge="演示模式"
      />
      <Stepper step={1} />
      <div className="uploadGrid">
        <button
          className={`drop ${video ? "filled" : ""}`}
          onClick={() => videoRef.current?.click()}
        >
          <input
            ref={videoRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            hidden
            onChange={(e) => setVideo(e.target.files?.[0] || null)}
          />
          <span>{video ? "▶" : "↑"}</span>
          <h2>{video ? video.name : "拖入一条爆款短视频"}</h2>
          <p>
            {video
              ? `${(video.size / 1024 / 1024).toFixed(1)} MB`
              : "支持 MP4、MOV、WebM，建议 10–60 秒"}
          </p>
          <strong>选择视频文件</strong>
        </button>
        <div className="sideCards">
          <section className="card">
            <div className="cardTitle">
              <div>
                <em>PRODUCT ASSETS</em>
                <h3>产品图片</h3>
              </div>
              <small>{images.length}/6</small>
            </div>
            <p className="muted">建议上传包装正面、侧面、膏体与使用场景。</p>
            <div className="imageList">
              {images.map((f, i) => (
                <div key={`${f.name}-${i}`}>
                  {f.name.slice(0, 5)}
                  <button
                    onClick={() => setImages(images.filter((_, n) => n !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button className="add" onClick={() => imageRef.current?.click()}>
                ＋<small>添加图片</small>
              </button>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) =>
                  setImages(
                    [...images, ...Array.from(e.target.files || [])].slice(
                      0,
                      6,
                    ),
                  )
                }
              />
            </div>
          </section>
          <section className="card knowledgeActive">
            <span>K</span>
            <div>
              <em>ACTIVE KNOWLEDGE</em>
              <h3>雷允上美白去渍牙膏</h3>
              <p>4 份资料已加载 · 主卖点：去渍美白</p>
            </div>
            <b>就绪</b>
          </section>
        </div>
      </div>
      <div className="bottomAction">
        <div>
          <b>准备开始</b>
          <small>
            {video
              ? "素材已就绪，可以进入智能拆解"
              : "先上传参考视频，产品图可稍后补充"}
          </small>
        </div>
        <button disabled={!video || busy} onClick={() => advance(2)}>
          {busy ? "正在读取镜头…" : "开始智能拆解 →"}
        </button>
      </div>
    </>
  );
}

function Analysis({ setStep }: { setStep: Dispatch<SetStateAction<number>> }) {
  const funnel: Array<[string, number]> = [
    ["钩住", 92],
    ["戳痛", 88],
    ["立信", 76],
    ["给效果", 84],
    ["逼单", 68],
  ];
  return (
    <>
      <Heading
        eyebrow="VIDEO INTELLIGENCE"
        title="爆款结构拆解"
        desc="先识别风格，再拆镜头、漏斗和前 5 秒钩子。"
        badge="演示分析"
      />
      <Stepper step={2} />
      <div className="notice">
        <b>演示模式</b>尚未配置视频理解 API，以下内容用于展示完整交付结构。
      </div>
      <section className="summary">
        <div className="score">
          <b>83</b>
          <small>参考分</small>
        </div>
        <div>
          <em>STYLE & FORMAT</em>
          <h2>真人实拍 · 产品展示 · 测评对比</h2>
          <p>总时长 15 秒 · 真人生活流 · 非混剪 · 带货转化</p>
        </div>
        <div>
          <small>前 5 秒钩子</small>
          <p>用“咖啡奶茶喝出一口黄牙”精准点名人群，1.2 秒内给出牙色对比。</p>
        </div>
      </section>
      <div className="twoCols">
        <section className="card">
          <h3>五环转化漏斗</h3>
          {funnel.map(([n, v]) => (
            <div className="metric" key={n}>
              <div>
                <b>{n}</b>
                <span>{v}</span>
              </div>
              <i>
                <span style={{ width: `${v}%` }} />
              </i>
            </div>
          ))}
        </section>
        <section className="card">
          <h3>为什么会爆</h3>
          {[
            "前 1.2 秒即完成人群筛选",
            "痛点—产品—动作—结果递进清楚",
            "产品特写与人物表情形成记忆闭环",
          ].map((x, i) => (
            <div className="reason" key={x}>
              <b>0{i + 1}</b>
              <p>{x}</p>
            </div>
          ))}
          <div className="skeleton">
            <small>可复用骨架</small>
            <p>痛点点名 → 产品身份 → 使用动作 → 草本背书 → 自信结果与 CTA</p>
          </div>
        </section>
      </div>
      <section className="card">
        <div className="cardTitle">
          <h3>全程分镜拆解</h3>
          <small>6 个关键镜头</small>
        </div>
        <div className="shotTable">
          {shotRows.map((s, i) => (
            <div key={s[0]}>
              <b>0{i + 1}</b>
              <strong>{s[0]}</strong>
              <p>{s[1]}</p>
              <span>{s[2]}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="actions">
        <button className="secondary" onClick={() => setStep(1)}>
          返回修改素材
        </button>
        <button onClick={() => setStep(3)}>确认拆解，进入改写 →</button>
      </div>
    </>
  );
}

function Rewrite({
  setStep,
  advance,
  busy,
}: {
  setStep: Dispatch<SetStateAction<number>>;
  advance: (next: number) => void;
  busy: boolean;
}) {
  return (
    <>
      <Heading
        eyebrow="REWRITE BRIEF"
        title="确认改写方向"
        desc="推荐值已经填好，你可以直接生成，也可以微调一两项。"
        badge="已自动推荐"
      />
      <Stepper step={3} />
      <div className="twoCols rewrite">
        <section className="card">
          <em>HANDOFF</em>
          <h3>改写交接单</h3>
          {[
            ["参考风格", "真人实拍 · 测评对比"],
            [
              "爆点骨架",
              "痛点点名 → 产品亮相 → 使用演示 → 草本背书 → 自信收尾",
            ],
            ["核心画面", "牙色痛点特写 + 黄豆粒膏体微距"],
            ["当前产品", "雷允上美白去渍牙膏"],
          ].map((x) => (
            <div className="handoff" key={x[0]}>
              <small>{x[0]}</small>
              <p>{x[1]}</p>
            </div>
          ))}
        </section>
        <section className="card">
          <em>OPTIONS</em>
          <h3>改写需求勾选卡</h3>
          <div className="formGrid">
            <label>
              主打卖点
              <select>
                <option>去渍美白</option>
                <option>清新口气</option>
              </select>
            </label>
            <label>
              副卖点
              <select>
                <option>清新口气</option>
                <option>草本护龈</option>
              </select>
            </label>
            <label>
              目标时长
              <select>
                <option>15 秒</option>
                <option>10 秒</option>
              </select>
            </label>
            <label>
              出稿数量
              <select>
                <option>1 条</option>
                <option>3 条</option>
              </select>
            </label>
          </div>
          <div className="checks">
            <label>
              <input type="checkbox" defaultChecked /> 保留原片画风
            </label>
            <label>
              <input type="checkbox" defaultChecked /> 保留叙事逻辑
            </label>
            <label>
              <input type="checkbox" defaultChecked /> 保留分镜节奏
            </label>
          </div>
        </section>
      </div>
      <div className="recommend">
        <span>✦</span>
        <div>
          <b>AI 推荐</b>
          <p>
            原片“饮品牙渍”的结构最适合知识库第一卖点“去渍美白”，副带“清新口气”。
          </p>
        </div>
      </div>
      <div className="actions">
        <button className="secondary" onClick={() => setStep(2)}>
          返回查看拆解
        </button>
        <button onClick={() => advance(4)}>
          {busy ? "正在组合知识库…" : "按此方向生成脚本 →"}
        </button>
      </div>
    </>
  );
}

function Delivery({
  setStep,
  copyScript,
  downloadScript,
}: {
  setStep: Dispatch<SetStateAction<number>>;
  copyScript: () => Promise<void>;
  downloadScript: () => void;
}) {
  return (
    <>
      <Heading
        eyebrow="FINAL DELIVERY"
        title="可直接使用的生成脚本"
        badge="方舟任务链路已接入"
      />
      <Stepper step={4} />
      <section className="resultHead">
        <div>
          <em>DEMO DELIVERY</em>
          <h2>烟茶咖啡牙渍 · 15 秒去渍美白脚本</h2>
          <p>已按知识库完成骨架对位、产品槽位填充与合规终检。</p>
        </div>
        <div>
          <button className="secondary" onClick={copyScript}>
            复制全文
          </button>
          <button onClick={downloadScript}>导出 TXT</button>
        </div>
      </section>
      <div className="notice">
        <b>演示模式</b>配置脚本生成 API 后，将根据你上传的视频实时生成。
      </div>
      <section className="paper">
        <div>
          <em>01</em>
          <article>
            <h3>脚本定位</h3>
            <p>
              画风：真人生活流实拍 ｜ 主卖点：去渍美白 ｜ 副卖点：清新口气 ｜
              时长：15 秒
            </p>
          </article>
        </div>
        <div>
          <em>02</em>
          <article>
            <h3>基础设定</h3>
            <p>
              角色：经常喝咖啡的年轻职场女性。产品：@产品图
              雷允上美白去渍牙膏。场景：清晨洗手台与窗边咖啡桌，自然日光，暖灰与草本绿影调。
            </p>
          </article>
        </div>
        <div>
          <em>03</em>
          <article>
            <h3>专业分镜脚本</h3>
            {script.map(([t, b], i) => (
              <div className="scriptShot" key={t}>
                <b>0{i + 1}</b>
                <div>
                  <h4>{t}</h4>
                  <p>{b}</p>
                  <small>中文小说式画面 · 台词内联 · 正向描述</small>
                </div>
              </div>
            ))}
          </article>
        </div>
      </section>
      <div className="twoCols">
        <section className="card">
          <h3>
            合规终检 <span className="ok">全部通过</span>
          </h3>
          {[
            "功效限定为去除外源性牙渍后的提亮",
            "未使用医疗或治愈类宣称",
            "草本成分与品牌年限来自产品知识库",
            "素材码使用 @产品图 占位",
          ].map((x) => (
            <p className="check" key={x}>
              ✓ {x}
            </p>
          ))}
        </section>
      </div>
      <ArkVideoGenerator
        defaultPrompt={script
          .map(([title, body]) => `${title}\n${body}`)
          .join("\n\n")}
      />
      <div className="actions">
        <button className="secondary" onClick={() => setStep(3)}>
          ← 调整改写参数
        </button>
      </div>
    </>
  );
}

function History({ onCreate }: { onCreate: () => void }) {
  return (
    <>
      <Heading
        eyebrow="PROJECTS"
        title="历史项目"
        desc="继续上一次创作，或者复用已经验证的爆款骨架。"
      />
      <section className="empty">
        <span>▱</span>
        <h2>第一个项目已经准备好了</h2>
        <p>雷允上 · 爆款改写 01 · 真人实拍 · 15 秒 · 去渍美白</p>
        <button onClick={onCreate}>继续创作</button>
      </section>
    </>
  );
}
function Knowledge() {
  const rows = [
    ["01", "智能体总指令", "三阶段工作流、输出格式与合规红线"],
    ["02", "带货视频拆解库", "五环漏斗、钩子、背书、效果与评分卡"],
    ["03", "Seedance 提示词库", "分镜、时间码、运镜、画质与素材码规则"],
    ["04", "雷允上产品卖点库", "产品事实、卖点、成分、场景与合规边界"],
  ];
  return (
    <>
      <Heading
        eyebrow="KNOWLEDGE BASE"
        title="创作知识库"
        desc="网页生成结果只使用这 4 份资料中的真实信息。"
      />
      <section className="productBanner">
        <div>
          <em>CURRENT PRODUCT</em>
          <h2>雷允上美白去渍牙膏</h2>
          <p>300 年中华老字号 · 主卖点：去渍美白</p>
        </div>
        <span>合规规则已启用</span>
      </section>
      <div className="knowledgeList">
        {rows.map((r) => (
          <section key={r[0]}>
            <b>{r[0]}</b>
            <div>
              <h3>{r[1]}</h3>
              <p>{r[2]}</p>
            </div>
            <span>已加载</span>
          </section>
        ))}
      </div>
    </>
  );
}
function Settings({ notify }: { notify: (text: string) => void }) {
  type PendingApi = "analysis" | "script";
  const [api, setApi] = useState<Record<PendingApi, string>>({
    analysis: "",
    script: "",
  });
  const fields: Array<[PendingApi, string, string]> = [
    ["analysis", "视频理解 API", "上传视频后完成转写、分镜和爆点分析"],
    ["script", "脚本生成 API", "组合知识库、拆解结果与改写参数"],
  ];
  return (
    <>
      <Heading
        eyebrow="MODEL CONNECTIONS"
        title="API 设置"
        desc="视频生成已经接入服务端；视频理解和脚本生成仍可后续配置。"
      />
      <div className="security">
        <b>密钥安全提示</b>
        <p>方舟密钥只由本项目服务端环境变量读取，不会进入浏览器输入框。</p>
      </div>
      {fields.map(([key, title, desc], i) => (
        <section className="card apiCard" key={key}>
          <b>0{i + 1}</b>
          <div>
            <h2>{title}</h2>
            <p>{desc}</p>
          </div>
          <span>{api[key] ? "已配置" : "待配置"}</span>
          <label>
            接口地址
            <input
              value={api[key]}
              onChange={(e) => setApi({ ...api, [key]: e.target.value })}
              placeholder="https://api.example.com/v1/..."
            />
          </label>
          <label>
            模型名称
            <input placeholder="输入模型 ID" />
          </label>
          <label>
            API Key
            <input type="password" placeholder="sk-••••••••" />
          </label>
        </section>
      ))}
      <section className="card apiCard">
        <b>03</b>
        <div>
          <h2>视频生成 API</h2>
          <p>创建方舟异步任务、轮询状态，并把生成视频返回当前页面。</p>
        </div>
        <span>服务端托管</span>
        <div className="serverManaged">
          <b>火山方舟 · Seedance 2.5</b>
          <code>doubao-seedance-2-5-260628</code>
          <small>
            接口与密钥均在服务端配置，浏览器只能看到任务状态和生成结果。
          </small>
        </div>
      </section>
      <div className="actions">
        <span />
        <button onClick={() => notify("待接入项设置已保存")}>
          保存待接入项
        </button>
      </div>
    </>
  );
}
