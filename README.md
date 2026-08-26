# Boomlab Viral Video Workbench

Boomlab 爆款短视频工作台：上传参考视频后，使用 Gemini 完成结构拆解与脚本改写，再通过火山方舟 Seedance 生成视频。

## 当前能力

- 上传 MP4、MOV 或 WebM 参考视频并校验类型、大小与时长
- 通过 OpenLux Gemini 2.5 Pro 分析画面、声音、口播、分镜和转化漏斗
- 将本地总指令、拆解方法、Seedance 写法与产品资料作为服务端知识库
- 确认改写参数后生成 1 条或 3 条结构化分镜脚本
- 通过火山方舟 `doubao-seedance-2-5-260628` 创建异步视频任务
- 每 10 秒查询一次生成状态，完成后在页面内播放并提供原始结果链接
- API Key 全部保留在服务端环境变量中，不进入浏览器代码或仓库

## 工作流程

1. 上传参考视频，可选填写真实后台数据和产品图片占位信息。
2. Gemini 完整分析视频，输出逐字稿、镜头拆解、爆点结构与改写交接单。
3. 确认画风、卖点、场景、时长和出稿数量。
4. 生成脚本并将 Seedance 提示词提交到火山方舟。
5. 页面轮询任务，生成完成后直接回显视频。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
cp .env.example .env.local
npm run dev
```

默认开发地址由 Vinext 输出；当前本地协作使用 `http://localhost:3100/`。

## 服务端配置

在 `.env.local` 中配置，绝不要提交真实密钥：

```dotenv
OPENLUX_API_KEY=
OPENLUX_API_BASE=https://api.openlux.ai
OPENLUX_GEMINI_MODEL=gemini-2.5-pro
ARK_API_KEY=
```

- `OPENLUX_API_KEY`：用于 Gemini 视频分析和脚本改写。
- `OPENLUX_API_BASE`：默认 `https://api.openlux.ai`。
- `OPENLUX_GEMINI_MODEL`：默认 `gemini-2.5-pro`。
- `ARK_API_KEY`：用于火山方舟 Seedance 视频生成。

## 验证

```bash
npm run lint
npm test
```

测试会模拟上游服务，不会创建真实的付费视频任务，也不会返回或记录真实密钥。

## 当前边界

- Gemini 视频上传最大 15 MB，最短 5 秒。
- 浏览器选择的产品图片目前只保留为 `@产品图` 占位，不会自动上传公网。
- Seedance 参考图片、视频和音频需要方舟可访问的 HTTPS 地址。
- 方舟生成结果链接可能过期，成功后应及时保存原文件。
- 分析与脚本结果仅保留在当前浏览器会话，尚未接入持久化项目库。

## 项目结构

- `app/ViralWorkbench.tsx`：完整工作台流程
- `app/ArkVideoGenerator.tsx`：Seedance 任务创建、轮询与结果回显
- `app/api/viral-agent/`：Gemini 分析和改写代理
- `app/api/seedance/`：火山方舟服务端代理
- `knowledge/viral-agent/`：本地业务规则与产品知识
- `tests/rendered-html.test.mjs`：页面、校验、密钥隔离与上游映射测试

项目基于 Vinext、React 19 和 Cloudflare Workers 兼容运行时构建。
