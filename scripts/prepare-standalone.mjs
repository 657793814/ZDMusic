import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "fs";
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

// Clean up source files (dev artifacts that leaked from next build)
const keepFiles = new Set(["server.js", "package.json", "node_modules", ".next", "public"]);
for (const f of readdirSync(standalone)) {
  if (!keepFiles.has(f)) {
    rmSync(join(standalone, f), { recursive: true, force: true });
  }
}

const { execSync } = await import("child_process");

// ── Step 1: Prune devDependencies from standalone ──
// `next build --output=standalone` copies the entire node_modules as-is,
// including devDependencies like typescript, eslint, @tauri-apps/cli, etc.
// These are NOT needed at runtime and bloat the final .app to ~500MB.
console.log("Pruning devDependencies from standalone...");
try {
  execSync("npm prune --production --no-audit --no-fund --loglevel=error", {
    cwd: standalone,
    stdio: "pipe",
    timeout: 60_000,
    shell: "/bin/bash",
  });
  console.log("✓ devDependencies pruned");
} catch (e) {
  console.warn("⚠️  prune failed (continuing):", e.message?.slice(0, 120));
}

// ── Step 2: Copy essential Next.js runtime deps from source node_modules ──
// Restore any packages that were wrongly pruned or need specific versions.
// These must be available for the Next.js server to start.
const RUNTIME_PKGS = [
  "next", "react", "react-dom", "styled-jsx",
  "zod", "zustand", "scheduler",
  "caniuse-lite", "source-map-js", "client-only",
  "server-only", "tslib", "graceful-fs", "watchpack", "acorn",
  "sharp", "axios", "openai", "nanoid",
];
const RUNTIME_SCOPED = [
  ["@next", ["env", "swc-darwin-arm64"]],
  ["@swc", ["helpers"]],
  ["@emnapi", ["*"]],
  ["@tauri-apps", ["api", "plugin-api", "plugin-http"]],
];

const srcModules = resolve(root, "node_modules");

for (const pkg of RUNTIME_PKGS) {
  const src = join(srcModules, pkg);
  const dest = join(standalone, "node_modules", pkg);
  if (existsSync(src)) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true, force: true });
  }
}

for (const [scope, subpkgs] of RUNTIME_SCOPED) {
  mkdirSync(join(standalone, "node_modules", scope), { recursive: true });
  for (const sub of subpkgs) {
    const src = join(srcModules, scope, sub);
    const dest = join(standalone, "node_modules", scope, sub);
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true, force: true });
    }
  }
}

// ── Step 3: Install bv2mp3 (and its dependencies) from npm ──
// The local workspace copy of bv2mp3 is a pnpm-linked source-only package
// without its own node_modules. npm install fetches the publish-ready version
// with all transitive dependencies included.
console.log("Installing bv2mp3...");
try {
  execSync("npm install bv2mp3@4.0.0 --no-audit --no-fund --loglevel=error", {
    cwd: standalone,
    stdio: "pipe",
    timeout: 120_000,
    shell: "/bin/bash",
    maxBuffer: 5 * 1024 * 1024,
  });
  const bv2mp3Path = join(standalone, "node_modules/bv2mp3/src/index.js");
  if (existsSync(bv2mp3Path)) {
    console.log("✓ bv2mp3 installed");
  }
} catch (e) {
  console.warn("⚠️  bv2mp3 install failed, B站下载功能不可用:", e.message?.slice(0, 120));
}

// ── Step 4: Remove the huge Anthropic SDK binary if it snuck in ──
const claudeBinary = join(standalone, "node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64");
if (existsSync(claudeBinary)) {
  rmSync(claudeBinary, { recursive: true, force: true });
}

console.log("✓ Standalone bundle ready");
