<script setup lang="ts">
/**
 * SettingsPage — 设置页面
 * 包含：语音模块、截屏监控、模型设置、API 设置
 */

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import VoicePanel from './VoicePanel.vue'
import ScreenshotPanel from './ScreenshotPanel.vue'

const router = useRouter()
const activeTab = ref('voice')

const tabs = [
  { key: 'voice', icon: '🎤', label: '语音模块' },
  { key: 'screenshot', icon: '👁', label: '截屏监控' },
  { key: 'service', icon: '⚡', label: '服务' },
  { key: 'model', icon: '🎨', label: '立绘设置' },
  { key: 'api', icon: '🔑', label: 'API 设置' }
]

function goBack(): void {
  router.push('/')
}

// ── 立绘设置 ──
const modelInfo = ref('A10.png（默认立绘）')
async function selectModel(): Promise<void> {
  const path = await window.api.selectFile({
    filters: [{ name: '立绘图片 (*.png)', extensions: ['png'] }],
    defaultPath: undefined
  })
  if (path) {
    try {
      const dataUrl = await window.api.readAsDataUrl(path)
      await window.api.showPet(path, dataUrl)
      modelInfo.value = path.split('\\').pop() || path
    } catch (err) {
      console.error('[settings] 切换立绘失败:', err)
    }
  }
}

// ── API 设置 ──
const apiUrl = ref('')
const apiKey = ref('')
const apiKeyMasked = ref('')
const apiSaved = ref(false)

async function loadApiConfig(): Promise<void> {
  const cfg = await window.api.getApiConfig()
  apiUrl.value = cfg.url
  apiKeyMasked.value = cfg.masked
}

async function saveApiConfig(): Promise<void> {
  const res = await window.api.setApiConfig({
    url: apiUrl.value.trim(),
    key: apiKey.value.trim()
  })
  if (res.success) {
    apiSaved.value = true
    apiKeyMasked.value = apiKey.value
      ? apiKey.value.slice(0, 8) + '••••' + apiKey.value.slice(-4)
      : apiKeyMasked.value
    apiKey.value = ''
    setTimeout(() => { apiSaved.value = false }, 2000)
  }
}

loadApiConfig()

// ── 服务（自定义脚本） ──
interface ServiceEntry { name: string; desc: string; command: string }
const STORAGE_KEY = 'pet_services'

const serviceList = ref<ServiceEntry[]>([])
const newServiceName = ref('')
const newServiceDesc = ref('')
const newServiceCmd = ref('')
const editingIndex = ref(-1)
const runResult = ref('')
const runningIndex = ref(-1)  // -1 表示无正在运行的任务

/** 默认服务列表，关联打包目录下的脚本 */
function defaultServices(): ServiceEntry[] {
  const dir = 'E:\\打包目录'
  return [
    {
      name: '📦 安装环境',
      desc: '检查 Node.js → 安装依赖 → 配置 API 密钥。首次使用必需',
      command: dir + '\\setup.bat'
    },
    {
      name: '🚀 启动桌宠',
      desc: '以开发模式运行桌宠，支持热重载，实时查看修改效果',
      command: dir + '\\run_dev.bat'
    },
    {
      name: '📀 打包安装程序',
      desc: '将桌宠打包为 .exe 安装包，产物在 dist/ 目录下',
      command: dir + '\\build_installer.bat'
    }
  ]
}

function loadServices(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      serviceList.value = JSON.parse(raw)
    } else {
      // 首次使用 → 写入默认服务
      serviceList.value = defaultServices()
      saveServices()
    }
  } catch { serviceList.value = defaultServices() }
}

function saveServices(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serviceList.value))
}

function addService(): void {
  const name = newServiceName.value.trim()
  const desc = newServiceDesc.value.trim()
  const cmd = newServiceCmd.value.trim()
  if (!name || !cmd) return
  if (editingIndex.value >= 0) {
    serviceList.value[editingIndex.value] = { name, desc, command: cmd }
    editingIndex.value = -1
  } else {
    serviceList.value.push({ name, desc, command: cmd })
  }
  saveServices()
  newServiceName.value = ''
  newServiceDesc.value = ''
  newServiceCmd.value = ''
}

function editService(i: number): void {
  const s = serviceList.value[i]
  newServiceName.value = s.name
  newServiceDesc.value = s.desc
  newServiceCmd.value = s.command
  editingIndex.value = i
}

