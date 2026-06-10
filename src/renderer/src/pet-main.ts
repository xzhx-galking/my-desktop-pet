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

/** 更新 galgame 对话框（仅显示最新一条消息） */
function updateGalgameBox(role: ChatRole, content: string): void {
  const label = role === 'assistant' ? '夜乃樱' : '你'
  const labelClass = role === 'assistant' ? 'label-ai' : 'label-user'
  latestMsg.innerHTML = `<span class="${labelClass}">${label}</span> ${content}`
  galgameBox.scrollTop = galgameBox.scrollHeight
  // 如果有历史面板打开，同步更新
  if (historyVisible) updateHistoryList()
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

/** 发送消息 */
async function sendChat(): Promise<void> {
  const text = chatInput.value.trim()
  if (!text || isSending) return

  chatInput.value = ''
  isSending = true
  chatSend.disabled = true

  // galgame 风格：显示用户消息在对话框中
  updateGalgameBox('user', text)
  chatHistory.push({ role: 'user', content: text } as ChatMsg)

  try {
    const res = await window.api.chatSend({
      message: text,
      history: chatHistory.slice(0, -1)
    })

    if (res.success && res.reply) {
      // 先存历史，但不显示文字
      chatHistory.push({ role: 'assistant', content: res.reply } as ChatMsg)

      // 如果历史超过 20 条，压缩早期的
      if (chatHistory.length > 20) {
        chatHistory = chatHistory.slice(-20)
      }

      // 先显示 ··· 思考动画（不显示文字）
      setThinking(true)
      let textShown = false
      try {
        await speakReply(res.tts_text || res.reply, () => {
          // 第一段语音生成完毕 → 同时显示文字 + 播放语音
          setThinking(false)
          updateGalgameBox('assistant', res.reply)
          textShown = true
        })
      } finally {
        if (!textShown) {
          // TTS 失败/跳过 → 仍然显示文字
          setThinking(false)
          updateGalgameBox('assistant', res.reply)
        }
      }
    } else {
      updateGalgameBox('assistant', `[${res.message}]`)
    }
  } catch (err) {
    updateGalgameBox('assistant', `[请求异常]`)
    console.error('[pet-chat] 发送失败:', err)
  } finally {
    isSending = false
    chatSend.disabled = false
    chatInput.focus()
  }
}

const DEFAULT_REF_AUDIO = 'E:\\桌宠文件\\声音-切分后的mp3\\VO01_0678.OGG_0000000000_0000134720.mp3'

/** 去掉括号内的内容（内心想法）及括号后的多余标点，只留外部文字用于 TTS */
function stripInnerThoughts(text: string): string {
  return text
    .replace(/[（(][^）)]*[）)]/g, '')    // 去掉括号内容
    .replace(/^[。、，,.\s]+/, '')           // 去掉括号残留的前导标点
    .trim()
}

/**
 * 将长文本按句尾标点拆分成短段，每段不超过 maxLen
 * 太短的段（< minLen）会跟下一段合并，避免模型因输入过短产生噪声
 */
function splitTextForTts(text: string, maxLen = 80, minLen = 15): string[] {
  // 中/日/英句尾标点
  const segments: string[] = []
  // 先按句尾拆分
  const sentences = text.match(/[^。！？.!?…\n]+[。！？.!?…]?/g) || [text]

  let current = ''
  for (const s of sentences) {
    if ((current + s).length > maxLen && current.length > 0) {
      segments.push(current.trim())
      current = s
    } else {
      current += s
    }
  }
  if (current.trim()) segments.push(current.trim())

  // 合并太短的段（避免单独发送「うん。」这类短文本导致噪声）
  const merged: string[] = []
  for (const seg of segments) {
    if (merged.length > 0 && merged[merged.length - 1].length < minLen) {
      merged[merged.length - 1] += seg
    } else if (seg.length < minLen && merged.length > 0) {
      merged[merged.length - 1] += seg
    } else {
      merged.push(seg)
    }
  }
  // 如果合并后还有太短的段，跟最后一段合并
  if (merged.length >= 2 && merged[merged.length - 1].length < minLen) {
    merged[merged.length - 2] += merged.pop()!
  }

  return merged.length > 0 ? merged : [text]
}

/** 尝试将 AI 回复转为语音（长文本自动分段）
 *  @param onFirstAudio - 第一段语音生成完毕时的回调（用于同步显示文字）
 */
