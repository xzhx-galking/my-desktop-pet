<script setup lang="ts">
/**
 * VoicePanel — 语音模块（GPT-SoVITS TTS）
 *
 * 功能：
 *  - 启动/停止 GPT-SoVITS 语音合成服务
 *  - 选择参考音频文件（音色样本）
 *  - 输入文字并合成语音
 *  - 播放合成结果
 */

import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useFilePicker, type FileEntry } from '../composables/useFilePicker'
import { loadVoiceParams, saveVoiceParams } from '../stores/persist'
import type { VoiceParams } from '../stores/persist'

const GPT_KEY = 'pet_gpt_model_path'
const SOVITS_KEY = 'pet_sovits_model_path'

const SERVER_PORT = 9880

// ── 服务状态 ──
const serverStatus = ref<'stopped' | 'starting' | 'running' | 'error'>('stopped')
const serverMessage = ref('')

/** 查询服务状态 */
async function checkStatus(): Promise<void> {
  const st = await window.api.voiceStatus()
  serverStatus.value = st.running ? 'running' : 'stopped'
  if (st.running) serverMessage.value = `服务运行中（端口 ${SERVER_PORT}）`
}

/** 启动语音服务 */
async function startServer(): Promise<void> {
  serverStatus.value = 'starting'
  serverMessage.value = '正在启动 GPT-SoVITS 服务…'

  // 传入训练模型路径（如果有选择）
  const modelPaths: { gpt?: string; sovits?: string } = {}
  if (gptModelPath.value) modelPaths.gpt = getRelativePath(gptModelPath.value)
  if (sovitsModelPath.value) modelPaths.sovits = getRelativePath(sovitsModelPath.value)

  const res = await window.api.voiceStart(modelPaths)
  if (res.success) {
    serverStatus.value = 'running'
    serverMessage.value = `服务运行中（端口 ${SERVER_PORT}）`
  } else {
    serverStatus.value = 'error'
    serverMessage.value = res.message
  }
}

/** 停止语音服务 */
async function stopServer(): Promise<void> {
  await window.api.voiceStop()
  serverStatus.value = 'stopped'
  serverMessage.value = ''
}

// ── 参考音频选择 ──
const VALID_EXTS = ['.mp3']
const { folderPath, files, pickFolder, getFilePath } =
  useFilePicker(VALID_EXTS, 'voice')

const selectedAudio = ref('')
const promptText = ref('')
const promptLang = ref('zh')

function selectAudio(entry: FileEntry): void {
  selectedAudio.value = selectedAudio.value === entry.name ? '' : entry.name
  // 保存到 localStorage，供宠物窗口 AI 对话 TTS 使用
  if (selectedAudio.value) {
    localStorage.setItem('pet_ref_audio_path', getFilePath(entry.name))
  } else {
    localStorage.removeItem('pet_ref_audio_path')
  }
}

/** 从 localStorage 恢复选中的音频 */
function restoreSelectedAudio(): void {
  const savedPath = localStorage.getItem('pet_ref_audio_path')
  console.log('[restoreAudio] savedPath:', savedPath, 'folder:', folderPath.value, 'files:', files.value.length)
  if (!savedPath || !folderPath.value || files.value.length === 0) return
  // savedPath 格式：folder/file，匹配文件名
  const savedName = savedPath.split(/[/\\]/).pop() || ''
  console.log('[restoreAudio] savedName:', savedName)
  if (savedName) {
    const match = files.value.find(f => f.name === savedName)
    console.log('[restoreAudio] match:', match?.name)
    if (match) selectedAudio.value = match.name
  }
}

// 文件列表加载后自动恢复选中态
watch(files, () => {
  restoreSelectedAudio()
}, { immediate: true })

// ── 训练模型选择 ──
const gptModelPath = ref(localStorage.getItem(GPT_KEY) || '')
const sovitsModelPath = ref(localStorage.getItem(SOVITS_KEY) || '')

const GPT_BASE = 'E:\\GPT-SoVITS-v2pro-20250604'

/** 选择 GPT 模型文件（.ckpt） */
async function pickGptModel(): Promise<void> {
  const path = await window.api.selectFile({
    filters: [{ name: 'GPT 模型 (*.ckpt)', extensions: ['ckpt'] }],
    defaultPath: GPT_BASE + '\\GPT_weights_v2ProPlus'
  })
  if (path) {
    gptModelPath.value = path
    localStorage.setItem(GPT_KEY, path)
  }
}