function removeService(i: number): void {
  serviceList.value.splice(i, 1)
  saveServices()
  if (editingIndex.value === i) { editingIndex.value = -1; newServiceName.value = ''; newServiceDesc.value = ''; newServiceCmd.value = '' }
}

async function runService(i: number): Promise<void> {
  if (runningIndex.value >= 0) return  // 已有任务在运行
  const svc = serviceList.value[i]
  runningIndex.value = i
  runResult.value = `⏳ 运行中: ${svc.name}...`
  try {
    const res = await window.api.runCommand(svc.command)
    if (res.success) {
      runResult.value = `✅ ${svc.name} — 运行完毕`
    } else {
      runResult.value = `❌ ${svc.name} — ${res.message}`
      if (res.detail) runResult.value += `\n${res.detail.slice(0, 200)}`
    }
  } catch (err) {
    runResult.value = `❌ ${svc.name} — 异常: ${(err as Error).message}`
  } finally {
    runningIndex.value = -1
    setTimeout(() => { runResult.value = '' }, 5000)
  }
}

function resetDefaults(): void {
  serviceList.value = defaultServices()
  saveServices()
}

loadServices()
</script>

<template>
  <div class="settings-page">
    <!-- 顶部栏 -->
    <div class="settings-topbar">
      <button class="back-btn" @click="goBack">← 返回</button>
      <span class="topbar-title">⚙️ 设置</span>
    </div>

    <div class="settings-body">
      <!-- 左侧子导航 -->
      <nav class="settings-nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="nav-tab"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- 右侧内容 -->
      <div class="settings-content">
        <!-- 语音模块 -->
        <VoicePanel v-if="activeTab === 'voice'" />

        <!-- 截屏监控 -->
        <ScreenshotPanel v-else-if="activeTab === 'screenshot'" />

        <!-- 服务 -->
        <div v-else-if="activeTab === 'service'" class="tab-page">
          <h2 class="tab-title">⚡ 服务</h2>
          <p class="setting-hint" style="margin-bottom:12px">快速启动脚本或程序，一个按钮对应一个脚本</p>

          <!-- 添加/编辑 -->
          <div class="setting-card" style="margin-bottom:12px">
            <div class="input-row" style="margin-bottom:6px">
              <input v-model="newServiceName" class="api-input" placeholder="名称" style="max-width:120px" />
              <input v-model="newServiceDesc" class="api-input" placeholder="说明，描述该脚本的作用" style="flex:1.5" />
            </div>
            <div class="input-row">
              <input v-model="newServiceCmd" class="api-input" placeholder="命令路径，如 E:\\setup.bat" @keyup.enter="addService" />
              <button class="action-btn primary" @click="addService">{{ editingIndex >= 0 ? '更新' : '添加' }}</button>
              <button v-if="editingIndex < 0" class="action-btn" @click="resetDefaults" title="恢复默认">↺ 默认</button>
            </div>
            <p class="setting-hint">支持 .exe / .bat / .ps1 及任意命令，使用绝对路径</p>
          </div>

          <!-- 列表 -->
          <div v-if="serviceList.length === 0" class="setting-hint" style="text-align:center;padding:20px">暂无服务，在上方添加</div>
          <div v-for="(svc, i) in serviceList" :key="i" class="service-item">
            <div class="service-info">
              <span class="service-name">{{ svc.name }}</span>
              <span class="service-desc">{{ svc.desc || '无说明' }}</span>
              <code class="service-cmd">{{ svc.command }}</code>
            </div>
            <div class="service-actions">
              <button class="action-btn primary" :disabled="runningIndex >= 0" @click="runService(i)">
                {{ runningIndex === i ? '⏳ 运行中' : '▶ 运行' }}
              </button>
              <button class="action-btn" @click="editService(i)" title="编辑">✏️</button>
              <button class="action-btn" @click="removeService(i)" style="color:#ef4444" title="删除">🗑️</button>
            </div>
          </div>

          <p v-if="runResult" class="run-result">{{ runResult }}</p>
        </div>

        <!-- 模型设置 -->
        <div v-else-if="activeTab === 'model'" class="tab-page">
          <h2 class="tab-title">🎨 立绘设置</h2>
          <div class="setting-card">
            <div class="setting-row">
              <span class="setting-label">当前立绘</span>
              <span class="setting-value">{{ modelInfo }}</span>
            </div>
            <button class="action-btn" @click="selectModel">更换立绘</button>
            <p class="setting-hint">点击按钮选择新的立绘图片（PNG），A10.png 为默认</p>
          </div>
        </div>

        <!-- API 设置 -->
        <div v-else-if="activeTab === 'api'" class="tab-page">
          <h2 class="tab-title">🔑 API 设置</h2>
          <div class="setting-card">
            <div class="setting-row">
              <span class="setting-label">API 地址</span>
              <span class="setting-value">{{ apiUrl || 'https://api.deepseek.com/v1/chat/completions' }}</span>
            </div>
            <div class="input-row">
              <input
                v-model="apiUrl"
                type="url"
                class="api-input"
                placeholder="https://api.deepseek.com/v1/chat/completions"
              />
            </div>
          </div>
          <div class="setting-card" style="margin-top:12px">
            <div class="setting-row">
              <span class="setting-label">API Key</span>
              <span class="setting-value">{{ apiKeyMasked || '未配置' }}</span>
            </div>
            <div class="input-row">
              <input
                v-model="apiKey"
                type="password"
                class="api-input"
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                @keyup.enter="saveApiConfig"
              />
              <button class="action-btn primary" @click="saveApiConfig">保存</button>
            </div>
            <p v-if="apiSaved" class="setting-success">✅ 已保存</p>
            <p class="setting-hint">API 地址和密钥仅保存在本地内存，重启需重新设置。支持任意兼容 OpenAI API 的服务。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: var(--ev-c-black-soft);
}

