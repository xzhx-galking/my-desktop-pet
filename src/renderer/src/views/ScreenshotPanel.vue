<script setup lang="ts">
/**
 * ScreenshotPanel — 截屏监控模块
 *
 * 定时截取屏幕内容，AI 分析并给出反应
 */

import { ref, watch, onMounted, onUnmounted } from 'vue'
import { petStore } from '../stores/petStore'
import { loadScreenshotInterval, saveScreenshotInterval } from '../stores/persist'

// ── 状态 ──
const isRunning = ref(false)
const statusMessage = ref('')
const intervalSec = ref(loadScreenshotInterval())
const lastReaction = ref<{ emotion: string; text: string; time: string } | null>(null)
const reactionHistory = ref<{ emotion: string; text: string; time: string }[]>([])

/** 查询当前截屏状态 */
async function checkStatus(): Promise<void> {
  const st = await window.api.screenshotStatus()
  isRunning.value = st.running
}

/** 启动截屏监控 */
async function startScreenshot(): Promise<void> {
  // 确保桌宠在运行
  if (!petStore.isActive) {
    statusMessage.value = '请先在首页启动桌宠'
    return
  }

  const ms = intervalSec.value * 1000
  if (ms < 5000) {
    statusMessage.value = '间隔时间不能少于 5 秒'
    return
  }

  isRunning.value = true
  statusMessage.value = '启动中…'
  const res = await window.api.screenshotStart(ms)
  if (res.success) {
    statusMessage.value = res.message
    petStore.screenshotEnabled = true
  } else {
    isRunning.value = false
    statusMessage.value = res.message
  }
}

/** 停止截屏监控 */
async function stopScreenshot(): Promise<void> {
  const res = await window.api.screenshotStop()
  if (res.success) {
    isRunning.value = false
    statusMessage.value = '已停止'
    petStore.screenshotEnabled = false
  }
}

/** 即时截屏一次 */
const capturingNow = ref(false)
async function captureNow(): Promise<void> {
  if (!petStore.isActive) {
    statusMessage.value = '请先在首页启动桌宠'
    return
  }
  capturingNow.value = true
  statusMessage.value = '截屏分析中…'
  try {
    const res = await window.api.screenshotCaptureOnce()
    statusMessage.value = res.success ? `✓ ${res.message}` : `失败: ${res.message}`
  } catch (err) {
    statusMessage.value = `异常: ${(err as Error).message}`
    console.error('[screenshot] 即时截屏异常:', err)
  } finally {
    capturingNow.value = false
  }
}

// ── 接收截屏反应 ──
function onReaction(data: { emotion: string; text: string }): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const entry = { ...data, time }
  lastReaction.value = entry
  reactionHistory.value.unshift(entry)
  if (reactionHistory.value.length > 20) reactionHistory.value = reactionHistory.value.slice(0, 20)
}

// 间隔变化时自动保存
watch(intervalSec, (val) => {
  if (val >= 5 && val <= 3600) saveScreenshotInterval(val)
})

onMounted(() => {
  checkStatus()
  window.api.onScreenshotReaction(onReaction)
})

