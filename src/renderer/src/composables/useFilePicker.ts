/**
 * useFilePicker — 文件夹选择与文件浏览 composable
 *
 * 提供按扩展名筛选的文件夹选择、文件列表读取、预览加载能力。
 * 自动记忆上次选择的文件夹路径，下次进入时直接加载。
 *
 * @example
 * ```ts
 * const { folderPath, files, loading, pickFolder, loadPreview } = useFilePicker(['.png', '.jpg'], 'model')
 * await pickFolder()
 * for (const f of files.value) {
 *   const url = await loadPreview(f.name)
 * }
 * ```
 */

import { ref } from 'vue'

export interface FileEntry {
  name: string
  ext: string
}

import { loadModelFolder, saveModelFolder, loadVoiceFolder, saveVoiceFolder } from '../stores/persist'

// 每个 namespace 独立缓存路径
const _cachedFolders: Record<string, string> = {}
function _loadSavedFolder(ns: string): string {
  if (ns === 'model') return loadModelFolder()
  if (ns === 'voice') return loadVoiceFolder()
  return ''
}
function _saveFolder(ns: string, path: string): void {
  if (ns === 'model') saveModelFolder(path)
  else if (ns === 'voice') saveVoiceFolder(path)
}

export function useFilePicker(validExtensions: string[] = [], namespace = '') {
  // 初始化缓存（如果还没加载过）
  if (namespace && !_cachedFolders[namespace]) {
    _cachedFolders[namespace] = _loadSavedFolder(namespace)
  }
  const folderPath = ref(namespace ? (_cachedFolders[namespace] || '') : '')
  const files = ref<FileEntry[]>([])
  const loading = ref(false)
  const error = ref('')

  /** 弹出系统文件夹选择对话框，选中后自动读取文件列表 */
  async function pickFolder(): Promise<void> {
    error.value = ''
    const path = await window.api.selectFolder()
    if (!path) return
    folderPath.value = path
    if (namespace) {
      _cachedFolders[namespace] = path
      _saveFolder(namespace, path)
    }
    await loadFiles()
  }

  /** 自动恢复上次的文件夹（如果存在且尚未加载） */
  if (folderPath.value && files.value.length === 0) {
    loadFiles()
  }

  /** 读取当前文件夹下的文件（按 validExtensions 过滤） */
  async function loadFiles(): Promise<void> {
    if (!folderPath.value) return
    loading.value = true
    error.value = ''
    try {
      const allFiles = await window.api.readDirectory(folderPath.value)
      files.value =
        validExtensions.length > 0
          ? allFiles.filter((f) => validExtensions.includes(f.ext))
          : allFiles
    } catch (e) {
      error.value = '读取文件夹失败: ' + (e as Error).message
      files.value = []
    } finally {
      loading.value = false
    }
  }

  /** 读取单个文件为 DataURL（用于预览图片/音频） */
  async function loadPreview(fileName: string): Promise<string | null> {
    try {
      return await window.api.readAsDataUrl(`${folderPath.value}/${fileName}`)
    } catch {
      return null
    }
  }

  /** 获取文件的完整本地路径 */
  function getFilePath(fileName: string): string {
    return `${folderPath.value}/${fileName}`
  }

  return {
    folderPath,
    files,
    loading,
    error,
    pickFolder,
    loadFiles,
    loadPreview,
    getFilePath
  }
}
