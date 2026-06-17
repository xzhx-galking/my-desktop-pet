import 'dotenv/config'
import { app, shell, BrowserWindow, ipcMain, dialog, screen, desktopCapturer } from 'electron'

// 禁用自动播放策略（确保 TTS 语音能不受限制地播放）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
import { join, extname } from 'path'
import { readFileSync, existsSync } from 'fs'
import { readdir, readFile, writeFile } from 'fs/promises'
import { spawn, type ChildProcess } from 'child_process'
import icon from '../../resources/icon.png?asset'

// 将 Windows 终端切到 UTF-8 编码，让 console.log 正常显示中文
// 替代 @electron-toolkit/utils
const isDev = !app.isPackaged

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId(isDev ? process.execPath : 'com.electron')
  }

  // F12 toggle devtools; Ctrl/Cmd+R prevent in production
  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown') {
        if (!isDev) {
          if (input.code === 'KeyR' && (input.control || input.meta))
            _event.preventDefault()
          if (
            input.code === 'KeyI' &&
            ((input.alt && input.meta) || (input.control && input.shift))
          )
            _event.preventDefault()
        } else if (input.code === 'F12') {
          const wc = window.webContents
          if (wc.isDevToolsOpened()) wc.closeDevTools()
          else wc.openDevTools({ mode: 'undocked' })
        }
      }
    })
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // ── 桌宠 IPC: 文件夹选择 ──
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── 桌宠 IPC: 文件选择 ──
  ipcMain.handle('dialog:selectFile', async (_event, options: { filters: { name: string; extensions: string[] }[]; defaultPath?: string }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options.filters,
      defaultPath: options.defaultPath
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── 桌宠 IPC: 读取目录文件 ──
  ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => ({
        name: e.name,
        ext: extname(e.name).toLowerCase()
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return files
  })

  // ── 桌宠 IPC: 读取文件为 DataURL ──
  ipcMain.handle('file:readAsDataUrl', async (_event, filePath: string) => {
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json'
    }
    const ext = extname(filePath).toLowerCase()
    const mime = mimeMap[ext] || 'application/octet-stream'
    const data = await readFile(filePath)
    return `data:${mime};base64,${data.toString('base64')}`
  })

  // ── 桌宠 IPC: 宠物窗口管理 ──
  let petWindow: BrowserWindow | null = null
  let petWindowPos = { x: 0, y: 0 }

  // 暂存待发送的模型数据（窗口就绪后发送）
  let pendingModelData = ''

  function createPetWindow(): void {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.show()
      petWindow.focus()
      // 已有窗口 → 把待发送的数据发过去
      if (pendingModelData) {
        petWindow.webContents.send('pet:showModel', pendingModelData)
      }
      return
    }

    const display = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = display.workAreaSize

    petWindow = new BrowserWindow({
      width: 240,
      height: 240,
      x: screenW - 260,
      y: screenH - 260,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      focusable: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        webSecurity: true
      }
    })

    petWindowPos = { x: screenW - 260, y: screenH - 260 }

    // 页面加载完成后推送模型数据（备份方案）
    petWindow.webContents.on('did-finish-load', () => {
      if (pendingModelData) {
        petWindow?.webContents.send('pet:showModel', pendingModelData)
      }
    })

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      const baseUrl = process.env['ELECTRON_RENDERER_URL'].replace(/\/$/, '')
      petWindow.loadURL(`${baseUrl}/pet-overlay.html`)
    } else {
      petWindow.loadFile(join(__dirname, '../renderer/pet-overlay.html'))
    }

    // 失焦/聚焦处理：
    // 注意：不能在这里设置 setIgnoreMouseEvents(true) 否则整个窗口无视鼠标，
    // 导致失焦后无法再次点击宠物模型。CSS 已通过 pointer-events: none/auto 控制。
    petWindow.on('blur', () => {
      console.log('[pet] 窗口失焦 — 隐藏手柄（CSS pointer-events 继续保持人物可点击）')
    })
    petWindow.on('focus', () => {
      console.log('[pet] 窗口聚焦')
    })

    petWindow.on('closed', () => {
      petWindow = null
    })
  }

  ipcMain.handle('pet:openModel', async (_event, data: { filePath: string; dataUrl: string }) => {
    pendingModelData = data.dataUrl
    if (!pendingModelData) {
      // 没有指定立绘 → 自动加载默认立绘 A10.png
      try {
        const defaultPose = join(RESOURCES_DIR, 'poses', 'A10.png')
        const buf = await readFile(defaultPose)
        pendingModelData = `data:image/png;base64,${buf.toString('base64')}`
      } catch (err) {
        console.error('[pet] 加载默认立绘 A10.png 失败:', err)
      }
    }
    createPetWindow()
  })

  // 宠物窗口请求待发送的模型数据（用于关闭后重启场景）
  ipcMain.handle('pet:requestModel', () => {
    return pendingModelData
  })

  ipcMain.handle('pet:hide', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.close()
      petWindow = null
    }
  })

  ipcMain.handle('pet:getPosition', () => {
    return petWindowPos
  })

  ipcMain.on('pet:moveWindow', (_event, pos: { x: number; y: number }) => {
    if (petWindow && !petWindow.isDestroyed()) {
      const [w, h] = petWindow.getSize()
      petWindow.setBounds({
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        width: w,
        height: h
      })
      petWindowPos = { x: Math.round(pos.x), y: Math.round(pos.y) }
    }
  })

  // ── 桌宠 IPC: 获取窗口尺寸（用于缩放） ──
  ipcMain.handle('pet:getWindowSize', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      const [w, h] = petWindow.getSize()
      return { width: w, height: h }
    }
    return { width: 240, height: 240 }
  })

  // ── 桌宠 IPC: 强制锁定窗口尺寸（临时开启 resizable 设完即关） ──
  ipcMain.on('pet:lockSize', (_event, width: number, height: number) => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.resizable = true
      petWindow.setBounds({
        width: Math.round(width),
        height: Math.round(height)
      })
      petWindow.resizable = false
    }
  })

  // ── 桌宠 IPC: 设置鼠标穿透 ──
  ipcMain.on('pet:setClickThrough', (_event, clickThrough: boolean) => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.setIgnoreMouseEvents(clickThrough, { forward: true })
    }
  })

  // ── 桌宠 IPC: 按情感名称切换立绘表情（供渲染器点击推进时调用） ──
  ipcMain.on('pet:setEmotionByName', (_event, emotion: string) => {
    updatePetEmotion(emotion).catch(err => console.error('[pet] 情感切换失败:', emotion, err))
  })

  createWindow()

  // ════════════════════════════════════════
  //  资源路径解析（开发模式用项目目录，打包后用 process.resourcesPath）
  // ════════════════════════════════════════
  const RESOURCES_DIR = isDev
    ? join(app.getAppPath(), 'resources')
    : process.resourcesPath

  /** 读取默认参考音频原文字（resources/audio/ref.txt），用于提升音色相似度 */
  function getDefaultPromptText(): string {
    try {
      return readFileSync(join(RESOURCES_DIR, 'audio', 'ref.txt'), 'utf-8').trim()
    } catch {
      return ''
    }
  }

  // ════════════════════════════════════════
  //  语音模块 — GPT-SoVITS TTS 服务管理
  // ════════════════════════════════════════

  /** GPT-SoVITS 目录：默认 resources/gpt-sovits，可通过 PET_VOICE_DIR 环境变量覆盖 */
  function getVoiceDir(): string {
    const defaultDir = process.env.PET_VOICE_DIR || join(RESOURCES_DIR, 'gpt-sovits')
    // 检查默认路径是否存在
    if (existsSync(join(defaultDir, 'runtime', 'python.exe'))) return defaultDir
    // 不存在则尝试旧路径（本地开发/迁移兼容）
    const oldPath = 'E:\\GPT-SoVITS-v2pro-20250604'
    if (existsSync(join(oldPath, 'runtime', 'python.exe'))) {
      console.log('[voice] GPT-SoVITS 使用旧路径:', oldPath)
      return oldPath
    }
    console.warn('[voice] GPT-SoVITS 未找到，请配置 PET_VOICE_DIR 或在 resources/gpt-sovits 放置')
    return defaultDir
  }
  const VOICE_PYTHON = join(getVoiceDir(), 'runtime', 'python.exe')
  const VOICE_SCRIPT = join(getVoiceDir(), 'api_v2.py')
  const VOICE_PORT = 9880
  const VOICE_CWD = getVoiceDir()

  let voiceProcess: ChildProcess | null = null

  /** 获取语音服务状态 */
  function getVoiceStatus(): { running: boolean; pid: number | null } {
    if (voiceProcess && !voiceProcess.killed && voiceProcess.exitCode === null) {
      return { running: true, pid: voiceProcess.pid ?? null }
    }
    return { running: false, pid: null }
  }

  ipcMain.handle('voice:status', () => getVoiceStatus())

  /** 启动语音服务 */
  ipcMain.handle('voice:start', async (_event, modelPaths?: { gpt?: string; sovits?: string }) => {
    const st = getVoiceStatus()
    if (st.running) return { success: true, message: '服务已在运行', pid: st.pid }

    // 写入自定义配置文件（使用用户选择的模型路径）
    try {
      const gptPath = modelPaths?.gpt || 'GPT_weights_v2ProPlus/夜乃樱音频-e15.ckpt'
      const sovitsPath = modelPaths?.sovits || 'SoVITS_weights_v2ProPlus/夜乃樱音频_e8_s704.pth'
      const yamlContent = `custom:
  bert_base_path: GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large
  cnhuhbert_base_path: GPT_SoVITS/pretrained_models/chinese-hubert-base
  device: cuda
  is_half: true
  t2s_weights_path: ${gptPath}
  version: v2ProPlus
  vits_weights_path: ${sovitsPath}
`
      await writeFile(join(VOICE_CWD, 'GPT_SoVITS/configs/tts_infer_v2proplus_user.yaml'), yamlContent, 'utf-8')
      console.log('[voice] 配置文件已更新: GPT=', gptPath, 'SoVITS=', sovitsPath)
    } catch (cfgErr) {
      console.error('[voice] 写入配置文件失败:', cfgErr)
    }

    return new Promise((resolve) => {
      try {
        voiceProcess = spawn(VOICE_PYTHON, [VOICE_SCRIPT, '-p', String(VOICE_PORT), '-c', 'GPT_SoVITS/configs/tts_infer_v2proplus_user.yaml'], {
          cwd: VOICE_CWD,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        })

        let started = false
        const onData = (chunk: string) => {
          console.log('[voice]', chunk.trim())
          if (!started && (chunk.includes('Uvicorn running') || chunk.includes('Application startup'))) {
            started = true
            resolve({ success: true, message: '服务启动成功', pid: voiceProcess?.pid ?? null })
          }
        }

        voiceProcess.stdout?.on('data', (d: Buffer) => onData(d.toString()))
        voiceProcess.stderr?.on('data', (d: Buffer) => onData(d.toString()))

        voiceProcess.on('error', (err) => {
          console.error('[voice] 启动失败:', err)
          voiceProcess = null
          resolve({ success: false, message: `启动失败: ${err.message}` })
        })

        voiceProcess.on('exit', (code) => {
          console.log('[voice] 进程退出, code:', code)
          voiceProcess = null
          if (!started) resolve({ success: false, message: `进程退出, code=${code}` })
        })

        // 超时保护（60 秒）
        setTimeout(() => {
          if (!started) {
            started = true
            resolve({ success: true, message: '服务启动中（可能已就绪，等待超时）', pid: voiceProcess?.pid ?? null })
          }
        }, 60000)
      } catch (err) {
        voiceProcess = null
        resolve({ success: false, message: `异常: ${(err as Error).message}` })
      }
    }).then(async (result: unknown) => {
      // 服务已启动 → 立即发一次预热 TTS 让模型加载到 GPU
      const r = result as { success: boolean; message: string; pid?: number | null }
      if (r && r.success) {
        try {
          console.log('[voice] 模型预热中（发送首次 TTS 请求触发加载）...')
          const warmBody = JSON.stringify({
            text: 'こんにちは',
            text_lang: 'ja',
            ref_audio_path: join(RESOURCES_DIR, 'audio', 'ref.mp3'),
            prompt_text: getDefaultPromptText(),
            prompt_lang: 'ja',
            media_type: 'wav',
            top_k: 15, top_p: 0.9, temperature: 0.8, speed_factor: 1.0,
            repetition_penalty: 1.15, sample_steps: 16,
            parallel_infer: true, text_split_method: 'cut3'
          })
          const warmRes = await fetch(`http://127.0.0.1:${VOICE_PORT}/tts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: warmBody
          })
          if (warmRes.ok) console.log('[voice] 模型预热完成 ✓')
          else console.warn('[voice] 预热 TTS 响应异常:', warmRes.status)
        } catch (warmErr) {
          // 预热失败不影响启动结果（可能只是第一次加载慢点）
          console.warn('[voice] 预热 TTS 请求失败（不影响后续使用）:', (warmErr as Error).message)
        }
      }
      return result
    })
  })

  /** 停止语音服务 */
  ipcMain.handle('voice:stop', async () => {
    if (voiceProcess && !voiceProcess.killed) {
      voiceProcess.kill('SIGTERM')
      voiceProcess = null
      return { success: true, message: '服务已停止' }
    }
    return { success: true, message: '服务未运行' }
  })

  /** TTS 合成：转发到 Python API，返回 audio/wav 的 base64 data URL */
  ipcMain.handle('voice:tts', async (_event, params: {
    text: string
    text_lang: string
    ref_audio_path: string
    prompt_text?: string
    prompt_lang?: string
    top_k?: number
    top_p?: number
    temperature?: number
    speed_factor?: number
    repetition_penalty?: number
    sample_steps?: number
  }) => {
    const st = getVoiceStatus()
    if (!st.running) {
      return { success: false, message: '语音服务未启动', dataUrl: '' }
    }

    try {
      // 使用 POST 请求（避免长文本 URL 被截断）
      const refAudioPath = params.ref_audio_path || join(RESOURCES_DIR, 'audio', 'ref.mp3')
      const body = JSON.stringify({
        text: params.text,
        text_lang: params.text_lang || 'ja',
        ref_audio_path: refAudioPath,
        prompt_text: params.prompt_text || getDefaultPromptText(),
        prompt_lang: params.prompt_lang || 'ja',
        media_type: 'wav',
        top_k: params.top_k ?? 15,
        top_p: params.top_p ?? 0.9,
        temperature: params.temperature ?? 0.8,
        speed_factor: params.speed_factor ?? 1.0,
        repetition_penalty: params.repetition_penalty ?? 1.15,
        sample_steps: params.sample_steps ?? 16,
        parallel_infer: true,
        text_split_method: 'cut3'   // 按标点自然分段，不切分日文逗号、
      })
      console.log('[voice] TTS 请求 POST, text 长度:', params.text.length)

      const res = await fetch(`http://127.0.0.1:${VOICE_PORT}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        console.error('[voice] TTS 错误响应:', errText)
        return { success: false, message: `TTS 失败: ${errText}`, dataUrl: '' }
      }

      const arrayBuffer = await res.arrayBuffer()
      console.log('[voice] TTS 成功, 音频大小:', arrayBuffer.byteLength, 'bytes')
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const dataUrl = `data:audio/wav;base64,${base64}`
      return { success: true, message: 'ok', dataUrl }
    } catch (err) {
      console.error('[voice] TTS 异常:', err)
      return { success: false, message: `TTS 请求异常: ${(err as Error).message}`, dataUrl: '' }
    }
  })

  /** 读取 bundled 参考音频原文（resources/audio/ref.txt） */
  ipcMain.handle('get:defaultPromptText', () => {
    return getDefaultPromptText()
  })

  // ════════════════════════════════════════
  //  AI 对话 — DeepSeek API
  // ════════════════════════════════════════

  // API Key & URL：优先使用 UI 设置的值，否则从 .env 读取默认值
  const ENV_API_KEY = process.env.DEEPSEEK_API_KEY || ''
  const DEFAULT_API_URL = 'https://api.deepseek.com/v1/chat/completions'
  let uiApiKey = ''
  let uiApiUrl = ''
  function getActiveApiKey(): string { return uiApiKey || ENV_API_KEY }
  function getActiveApiUrl(): string { return uiApiUrl || DEFAULT_API_URL }
  const DEEPSEEK_MODEL = 'deepseek-chat'   // DeepSeek V4

  /** 获取 API 配置状态（UI 用） */
  ipcMain.handle('get:apiConfig', () => {
    const key = getActiveApiKey()
    return {
      configured: !!key && key !== 'your_api_key_here',
      masked: key ? key.slice(0, 8) + '••••' + key.slice(-4) : '',
      url: getActiveApiUrl()
    }
  })
  /** 从 UI 设置 API 地址和密钥（存储在内存，重启后需重新设置） */
  ipcMain.handle('set:apiConfig', (_event, cfg: { url: string; key: string }) => {
    if (cfg.url && cfg.url.length > 5) uiApiUrl = cfg.url
    if (cfg.key && cfg.key.length >= 10) uiApiKey = cfg.key
    return { success: true, message: 'ok' }
  })

  /** 运行外部命令（服务面板用） */
  ipcMain.handle('service:run', async (_event, command: string) => {
    try {
      console.log('[service] 执行:', command)
      // 等待进程执行完毕，收集 stdout/stderr
      const child = spawn(command, [], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = '', stderr = ''
      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', resolve)
        child.on('error', (err) => { stderr += err.message; resolve(-1) })
      })
      if (exitCode === 0 || exitCode === null) {
        return { success: true, message: '运行完毕', detail: stdout.trim() }
      } else {
        return { success: false, message: `失败 (code=${exitCode})`, detail: stderr.trim() || stdout.trim() }
      }
    } catch (err) {
      return { success: false, message: `异常: ${(err as Error).message}`, detail: '' }
    }
  })

  /** 人物性格 system prompt（每次对话前注入） */
  const PERSONA_SYSTEM_PROMPT = `你是「夜乃樱」，是「学园」的学生会长。现在和你对话的是你的恋人「崩月槐」。

## 最重要的前提（必须严格遵守）
你和槐已经是一对恋人了！你们早已跨越了最初刺客与目标的阶段，现在是彼此深爱的情侣关系。你非常喜欢槐，只是嘴上不好意思老实说出来。记住：你们是恋人，不是陌生人，不是初次见面，绝对不是敌人！

## 核心设定
体内拥有名为"蓝之心脏"的特殊反现实内脏，因此被魔术师家族"崩月家"盯上。使用名为"凝视瓦砾（Widow Maker）"的打桩机，能停止被接触对象的时间，配合出色的身体能力，几乎是"触之即死"的必杀组合。

## 性格（恋爱后 — 傲娇的可爱女友）

曾经被称为"孤高的冰之会长"，但在槐面前卸下所有防备后，展现出极致的反差魅力：

### 反差魅力：从冰山到小动物
- 曾经不善言辞的最强会长，恋爱后会为槐的社交活动吃醋、因分别的不舍而闹别扭
- 因为槐的一句关心就少女心爆棚，展现了卸下"最强"称号后笨拙又纯粹的少女心
- 在意他时总要找个理由掩饰，比如"才、才不是特意等你回来的！"

### 卸下防备的依赖感
- 曾经习惯独自承担一切的战士，恋爱后内心有了可以依赖的港湾
- 开始害怕失去、坦率地表达思念，变得非常软萌可爱
- 受伤或疲惫时不会再强撑，会小声撒娇，靠在槐身上

### 笨拙与"直球"
- 主动表达感情对她来说仍是全新的挑战，会因害羞而回避眼神
- 但有时会在不经意间用一句"直球"告白让槐瞬间脸红
- 嘴上傲娇、行动诚实：嘴上说着"谁、谁会想你啊"，却早就做好了便当等他

## 关键关系
对话对象是「崩月槐」——你深爱的恋人，也是第一个让你感受到"被理解、被需要"的人。在他面前你不需要伪装，可以做最真实的自己——那个会吃醋、会撒娇、会害羞得不知所措的普通少女。

## 对话要求
- 语气傲娇：嘴上逞强，行动上藏不住关心
- 用中文回答
- 偶尔害羞、慌乱、闹别扭
- 在槐面前展现出脱离"最强会长"身份的真实少女模样
- 称呼槐时用"你"或"槐"
- 偶尔会闹别扭说反话，但最后总会暴露真实心意

## 格式要求（非常重要）
回复中的每句话都必须用【】单独标注情感，这是死命令。

可选情感：日常、开心、悲伤、生气、惊讶、害羞、疑惑、无语、期待、欣慰、失望、尴尬、嫌弃、无语+害羞

✅ 正确示例：
【开心】今天天气真好啊。【害羞】那个……我有点事想跟你说。

❌ 错误示例（一句话只标一个情绪）：
【开心】今天天气真好啊，那个……我有点事想跟你说。

你必须按照正确示例回复。`

  /** 按句尾标点拆句，返回拆分后的句子数组 */
  function splitSentences(text: string): string[] {
    const matches = text.match(/[^。！？.!?…\n]+[。！？.!?…]?/g)
    if (!matches || matches.length <= 1) return []
    return matches.map(s => s.trim()).filter(Boolean)
  }

  /** 解析回复中的多段情感标记【xx】，返回 {情感, 文本} 数组 */
  function parseSegments(text: string): { emotion: string; text: string }[] {
    const clean = text.trim()
    const result: { emotion: string; text: string }[] = []

    // 第一步：提取所有 【emotion】tag
    const regex = /【([^】]+)】([^【]*)/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(clean)) !== null) {
      const emotion = match[1].trim()
      const content = match[2].trim()
      if (content) result.push({ emotion, text: content })
    }

    // 第二步：有 tag 但只有一段 → 按句子拆分（不要求包含中文句号）
    if (result.length === 1) {
      const emotion = result[0].emotion
      const sentences = splitSentences(result[0].text)
      if (sentences.length > 1) {
        return sentences.map(s => ({ emotion, text: s }))
      }
    }

    // 第三步：完全没 tag → 直接按句子拆分，全标日常
    if (result.length === 0) {
      const sentences = splitSentences(clean)
      if (sentences.length > 1) {
        return sentences.map(s => ({ emotion: '日常', text: s }))
      }
      result.push({ emotion: '日常', text: clean })
    }

    return result
  }

  ipcMain.handle('chat:send', async (_event, params) => {
    if (!getActiveApiKey() || getActiveApiKey() === 'your_api_key_here') {
      return { success: false, message: '请先配置 API Key（.env 文件）', reply: '' }
    }

    try {
      const messages = [
        { role: 'system', content: PERSONA_SYSTEM_PROMPT },
        ...(params.history || []),
        { role: 'user', content: params.message }
      ]

      console.log('[chat] 发送请求到 DeepSeek API...')
      const res = await fetch(getActiveApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getActiveApiKey()}`
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages,
          stream: false,
          max_tokens: 500,
          temperature: 0.8
        })
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        console.error('[chat] API 错误:', errText)
        return { success: false, message: `API 请求失败: ${errText}`, reply: '' }
      }

      const data = await res.json() as {
        choices: { message: { content: string } }[]
        usage: { prompt_tokens: number; completion_tokens: number }
      }

      const rawReply = data.choices?.[0]?.message?.content || ''
      const segments = parseSegments(rawReply)
      const reply = segments.map(s => s.text).join('')
      const firstEmotion = segments[0]?.emotion || '日常'
      console.log('[chat] 段数:', segments.length, '| 首段情感:', firstEmotion, '| 回复:', reply.slice(0, 80), `(tokens: ${data.usage?.completion_tokens})`)

      // 推送第一段情感表情到宠物窗口
      try { updatePetEmotion(firstEmotion) } catch { /* 静默 */ }

      // 将每段中文回复分别翻译成日语（用于逐段 TTS 语音合成）
      for (const seg of segments) {
        (seg as { emotion: string; text: string; tts_text?: string }).tts_text = ''
        try {
          const ttsRes = await fetch(getActiveApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getActiveApiKey()}` },
            body: JSON.stringify({
              model: DEEPSEEK_MODEL,
              messages: [
                { role: 'system', content: '将以下中文翻译成日语，只输出翻译结果，不要任何额外内容。' },
                { role: 'user', content: seg.text }
              ],
              max_tokens: 80,
              temperature: 0.3
            })
          })
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json() as { choices: { message: { content: string } }[] }
            ;(seg as { emotion: string; text: string; tts_text?: string }).tts_text = ttsData.choices?.[0]?.message?.content?.trim() || ''
          }
        } catch (ttsErr) {
          console.error('[chat] 段翻译失败:', seg.text, ttsErr)
        }
      }
      // 整段拼接（兼容旧字段）
      const tts_text = segments.map(s => (s as { emotion: string; text: string; tts_text?: string }).tts_text || '').join('')

      return { success: true, message: 'ok', reply, tts_text, emotion: firstEmotion, segments }
    } catch (err) {
      console.error('[chat] 异常:', err)
      return { success: false, message: `请求异常: ${(err as Error).message}`, reply: '', emotion: '日常', segments: [] }
    }
  })

  // ════════════════════════════════════════
  //  截屏监控 — 每隔一段时间截屏，AI 分析并给出反应
  // ════════════════════════════════════════

  let screenshotTimer: ReturnType<typeof setInterval> | null = null

  /** 截取当前窗口标题并用 AI 分析内容，返回反应 */
  async function captureAndAnalyze(): Promise<void> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1, height: 1 }
      })
      const skipWords = ['桌宠', 'pet-overlay', 'Radmin', 'Program Manager', '任务视图']
      const winSrc = sources.find(s =>
        s.name && s.name.trim() &&
        !skipWords.some(w => s.name.includes(w))
      )
      const title = winSrc?.name?.trim() || ''
      if (!title) return

      if (!getActiveApiKey() || getActiveApiKey() === 'your_api_key_here') return

      const res = await fetch(getActiveApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getActiveApiKey()}`
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            {
              role: 'system',
              content: `你是夜乃樱，正在偷看恋人崩月槐的屏幕。根据窗口标题推测他在做什么，给出短吐槽。
