# 语音识别 & 听歌识曲 — 集成方案

## 一、语音识别（STT）替代方案

### 目前问题

当前使用 Web Speech API（浏览器内置 `SpeechRecognition`），本质是**Google 云端识别**，国内网络延迟大、不稳定。

### 推荐方案：阿里云语音识别（NLS）

| 项目 | 说明 |
|------|------|
| 服务 | 阿里云智能语音交互（NLS） |
| API | 一句话识别（REST）+ 实时识别（WebSocket） |
| 免费额度 | 每月 2 小时实时识别（新用户） |
| 延迟 | 国内节点，毫秒级返回 |
| SDK | `@alicloud/nls-sdk` Node.js |

### 架构

```
前端 (MediaRecorder)
  ↓ PCM/WAV 音频 buffer or file
  ─────────────────────────────────
  POST /api/stt  (Next.js API Route)
  ↓
阿里云 NLS (一句话识别 REST API)
  ↓
返回识别文本 → 前端填入输入框
```

### 交互流程

1. 用户点击麦克风按钮 → 前端开始录音（不再需要 SpeechRecognition）
2. 录音期间显示「正在听…」脉冲动画
3. 用户点击停止 → 前端停止录音，音频 blob 发送到 `/api/stt`
4. 后端调用阿里云 NLS → 返回文本 → 前端填入输入框
5. 若失败则显示错误提示

### 备选方案

| 服务 | API 类型 | 免费额度 | 复杂度 |
|------|---------|---------|-------|
| **阿里云 NLS** ✅ 推荐 | REST / WebSocket | 2h/月 | 中 |
| **百度语音识别** | REST | 每日 500 次 | 低 |
| **讯飞语音识别** | WebSocket | 新用户送体验包 | 高 |
| **whisper.cpp 本地** | 子进程 CLI | 完全免费、离线 | 高（需编译） |

> **决策建议：** 先用**阿里云 NLS**（免费额度够用、国内延迟低），以后可加本地 Whisper 兜底。

---

## 二、听歌识曲方案（ACRCloud Cloud + 本地匹配）

### 架构概览

```
用户点击「识曲」
  ↓
前端录音 10-15 秒 (MediaRecorder)
  ↓
POST /api/music-recognize  { audio: blob }
  ↓
┌─ config.musicRecognitionMode ─────────┐
│                                       │
│  "cloud"                              │  "local"
│    ↓                                  │    ↓
│  ACRCloud API (acrcloud.cn)           │  本地音频指纹匹配
│    ↓                                  │    ↓
│  返回 { title, artist, album, ... }   │  返回本地曲库 ID
│                                       │
└───────────────────────────────────────┘
  ↓
前端显示识别结果 → 点击可直接播放 / 加入歌单
```

### 2.1 Cloud 模式 — ACRCloud 集成

#### 前置条件

