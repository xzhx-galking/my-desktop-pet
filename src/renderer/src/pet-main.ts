/**
 * pet-main.ts — 桌宠悬浮窗口入口
 *
 * 功能：
 *  - 显示宠物立绘
 *  - 拖拽移动 + 缩放手柄
 *  - 像素级碰撞检测（透明区域不响应鼠标）
 *  - AI 对话 + TTS 语音朗读
 */

// ── DOM ──
const petImage = document.getElementById('pet-image') as HTMLImageElement
const dropHint = document.getElementById('drop-hint') as HTMLElement
const resizeHandle = document.getElementById('resize-handle') as HTMLElement
const sizeLabel = document.getElementById('size-label') as HTMLElement
const chatArea = document.getElementById('chat-area') as HTMLElement
const galgameBox = document.getElementById('galgame-box') as HTMLElement
const latestMsg = document.getElementById('latest-msg') as HTMLElement
const thinkingEl = document.getElementById('thinking') as HTMLElement
const chatInput = document.getElementById('chat-input') as HTMLInputElement
const chatSend = document.getElementById('chat-send') as HTMLButtonElement
const historyOverlay = document.getElementById('history-overlay') as HTMLElement
const historyList = document.getElementById('history-list') as HTMLElement
const historyBtn = document.getElementById('history-btn') as HTMLButtonElement
const historyClose = document.getElementById('history-close') as HTMLButtonElement
const continueArrow = document.getElementById('continue-arrow') as HTMLElement
const screenshotBtn = document.getElementById('screenshot-btn') as HTMLButtonElement
const voiceLoading = document.getElementById('voice-loading') as HTMLElement

// ── 窗口尺寸（本地跟踪） ──
const DEFAULT_W = 240
const DEFAULT_H = 360   // 加高给对话区域留空间
let curW = DEFAULT_W
let curH = DEFAULT_H
let imgAspect = 1

// ── 窗口位置（本地跟踪） ──
let winX = 0
let winY = 0

// ── 单变量状态机 ──
type Mode = 'none' | 'drag' | 'resize'
let mode: Mode = 'none'
function setMode(m: Mode): void { mode = m; document.title = '桌宠 [' + m + ']' }
let startX = 0
let startY = 0
let startW = 0   // 开始缩放时的窗口宽度

// ── Canvas 像素碰撞检测（透明区域不响应鼠标） ──
let hitCanvas: HTMLCanvasElement | null = null
let hitCtx: CanvasRenderingContext2D | null = null

function initHitDetection(img: HTMLImageElement): void {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.drawImage(img, 0, 0)
    hitCanvas = c
    hitCtx = ctx
  }
}

function isHitPixel(clientX: number, clientY: number): boolean {
  if (!hitCanvas || !hitCtx) return true   // 无 canvas 时放行
  const rect = petImage.getBoundingClientRect()
  const sx = hitCanvas.width / rect.width
  const sy = hitCanvas.height / rect.height
  const ix = Math.floor((clientX - rect.left) * sx)
  const iy = Math.floor((clientY - rect.top) * sy)
  if (ix < 0 || ix >= hitCanvas.width || iy < 0 || iy >= hitCanvas.height) return false
  const px = hitCtx.getImageData(ix, iy, 1, 1).data
  return px[3] >= 10   // alpha ≥ 10 算有效像素
}

// ════════════════════════════════════
//  对话状态
// ════════════════════════════════════
type ChatRole = 'user' | 'assistant'
interface ChatMsg { role: ChatRole; content: string }

let chatHistory: ChatMsg[] = []
let isSending = false
let historyVisible = false

// ── 分段落语音状态 ──
let segmentAudioUrls: (string | null)[] = []
let currentAudio: HTMLAudioElement | null = null

// ── 多段推进状态 ──
let segments: { emotion: string; text: string }[] = []
let segIndex = 0

