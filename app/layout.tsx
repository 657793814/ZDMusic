import { Providers } from "@/app/components/providers";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "卓动悦听",
  description: "在任何时间、任何地点播放音乐。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable}`}
      style={{ backgroundColor: "var(--color-surface)" }}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        className={`${inter.className} antialiased`}
        style={{ backgroundColor: "var(--color-surface)", color: "var(--color-on-surface)" }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