/* ── 顶部栏 ── */
.settings-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--ev-c-gray-3);
  flex-shrink: 0;
}

.back-btn {
  background: none;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  color: var(--ev-c-text-2);
  font-size: 14px;
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.back-btn:hover {
  background-color: var(--ev-c-gray-3);
  color: var(--ev-c-text-1);
}

.topbar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ev-c-text-1);
}

/* ── 主体 ── */
.settings-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* ── 左侧导航 ── */
.settings-nav {
  width: 160px;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 8px;
  border-right: 1px solid var(--ev-c-gray-3);
  overflow-y: auto;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ev-c-text-2);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.nav-tab:hover {
  background-color: var(--ev-c-gray-3);
  color: var(--ev-c-text-1);
}
.nav-tab.active {
  background-color: var(--ev-c-gray-2);
  color: var(--ev-c-text-1);
  font-weight: 600;
}

.tab-icon {
  font-size: 18px;
  line-height: 1;
}
.tab-label {
  white-space: nowrap;
}

/* ── 右侧内容 ── */
.settings-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px;
}

.tab-page {
  max-width: 600px;
}

/* ── 服务列表 ── */
.service-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  margin-bottom: 6px;
  background-color: var(--ev-c-black-mute);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  gap: 12px;
}
.service-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.service-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ev-c-text-1);
}
.service-desc {
  font-size: 12px;
  color: var(--ev-c-text-3);
  line-height: 1.4;
}
.service-cmd {
  font-size: 11px;
  color: var(--ev-c-text-3);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.service-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.run-result {
  font-size: 13px;
  color: var(--ev-c-text-2);
  margin: 8px 0 0;
  padding: 8px 12px;
  background: var(--ev-c-black-mute);
  border-radius: 6px;
}

.tab-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--ev-c-text-1);
  margin: 0 0 20px 0;
}

.setting-card {
  background-color: var(--ev-c-black-mute);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: 14px;
  color: var(--ev-c-text-2);
  font-weight: 500;
}

.setting-value {
  font-size: 14px;
  color: var(--ev-c-text-1);
  font-weight: 600;
}

.setting-hint {
  font-size: 12px;
  color: var(--ev-c-text-3);
  margin: 0;
  line-height: 1.5;
}

.setting-success {
  font-size: 13px;
  color: #22c55e;
  margin: 0;
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.api-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  background: var(--ev-c-black-soft);
  color: var(--ev-c-text-1);
  font-size: 13px;
  font-family: monospace;
  outline: none;
  transition: border-color 0.15s;
}
.api-input:focus {
  border-color: #4a6cf7;
}
.api-input::placeholder {
  color: var(--ev-c-text-3);
}

.action-btn {
  padding: 8px 18px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  background: transparent;
  color: var(--ev-c-text-2);
  font-size: 13px;
  cursor: pointer;
  align-self: flex-start;
  transition: all 0.15s;
}
.action-btn:hover {
  background-color: var(--ev-c-gray-3);
  color: var(--ev-c-text-1);
}
.action-btn.primary {
  background-color: #4a6cf7;
  color: #fff;
  border-color: #4a6cf7;
}
.action-btn.primary:hover {
  background-color: #6a8aff;
  border-color: #6a8aff;
}
</style>