/** 显示对话框中的一段文本，并切换到对应表情 */
function showSegment(index: number, role: ChatRole): void {
  if (index < 0 || index >= segments.length) return
  const seg = segments[index]
  const label = role === 'assistant' ? '夜乃樱' : '你'
  const labelClass = role === 'assistant' ? 'label-ai' : 'label-user'
  latestMsg.innerHTML = `<span class="${labelClass}">${label}</span> ${seg.text}`
  galgameBox.scrollTop = galgameBox.scrollHeight
  // 切换表情（通知主进程按标签选图）
  if (role === 'assistant') window.api.setPetEmotion(seg.emotion)
  // 更新继续箭头
  continueArrow.classList.toggle('visible', index < segments.length - 1)
}

/** 点击 galgame 框推进到下一段 */
function advanceSegment(): void {
  // 截屏反应模式下，点一下恢复对话分段
  if (screenShotMode) {
    screenShotMode = false
    restoreSegments()
    return
  }
  if (segments.length === 0) return
  if (segIndex < segments.length - 1) {
    segIndex++
    const url = segmentAudioUrls[segIndex]
    if (url) {
      // 语音已就绪 → 立即显示文字并播放
      revealCurrentSegment()
    } else {
      // 语音未就绪 → 先显示加载波动，就绪后自动揭示
      setVoiceLoading(true)
      latestMsg.innerHTML = ''
      continueArrow.classList.remove('visible')
    }
  }
}

// ── 截屏反应 vs 对话分段互不干扰 ──
let screenShotMode = false
let savedSegments: { emotion: string; text: string }[] = []
let savedSegIndex = 0

/** 保存当前对话分段（截屏前调用） */
function saveSegments(): void {
  savedSegments = segments.slice()
  savedSegIndex = segIndex
}

/** 恢复对话分段（截屏结束后调用） */
function restoreSegments(): void {
  if (savedSegments.length > 0) {
    segments = savedSegments
    segIndex = savedSegIndex
    savedSegments = []
    showSegment(segIndex, 'assistant')
  }
}

/** 更新历史面板内容 */
function updateHistoryList(): void {
  historyList.innerHTML = chatHistory.map(msg => {
    const label = msg.role === 'assistant' ? '夜乃樱' : '你'
    return `<div class="hist-item ${msg.role}"><span class="hist-label">${label}</span>${msg.content}</div>`
  }).join('')
  historyList.scrollTop = historyList.scrollHeight
}

/** 切换历史面板 */
function toggleHistory(): void {
  historyVisible = !historyVisible
  historyOverlay.classList.toggle('visible', historyVisible)
  historyBtn.classList.toggle('active', historyVisible)
  if (historyVisible) updateHistoryList()
}

/** 显示/隐藏思考动画 */
function setThinking(show: boolean): void {
  thinkingEl.classList.toggle('visible', show)
}

/** 显示/隐藏语音加载波动 */
function setVoiceLoading(show: boolean): void {
  voiceLoading.classList.toggle('visible', show)
}

/** 语音就绪后显示当前段文字并播放（隐藏加载波动） */
function revealCurrentSegment(): void {
  setVoiceLoading(false)
  showSegment(segIndex, 'assistant')
  playCurrentSegmentAudio()
}

/** 发送消息 */
async function sendChat(): Promise<void> {
  const text = chatInput.value.trim()
  if (!text || isSending) return

  chatInput.value = ''
  isSending = true
  chatSend.disabled = true
  screenShotMode = false
  savedSegments = []
  segments = []
  segIndex = 0

  // galgame 风格：显示用户消息在对话框中
  const userLabel = '你'
  latestMsg.innerHTML = `<span class="label-user">${userLabel}</span> ${text}`
  chatHistory.push({ role: 'user', content: text } as ChatMsg)

  try {
    const res = await window.api.chatSend({
      message: text,
      history: chatHistory.slice(0, -1)
    })

    if (res.success && res.reply) {
      // 存历史
      chatHistory.push({ role: 'assistant', content: res.reply } as ChatMsg)
      if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20)

      // 保存分段
      segments = (res.segments && res.segments.length > 0)
        ? res.segments
        : [{ emotion: res.emotion || '日常', text: res.reply }]
      segIndex = 0
      segmentAudioUrls = []
      if (currentAudio) { currentAudio.pause(); currentAudio = null }

      // 先显示语音加载波动，语音就绪后才显示文字
      setThinking(false)
      setVoiceLoading(true)
      latestMsg.innerHTML = ''
      continueArrow.classList.remove('visible')

      // 后台逐段预合成语音
      preGenerateSegmentAudio().catch(() => {})
    } else {
      latestMsg.innerHTML = `<span class="label-ai">夜乃樱</span> [${res.message}]`
    }
  } catch (err) {
    latestMsg.innerHTML = `<span class="label-ai">夜乃樱</span> [请求异常]`
    console.error('[pet-chat] 发送失败:', err)
  } finally {
    isSending = false
    chatSend.disabled = false
    chatInput.focus()
  }
}

