import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve("."),
  },
  output: "standalone",
  devIndicators: false,
  // Tauri dev / 浏览器回归通过 127.0.0.1 访问时必须放行，否则 Next 16 会以
  // “cross-origin dev resource” 拦截 HMR 资源，导致页面只渲染 SSR、永不 hydrate。
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
