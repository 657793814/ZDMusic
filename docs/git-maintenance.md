# 卓动悦听 — Git 维护记录

> 文档最后更新: 2026-07-09

---

## 仓库瘦身记录

### 背景

项目早期不小心把 **DMG 安装包**（~140MB 每个）提交到了 Git 仓库中。虽然之后删除了文件，但 Git 历史中仍保留着这些大文件的 blob 对象，导致：

- 仓库包体积：**117 MB**（含 2 个已删除的 DMG）
- 推送云效时报错：`remote: 内部服务错误 (182/625)` — chunk 上传超时

### 处理过程

#### 1. 找出大文件

```bash
# 查看历史中所有 blob 大小，按从大到小排序
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' \
  | awk '/^blob/ {print substr($0,6)}' | sort -k1 -rn | head -10
```

发现两个大文件：
- `卓动悦听-20260709.dmg` — 139 MB
- `卓动悦听-20260709-v2.dmg` — 138 MB

#### 2. 从 Git 历史中彻底删除

```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch "卓动悦听-20260709.dmg" "卓动悦听-20260709-v2.dmg"' \
  --prune-empty --tag-name-filter cat -- --all
```

⚠️ **注意**：`filter-branch` 会重写所有 commit 的 SHA，**已有远端仓库需要 `--force` 推送**。

#### 3. 清理引用和压缩

```bash
# 删除 filter-branch 留下的 backup refs
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin

# 过期所有 reflog
git reflog expire --expire=now --all

# 激进 GC，彻底清除不可达对象
git gc --prune=now --aggressive
```

#### 4. 确认效果

```bash
git count-objects -vH
```

```
size-pack: 3.06 MiB   ← 从 117 MB 降到约 3 MB
```

#### 5. 强制推送

```bash
# 增大 HTTP 缓冲区，避免 chunk 上传断开
git config http.postBuffer 524288000

# 强制推送（历史已重写）
git push origin main --force
```

> **注意**：如果团队成员有 clone，需要执行 `git pull --rebase` 或重新 clone。

---

## 后续预防

### `.gitignore` 已配置

在项目 `.gitignore` 中添加构建产物忽略：

```
# 构建产物
/dist/
/.next/
/out/

# Tauri 编译产物
/src-tauri/target/
*.dmg
```

### 提交前检查

可以用以下命令检查是否有大文件即将提交：

```bash
# 暂存区中较大的文件（> 10MB）
git diff --cached --name-only -z | xargs -0 ls -l | awk '{if ($5 > 10485760) print}'
```

### 如果又不小心提交了大文件

```bash
# 方案1：用 filter-repo（推荐，比 filter-branch 快）
# pip install git-filter-repo
git filter-repo --path-glob '*.dmg' --invert-paths

# 方案2：git filter-branch（如上）
```

---

## 云效推送常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `内部服务错误` + `(N/625)` | 上传数据量过大或 chunk 超时 | 设置 `http.postBuffer` 或清理历史大文件 |
| `the remote end hung up unexpectedly` | 单个请求耗时过长被断开 | 增大 `http.postBuffer`、清理历史、或改用 SSH |
| `failed to push some refs` + 非快进 | 远端有新的提交 | 先 `git pull --rebase` |

### Git 配置调优

```bash
# 增大 HTTP 缓冲区（解决大 pack 推送超时）
git config http.postBuffer 524288000   # 512 MB

# 减小推送包大小（云效可能有单包大小限制）
git config pack.packSizeLimit 20m
```