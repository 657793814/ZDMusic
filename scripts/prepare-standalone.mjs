import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const standalone = resolve(root, ".next", "standalone");

/** Deep-copy directory contents recursively */
function copyContents(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) {
      copyContents(s, d);
    } else {
      cpSync(s, d, { force: true });
    }
  }
}

// Copy static & public assets
const nextStatic = resolve(root, ".next", "static");
if (existsSync(nextStatic)) copyContents(nextStatic, resolve(standalone, ".next", "static"));
const publicDir = resolve(root, "public");
if (existsSync(publicDir)) copyContents(publicDir, resolve(standalone, "public"));

// AI 深度尚未接入主应用，正式包不携带模型、WASM 和 benchmark 资源。
rmSync(resolve(standalone, "public/visual/ai-depth"), { recursive: true, force: true });

// Clean up source files (dev artifacts that leaked from next build)
const keepFiles = new Set(["server.js", "package.json", "node_modules", ".next", "public"]);
for (const f of readdirSync(standalone)) {
  if (!keepFiles.has(f)) {
    rmSync(join(standalone, f), { recursive: true, force: true });
  }
}

// bv2mp3 由 chat API 动态执行，无法完全依赖 Next 文件追踪。
// 在隔离目录只安装它的生产依赖，避免读取 standalone 中的完整项目 manifest，
// 也避免覆盖 Next 已按运行时追踪好的依赖文件。
const runtimeDir = mkdtempSync(join(tmpdir(), "zdmusic-bv2mp3-"));
try {
  console.log("正在安装隔离的 bv2mp3 生产依赖...");
  execFileSync(
    "npm",
    [
      "install",
      "--prefix", runtimeDir,
      "--omit=dev",
      "--no-audit",
      "--no-fund",
      "--no-save",
      "--package-lock=false",
      "--loglevel=error",
      "bv2mp3@4.0.0",
    ],
    { stdio: "inherit", timeout: 120_000 },
  );

  const standaloneModules = join(standalone, "node_modules");
  const runtimeModules = join(runtimeDir, "node_modules");
  rmSync(join(standaloneModules, "bv2mp3"), { recursive: true, force: true });
  // 应用直接执行 src/index.js，不需要 npm .bin；同时避免临时符号链接和目录合并差异。
  rmSync(join(runtimeModules, ".bin"), { recursive: true, force: true });
  rmSync(join(standaloneModules, ".bin"), { recursive: true, force: true });
  cpSync(runtimeModules, standaloneModules, {
    recursive: true,
    dereference: true,
    force: false,
    errorOnExist: false,
  });

  if (!existsSync(join(standaloneModules, "bv2mp3/src/index.js"))) {
    throw new Error("bv2mp3 运行文件未正确写入 standalone");
  }
  console.log("✓ bv2mp3 生产依赖已隔离安装");
} finally {
  rmSync(runtimeDir, { recursive: true, force: true });
}

// 明显的构建期依赖或尚未启用的资源一旦重新出现，立即让构建失败。
const forbiddenPaths = [
  "node_modules/typescript",
  "node_modules/@types",
  "node_modules/eslint",
  "node_modules/@typescript-eslint",
  "node_modules/@tailwindcss",
  "node_modules/tailwindcss",
  "node_modules/lightningcss-darwin-arm64",
  "node_modules/@next/swc-darwin-arm64",
  "node_modules/@tauri-apps/cli",
  "node_modules/@tauri-apps/cli-darwin-arm64",
  "public/visual/ai-depth",
];
const leakedPaths = forbiddenPaths.filter((path) => existsSync(join(standalone, path)));
if (leakedPaths.length > 0) {
  throw new Error(`standalone 含有禁止打包的内容: ${leakedPaths.join(", ")}`);
}

console.log("✓ Standalone bundle ready");
