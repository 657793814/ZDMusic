/**
 * 批量生成 app 图标
 * 从 source.svg → 所有尺寸的 PNG
 * 用法: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(__dirname, '..');
const SRC = join(PROJECT, 'src-tauri/icons/source.svg');
const PUBLIC = join(PROJECT, 'public');

const svgBuffer = readFileSync(SRC);

const sizes = {
  // src-tauri/icons
  'src-tauri/icons/icon.png': 512,
  'src-tauri/icons/128x128.png': 128,
  'src-tauri/icons/128x128@2x.png': 256,
  'src-tauri/icons/32x32.png': 32,
  'src-tauri/icons/Square30x30Logo.png': 30,
  'src-tauri/icons/Square44x44Logo.png': 44,
  'src-tauri/icons/Square71x71Logo.png': 71,
  'src-tauri/icons/Square89x89Logo.png': 89,
  'src-tauri/icons/Square107x107Logo.png': 107,
  'src-tauri/icons/Square142x142Logo.png': 142,
  'src-tauri/icons/Square150x150Logo.png': 150,
  'src-tauri/icons/Square284x284Logo.png': 284,
  'src-tauri/icons/Square310x310Logo.png': 310,
  'src-tauri/icons/StoreLogo.png': 50,

  // public
  'public/icon.ico': 256,     // sharp 会以 PNG 写 .ico，但够用了
  'public/icon-192.png': 192, // PWA
  'public/icon-512.png': 512,
};

async function main() {
  for (const [relPath, size] of Object.entries(sizes)) {
    const absPath = join(PROJECT, relPath);
    await mkdir(dirname(absPath), { recursive: true });

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(absPath);

    const kb = (await import('fs')).statSync(absPath).size / 1024;
    console.log(`  ${String(size).padEnd(4)} px  →  ${relPath}  (${kb.toFixed(1)} KB)`);
  }

  // 生成 icon.icns — macOS 需要
  console.log('\n⚠️  icon.icns 需要 macOS 的 iconutil 或 png2icns 工具');
  console.log('   建议在 Mac 上用 "iconutil -c icns iconset.iconset" 生成');
  console.log('   或保留现有的 icon.icns，它只是 macOS dock 用');
}

main().catch(e => { console.error(e); process.exit(1); });
