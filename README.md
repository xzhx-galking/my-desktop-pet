# 🎀 夜乃樱桌宠 — My Desktop Pet

> 基于 Electron + DeepSeek + GPT-SoVITS 的桌面宠物  
> 角色：**夜乃樱**（学园会长 × 傲娇女友）  
> 功能：实时 AI 对话 · 屏幕感知吐槽 · 138 种情感立绘 · TTS 语音

---

## ✨ 功能特色

- 🖼️ **透明悬浮桌宠** — 始终置顶，穿越桌面，支持拖拽和缩放
- 💬 **AI 对话** — 接入 DeepSeek，傲娇女友人格，多段话推进（Galgame 风格）
- 🎤 **TTS 语音** — GPT-SoVITS 合成语音，点击箭头逐段播放
- 👁️ **屏幕感知** — 自动检测当前窗口，AI 根据内容吐槽
- 🎨 **138 种表情** — 根据对话情感自动切换立绘
- ⚙️ **高度可配置** — 自定义 API 地址 / 密钥 / 立绘 / 脚本

---

## 📥 安装

### 方式一：从源码运行（推荐）

项目根目录提供了三个脚本，双击即可运行：

| 脚本 | 功能 |
|------|------|
| `setup.bat` | 一键安装 — 检查环境 → 安装依赖 → 配置 API 密钥 |
| `run_dev.bat` | 启动桌宠 — 以开发模式运行，支持热重载 |
| `build_installer.bat` | 打包安装程序 — 生成 `.exe` 安装包 |

```bash
# 或者手动操作：
git clone https://github.com/xzhx-galking/my-desktop-pet.git
cd my-desktop-pet
npm install
cp .env.example .env    # 编辑填入你的 DeepSeek API Key
npm run dev             # 启动桌宠
npm run build:win       # 打包安装程序
```

> 💡 首次启动需加载语音模型，约 30 秒~2 分钟，请耐心等待。
> GPT-SoVITS 语音引擎（约 18 GB）需单独下载，在「设置 → 语音模块」中配置路径。

---

## 🎮 使用说明

### 首页
- 点击 **启动桌宠** 打开透明悬浮窗（默认立绘 A10.png）
- 右上角 ⚙️ 齿轮进入设置页面

### 设置页面
| 标签 | 说明 |
|------|------|
| 🎤 语音模块 | 启动/停止 GPT-SoVITS，选择参考音频，调整参数 |
| 👁 截屏监控 | 定时检测屏幕窗口，AI 自动吐槽 |
| ⚡ 服务 | 绑定常用脚本，一键运行 |
| 🎨 立绘设置 | 更换默认立绘 |
| 🔑 API 设置 | 自定义 API 地址和 Key |

### 桌宠窗口
- 🐾 点击立绘拖拽移动
- 🔄 右下角拖拽缩放
- 💬 点击对话框推进段落
- 📸 右下角按钮手动截屏
- ❌ 右键 / Esc 关闭

---

## 📦 打包分发

```bash
# 打出 Windows 安装包
npm run build:win

# 产物在 dist/ 目录
# dist/my-desktop-pet-1.0.0-setup.exe
```

打包后的安装包可发给朋友，朋友只需：
1. 双击安装
2. 配置 API Key（设置 → API 设置）
3. 放置 GPT-SoVITS（设置 → 语音模块）
4. 开始使用 🎉

---

## 🔧 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | — |
| `PET_VOICE_DIR` | GPT-SoVITS 目录路径 | `resources/gpt-sovits/` |

---

## 📁 项目结构

```
src/
├── main/index.ts           ← 主进程（API / TTS / 截屏）
├── renderer/
│   ├── pet-overlay.html    ← 桌宠悬浮窗口
│   └── src/
│       ├── pet-main.ts     ← 桌宠交互逻辑
│       ├── views/          ← 设置页面
│       └── stores/         ← 状态管理
├── preload/index.ts        ← IPC 桥接
resources/                  ← 资源文件
├── poses/                  ← 立绘 138 张 + 标签.txt
└── audio/                  ← 参考音频
```

---

## 📝 依赖

- [Electron](https://electronjs.org/) — 桌面框架
- [Vue 3](https://vuejs.org/) — UI 框架
- [DeepSeek API](https://platform.deepseek.com/) — AI 对话
- [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) — 语音合成
- [electron-vite](https://electron-vite.org/) — 构建工具
- [electron-builder](https://www.electron.build/) — 打包分发

---

> 🎀 让桌面多一份温暖 — 夜乃樱桌宠