async function speakReply(text: string, onFirstAudio?: () => void): Promise<void> {
  try {
    console.log('[pet-chat] speakReply 开始, 原文长度:', text.length, '内容:', text.slice(0, 60))

    const audioPath = localStorage.getItem('pet_ref_audio_path') || DEFAULT_REF_AUDIO
    const promptText = localStorage.getItem('pet_ref_prompt_text') || ''

    console.log('[pet-chat] 参考音频:', audioPath, '提示文字:', promptText || '(空)')

    // 读取用户保存的语音参数
    let voiceParams: Record<string, number> = {}
    try {
      const raw = localStorage.getItem('pet_voice_params')
      if (raw) voiceParams = JSON.parse(raw)
    } catch { /* 静默 */ }

    const st = await window.api.voiceStatus()
    if (!st.running) {
      console.log('[pet-chat] TTS 服务未运行，跳过语音')
      return
    }

    const ttsText = stripInnerThoughts(text)
    if (!ttsText) {
      console.log('[pet-chat] 去掉括号后无文字，跳过 TTS')
      return
    }

    // 拆分成短段并逐段生成语音
    const segments = splitTextForTts(ttsText)
    console.log(`[pet-chat] TTS 文本已拆分为 ${segments.length} 段`)

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      console.log(`[pet-chat] TTS 第 ${i + 1}/${segments.length} 段: "${seg.slice(0, 40)}..."`)

      const res = await window.api.voiceTts({
        text: seg,
        text_lang: 'ja',    // 文字已被翻译成日语
        ref_audio_path: audioPath,
        prompt_text: promptText,
        prompt_lang: 'ja',  // 参考音频的文字是日语
        top_k: voiceParams.top_k ?? 15,
        top_p: voiceParams.top_p ?? 0.85,
        temperature: voiceParams.temperature ?? 0.7,
        speed_factor: voiceParams.speed_factor ?? 1.0,
        repetition_penalty: voiceParams.repetition_penalty ?? 1.25,
        sample_steps: voiceParams.sample_steps ?? 16
      })

      if (res.success && res.dataUrl) {
        console.log(`[pet-chat] 第 ${i + 1} 段 TTS 成功, 音频大小:`, res.dataUrl.length)
        // 第一段语音就绪 → 通知外部显示文字 + 开始播放
        if (i === 0) onFirstAudio?.()
        const audio = new Audio(res.dataUrl)
        // 等待当前段播放完再播下一段
        await new Promise<void>((resolve) => {
          audio.onended = () => {
            console.log(`[pet-chat] 第 ${i + 1} 段播放完毕`)
            resolve()
          }
          audio.onerror = (e) => {
            console.error(`[pet-chat] 第 ${i + 1} 段播放出错:`, e)
            resolve()
          }
          const playPromise = audio.play()
          if (playPromise) {
            playPromise.catch((err) => {
              console.error(`[pet-chat] 第 ${i + 1} 段 play() 被拦截:`, err.message)
              // 尝试用 AudioContext 方式播放
              playAudioWithContext(res.dataUrl).then(resolve).catch(() => resolve())
            })
          }
        })
      } else {
        console.error(`[pet-chat] 第 ${i + 1} 段 TTS 失败:`, res.message)
      }
    }
    console.log('[pet-chat] TTS 全部段播放完成')
  } catch (err) {
    console.error('[pet-chat] TTS 异常:', err)
  }
}

/** 备用播放方式：使用 AudioContext 解码并播放（绕过 autoplay 限制） */
function playAudioWithContext(dataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const AC: typeof AudioContext = window.AudioContext
        // @ts-expect-error webkitAudioContext for Safari/old Electron
        || window.webkitAudioContext
      const ctx = new AC()
      fetch(dataUrl)
        .then(r => r.arrayBuffer())
        .then(buf => ctx.decodeAudioData(buf))
        .then(audioBuffer => {
          const source = ctx.createBufferSource()
          source.buffer = audioBuffer
          source.connect(ctx.destination)
          source.onended = () => { ctx.close().then(resolve).catch(resolve) }
          source.start(0)
        })
        .catch((err) => {
          console.error('[pet-chat] AudioContext 播放失败:', err)
          ctx.close().catch(() => {})
          reject(err)
        })
    } catch (err) {
      reject(err)
    }
  })
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