1. 注册 [ACRCloud.cn](https://www.acrcloud.cn)（中国区）
2. 创建项目，获取 `access_key` 和 `access_secret`
3. 选择「音频指纹识别」服务

#### API 说明

```
POST https://identify-china.acrcloud.cn/v1/identify
Content-Type: multipart/form-data

参数:
  access_key: <key>
  data_type: audio
  sample_rate: 8000
  audio: <file>  (10-15s WAV/PCM, 16bit 单声道 8kHz)
  timestamp: <当前 Unix 时间戳>
  signature: <HMAC-SHA1 签名>
```

签名算法：
```
string_to_sign = POST + "\n" + access_key + "\n" + data_type + "\n" + signature_version + "\n" + timestamp
signature = Base64(HMAC-SHA1(string_to_sign, access_secret))
```

#### 返回结果示例

```json
{
  "status": {
    "code": 0,
    "msg": "Success"
  },
  "metadata": {
    "music": [
      {
        "title": "晴天",
        "artists": [{"name": "周杰伦"}],
        "album": {"name": "叶惠美"},
        "duration_ms": 266000,
        "acr_id": "...",
        "external_ids": {
          "isrc": "TWK970300803",
          "upc": "..."
        }
      }
    ]
  }
}
```

### 2.2 Local 模式 — 本地音频指纹匹配

本地模式需要预先为本地音乐库建立音频指纹索引，运行时用录音片段匹配。

#### 方案：Chromaprint + 自建指纹库

| 组件 | 说明 |
|------|------|
| **Chromaprint** | 开源音频指纹提取库（FFmpeg 已集成） |
| **Fingerprint 存储** | SQLite（本地文件，无需服务） |
| **匹配算法** | 子指纹交叉比对 + 评分排序 |

#### 建立索引流程（扫描时执行）

```
遍历本地音乐文件
  ↓
ffmpeg → 16bit 单声道 16kHz PCM
  ↓
chromaprint(fingerprint) → 32-bit 整数数组（每 0.123s 一个指纹）
  ↓
存入数据库: track_id + fingerprint_sequence + duration
```

#### 匹配流程

```
录音 10-15s PCM → chromaprint 提取指纹
  ↓
从数据库中遍历指纹序列，滑动窗口匹配
  ↓
Hamming distance 计算相似度，取 Top-N
  ↓
相似度 > 阈值 → 匹配成功，返回曲目信息
```

#### 局限性

- 需要先扫描全部曲库建立指纹索引
- 匹配精度依赖曲库完整性
- 对录音质量有一定要求
- 首次索引建立耗时（数万首歌约 10-30 分钟）

---

## 三、配置项设计

在设置页面新增：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `stt.provider` | enum | `"aliyun"` | 语音识别服务商 |
| `stt.aliyun.appKey` | string | `""` | 阿里云 NLS AppKey |
| `stt.aliyun.accessKey` | string | `""` | 阿里云 AccessKey |
| `stt.aliyun.secret` | string | `""` | 阿里云 Secret |
| `musicRecognition.mode` | enum | `"cloud"` | 听歌识曲模式 |
| `musicRecognition.acrCloud.host` | string | `"identify-china.acrcloud.cn"` | ACRCloud 中国节点 |
| `musicRecognition.acrCloud.accessKey` | string | `""` | ACRCloud Key |
| `musicRecognition.acrCloud.accessSecret` | string | `""` | ACRCloud Secret |

---

## 四、实施计划

### Phase 1（语音识别替换）
1. 注册阿里云语音识别，获取密钥
2. 前端实现 `MediaRecorder` 录音（替换 `SpeechRecognition`）
3. 新建 `POST /api/stt` API Route
4. 集成阿里云 NLS SDK
5. 前端录音 → 后端识别 → 填入文本框（闭环测试）

### Phase 2（听歌识曲 — Cloud 模式）
1. 注册 ACRCloud，获取密钥
2. 新建 `POST /api/music-recognize` API Route
3. 前端实现短时录音（10-15 秒）+ 发送识曲
4. 识别结果展示 UI（悬浮卡片：歌名 + 歌手 + 播放按钮）
5. 配置项管理（存 ZDMusic config）

### Phase 3（听歌识曲 — Local 模式）
1. 调研 Chromaprint 的 Node.js 绑定或 CLI 调用
2. 设计本地指纹库表结构
3. 曲库扫描时建立指纹索引
4. 实现录音指纹提取 + 匹配算法
5. 集成到 `/api/music-recognize`，切换模式

---

## 五、Key Decisions

1. **语音识别不走 Web Speech API** — 换阿里云 REST API，国内可用的端到端方案
2. **录音逻辑统一** — 前端 `MediaRecorder` 同时服务 STT 和识曲，复用录音 hook
3. **API 路由集中管理** — 所有第三方 API 密钥放在 Next.js 后端，前端不暴露
4. **local 识曲先行可用** — Cloud 模式先用 ACRCloud 上线，Local 模式后续补
5. **配置持久化** — 密钥通过 `/api/config` 读写，存本地 JSON，不暴露到 git
