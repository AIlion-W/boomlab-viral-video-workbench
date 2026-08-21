import type { Metadata } from "next";
import Workbench from "./Workbench";

export const metadata: Metadata = {
  title: "爆款前5秒 · AI 视频创作工作台",
  description: "上传爆款短视频与产品图片，拆解爆点结构并生成可用于视频模型的专业分镜脚本。",
};

export default function Home() { return <Workbench />; }