/** 选择 SoVITS 模型文件（.pth） */
async function pickSovitsModel(): Promise<void> {
  const path = await window.api.selectFile({
    filters: [{ name: 'SoVITS 模型 (*.pth)', extensions: ['pth'] }],
    defaultPath: GPT_BASE + '\\SoVITS_weights_v2ProPlus'
  })
  if (path) {
    sovitsModelPath.value = path
    localStorage.setItem(SOVITS_KEY, path)
  }
}

/** 获取模型文件相对于 GPT-SoVITS 目录的路径 */
function getRelativePath(absPath: string): string {
  const base = 'E:\\GPT-SoVITS-v2pro-20250604\\'
  if (absPath.startsWith(base)) return absPath.slice(base.length).replace(/\\/g, '/')
  return absPath
}

// ── 语音参数（可调节，自动持久化） ──
const voiceParams = ref<VoiceParams>(loadVoiceParams())

watch(voiceParams, (v) => {
  saveVoiceParams(v)
}, { deep: true })

// ── 文字合成 ──
const ttsText = ref('')
const ttsLang = ref('zh')
const ttsLoading = ref(false)
const ttsMessage = ref('')
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)

async function speak(): Promise<void> {
  if (!ttsText.value.trim()) {
    ttsMessage.value = '请输入要合成的文字'
    return
  }
  if (!selectedAudio.value) {
    ttsMessage.value = '请先选择参考音频'
    return
  }

  ttsLoading.value = true
  ttsMessage.value = '合成中…'

  try {
    const p = voiceParams.value
    const res = await window.api.voiceTts({
      text: ttsText.value.trim(),
      text_lang: ttsLang.value,
      ref_audio_path: getFilePath(selectedAudio.value),
      prompt_text: promptText.value,
      prompt_lang: promptLang.value,
      top_k: p.top_k,
      top_p: p.top_p,
      temperature: p.temperature,
      speed_factor: p.speed_factor,
      repetition_penalty: p.repetition_penalty,
      sample_steps: p.sample_steps
    })

    if (!res.success) {
      ttsMessage.value = `合成失败: ${res.message}`
      ttsLoading.value = false
      return
    }

    ttsMessage.value = '合成成功 ✓'

    // 播放
    stopAudio()
    const audio = new Audio(res.dataUrl)
    audio.addEventListener('ended', () => {
      isPlaying.value = false
      audioRef.value = null
    })
    audio.addEventListener('error', () => {
      ttsMessage.value = '音频播放失败'
      isPlaying.value = false
      audioRef.value = null
    })
    audioRef.value = audio
    isPlaying.value = true
    audio.play()
  } catch (err) {
    ttsMessage.value = `异常: ${(err as Error).message}`
  } finally {
    ttsLoading.value = false
  }
}

function stopAudio(): void {
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value = null
  }
  isPlaying.value = false
}

// 同步 prompt 到 localStorage（供宠物窗口 AI 对话 TTS 使用）
watch(promptText, (v) => {
  if (v) localStorage.setItem('pet_ref_prompt_text', v)
  else localStorage.removeItem('pet_ref_prompt_text')
})
watch(promptLang, (v) => {
  localStorage.setItem('pet_ref_prompt_lang', v)
})

