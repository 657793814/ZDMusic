#!/usr/bin/env bash
# ============================================
# 卓动悦听 — 一键打包脚本
# 用法:
#   ./scripts/build.sh           # 构建 .app + .dmg
#   ./scripts/build.sh --no-dmg  # 仅构建 .app，跳过 DMG
#   ./scripts/build.sh --help    # 查看帮助
# ============================================
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT="卓动悦听"
BUNDLE_DIR="src-tauri/target/release/bundle/macos"
DMG_DIR="src-tauri/target/release/bundle/dmg"

# ---------- 环境初始化 ----------
echo "🔧 初始化环境..."

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use 22.22.3 --silent 2>/dev/null || true
fi

export PATH="$HOME/.cargo/bin:$PATH"

# 验证工具链
echo "   Node: $(node -v)"
echo "   npm:  $(npm -v)"
echo "   Rust: $(rustc --version 2>/dev/null || echo '未找到 rustc')"

# ---------- 1. Next.js 构建 ----------
echo ""
echo "📦 [1/4] Next.js 构建..."
npm run build

# ---------- 2. 精简 Standalone ----------
echo ""
echo "📦 [2/4] 精简 Standalone 产物..."
node scripts/prepare-standalone.mjs

# ---------- 3. Tauri 打包 ----------
echo ""
echo "📦 [3/4] Tauri 打包 .app..."
npx tauri build --bundles app

APP_PATH="$BUNDLE_DIR/$PROJECT.app"
if [ ! -d "$APP_PATH" ]; then
  echo "❌ .app 未生成，打包失败"
  exit 1
fi

echo ""
echo "✅ .app 打包完成"
du -sh "$APP_PATH"

# ---------- 4. 默认生成 DMG ----------
SKIP_DMG=false
for arg in "$@"; do
  case "$arg" in
    --no-dmg|-n) SKIP_DMG=true ;;
    --help|-h)
      echo "用法: $0 [选项]"
      echo "  --no-dmg  仅构建 .app，跳过 DMG"
      echo "  --help    显示此帮助"
      exit 0
      ;;
  esac
done

if [ "$SKIP_DMG" = false ]; then
  echo ""
  echo "📦 [4/4] 生成 .dmg..."
  mkdir -p "$DMG_DIR"
  DMG_PATH="$DMG_DIR/$PROJECT.dmg"
  rm -f "$DMG_PATH"
  hdiutil create \
    -volname "$PROJECT" \
    -srcfolder "$APP_PATH" \
    -ov \
    -format UDZO \
    -size 300m \
    "$DMG_PATH"
  echo ""
  echo "✅ .dmg 生成完成"
  du -sh "$DMG_PATH"
fi

echo ""
echo "🎉 构建完毕！"
echo "   .app: $APP_PATH"
[ "$SKIP_DMG" = false ] && echo "   .dmg: $DMG_DIR/$PROJECT.dmg"