// ── galgame 框点击推进 ──
galgameBox.addEventListener('click', advanceSegment)

/** 默认参考音频路径（在 main process voice:tts 中自动填充资源路径，传空由后端决定） */
const DEFAULT_REF_AUDIO = ''

/** 去掉括号内的内容（内心想法）及括号后的多余标点，只留外部文字用于 TTS */
function stripInnerThoughts(text: string): string {
  return text
    .replace(/[（(][^）)]*[）)]/g, '')    // 去掉括号内容
    .replace(/^[。、，,.\s]+/, '')           // 去掉括号残留的前导标点
    .trim()
}

/** 生成单段 TTS 音频，返回 dataUrl（不播放） */
async function generateSingleTts(text: string): Promise<{ success: boolean; dataUrl: string }> {
  try {
    const audioPath = localStorage.getItem('pet_ref_audio_path') || DEFAULT_REF_AUDIO
    const promptText = localStorage.getItem('pet_ref_prompt_text') || ''
    let voiceParams: Record<string, number> = {}
    try { const raw = localStorage.getItem('pet_voice_params'); if (raw) voiceParams = JSON.parse(raw) } catch { /* 静默 */ }

    const st = await window.api.voiceStatus()
    if (!st.running) return { success: false, dataUrl: '' }

    const cleanText = stripInnerThoughts(text)
    if (!cleanText) return { success: false, dataUrl: '' }

    const res = await window.api.voiceTts({
      text: cleanText,
      text_lang: 'ja',
      ref_audio_path: audioPath,
      prompt_text: promptText,
      prompt_lang: 'ja',
      top_k: voiceParams.top_k ?? 15,
      top_p: voiceParams.top_p ?? 0.85,
      temperature: voiceParams.temperature ?? 0.7,
      speed_factor: voiceParams.speed_factor ?? 1.0,
      repetition_penalty: voiceParams.repetition_penalty ?? 1.25,
      sample_steps: voiceParams.sample_steps ?? 16
    })
    return { success: res.success, dataUrl: res.dataUrl }
  } catch (err) {
    console.error('[pet-chat] 单段 TTS 异常:', err)
    return { success: false, dataUrl: '' }
  }
}

/** 后台逐段预合成语音，同步播放时机 */
async function preGenerateSegmentAudio(): Promise<void> {
  segmentAudioUrls = new Array(segments.length).fill(null)
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as { emotion: string; text: string; tts_text?: string }
    if (!seg.tts_text) continue
    console.log(`[pet] 合成第 ${i + 1}/${segments.length} 段语音...`)
    const res = await generateSingleTts(seg.tts_text)
    if (res.success && res.dataUrl) {
      segmentAudioUrls[i] = res.dataUrl
      // 当前段语音就绪 → 显示文字并播放（隐藏加载波动）
      if (i === segIndex) {
        revealCurrentSegment()
      }
    }
  }
  console.log('[pet] 全部段语音合成完毕')
  // 全部完成后如果还有加载波动未消（最后一段合成失败等情况），手动关闭
  setVoiceLoading(false)
}