onMounted(() => {
  // 恢复之前保存的提示文字
  const savedText = localStorage.getItem('pet_ref_prompt_text')
  if (savedText) promptText.value = savedText
  const savedLang = localStorage.getItem('pet_ref_prompt_lang')
  if (savedLang) promptLang.value = savedLang

  // 如果没有保存过参考音频路径，设置默认值
  if (!localStorage.getItem('pet_ref_audio_path')) {
    localStorage.setItem('pet_ref_audio_path',
      'E:\\桌宠文件\\声音-切分后的mp3\\VO01_0678.OGG_0000000000_0000134720.mp3')
  }

  // 延迟恢复选中的音频（等待文件列表加载完毕）
  setTimeout(() => restoreSelectedAudio(), 300)
  checkStatus()
})
onUnmounted(() => {
  stopAudio()
})
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h2 class="panel-title">🎤 语音模块</h2>
      <p class="panel-desc">GPT-SoVITS 语音合成 — 让桌宠开口说话</p>
    </div>

    <div class="panel-body">
      <!-- ═══════════════ 服务控制 ═══════════════ -->
      <section class="section">
        <div class="section-header">
          <h3 class="section-title">🔌 服务控制</h3>
          <span class="server-badge" :class="serverStatus">
            {{ serverStatus === 'running' ? '运行中' : serverStatus === 'starting' ? '启动中' : serverStatus === 'error' ? '错误' : '已停止' }}
          </span>
        </div>
        <p class="section-desc">
          GPT-SoVITS API 服务（端口 {{ SERVER_PORT }}）
        </p>
        <div class="server-actions">
          <button
            v-if="serverStatus !== 'running'"
            class="btn btn-start"
            :disabled="serverStatus === 'starting'"
            @click="startServer"
          >
            <span class="btn-icon">{{ serverStatus === 'starting' ? '⏳' : '▶' }}</span>
            <span>{{ serverStatus === 'starting' ? '启动中…' : '启动服务' }}</span>
          </button>
          <button
            v-else
            class="btn btn-stop"
            @click="stopServer"
          >
            <span class="btn-icon">⏹</span>
            <span>停止服务</span>
          </button>
        </div>
        <p v-if="serverMessage" class="msg" :class="{ error: serverStatus === 'error' }">
          {{ serverMessage }}
        </p>
      </section>

      <!-- ═══════════════ 参考音频 ═══════════════ -->
      <section class="section">
        <div class="section-header">
          <h3 class="section-title">🎧 参考音频</h3>
          <span v-if="selectedAudio" class="badge-selected">已选</span>
        </div>
        <p class="section-desc">选择一段语音样本作为桌宠的音色</p>

        <div class="toolbar">
          <button class="btn btn-secondary" @click="pickFolder">
            <span class="btn-icon">📂</span>
            <span>{{ folderPath ? '更换文件夹' : '选择音频文件夹' }}</span>
          </button>
          <span v-if="folderPath" class="path-hint" :title="folderPath">📁 {{ folderPath }}</span>
        </div>

        <!-- 参考音频列表 -->
        <div v-if="folderPath && files.length > 0" class="audio-list">
          <div
            v-for="entry in files"
            :key="entry.name"
            class="audio-item"
            :class="{ selected: selectedAudio === entry.name }"
            @click="selectAudio(entry)"
          >
            <span class="audio-icon">{{ selectedAudio === entry.name ? '🔊' : '🔇' }}</span>
            <span class="audio-name" :title="entry.name">{{ entry.name }}</span>
            <span class="audio-ext">{{ entry.ext.toUpperCase() }}</span>
          </div>
        </div>
        <div v-else-if="!folderPath" class="section-hint">
          点击上方按钮选择包含参考音频的文件夹
        </div>

        <!-- 选定后的提示文字输入 -->
        <div v-if="selectedAudio" class="prompt-box">
          <label class="input-label">参考音频原文字（prompt text，提升音色相似度）</label>
          <div class="input-row">
            <input
              v-model="promptText"
              class="input"
              type="text"
              placeholder="如：你好，我是你的桌宠"
            />
            <select v-model="promptLang" class="select-lang">
              <option value="zh">中文</option>
              <option value="ja">日文</option>
              <option value="en">英文</option>
            </select>
          </div>
        </div>
      </section>

      <!-- ═══════════════ 训练模型选择 ═══════════════ -->
      <section class="section">
        <div class="section-header">
          <h3 class="section-title">🧠 训练模型</h3>
          <span v-if="gptModelPath && sovitsModelPath" class="badge-selected">已配置</span>
        </div>
        <p class="section-desc">选择用 SoVITS_v2ProPlus 训练好的模型文件（可选，不选则使用默认模型）</p>

        <div class="model-select-area">
          <!-- GPT 模型 -->
          <div class="model-row">
            <div class="model-row-header">
              <span class="model-label">GPT 模型</span>
              <span class="model-ext">.ckpt</span>
            </div>
            <div class="model-input-row">
              <input class="input model-input" readonly :value="gptModelPath ? gptModelPath.split(/[/\\]/).pop() : '未选择'" />
              <button class="btn btn-secondary btn-sm" @click="pickGptModel">选择文件</button>
            </div>
          </div>

          <!-- SoVITS 模型 -->
          <div class="model-row">
            <div class="model-row-header">
              <span class="model-label">SoVITS 模型</span>
              <span class="model-ext">.pth</span>
            </div>
            <div class="model-input-row">
              <input class="input model-input" readonly :value="sovitsModelPath ? sovitsModelPath.split(/[/\\]/).pop() : '未选择'" />
              <button class="btn btn-secondary btn-sm" @click="pickSovitsModel">选择文件</button>
            </div>
          </div>

          <p class="section-hint" style="margin-top:4px;text-align:left;padding:0;">
            💡 选好后重启语音服务生效。推荐：<code>夜乃樱音频-e15.ckpt</code> + <code>夜乃樱音频_e8_s704.pth</code>
          </p>
        </div>
      </section>

      <!-- ═══════════════ 文字合成 ═══════════════ -->
      <section class="section">
        <div class="section-header">
          <h3 class="section-title">📝 文字合成</h3>
        </div>
        <p class="section-desc">输入想让桌宠说的话</p>

        <div class="tts-input-area">
          <div class="input-row">
            <select v-model="ttsLang" class="select-lang" :disabled="ttsLoading">
              <option value="zh">中文</option>
              <option value="ja">日文</option>
              <option value="en">英文</option>
              <option value="ko">韩文</option>
              <option value="all">多语种混合</option>
            </select>
          </div>
          <textarea
            v-model="ttsText"
            class="textarea"
            rows="4"
            placeholder="输入要合成的文字…"
            :disabled="ttsLoading"
          ></textarea>
          <div class="tts-actions">
            <button
              class="btn btn-speak"
              :disabled="!ttsText.trim() || !selectedAudio || ttsLoading || serverStatus !== 'running'"
              @click="speak"
            >
              <span class="btn-icon">{{ ttsLoading ? '⏳' : isPlaying ? '🔊' : '🗣' }}</span>
              <span>{{ ttsLoading ? '合成中…' : isPlaying ? '播放中' : '合成并播放' }}</span>
            </button>
            <button
              v-if="isPlaying"
              class="btn btn-secondary"
              @click="stopAudio"
            >
              ⏹ 停止
            </button>
          </div>
          <p v-if="ttsMessage" class="msg" :class="{ error: ttsMessage.includes('失败') || ttsMessage.includes('异常') }">
            {{ ttsMessage }}
          </p>
        </div>
      </section>

      <!-- ═══════════════ 参数调节 ═══════════════ -->
      <section class="section">
        <div class="section-header">
          <h3 class="section-title">🎛️ 参数调节</h3>
          <span class="badge-saved">自动保存</span>
        </div>
        <p class="section-desc">调节 TTS 合成参数，修改后即时生效</p>

        <div class="param-grid">
          <div class="param-item">
            <label class="param-label">
              <span>温度 temperature</span>
              <span class="param-val">{{ voiceParams.temperature.toFixed(1) }}</span>
            </label>
            <input type="range" min="0.1" max="1.5" step="0.1" v-model.number="voiceParams.temperature" class="param-slider" />
          </div>
          <div class="param-item">
            <label class="param-label">
              <span>采样 top_k</span>
              <span class="param-val">{{ voiceParams.top_k }}</span>
            </label>
            <input type="range" min="1" max="50" step="1" v-model.number="voiceParams.top_k" class="param-slider" />
          </div>
          <div class="param-item">
            <label class="param-label">
              <span>核采样 top_p</span>
              <span class="param-val">{{ voiceParams.top_p.toFixed(2) }}</span>
            </label>
            <input type="range" min="0.1" max="1.0" step="0.01" v-model.number="voiceParams.top_p" class="param-slider" />
          </div>
          <div class="param-item">
            <label class="param-label">
              <span>语速 speed</span>
              <span class="param-val">{{ voiceParams.speed_factor.toFixed(1) }}</span>
            </label>
            <input type="range" min="0.5" max="2.0" step="0.1" v-model.number="voiceParams.speed_factor" class="param-slider" />
          </div>
          <div class="param-item">
            <label class="param-label">
              <span>重复惩罚 repetition_penalty</span>
              <span class="param-val">{{ voiceParams.repetition_penalty.toFixed(1) }}</span>
            </label>
            <input type="range" min="1.0" max="2.0" step="0.1" v-model.number="voiceParams.repetition_penalty" class="param-slider" />
          </div>
          <div class="param-item">
            <label class="param-label">
              <span>采样步数 sample_steps</span>
              <span class="param-val">{{ voiceParams.sample_steps }}</span>
            </label>
            <input type="range" min="4" max="64" step="1" v-model.number="voiceParams.sample_steps" class="param-slider" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.panel-header {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.panel-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--ev-c-text-1);
  margin-bottom: 4px;
}

