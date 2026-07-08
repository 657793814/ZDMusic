#!/usr/bin/env node
/**
 * bv2mp3 包装脚本
 *
 * bv2mp3 内部使用 @clack/prompts（TTY 依赖的 CLI 框架），
 * 但在 Next.js 无头子进程中无 TTY 可用，@clack/core 会抛出异常。
 *
 * 此脚本在加载 bv2mp3 前修补 @clack/prompts，将 TTY 依赖函数
 * 替换为无操作版本，保留核心下载逻辑。
 */

// 1. 修补 @clack/prompts + @clack/core
const module = await import("module");
const require = module.createRequire(import.meta.url);

// @clack/core 修补 — 将 stdin 替换为哑元，阻止 TTY 检查
const cwd = process.cwd();
const clackCorePath = require.resolve("@clack/core", { paths: [cwd] });

// 使用动态 import 加载，然后修补
const clackPromisesPath = require.resolve("@clack/prompts", { paths: [cwd] });

// 修补 @clack/core 中的 stdin 和 stderr 检测
// 这样即使 @clack/prompts 内部调用也不会崩溃
// 方法: 在加载前设置环境变量
process.env.CLACK_HIDE = "1";

// 2. 修补 module 缓存 — 在 bv2mp3 加载前干掉 @clack 的交互功能
// 拦截模块加载，将 @clack/prompts 替换为修补版本
const origLoad = require("module")._load;
require("module")._load = function (request, parent, isMain) {
  const resolved = require("module")._resolveFilename(request, parent, false);
  // 拦截 @clack/prompts — 返回修补版本
  if (resolved === clackPromisesPath) {
    return createPatchedClackPrompts();
  }
  // 拦截 @clack/core — 返回修补版本
  if (resolved === clackCorePath) {
    return createPatchedClackCore();
  }
  return origLoad.apply(this, arguments);
};

function createPatchedClackCore() {
  return {
    // 提供最基本的非交互式实现
    spinner() {
      let timer = null;
      return {
        start(msg) { if (process.stderr.isTTY) process.stderr.write(`${msg || ""}...\n`); },
        stop(msg) { if (timer) clearInterval(timer); if (msg && process.stderr.isTTY) process.stderr.write(`${msg}\n`); },
        message(msg) { /* noop */ },
      };
    },
    // 所有交互函数返回默认值，不读 stdin
    text: ({ initialValue }) => Promise.resolve(initialValue ?? ""),
    confirm: ({ initialValue }) => Promise.resolve(initialValue ?? true),
    select: ({ initialValue }) => Promise.resolve(initialValue),
    multiselect: ({ initialValues }) => Promise.resolve(initialValues ?? []),
    isCancel: () => false,
    intro: (msg) => { if (process.stderr.isTTY) process.stderr.write(`${msg}\n`); },
    outro: (msg) => { if (process.stderr.isTTY) process.stderr.write(`${msg}\n`); },
    note: () => {},
    cancel: (msg) => { if (process.stderr.isTTY) process.stderr.write(`${msg || "Cancelled"}\n`); },
    spinner: () => ({
      start: () => {},
      stop: () => {},
      message: () => {},
    }),
    log: {
      success: (msg) => { if (process.stderr.isTTY) process.stderr.write(`✔ ${msg}\n`); },
      info: (msg) => { if (process.stderr.isTTY) process.stderr.write(`ℹ ${msg}\n`); },
      warn: (msg) => { if (process.stderr.isTTY) process.stderr.write(`⚠ ${msg}\n`); },
      error: (msg) => process.stderr.write(`✖ ${msg}\n`),
    },
    progress: () => {
      let started = false;
      return {
        start: () => { started = true; },
        stop: () => { started = false; },
        advance: () => {},
        cleanup: () => {},
      };
    },
  };
}

function createPatchedClackPrompts() {
  const base = createPatchedClackCore();
  return {
    ...base,
    // @clack/prompts 额外导出
    spinner: base.spinner,
    log: base.log,
    progress: base.progress,
    // 确保所有交互式 prompt 不会阻塞
    text: ({ initialValue, placeholder }) =>
      Promise.resolve(initialValue ?? placeholder ?? ""),
    confirm: ({ initialValue }) => Promise.resolve(initialValue ?? true),
    select: ({ options }) => {
      const first = options?.[0]?.value;
      return Promise.resolve(first);
    },
    multiselect: ({ options, initialValues }) =>
      Promise.resolve(initialValues ?? options?.map((o) => o.value) ?? []),
    isCancel: () => false,
    intro: () => {},
    outro: () => {},
    note: () => {},
    cancel: () => {},
  };
}

// 恢复原始 _load
const restoredLoad = require("module")._load;

// 3. 执行 bv2mp3
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("用法: node wrap-bv2mp3.mjs --url=...");
  process.exit(1);
}

// bv2mp3 期望其 node_modules 同级有 @clack 等依赖
// 但运行时可能找不到，所以需要确保 require 路径正确
try {
  // 先尝试直接 import
  await import("bv2mp3/src/index.js");
} catch (e) {
  // 如果上面的方式不行，fallback 到 require
  const bv2mp3Path = require.resolve("bv2mp3/src/index.js", { paths: [cwd] });
  // 通过子进程执行
  const { execSync } = await import("child_process");
  execSync(`node "${bv2mp3Path}" ${args.join(" ")}`, {
    cwd,
    stdio: "inherit",
    timeout: 300_000,
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      CLACK_HIDE: "1",
      CI: "true",
    },
  });
}