/** 播放当前段（segIndex）的语音（由 revealCurrentSegment 在语音就绪后调用） */
function playCurrentSegmentAudio(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  const url = segmentAudioUrls[segIndex]
  if (!url) return
  try {
    let vol = 1.0
    try { const raw = localStorage.getItem('pet_voice_params'); if (raw) vol = JSON.parse(raw).volume ?? 1.0 } catch { /* 静默 */ }
    const audio = new Audio(url)
    audio.volume = vol
    audio.play().catch(() => {})
    currentAudio = audio
    audio.onended = () => { if (currentAudio === audio) currentAudio = null }
  } catch (err) {
    console.error('[pet] 播放语音失败:', err)
  }
}

// ════════════════════════════════════
//  显示模型（统一入口：IPC 推送 / 页面主动请求）
// ════════════════════════════════════
function showModel(dataUrl: string): void {
  const img = new Image()
  img.onload = () => {
    imgAspect = img.naturalWidth / img.naturalHeight || 1
    curW = DEFAULT_W
    curH = DEFAULT_H
    setMode('none')
    window.api.lockPetSize(curW, curH)
    window.api.getPetPosition().then((pos) => {
      winX = pos.x
      winY = pos.y
    })

    petImage.src = dataUrl
    petImage.classList.remove('hidden')
    screenshotBtn.classList.remove('hidden')
    dropHint.style.display = 'none'

    // 显示对话区域
    chatArea.classList.add('visible')

    sizeLabel.textContent = '100%'
    // 手柄默认隐藏，点击模型像素后显示
    resizeHandle.classList.remove('visible')
    sizeLabel.classList.remove('visible')

    // 构建碰撞检测 canvas
    initHitDetection(img)
  }
  img.src = dataUrl
}

// IPC 推送（模型切换时由主进程发送）
window.api.onPetShowModel((dataUrl: string) => {
  document.title = '桌宠 [推送✓]'
  showModel(dataUrl)
})

// 页面加载后主动请求待发送的模型（关闭后再启动场景）
window.api.requestPetModel().then((dataUrl) => {
  if (dataUrl) {
    document.title = '桌宠 [拉取✓]'
    showModel(dataUrl)
  } else {
    document.title = '桌宠 [无数据]'
  }
})

// 接收表情切换（仅替换立绘图片，不重置窗口大小）
window.api.onPetSetEmotion((dataUrl: string) => {
  console.log('[pet] 切换表情')
  // 直接换图，不重新初始化碰撞检测和窗口大小
  petImage.src = dataUrl
})

// ── 截屏反应：单独显示 + 语音朗读 ──
window.api.onScreenshotReaction((data: { emotion: string; text: string; ttsText?: string }) => {
  console.log('[pet] 截屏反应:', data.emotion, data.text)
  // 保存当前对话分段，等截屏结束后恢复
  if (!screenShotMode) saveSegments()
  screenShotMode = true

  // 先入历史（内容与语音无关）
  chatHistory.push({ role: 'assistant', content: `👀 ${data.text}` } as ChatMsg)
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20)
  updateHistoryList()

  if (data.ttsText) {
    // 先显示加载波动，语音就绪后再显示文字
    latestMsg.innerHTML = ''
    continueArrow.classList.remove('visible')
    window.api.setPetEmotion(data.emotion)
    setVoiceLoading(true)
    generateSingleTts(data.ttsText).then(res => {
      setVoiceLoading(false)
      // 语音就绪 → 现在显示文字
      latestMsg.innerHTML = `<span class="label-ai">夜乃樱</span> ${data.text}`
      if (res.success && res.dataUrl) {
        let vol = 1.0
        try { const raw = localStorage.getItem('pet_voice_params'); if (raw) vol = JSON.parse(raw).volume ?? 1.0 } catch { /* 静默 */ }
        const audio = new Audio(res.dataUrl)
        audio.volume = vol
        audio.play().catch(() => {})
      }
    })
  } else {
    // 无 TTS → 直接显示文字
    latestMsg.innerHTML = `<span class="label-ai">夜乃樱</span> ${data.text}`
    continueArrow.classList.remove('visible')
    window.api.setPetEmotion(data.emotion)
  }
})

