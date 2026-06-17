<script setup lang="ts">
/**
 * HomePage — 桌宠首页
 * 提供启动/关闭按钮，控制桌面宠物的显示
 */

import { useRouter } from 'vue-router'
import { petStore } from '../stores/petStore'

const router = useRouter()

/** 启动桌宠——首次启动时同步加载语音模块 */
async function startPet(): Promise<void> {
  // 检查语音服务是否已在运行
  const voiceStatus = await window.api.voiceStatus()
  const needVoiceLoad = !voiceStatus.running

  if (needVoiceLoad) {
    petStore.isVoiceLoading = true
  }

  try {
    // 打开宠物窗（传空路径则由 main process 自动加载默认立绘 A10.png）
    await window.api.showPet('', '')

    // 首次启动才需要等待语音模型加载
    if (needVoiceLoad) {
      const voiceRes = await window.api.voiceStart()
      console.log('[home] 语音服务:', voiceRes.message)
    }
  } catch (err) {
    console.error('[home] 启动失败:', err)
  } finally {
    petStore.isVoiceLoading = false
    petStore.isActive = true
  }
}

/** 关闭桌宠（不停止语音服务，下次秒开） */
async function stopPet(): Promise<void> {
  await window.api.hidePet()
  petStore.isActive = false
}

// 页面加载时查询截屏状态（更新 store，供其他组件参考）
window.api.screenshotStatus().then(st => {
  petStore.screenshotEnabled = st.running
})
</script>

<template>
  <div class="home-page">
    <button class="settings-btn" title="设置" @click="router.push('/settings')">⚙️</button>
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

        <button
          class="power-btn"
          :class="{ on: petStore.isActive, loading: petStore.isVoiceLoading, off: !petStore.isActive && !petStore.isVoiceLoading }"
          :disabled="petStore.isVoiceLoading"
          @click="petStore.isActive ? stopPet() : startPet()"
        >
          <span class="btn-icon">{{ petStore.isVoiceLoading ? '⏳' : '⏻' }}</span>
          <span class="btn-label">
            {{ petStore.isVoiceLoading ? '加载语音模块中' : petStore.isActive ? '关闭桌宠' : '启动桌宠' }}
          </span>
        </button>

      </div>

      <div class="tips">
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
  position: relative;
}

/* ── 设置齿轮按钮 ── */
.settings-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  z-index: 10;
}
.settings-btn:hover {
  background-color: var(--ev-c-gray-3);
  transform: scale(1.1);
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

.power-btn.loading {
  color: #fff;
  background-color: #f59e0b;
  cursor: wait;
}

.power-btn.loading:hover {
  background-color: #d97706;
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
