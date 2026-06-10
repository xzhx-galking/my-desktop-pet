<script setup lang="ts">
/**
 * ModelPanel — 更换桌宠立绘
 *
 * 功能：
 *  - 选择立绘文件夹（支持 .png .gif .jpg .glb 等格式）
 *  - 网格展示立绘缩略图
 *  - 选中并应用立绘（后续接入桌宠渲染）
 */

import { ref, watch, onUnmounted } from 'vue'
import { useFilePicker, type FileEntry } from '../composables/useFilePicker'
import ThumbnailView from '../components/ThumbnailView.vue'
import { petStore } from '../stores/petStore'
import { saveModelPath, saveModelName } from '../stores/persist'

const VALID_EXTS = ['.png', '.gif', '.jpg', '.jpeg', '.webp', '.svg', '.glb', '.gltf', '.json']
const { folderPath, files, loading, error, pickFolder, loadPreview, getFilePath } =
  useFilePicker(VALID_EXTS, 'model')

const selectedFile = ref('')
const previewUrls = new Map<string, string>()

/** 选中 / 取消选中某个模型（只高亮，不触发宠物窗口） */
function toggleSelect(entry: FileEntry): void {
  selectedFile.value =
    selectedFile.value === entry.name ? '' : entry.name
}

/** 确认应用选中的模型 → 保存状态并打开/更新宠物窗口 */
async function confirmModel(): Promise<void> {
  if (!selectedFile.value) return
  const entry = files.value.find((f) => f.name === selectedFile.value)
  if (!entry) return
  const dataUrl = await loadPreview(entry.name)
  if (dataUrl) {
    // 保存到全局 store + localStorage（跨会话持久）
    petStore.currentModelPath = getFilePath(entry.name)
    petStore.currentModelDataUrl = dataUrl
    petStore.currentModelName = entry.name
    petStore.isActive = true
    saveModelPath(getFilePath(entry.name))
    saveModelName(entry.name)
    await window.api.showPet(getFilePath(entry.name), dataUrl)
  }
}

/** 加载缩略图（缓存到 Map） */
async function getThumbUrl(entry: FileEntry): Promise<string | null> {
  if (previewUrls.has(entry.name)) return previewUrls.get(entry.name)!
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(entry.ext)) {
    const url = await loadPreview(entry.name)
    if (url) previewUrls.set(entry.name, url)
    return url ?? null
  }
  return null
}

// 文件列表加载后，自动高亮上一次选中的模型
watch(files, (list) => {
  if (petStore.currentModelName && !selectedFile.value) {
    const match = list.find((f) => f.name === petStore.currentModelName)
    if (match) selectedFile.value = match.name
  }
})