.panel-desc {
  font-size: 13px;
  color: var(--ev-c-text-3);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

/* ── 区块 ── */
.section {
  background-color: var(--ev-c-black-mute);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 12px;
  padding: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ev-c-text-1);
  margin: 0;
}

.section-desc {
  font-size: 12px;
  color: var(--ev-c-text-3);
  margin: 2px 0 12px 0;
}

.section-hint {
  font-size: 13px;
  color: var(--ev-c-text-3);
  text-align: center;
  padding: 16px;
}

/* ── 服务徽章 ── */
.server-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
  text-transform: uppercase;
}

.server-badge.running { background: #22c55e20; color: #22c55e; }
.server-badge.starting { background: #f59e0b20; color: #f59e0b; }
.server-badge.stopped { background: #6b728020; color: #6b7280; }
.server-badge.error { background: #ef444420; color: #ef4444; }

/* ── 按钮 ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-icon { font-size: 16px; line-height: 1; }

.btn-start { color: #fff; background-color: #22c55e; }
.btn-start:hover:not(:disabled) { background-color: #16a34a; }

.btn-stop { color: #fff; background-color: #ef4444; }
.btn-stop:hover:not(:disabled) { background-color: #dc2626; }

.btn-secondary { color: var(--ev-c-text-2); background-color: var(--ev-c-gray-3); }
.btn-secondary:hover:not(:disabled) { background-color: var(--ev-c-gray-2); color: var(--ev-c-text-1); }

.btn-speak { color: #fff; background-color: #4a6cf7; }
.btn-speak:hover:not(:disabled) { background-color: #3b5de7; }

.server-actions { margin-bottom: 4px; }

/* ── 工具栏 ── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.path-hint {
  font-size: 12px;
  color: var(--ev-c-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* ── 参考音频列表 ── */
.audio-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 160px;
  overflow-y: auto;
}

.audio-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: var(--ev-c-gray-4);
  cursor: pointer;
  transition: background-color 0.15s;
}

.audio-item:hover { background-color: var(--ev-c-gray-3); }
.audio-item.selected { background-color: rgba(74, 108, 247, 0.15); border: 1px solid rgba(74, 108, 247, 0.3); }

.audio-icon { font-size: 16px; flex-shrink: 0; }
.audio-name { flex: 1; font-size: 13px; color: var(--ev-c-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.audio-ext { font-size: 11px; font-weight: 600; color: var(--ev-c-text-3); background: var(--ev-c-gray-3); padding: 1px 6px; border-radius: 4px; flex-shrink: 0; }

.badge-selected {
  font-size: 11px;
  font-weight: 600;
  background: #22c55e20;
  color: #22c55e;
  padding: 1px 8px;
  border-radius: 999px;
}

/* ── 模型选择 ── */
.model-select-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.model-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-row-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ev-c-text-2);
}

.model-ext {
  font-size: 10px;
  font-weight: 700;
  color: #8888aa;
  background: rgba(74, 108, 247, 0.15);
  padding: 1px 6px;
  border-radius: 4px;
}

.model-input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.model-input {
  flex: 1;
  font-size: 12px !important;
  color: var(--ev-c-text-2) !important;
  cursor: default !important;
}

.btn-sm {
  padding: 5px 12px !important;
  font-size: 12px !important;
  flex-shrink: 0;
}

/* ── Prompt 输入 ── */
.prompt-box {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ev-c-gray-3);
}

.input-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--ev-c-text-2);
  margin-bottom: 6px;
}

