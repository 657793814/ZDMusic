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
const { execSync } = await import("child_process");
const nvmSh = join(process.env.HOME || "", ".nvm/nvm.sh");
if (existsSync(nvmSh)) {
  try {
    execSync(
      `bash -l -c 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npm install --production --no-optional 2>&1'`,
      { cwd: standalone, stdio: "pipe", timeout: 180_000, shell: "/bin/bash", maxBuffer: 10 * 1024 * 1024 }
    );
    console.log("✓ bv2mp3 installed in standalone");
  } catch {
    console.log("⚠️  npm install failed, standalone still works for most features");
  }
} else {
  console.log("ℹ️  nvm not available, skipping bv2mp3 install");
}

// Remove the large Anthropic Clude SDK native binary (197MB) if it was installed
// This package was removed from package.json so this is now a no-op, kept for safety
const claudeBinary = join(standalone, "node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64");
if (existsSync(claudeBinary)) {
  rmSync(claudeBinary, { recursive: true, force: true });
  console.log("✓ pruned @anthropic-ai/claude-agent-sdk-darwin-arm64 binary");
}

console.log("✓ Standalone bundle ready");