onUnmounted(() => {
  previewUrls.clear()
})
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h2 class="panel-title">🎨 更换桌宠立绘</h2>
      <p class="panel-desc">选择包含立绘文件的文件夹，点击即可预览</p>
    </div>

    <!-- 文件夹选择栏 -->
    <div class="toolbar">
      <button class="btn btn-primary" @click="pickFolder">
        <span class="btn-icon">📂</span>
        <span>{{ folderPath ? '更换文件夹' : '选择模型文件夹' }}</span>
      </button>
      <span v-if="folderPath" class="path-hint" :title="folderPath">
        📁 {{ folderPath }}
      </span>
    </div>

    <!-- 确认操作栏（始终显示） -->
    <div class="action-bar">
      <div class="action-info">
        <span class="action-check">{{ selectedFile ? '✅' : '👆' }}</span>
        <span class="action-name" :class="{ muted: !selectedFile }">
          {{ selectedFile || '点击上方模型卡片选中' }}
        </span>
      </div>
      <div class="action-buttons">
        <button
          class="btn btn-cancel"
          :disabled="!selectedFile"
          @click="selectedFile = ''"
        >
          ✕ 取消
        </button>
        <button
          class="btn btn-confirm"
          :disabled="!selectedFile"
          @click="confirmModel"
        >
          ✅ 确认应用
        </button>
      </div>
    </div>

    <!-- 内容区域（滚动） -->
    <div class="panel-body">
      <!-- 加载中 / 错误 / 空状态 -->
      <div v-if="loading" class="status-box">
        <span class="status-icon">⏳</span><span>读取文件中…</span>
      </div>
      <div v-else-if="error" class="status-box error">
        <span class="status-icon">❌</span><span>{{ error }}</span>
      </div>
      <div v-else-if="folderPath && files.length === 0" class="status-box">
        <span class="status-icon">📭</span>
        <span>该文件夹内没有支持的模型文件</span>
        <span class="status-sub">支持格式: png / gif / jpg / webp / svg / glb / gltf / json</span>
      </div>

      <!-- 模型网格 -->
      <div v-else-if="files.length > 0" class="model-grid">
        <div
          v-for="entry in files"
          :key="entry.name"
          class="model-card"
          :class="{ selected: selectedFile === entry.name }"
          @click="toggleSelect(entry)"
        >
          <!-- 图片类模型显示缩略图 -->
          <div class="model-thumb">
            <ThumbnailView v-if="['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(entry.ext)"
              :entry="entry"
              :get-thumb="getThumbUrl"
            />
            <!-- 3D / JSON 模型显示图标 -->
            <div v-else class="model-icon-box">
              <span class="model-type-icon">{{ entry.ext === '.glb' || entry.ext === '.gltf' ? '🧊' : '📄' }}</span>
              <span class="model-ext-label">{{ entry.ext.toUpperCase() }}</span>
            </div>
          </div>
          <div class="model-name" :title="entry.name">{{ entry.name }}</div>
        </div>
      </div>

      <!-- 初始提示 -->
      <div v-if="!folderPath" class="status-box welcome">
        <span class="status-icon">👆</span>
        <span>点击上方按钮选择模型文件夹</span>
      </div>
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

/* ── 工具栏 ── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

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

.btn-primary {
  color: #fff;
  background-color: #4a6cf7;
}

.btn-primary:hover {
  background-color: #3b5de7;
}

.btn-icon {
  font-size: 16px;
  line-height: 1;
}

.path-hint {
  font-size: 13px;
  color: var(--ev-c-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* ── 状态 ── */
.panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.status-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ev-c-text-3);
  font-size: 15px;
}

.status-box.welcome { gap: 12px; }
.status-box.error { color: #f56c6c; }

.status-icon { font-size: 40px; }
.status-sub {
  font-size: 12px;
  color: var(--ev-c-text-3);
  opacity: 0.7;
}

/* ── 模型网格 ── */
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding: 4px 0;
}

.model-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 10px;
  border-radius: 12px;
  border: 2px solid transparent;
  background-color: var(--ev-c-black-mute);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.model-card:hover {
  background-color: var(--ev-c-gray-3);
}

.model-card.selected {
  border-color: #4a6cf7;
  background-color: rgba(74, 108, 247, 0.1);
}

.model-thumb {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  overflow: hidden;
}

.model-icon-box {
  width: 80px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  background-color: var(--ev-c-gray-3);
}

.model-type-icon { font-size: 28px; line-height: 1; }

.model-ext-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--ev-c-text-3);
  letter-spacing: 1px;
}

.model-name {
  font-size: 12px;
  color: var(--ev-c-text-2);
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
  max-width: 100%;
}

/* ── 确认操作栏 ── */
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
  border-radius: 12px;
  background-color: var(--ev-c-black-mute);
  border: 1px solid var(--ev-c-gray-3);
  flex-shrink: 0;
}

.action-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.action-check {
  font-size: 16px;
  flex-shrink: 0;
}

.action-name {
  font-size: 13px;
  color: var(--ev-c-text-1);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-name.muted {
  color: var(--ev-c-text-3);
  font-weight: 400;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.btn-cancel {
  color: var(--ev-c-text-2);
  background-color: var(--ev-c-gray-3);
}

.btn-cancel:hover:not(:disabled) {
  background-color: var(--ev-c-gray-2);
  color: var(--ev-c-text-1);
}

.btn-confirm {
  color: #fff;
  background-color: #22c55e;
}

.btn-confirm:hover:not(:disabled) {
  background-color: #16a34a;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