/* ── 输入控件 ── */
.input-row {
  display: flex;
  gap: 8px;
}

.input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  font-size: 13px;
  background-color: var(--ev-c-gray-4);
  color: var(--ev-c-text-1);
  outline: none;
  transition: border-color 0.15s;
}

.input:focus { border-color: #4a6cf7; }

.select-lang {
  padding: 8px 10px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  font-size: 13px;
  background-color: var(--ev-c-gray-4);
  color: var(--ev-c-text-1);
  outline: none;
  cursor: pointer;
}

.select-lang:focus { border-color: #4a6cf7; }

/* ── 文字合成 ── */
.tts-input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  background-color: var(--ev-c-gray-4);
  color: var(--ev-c-text-1);
  outline: none;
  transition: border-color 0.15s;
}

.textarea:focus { border-color: #4a6cf7; }
.textarea:disabled { opacity: 0.4; cursor: not-allowed; }

.tts-actions {
  display: flex;
  gap: 8px;
}

/* ── 参数调节 ── */
.badge-saved {
  font-size: 10px;
  font-weight: 600;
  background: #22c55e20;
  color: #22c55e;
  padding: 1px 8px;
  border-radius: 999px;
}

.param-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.param-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--ev-c-text-2);
}

.param-val {
  font-weight: 700;
  color: var(--ev-c-text-1);
  min-width: 28px;
  text-align: right;
}

.param-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--ev-c-gray-3);
  outline: none;
  cursor: pointer;
}

.param-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #4a6cf7;
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* ── 消息 ── */
.msg {
  font-size: 13px;
  color: var(--ev-c-text-2);
  margin: 4px 0 0 0;
}

.msg.error { color: #ef4444; }
</style>
