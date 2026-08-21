import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "爆款前5秒 · AI 视频创作工作台",
  description: "拆解爆款短视频，生成基于产品知识库的相似视频脚本。",
  openGraph: {
    title: "爆款前5秒 · AI 视频创作工作台",
    description: "拆解爆款短视频，生成基于产品知识库的相似视频脚本。",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "爆款前5秒 · AI 视频创作工作台",
    description: "拆解爆款短视频，生成基于产品知识库的相似视频脚本。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
