<script setup lang="ts">
/**
 * ExpressionPanel — 表情拆分
 *
 * 功能：
 *  - 选择表情文件夹（支持 .png .gif .jpg .webp 等图片格式）
 *  - 网格展示表情缩略图
 *  - 点击表情可大图预览
 */

import { ref, onUnmounted } from 'vue'
import { useFilePicker, type FileEntry } from '../composables/useFilePicker'
import ThumbnailView from '../components/ThumbnailView.vue'

const VALID_EXTS = ['.png', '.gif', '.jpg', '.jpeg', '.webp']
const { folderPath, files, loading, error, pickFolder, loadPreview } =
  useFilePicker(VALID_EXTS)

const previewUrl = ref('')
const previewName = ref('')
const previewVisible = ref(false)
const thumbCache = new Map<string, string>()

async function getThumbUrl(entry: FileEntry): Promise<string | null> {
  if (thumbCache.has(entry.name)) return thumbCache.get(entry.name)!
  const url = await loadPreview(entry.name)
  if (url) thumbCache.set(entry.name, url)
  return url ?? null
}

async function showPreview(entry: FileEntry): Promise<void> {
  const url = await loadPreview(entry.name)
  if (url) {
    previewUrl.value = url
    previewName.value = entry.name
    previewVisible.value = true
  }
}

function closePreview(): void {
  previewVisible.value = false
  previewUrl.value = ''
  previewName.value = ''
}

onUnmounted(() => {
  thumbCache.clear()
})
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h2 class="panel-title">😊 表情拆分</h2>
      <p class="panel-desc">选择表情图片文件夹，预览并管理宠物表情</p>
    </div>

    <!-- 文件夹选择栏 -->
    <div class="toolbar">
      <button class="btn btn-primary" @click="pickFolder">
        <span class="btn-icon">📂</span>
        <span>{{ folderPath ? '更换文件夹' : '选择表情文件夹' }}</span>
      </button>
      <span v-if="folderPath" class="path-hint" :title="folderPath">
        📁 {{ folderPath }}
      </span>
    </div>

    <!-- 加载中 / 错误 / 空状态 -->
    <div v-if="loading" class="status-box">
      <span class="status-icon">⏳</span><span>读取文件中…</span>
    </div>
    <div v-else-if="error" class="status-box error">
      <span class="status-icon">❌</span><span>{{ error }}</span>
    </div>
    <div v-else-if="folderPath && files.length === 0" class="status-box">
      <span class="status-icon">📭</span>
      <span>该文件夹内没有支持的图片文件</span>
      <span class="status-sub">支持格式: png / gif / jpg / webp</span>
    </div>

    <!-- 表情网格 -->
    <div v-else-if="files.length > 0" class="expr-grid">
      <div
        v-for="entry in files"
        :key="entry.name"
        class="expr-card"
        @click="showPreview(entry)"
      >
        <div class="expr-thumb">
          <ThumbnailView :entry="entry" :get-thumb="getThumbUrl" />
        </div>
        <div class="expr-name" :title="entry.name">{{ entry.name }}</div>
      </div>
    </div>

    <!-- 初始提示 -->
    <div v-else class="status-box welcome">
      <span class="status-icon">👆</span>
      <span>点击上方按钮选择表情文件夹</span>
    </div>

    <!-- 大图预览遮罩 -->
    <Teleport to="body">
      <div v-if="previewVisible" class="preview-overlay" @click.self="closePreview">
        <div class="preview-modal">
          <button class="preview-close" @click="closePreview">✕</button>
          <img :src="previewUrl" :alt="previewName" class="preview-img" />
          <div class="preview-name">{{ previewName }}</div>
        </div>
      </div>
    </Teleport>
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

/* ── 表情网格 ── */
.expr-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding: 4px 0;
}

.expr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 6px 8px;
  border-radius: 12px;
  background-color: var(--ev-c-black-mute);
  cursor: pointer;
  transition: background-color 0.15s, transform 0.15s;
}

.expr-card:hover {
  background-color: var(--ev-c-gray-3);
  transform: scale(1.03);
}

.expr-thumb {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  overflow: hidden;
}

.expr-name {
  font-size: 11px;
  color: var(--ev-c-text-2);
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
  max-width: 100%;
}

/* ── 大图预览遮罩 ── */
:global(.preview-overlay) {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

:global(.preview-modal) {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border-radius: 16px;
  background-color: var(--ev-c-black-soft);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  max-width: 80vw;
  max-height: 80vh;
}

:global(.preview-close) {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background-color: var(--ev-c-gray-3);
  color: var(--ev-c-text-1);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.preview-close:hover) {
  background-color: #f56c6c;
}

:global(.preview-img) {
  max-width: 60vw;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 8px;
}

:global(.preview-name) {
  font-size: 14px;
  color: var(--ev-c-text-2);
}
</style>
