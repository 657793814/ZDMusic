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

// Clean up source files
const keepFiles = new Set(["server.js", "package.json", "node_modules", ".next", "public"]);
for (const f of readdirSync(standalone)) {
  if (!keepFiles.has(f)) {
    rmSync(join(standalone, f), { recursive: true, force: true });
  }
}

// Install runtime deps so bv2mp3 etc are available
// Use a memory-safe approach: copy only production-relevant packages from source node_modules
// instead of running npm install (which can OOM on memory-constrained systems)
const { execSync } = await import("child_process");

// Minimal set of packages needed at runtime (next server and API routes)
const RUNTIME_PKGS = [
  "next", "react", "react-dom", "styled-jsx",
  "zod", "zustand", "scheduler",
  "caniuse-lite", "source-map-js", "client-only",
  "server-only", "tslib", "graceful-fs", "watchpack", "acorn",
  "sharp", "bv2mp3", "axios", "openai", "nanoid",
];
const RUNTIME_SCOPED = [
  ["@next", ["env", "swc-darwin-arm64"]],
  ["@swc", ["helpers"]],
  ["@emnapi", ["*"]],
  ["@tauri-apps", ["api", "plugin-*"]],
];

const srcModules = resolve(root, "node_modules");

// Copy regular packages
for (const pkg of RUNTIME_PKGS) {
  const src = join(srcModules, pkg);
  const dest = join(standalone, "node_modules", pkg);
  if (existsSync(src)) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true, force: true });
  }
}

// Copy scoped packages
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
console.log("✓ Production dependencies copied to standalone");

// Remove the large Anthropic Clude SDK native binary (197MB) if it was installed
// This package was removed from package.json so this is now a no-op, kept for safety
const claudeBinary = join(standalone, "node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64");
if (existsSync(claudeBinary)) {
  rmSync(claudeBinary, { recursive: true, force: true });
  console.log("✓ pruned @anthropic-ai/claude-agent-sdk-darwin-arm64 binary");
}

console.log("✓ Standalone bundle ready");