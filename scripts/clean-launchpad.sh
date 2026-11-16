#!/usr/bin/env bash
# 清理 Launchpad 里多出来的「卓动悦听」图标（兜底工具，build.sh 已自动处理）。
#
# 现象：Launchpad 里卓动悦听出现两次以上，其中一个是安装到旧 dmg 卷、废纸篓或
#       源码 bundle/macos/ 里的副本，点了会跳到那些目录而不是真应用。
# 根因：macOS 把构建产物、挂过的 dmg 卷、废纸篓里的 .app 也注册进 LaunchServices，
#       Launchpad 把它们当独立应用列出来。/Applications 下才是真正安装的。
#
# 用法：bash scripts/clean-launchpad.sh
set -euo pipefail

cd "$(dirname "$0")/.."
LS=/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister

# 1. 标记 src-tauri/ 不参与索引（cargo clean 不会删这个标记）
: > src-tauri/.metadata_never_index
chflags hidden src-tauri/target 2>/dev/null || true
echo "✓ 已标记构建目录不参与索引"

# 2. 把还留在 macos/ 里的旧 .app 移进隐藏 staging
src="src-tauri/target/release/bundle/macos/卓动悦听.app"
stage="src-tauri/target/release/bundle/.staging"
if [ -d "$src" ]; then
  mkdir -p "$stage"
  : > "$stage/.metadata_never_index"
  rm -rf "$stage/卓动悦听.app"
  mv "$src" "$stage/卓动悦听.app"
  chflags hidden "$stage" 2>/dev/null || true
  echo "✓ 已移走 macos/ 里的旧构建产物"
fi

# 3. 注销所有非 /Applications 的残留注册。
#    注意：路径可能已不存在（卸载的卷、清空过的废纸篓），所以不预先判断存在性。
ABS="$(pwd)"
targets=(
  "$HOME/.Trash/卓动悦听.app"
  "/Volumes/卓动悦听/卓动悦听.app"
  "/Volumes/卓动悦听 1/卓动悦听.app"
  "/Volumes/卓动悦听 2/卓动悦听.app"
  "/Volumes/卓动悦听 4/卓动悦听.app"
  "/private/tmp/zdmusic-app-test.44fHUt/卓动悦听.app"
  "$ABS/src-tauri/target/release/bundle/macos/卓动悦听.app"
  "$ABS/src-tauri/target/release/bundle/.staging/卓动悦听.app"
)
for p in "${targets[@]}"; do
  "$LS" -u -f "$p" >/dev/null 2>&1 || true
done
echo "✓ 已取消残留应用注册"

# 4. 确保真正安装的应用在册（防止路径写法误伤 /Applications 那条）
if [ -d "/Applications/卓动悦听.app" ]; then
  "$LS" -R -f "/Applications/卓动悦听.app" >/dev/null 2>&1 || true
fi

# 5. 卸载还没推出的 dmg 卷
mounted="$(mount | grep -i '/Volumes/卓动悦听' | sed -E 's#.* on (/Volumes/[^ ]+) \(.*#\1#' || true)"
if [ -n "$mounted" ]; then
  while IFS= read -r vol; do
    [ -n "$vol" ] || continue
    hdiutil detach "$vol" >/dev/null 2>&1 || true
    echo "✓ 已卸载 $vol"
  done <<< "$mounted"
fi

# 6. 重建索引 + 重启 Dock
mdutil -E / >/dev/null 2>&1 || true
killall Dock 2>/dev/null || true
echo "✓ 已重启 Dock"

echo
echo "完成。Launchpad 里应该只剩 /Applications 下真正安装的卓动悦听。"
echo "若旧图标仍在：退出登录再登录一次（索引重建需要几分钟）。"