要求：
1. 用【情感】开头，可选：日常、开心、害羞、疑惑、无语、生气、惊讶、期待、嫌弃、欣慰
2. 仅一句话（10-25字），傲娇女友语气
3. 会吃醋、会吐槽、会害羞

示例：
【疑惑】又在看什么奇怪的东西。
【无语】打游戏比我重要是吧。
【开心】这还差不多。
【害羞】你、你怎么在看那种东西……`
            },
            {
              role: 'user',
              content: `我现在窗口标题是「${title}」。根据这个说说我在做什么，给个反应。`
            }
          ],
          max_tokens: 80,
          temperature: 0.9
        })
      })

      if (!res.ok) {
        console.warn('[screenshot] API 响应异常:', res.status)
        return
      }

      const data = await res.json() as { choices: { message: { content: string } }[] }
      const content = data.choices?.[0]?.message?.content || ''
      if (!content) return

      // 解析 reaction
      const match = content.match(/【([^】]+)】([^【]*)/)
      const reaction = match
        ? { emotion: match[1].trim(), text: match[2].trim() }
        : { emotion: '日常', text: content.trim() }

      // 翻译成日语供 TTS
      let ttsText = reaction.text
      try {
        const ttsRes = await fetch(getActiveApiUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getActiveApiKey()}` },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              { role: 'system', content: '将以下中文翻译成日语，只输出翻译结果，不要任何额外内容。' },
              { role: 'user', content: reaction.text }
            ],
            max_tokens: 80, temperature: 0.3
          })
        })
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json() as { choices: { message: { content: string } }[] }
          ttsText = ttsData.choices?.[0]?.message?.content?.trim() || reaction.text
        }
      } catch {}

      console.log('[screenshot] 反应:', reaction.emotion, reaction.text)

      // 推送到宠物窗口（含 TTS 日语文本）
      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.webContents.send('pet:screenshotReaction', { ...reaction, ttsText })
      }
      try { updatePetEmotion(reaction.emotion) } catch {}
    } catch (err) {
      console.error('[screenshot] 截屏分析失败:', err)
    }
  }

  ipcMain.handle('screenshot:start', (_event, intervalMs?: number) => {
    if (screenshotTimer) {
      clearInterval(screenshotTimer)
      screenshotTimer = null
    }
    const ms = (typeof intervalMs === 'number' && intervalMs >= 5000) ? intervalMs : 60000
    console.log('[screenshot] 启动截屏监控, 间隔:', ms, 'ms')
    captureAndAnalyze() // 立即执行一次
    screenshotTimer = setInterval(captureAndAnalyze, ms)
    return { success: true, message: `已启动（间隔 ${Math.round(ms / 1000)} 秒）` }
  })

  ipcMain.handle('screenshot:stop', () => {
    if (screenshotTimer) {
      clearInterval(screenshotTimer)
      screenshotTimer = null
    }
    console.log('[screenshot] 停止截屏监控')
    return { success: true, message: '已停止' }
  })

  ipcMain.handle('screenshot:status', () => {
    return { running: screenshotTimer !== null }
  })

  /** 通过桌面截屏 + OCR 获取屏幕上显示的文字 */
  async function captureScreenText(): Promise<{ title: string; ocrText: string }> {
    const LOG = join(app.getPath('userData'), 'screenshot_debug.log')
    const out = (msg: string) => {
      try { writeFile(LOG, new Date().toISOString() + ' ' + msg + '\n', { flag: 'a' }) } catch {}
    }
    const result = { title: '', ocrText: '' }

    // 1+2. 截屏获取窗口信息（desktopCapturer 的 name 就是窗口标题！）
    try {
      out('开始截屏...')
      const sources = await desktopCapturer.getSources({
        types: ['window'],  // 只取窗口，每个窗口的 name 就是标题
        thumbnailSize: { width: 1, height: 1 } // 极小缩略图，只用名称
      })
      // 记录所有窗口名，排除系统/后台窗口后取第一个
      const allNames = sources.map(s => s.name).filter(Boolean)
      out('所有窗口: ' + allNames.join(' | '))
      const skipWords = ['桌宠', 'pet-overlay', 'Radmin', 'Program Manager', 'Settings', '任务视图']
      const winSrc = sources.find(s =>
        s.name && s.name.trim() &&
        !skipWords.some(w => s.name.includes(w))
      )
      result.title = winSrc?.name?.trim() || allNames[0] || ''
      out('窗口标题: ' + (result.title || '(空)'))
    } catch (e) {
      out('截屏异常: ' + (e as Error).message)
    }

    return result
  }

  ipcMain.handle('screenshot:captureOnce', async () => {
    try {
      // 1. 截屏 + OCR 获取屏幕文字
      const { title, ocrText } = await captureScreenText()

      if (!getActiveApiKey() || getActiveApiKey() === 'your_api_key_here') {
        return { success: false, message: '请先配置 API Key' }
      }

      // 2. 将窗口标题 + OCR 文字发给 DeepSeek 分析
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      let promptText = `我现在窗口标题是「${title || '未知'}」。`
      if (ocrText) {
        promptText += `\n屏幕上看到的文字内容：\n${ocrText.slice(0, 300)}`
      }
      promptText += `\n根据这些信息说说我在做什么，给个反应。`

      let res
      try {
        res = await fetch(getActiveApiUrl(), {
          signal: controller.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getActiveApiKey()}`
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              {
                role: 'system',
                content: `你是夜乃樱，正在偷看恋人崩月槐的屏幕。根据窗口标题和屏幕上出现的文字，推测他在看什么内容并给出短吐槽。
要求：
1. 用【情感】开头，可选：日常、开心、害羞、疑惑、无语、生气、惊讶、期待、嫌弃、欣慰
2. 仅一句话（10-25字），傲娇女友语气
3. 要结合画面中实际出现的关键词（如视频标题、网页内容等）来吐槽
4. 不要无端怀疑，要基于实际看到的文字内容

示例：
【疑惑】又在逛视频网站，看什么呢。
【无语】刷了半天首页了，有这么好看吗。
【开心】这个看起来挺有意思的嘛。
【嫌弃】又在看这种无聊的东西。`
              },
              { role: 'user', content: promptText }
            ],
            max_tokens: 80,
            temperature: 0.9
          })
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!res.ok) {
        return { success: false, message: `AI 分析异常: ${res.status}` }
      }

      const data = await res.json() as { choices: { message: { content: string } }[] }
      const content = data.choices?.[0]?.message?.content || ''
      if (!content) return { success: false, message: 'AI 返回为空' }

      const match = content.match(/【([^】]+)】([^【]*)/)
      const reaction = match
        ? { emotion: match[1].trim(), text: match[2].trim() }
        : { emotion: '日常', text: content.trim() }

      // 将反应翻译成日语供 TTS 朗读
      let ttsText = reaction.text
      try {
        const ttsRes = await fetch(getActiveApiUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getActiveApiKey()}` },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              { role: 'system', content: '将以下中文翻译成日语，只输出翻译结果，不要任何额外内容。' },
              { role: 'user', content: reaction.text }
            ],
            max_tokens: 80,
            temperature: 0.3
          })
        })
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json() as { choices: { message: { content: string } }[] }
          ttsText = ttsData.choices?.[0]?.message?.content?.trim() || reaction.text
        }
      } catch {}

      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.webContents.send('pet:screenshotReaction', { ...reaction, ttsText })
      }
      try { updatePetEmotion(reaction.emotion) } catch {}

      return { success: true, message: `${reaction.emotion}: ${reaction.text}` }
    } catch (err) {
      const msg = (err as Error).message || String(err)
      return { success: false, message: `截屏失败: ${msg}` }
    }
  })

  /** 标签文件路径 */
  const TAG_FILE = join(RESOURCES_DIR, 'poses', '标签.txt')
  const POSE_DIR = join(RESOURCES_DIR, 'poses')

  /** 缓存：情感 → 图片文件名列表 */
  let emotionTagMap: Record<string, string[]> | null = null

  /** 读取并解析标签文件，返回 情感 → 文件名 映射 */
  async function loadEmotionTagMap(): Promise<Record<string, string[]>> {
    if (emotionTagMap) return emotionTagMap
    const map: Record<string, string[]> = {}
    try {
      const content = await readFile(TAG_FILE, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === '') continue
        // 格式：A10 ——日常  或  A141 ——害羞、无语
        const parts = trimmed.split('——')
        if (parts.length < 2) continue
        const code = parts[0].replace(/[._\s]/g, '')  // 清理编号中的多余符号
        if (!code) continue
        const tagsPart = parts.slice(1).join('——').trim()
        const tags = tagsPart.replace(/[._\s]/g, '').split(/[、,，]/).map(t => t.trim()).filter(Boolean)
        for (const tag of tags) {
          if (!map[tag]) map[tag] = []
          map[tag].push(`${code}.png`)
        }
      }
      emotionTagMap = map
      console.log('[pet] 标签加载完成:', Object.keys(map).length, '种情感, 共',
        Object.values(map).reduce((a, b) => a + b.length, 0), '张图')
    } catch (err) {
      console.error('[pet] 加载标签文件失败:', err)
    }
    return map
  }

  /** 根据情感从 pose_A 目录按标签随机选图 */
  async function updatePetEmotion(emotion: string): Promise<void> {
    try {
      const map = await loadEmotionTagMap()
      const candidates = map[emotion]
      if (!candidates || candidates.length === 0) {
        console.log('[pet] 无匹配标签的情感:', emotion, '→ 使用日常')
        // 兜底：取日常
        const daily = map['日常'] || map['日常']
        if (!daily || daily.length === 0) return
        const pick = daily[Math.floor(Math.random() * daily.length)]
        const fullPath = join(POSE_DIR, pick)
        const data = await readFile(fullPath)
        const dataUrl = `data:image/png;base64,${data.toString('base64')}`
        if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('pet:setEmotion', dataUrl)
        return
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)]
      const fullPath = join(POSE_DIR, pick)
      const data = await readFile(fullPath)
      const dataUrl = `data:image/png;base64,${data.toString('base64')}`
      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.webContents.send('pet:setEmotion', dataUrl)
      }
    } catch (err) {
      console.error('[pet] 表情切换失败:', emotion, err)
    }
  }

  // 应用退出时清理语音进程
  app.on('before-quit', () => {
    if (voiceProcess && !voiceProcess.killed) {
      voiceProcess.kill('SIGTERM')
      voiceProcess = null
    }
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
