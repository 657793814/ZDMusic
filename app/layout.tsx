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
  icons: {
    icon: [
      { url: "/icon.ico", sizes: "256x256" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
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
        <link rel="icon" href="/icon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script dangerouslySetInnerHTML={{__html:
          `document.body && document.body.focus && document.body.focus();`
        }} />
      </head>
      <body
        tabIndex={-1}
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
