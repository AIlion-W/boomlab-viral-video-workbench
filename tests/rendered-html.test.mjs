import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
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
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/);
});

test("ships production metadata and accessible controls", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /<title>爆款前5秒/);
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /选择视频文件/);
  assert.match(html, /API 设置/);
});