onUnmounted(() => {
  window.api.offScreenshotReaction()
})
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h2 class="panel-title">👁 截屏监控</h2>
      <p class="panel-desc">定时截取屏幕内容，AI 自动给出反应</p>
    </div>

    <div class="panel-body">
      <!-- ═══════════════ 控制区 ═══════════════ -->
      <section class="section">
        <div class="section-header">
          <h3 class="section-title">🔘 控制</h3>
          <span class="status-badge" :class="{ running: isRunning, stopped: !isRunning }">
            {{ isRunning ? '运行中' : '已停止' }}
          </span>
        </div>

        <div class="control-row">
          <div class="interval-group">
            <label class="interval-label">截屏间隔</label>
            <div class="interval-input-row">
              <input
                v-model.number="intervalSec"
                class="input interval-input"
                type="number"
                min="5"
                max="3600"
                :disabled="isRunning"
              />
              <span class="interval-unit">秒</span>
            </div>
          </div>

          <div class="action-btns">
            <button
              v-if="!isRunning"
              class="btn btn-start"
              @click="startScreenshot"
            >
              <span class="btn-icon">▶</span>
              <span>启动监控</span>
            </button>
            <button
              v-else
              class="btn btn-stop"
              @click="stopScreenshot"
            >
              <span class="btn-icon">⏹</span>
              <span>停止监控</span>
            </button>
          </div>
        </div>

        <div class="capture-now-row">
          <button
            class="btn btn-capture"
            :disabled="!petStore.isActive || capturingNow"
            @click="captureNow"
          >
            <span class="btn-icon">{{ capturingNow ? '⏳' : '📸' }}</span>
            <span>{{ capturingNow ? '分析中…' : '立即截屏' }}</span>
          </button>
          <span class="capture-hint">点击即截取当前屏幕，AI 自动给出反应</span>
        </div>

        <p v-if="statusMessage" class="msg" :class="{ error: statusMessage.includes('失败') || statusMessage.includes('先') }">
          {{ statusMessage }}
        </p>
      </section>

      <!-- ═══════════════ 使用说明 ═══════════════ -->
      <section class="section">
        <div class="section-header">
          <h3 class="section-title">💡 说明</h3>
        </div>
        <ul class="info-list">
          <li>需要先 <strong>启动桌宠</strong> 才能开启截屏监控</li>
          <li>截屏仅用于 AI 分析屏幕内容，<strong>不会保存或上传</strong>到任何其他地方</li>
          <li>每次截屏会消耗 DeepSeek API 额度（约 500-1000 tokens）</li>
          <li>间隔建议 30 秒以上，避免 API 过快消耗</li>
        </ul>
      </section>

      <!-- ═══════════════ 最近反应 ═══════════════ -->
      <section class="section" v-if="reactionHistory.length > 0">
        <div class="section-header">
          <h3 class="section-title">💬 最近反应</h3>
          <span class="badge-count">{{ reactionHistory.length }}</span>
        </div>

        <div class="reaction-list">
          <div
            v-for="(item, i) in reactionHistory"
            :key="i"
            class="reaction-item"
            :class="{ latest: i === 0 }"
          >
            <span class="reaction-time">{{ item.time }}</span>
            <span class="reaction-emotion">【{{ item.emotion }}】</span>
            <span class="reaction-text">{{ item.text }}</span>
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
  gap: 16px;
  min-height: 0;
}

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
  margin-bottom: 10px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ev-c-text-1);
  margin: 0;
}

/* ── 状态徽章 ── */
.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
  text-transform: uppercase;
}

.status-badge.running { background: #22c55e20; color: #22c55e; }
.status-badge.stopped { background: #6b728020; color: #6b7280; }

/* ── 控制行 ── */
.control-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.interval-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.interval-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ev-c-text-2);
}

.interval-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.interval-input {
  width: 80px;
  padding: 8px 10px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  font-size: 14px;
  background-color: var(--ev-c-gray-4);
  color: var(--ev-c-text-1);
  outline: none;
  text-align: center;
}

.interval-input:focus { border-color: #4a6cf7; }
.interval-input:disabled { opacity: 0.4; cursor: not-allowed; }

.interval-unit {
  font-size: 13px;
  color: var(--ev-c-text-3);
}

.action-btns {
  flex-shrink: 0;
}

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

.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-icon { font-size: 16px; line-height: 1; }

.btn-start { color: #fff; background-color: #22c55e; }
.btn-start:hover:not(:disabled) { background-color: #16a34a; }

.btn-stop { color: #fff; background-color: #ef4444; }
.btn-stop:hover:not(:disabled) { background-color: #dc2626; }

.btn-capture { color: #fff; background-color: #4a6cf7; }
.btn-capture:hover:not(:disabled) { background-color: #3b5de7; }
.btn-capture:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── 即时截屏行 ── */
.capture-now-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--ev-c-gray-3);
}

.capture-hint {
  font-size: 12px;
  color: var(--ev-c-text-3);
}

/* ── 消息 ── */
.msg {
  font-size: 13px;
  color: var(--ev-c-text-2);
  margin: 8px 0 0 0;
}

.msg.error { color: #ef4444; }

/* ── 说明列表 ── */
.info-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-list li {
  font-size: 13px;
  color: var(--ev-c-text-2);
  line-height: 1.5;
}

/* ── 反应列表 ── */
.badge-count {
  font-size: 11px;
  font-weight: 600;
  background: #4a6cf720;
  color: #88aaff;
  padding: 1px 8px;
  border-radius: 999px;
}

.reaction-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.reaction-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  background-color: var(--ev-c-gray-4);
}

.reaction-item.latest {
  background-color: rgba(74, 108, 247, 0.12);
  border: 1px solid rgba(74, 108, 247, 0.25);
}

.reaction-time {
  font-size: 11px;
  color: var(--ev-c-text-3);
  flex-shrink: 0;
  font-family: monospace;
}

.reaction-emotion {
  color: #f59e0b;
  font-weight: 600;
  flex-shrink: 0;
}

.reaction-text {
  color: var(--ev-c-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
