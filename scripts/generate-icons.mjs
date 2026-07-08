import { cpSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const iconsDir = resolve(root, "src-tauri", "icons");
const svgPath = resolve(iconsDir, "source.svg");
const svg = readFileSync(svgPath, "utf-8");

// Sizes to generate (filename => px)
const sizes = {
  "32x32.png": 32,
  "128x128.png": 128,
  "128x128@2x.png": 256,
  "Square30x30Logo.png": 30,
  "Square44x44Logo.png": 44,
  "Square71x71Logo.png": 71,
  "Square89x89Logo.png": 89,
  "Square107x107Logo.png": 107,
  "Square142x142Logo.png": 142,
  "Square150x150Logo.png": 150,
  "Square284x284Logo.png": 284,
  "Square310x310Logo.png": 310,
  "StoreLogo.png": 50,
  "icon.png": 512,
};

// Render 1024x1024 as base
const basePng = await sharp(Buffer.from(svg))
  .resize(1024, 1024)
  .png()
  .toBuffer();

// Generate all size PNGs
for (const [file, size] of Object.entries(sizes)) {
  await sharp(basePng)
    .resize(size, size)
    .png()
    .toFile(resolve(iconsDir, file));
  console.log(`✓ ${file} (${size}x${size})`);
}

// Generate icon.icns via iconset
const iconsetDir = "/tmp/aura-icon.iconset";
mkdirSync(iconsetDir, { recursive: true });

const iconsetSizes = [
  [16, 16, "icon_16x16.png"],
  [32, 32, "icon_16x16@2x.png"],
  [32, 32, "icon_32x32.png"],
  [64, 64, "icon_32x32@2x.png"],
  [128, 128, "icon_128x128.png"],
  [256, 256, "icon_128x128@2x.png"],
  [256, 256, "icon_256x256.png"],
  [512, 512, "icon_256x256@2x.png"],
  [512, 512, "icon_512x512.png"],
  [1024, 1024, "icon_512x512@2x.png"],
];

for (const [w, h, name] of iconsetSizes) {
  const buf = await sharp(basePng).resize(w, h).png().toBuffer();
  writeFileSync(resolve(iconsetDir, name), buf);
}

execSync(`iconutil -c icns "${iconsetDir}" -o "${iconsDir}/icon.icns"`, { stdio: "inherit" });
console.log("✓ icon.icns");

// icon.ico — copy 256x256 as placeholder
cpSync(resolve(iconsDir, "128x128@2x.png"), resolve(iconsDir, "icon.ico"));
console.log("✓ icon.ico");

// Cleanup
rmSync(iconsetDir, { recursive: true, force: true });
console.log("✅ All icons ready");