// ── 截屏按钮点击 ──
screenshotBtn.addEventListener('click', async () => {
  screenshotBtn.classList.add('capturing')
  try {
    const res = await window.api.screenshotCaptureOnce()
    console.log('[pet] 截屏:', res.message)
    if (!res.success) {
      latestMsg.innerHTML = `<span class="label-ai">夜乃樱</span> [${res.message}]`
    }
  } catch (err) {
    console.error('[pet] 截屏异常:', err)
  } finally {
    screenshotBtn.classList.remove('capturing')
  }
})

// ════════════════════════════════════
//  拖拽 + 手柄显隐（仅非透明像素触发）
// ════════════════════════════════════
petImage.addEventListener('mousedown', (e: MouseEvent) => {
  if (e.button !== 0) return
  console.log('[pet-main] mousedown — mode:', mode, 'isHitPixel:', isHitPixel(e.clientX, e.clientY))

  // 透明区域 → 忽略点击
  if (!isHitPixel(e.clientX, e.clientY)) return

  // 非透明像素 → 显示手柄 + 开始拖拽
  resizeHandle.classList.add('visible')
  sizeLabel.classList.add('visible')
  setMode('drag')
  startX = e.screenX
  startY = e.screenY
  petImage.style.cursor = 'grabbing'
})

// ════════════════════════════════════
//  缩放手柄 → 整体缩放
// ════════════════════════════════════
resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  setMode('resize')
  startX = e.screenX
  startW = curW   // 记录当前宽度作为缩放基准
})

// ════════════════════════════════════
//  全局 mousemove
// ════════════════════════════════════
document.addEventListener('mousemove', (e: MouseEvent) => {
  if (mode === 'drag') {
    const dx = e.screenX - startX
    const dy = e.screenY - startY
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
    winX += dx
    winY += dy
    window.api.movePetWindow(Math.round(winX), Math.round(winY))
    window.api.lockPetSize(curW, curH)  // 拖拽时锁住当前尺寸
    startX = e.screenX
    startY = e.screenY
    return
  }

  if (mode === 'resize') {
    const dx = e.screenX - startX
    let newW = Math.max(60, startW + dx)
    let newH = Math.round(newW / imgAspect)
    newH = Math.max(60, Math.min(800, newH))
    newW = Math.min(800, Math.max(60, newW))

    // 整体调整窗口大小 → 图片自动随窗口撑满
    window.api.lockPetSize(newW, newH)
    curW = newW
    curH = newH
    sizeLabel.textContent = Math.round((newW / DEFAULT_W) * 100) + '%'
    return
  }
})

// ════════════════════════════════════
//  全局 mouseup
// ════════════════════════════════════
document.addEventListener('mouseup', () => {
  if (mode === 'drag') petImage.style.cursor = 'grab'
  setMode('none')
})

// ════════════════════════════════════
//  窗口失焦 → 隐藏手柄
// ════════════════════════════════════
window.addEventListener('blur', () => {
  console.log('[pet-main] 窗口 blur — 隐藏手柄。当前 mode:', mode, ' | isHitCanvas:', !!hitCanvas)
  resizeHandle.classList.remove('visible')
  sizeLabel.classList.remove('visible')
})

window.addEventListener('focus', () => {
  console.log('[pet-main] 窗口 focus — 恢复交互。当前 mode:', mode)
})

// ════════════════════════════════════
//  对话事件
// ════════════════════════════════════
chatSend.addEventListener('click', sendChat)
chatInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendChat()
  }
})

// 历史面板开关
historyBtn.addEventListener('click', toggleHistory)
historyClose.addEventListener('click', toggleHistory)

// ════════════════════════════════════
//  右键 / ESC 关闭
// ════════════════════════════════════
document.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault()
  window.api.hidePet()
})
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' || e.key === 'q') window.api.hidePet()
})
