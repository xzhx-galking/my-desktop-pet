<script setup lang="ts">
/**
 * HomePage — 桌宠首页
 * 提供启动/关闭按钮，控制桌面宠物的显示
 */

import { useRouter } from 'vue-router'
import { petStore } from '../stores/petStore'
import { loadModelPath, loadModelName } from '../stores/persist'

const router = useRouter()

// 页面加载时从 localStorage 恢复模型信息
const savedPath = loadModelPath()
const savedName = loadModelName()
if (savedPath && !petStore.currentModelPath) {
  petStore.currentModelPath = savedPath
  petStore.currentModelName = savedName
}

/** 启动桌宠——使用上一次确认的模型 */
async function startPet(): Promise<void> {
  let dataUrl = petStore.currentModelDataUrl
  const filePath = petStore.currentModelPath

  // 有路径但没 dataUrl（跨会话重启后）→ 重新读取
  if (!dataUrl && filePath) {
    dataUrl = await window.api.readAsDataUrl(filePath)
    if (dataUrl) petStore.currentModelDataUrl = dataUrl
  }

  if (!dataUrl) {
    router.push('/model')
    return
  }
  await window.api.showPet(filePath, dataUrl)
  petStore.isActive = true

  // 同时启动语音 API 服务（不阻塞，后台自动）
  window.api.voiceStart().then((res) => {
    console.log('[home] 语音服务:', res.message)
  })
}

/** 关闭桌宠 */
async function stopPet(): Promise<void> {
  await window.api.hidePet()
  petStore.isActive = false
}
</script>

<template>
  <div class="home-page">
    <div class="hero">
      <div class="logo-area">
        <span class="logo-emoji">🐾</span>
        <h1 class="logo-title">My Desktop Pet</h1>
        <p class="logo-desc">你的桌面小伙伴</p>
      </div>

      <div class="status-card" :class="{ active: petStore.isActive }">
        <div class="status-indicator">
          <span class="status-dot" :class="{ online: petStore.isActive }"></span>
          <span class="status-text">{{ petStore.isActive ? '运行中' : '已停止' }}</span>
        </div>

        <div v-if="petStore.currentModelName" class="current-model">
          <span class="model-label">当前立绘：</span>
          <span class="model-name">{{ petStore.currentModelName }}</span>
        </div>
        <div v-else class="current-model">
          <span class="model-label hint">请先在「更换立绘」中选择并确认</span>
        </div>

        <button
          class="power-btn"
          :class="{ on: petStore.isActive, off: !petStore.isActive }"
          @click="petStore.isActive ? stopPet() : startPet()"
        >
          <span class="btn-icon">{{ petStore.isActive ? '⏻' : '⏻' }}</span>
          <span class="btn-label">{{ petStore.isActive ? '关闭桌宠' : '启动桌宠' }}</span>
        </button>
      </div>

      <div class="tips">
        <p class="tip-line">💡 在左侧「更换立绘」中选择立绘并确认</p>
        <p class="tip-line">💡 可拖拽宠物移动、拖拽右下角手柄缩放</p>
        <p class="tip-line">💡 点击其他软件窗口时手柄自动隐藏</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: 40px;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  max-width: 400px;
}

/* ── Logo ── */
.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.logo-emoji {
  font-size: 64px;
  line-height: 1;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.logo-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--ev-c-text-1);
  margin: 0;
}

.logo-desc {
  font-size: 14px;
  color: var(--ev-c-text-3);
  margin: 0;
}

/* ── 状态卡 ── */
.status-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 28px 24px;
  border-radius: 16px;
  background-color: var(--ev-c-black-mute);
  border: 1px solid var(--ev-c-gray-3);
  transition: border-color 0.3s;
}

.status-card.active {
  border-color: rgba(34, 197, 94, 0.4);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #ef4444;
  transition: background-color 0.3s;
}

.status-dot.online {
  background-color: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.status-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--ev-c-text-1);
}

/* ── 当前模型 ── */
.current-model {
  font-size: 13px;
  color: var(--ev-c-text-2);
}

.model-label.hint {
  color: var(--ev-c-text-3);
  font-style: italic;
}

.model-name {
  color: var(--ev-c-text-1);
  font-weight: 500;
}

/* ── 电源按钮 ── */
.power-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 32px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
}

.power-btn:active {
  transform: scale(0.97);
}

.power-btn.on {
  color: #fff;
  background-color: #ef4444;
}

.power-btn.on:hover {
  background-color: #dc2626;
}

.power-btn.off {
  color: #fff;
  background-color: #22c55e;
}

.power-btn.off:hover {
  background-color: #16a34a;
}

.btn-icon {
  font-size: 20px;
  line-height: 1;
}

/* ── 使用提示 ── */
.tips {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.tip-line {
  font-size: 12px;
  color: var(--ev-c-text-3);
  margin: 0;
  text-align: center;
  line-height: 1.6;
}
</style>
