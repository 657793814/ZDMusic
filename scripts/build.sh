#!/usr/bin/env bash
# ============================================
# 卓动悦听 — 一键打包脚本
# 用法:
#   npm run tauri:build            # 构建 .app + .dmg
#   npm run tauri:build -- --app   # 仅构建 .app，跳过 DMG
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

echo "   Node: $(node -v)"
echo "   npm:  $(npm -v)"
echo "   Rust: $(rustc --version 2>/dev/null || echo '未找到 rustc')"

# ---------- 清理旧残留 ----------
echo ""
echo "🧹 清理旧构建残留..."
rm -f "$BUNDLE_DIR/rw.*.dmg"
rm -f "$DMG_DIR/卓动悦听_*.dmg"

# 清理 debug 编译产物（仅在 build 时，dev 模式不清理）
if [ -d "src-tauri/target/debug" ]; then
  echo "   🗑️ 清理 Debug 编译产物..."
  rm -rf "src-tauri/target/debug"
fi

# 清理 Tauri 临时文件
find "src-tauri/target" -name ".tmp_*" -delete 2>/dev/null || true

echo "   ✅ 旧构建残留已清理"

# ---------- Tauri 打包（含 beforeBuildCommand 中的 Next.js 构建 + 精简）----------
echo ""
echo "📦 [1/2] Tauri 构建 .app..."
# --bundles app 跳过 Tauri 自带的 create-dmg 流程，只生成 .app
npx tauri build --bundles app

APP_PATH="$BUNDLE_DIR/$PROJECT.app"
if [ ! -d "$APP_PATH" ]; then
  echo "❌ .app 未生成，构建失败"
  exit 1
fi

APP_MB=$(du -sm "$APP_PATH" | cut -f1)
echo ""
echo "✅ .app 打包完成 (${APP_MB}MB)"
du -sh "$APP_PATH"

# ---------- 参数解析 ----------
SKIP_DMG=false
for arg in "$@"; do
  case "$arg" in
    --app|-a) SKIP_DMG=true ;;
    --help|-h)
      echo "用法: $0 [选项]"
      echo "  --app     仅构建 .app，跳过 DMG"
      echo "  --help    显示此帮助"
      exit 0
      ;;
  esac
done

# ---------- DMG ----------
if [ "$SKIP_DMG" = false ]; then
  echo ""
  echo "📦 [2/2] 生成 .dmg..."

  mkdir -p "$DMG_DIR"
  DMG_PATH="$DMG_DIR/$PROJECT.dmg"
  rm -f "$DMG_PATH"

  # 按 .app 大小 + 50% 余量预分配，防止 hdiutil 空间不足
  DMG_MB=$((APP_MB + APP_MB / 2 + 50))
  echo "   .app: ${APP_MB}MB → DMG 预分配: ${DMG_MB}MB"

  hdiutil create \
    -volname "$PROJECT" \
    -srcfolder "$APP_PATH" \
    -ov \
    -format UDZO \
    -size "${DMG_MB}m" \
    "$DMG_PATH"

  echo ""
  echo "✅ .dmg 生成完成"
  du -sh "$DMG_PATH"
fi

echo ""
echo "🎉 构建完毕！"
echo "   .app: $APP_PATH"
[ "$SKIP_DMG" = false ] && echo "   .dmg: $DMG_DIR/$PROJECT.dmg"