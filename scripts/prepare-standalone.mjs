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

// Install bv2mp3 so npx isn't needed at runtime
const { execSync } = await import("child_process");
const nvmSh = join(process.env.HOME || "", ".nvm/nvm.sh");
if (existsSync(nvmSh)) {
  try {
    execSync(
      `bash -l -c 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npm install --no-optional --ignore-scripts 2>&1'`,
      { cwd: standalone, stdio: "pipe", timeout: 180_000, shell: "/bin/bash", maxBuffer: 10 * 1024 * 1024 }
    );
    console.log("✓ bv2mp3 installed in standalone");
  } catch {
    console.log("⚠️  npm install failed, standalone still works for most features");
  }
} else {
  console.log("ℹ️  nvm not available, skipping bv2mp3 install");
}

console.log("✓ Standalone bundle ready");
