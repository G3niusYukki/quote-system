import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "国际快递报价系统",
  description: "智能报价查询",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
