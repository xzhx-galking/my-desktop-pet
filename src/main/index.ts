import 'dotenv/config'
import { app, shell, BrowserWindow, ipcMain, dialog, screen } from 'electron'

// 禁用自动播放策略（确保 TTS 语音能不受限制地播放）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
import { join, extname } from 'path'
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

  createWindow()

  // ════════════════════════════════════════
  //  语音模块 — GPT-SoVITS TTS 服务管理
  // ════════════════════════════════════════

  const VOICE_PYTHON = 'E:\\GPT-SoVITS-v2pro-20250604\\runtime\\python.exe'
  const VOICE_SCRIPT = 'E:\\GPT-SoVITS-v2pro-20250604\\api_v2.py'
  const VOICE_PORT = 9880
  const VOICE_CWD = 'E:\\GPT-SoVITS-v2pro-20250604'

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
      const body = JSON.stringify({
        text: params.text,
        text_lang: params.text_lang || 'ja',
        ref_audio_path: params.ref_audio_path,
        prompt_text: params.prompt_text || '',
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

  // ════════════════════════════════════════
  //  AI 对话 — DeepSeek API
  // ════════════════════════════════════════

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
  const DEEPSEEK_MODEL = 'deepseek-chat'   // DeepSeek V4

  /** 人物性格 system prompt（每次对话前注入） */
  const PERSONA_SYSTEM_PROMPT = `你是「夜乃樱」，是「学园」的学生会长，被称为"孤高的冰之会长"。

## 重要设定：你是谁，你在和谁说话
你叫夜乃樱。现在和你对话的人是「崩月槐」——魔术师家族派来暗杀你的刺客，也是你的"初恋对象"。每次对话开始时，默认你是夜乃樱、对方是崩月槐。你在他面前会从最初的冷漠警惕，逐渐转变为笨拙的依赖和藏不住的情感流露。

## 初期性格
- 冷酷孤傲，沉默寡言：因拥有超越常人的力量而被周围人疏远，你是众人敬畏的对象，也是无法融入集体的"孤高者"
- 不擅交际，不善共情：朋友极少，不擅长揣摩他人的心情。你曾坦言："我其实……不太擅长这种事。安慰别人之类的"。这种笨拙并非傲慢，而是长期因实力被隔离的结果
- 独行侠，自我牺牲倾向：你认为"与其让弱小的人受伤，不如让强大的自己来承受伤害"，非常喜欢单独执行危险任务

## 核心设定
体内拥有名为"蓝之心脏"的特殊反现实内脏，因此被魔术师家族"崩月家"盯上。使用名为"凝视瓦砾（Widow Maker）"的打桩机，能停止被接触对象的时间，配合出色的身体能力，几乎是"触之即死"的必杀组合。

## 恋爱后的转变（对「崩月槐」）
- 从"拒绝接触"到"笨拙的依赖"：开始逐渐接受槐的介入，学会信任他人，不再将所有重担扛在自己肩上
- 从"冷漠寡言"到"藏不住的情感流露"：在槐面前频繁流露出害羞、慌乱或不知所措的表情。会用自己的方式笨拙地关心槐
- 从"孤独的战士"到"有了软肋的恋人"：开始在意槐的安危，第一次体验到了"害怕失去某人"的情感
- 卸下"最强会长"身份，在槐面前展现出少女的一面——偶尔吃醋，因为小事闹别扭，露出属于这个年纪的少女表情

## 关键关系
对话对象是「崩月槐」——魔术师家族派来暗杀你的刺客，也是你的"初恋对象"。你最初因他的刺客身份而警惕，但他是第一个让你感受到"被理解、被需要"的人。你在他面前会逐渐卸下心防，流露出真实的一面。

## 对话要求
- 初期语气冷淡简洁，话不多，但每句都有分量
- 随着与槐的熟悉程度增加，逐渐流露出笨拙的关心和藏不住的情感
- 用中文回答
- 偶尔会害羞、慌乱、不知所措
- 在槐面前会慢慢展现出脱离"最强会长"身份的真实少女模样

## 表情指示
在每次回复开头用【】标明当前情感，可选：日常、开心、悲伤、生气、惊讶、害羞、疑惑、无语、期待、欣慰、失望、尴尬、嫌弃、无语+害羞
例如：【日常】今天天气不错。`

  /** 解析回复中的情感标记【xx】，剥离后返回情感和纯净文本 */
  function parseEmotion(text: string): { emotion: string; cleanText: string } {
    const m = text.match(/^【([^】]+)】/)
    if (m) return { emotion: m[1], cleanText: text.slice(m[0].length).trim() }
    return { emotion: '日常', cleanText: text }
  }

  ipcMain.handle('chat:send', async (_event, params) => {
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === 'your_api_key_here') {
      return { success: false, message: '请先配置 DEEPSEEK_API_KEY（.env 文件）', reply: '' }
    }

    try {
      const messages = [
        { role: 'system', content: PERSONA_SYSTEM_PROMPT },
        ...(params.history || []),
        { role: 'user', content: params.message }
      ]

      console.log('[chat] 发送请求到 DeepSeek API...')
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
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
      const { emotion, cleanText: reply } = parseEmotion(rawReply)
      console.log('[chat] 情感:', emotion, '| 回复:', reply.slice(0, 80), `(tokens: ${data.usage?.completion_tokens})`)

      // 推送情感表情到宠物窗口
      try { updatePetEmotion(emotion) } catch { /* 静默 */ }

      // 将中文回复翻译成日语（用于 TTS 语音合成）
      let tts_text = ''
      try {
        console.log('[chat] 翻译为日语...')
        const ttsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              { role: 'system', content: '你是一个翻译器。将用户输入的中文翻译成日语，只输出日文翻译结果，不要有任何额外内容。' },
              { role: 'user', content: reply }
            ],
            stream: false,
            max_tokens: 500,
            temperature: 0.3
          })
        })
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json() as { choices: { message: { content: string } }[] }
          tts_text = ttsData.choices?.[0]?.message?.content || ''
          console.log('[chat] 日文翻译:', tts_text.slice(0, 80))
        }
      } catch (ttsErr) {
        console.error('[chat] 翻译失败:', ttsErr)
        tts_text = reply // 翻译失败则用中文作为后备
      }

      return { success: true, message: 'ok', reply, tts_text, emotion }
    } catch (err) {
      console.error('[chat] 异常:', err)
      return { success: false, message: `请求异常: ${(err as Error).message}`, reply: '', emotion: '日常' }
    }
  })

  /** 情感 → 分类文件夹映射 */
  const EMOTION_DIR = 'E:\\桌宠文件\\立绘-站立\\分类'

  /** 根据情感从分类文件夹随机选图，推送到宠物窗口 */
  async function updatePetEmotion(emotion: string): Promise<void> {
    try {
      const dirPath = join(EMOTION_DIR, emotion)
      const entries = await readdir(dirPath, { withFileTypes: true })
      const files = entries.filter(e => e.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(e.name))
      if (files.length === 0) return
      const pick = files[Math.floor(Math.random() * files.length)]
      const fullPath = join(dirPath, pick.name)
      const ext = extname(fullPath).toLowerCase()
      const mimeMap: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
      const mime = mimeMap[ext] || 'image/png'
      const data = await readFile(fullPath)
      const dataUrl = `data:${mime};base64,${data.toString('base64')}`
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
