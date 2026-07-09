import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve("."),
  },
  output: "standalone",
  devIndicators: false,
};

export default nextConfig;
