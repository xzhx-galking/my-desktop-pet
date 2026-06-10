import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // ── 文件系统 ──
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectFolder'),
  selectFile: (opts: { filters: { name: string; extensions: string[] }[]; defaultPath?: string }): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectFile', opts),
  readDirectory: (dirPath: string): Promise<{ name: string; ext: string }[]> =>
    ipcRenderer.invoke('fs:readDirectory', dirPath),
  readAsDataUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('file:readAsDataUrl', filePath),

  // ── 宠物窗口 ──
  showPet: (filePath: string, dataUrl: string): Promise<void> =>
    ipcRenderer.invoke('pet:openModel', { filePath, dataUrl }),
  hidePet: (): Promise<void> =>
    ipcRenderer.invoke('pet:hide'),
  getPetPosition: (): Promise<{ x: number; y: number }> =>
    ipcRenderer.invoke('pet:getPosition'),
  getPetWindowSize: (): Promise<{ width: number; height: number }> =>
    ipcRenderer.invoke('pet:getWindowSize'),
  movePetWindow: (x: number, y: number): void =>
    ipcRenderer.send('pet:moveWindow', { x, y }),
  lockPetSize: (width: number, height: number): void =>
    ipcRenderer.send('pet:lockSize', width, height),
  setPetClickThrough: (clickThrough: boolean): void =>
    ipcRenderer.send('pet:setClickThrough', clickThrough),
  requestPetModel: (): Promise<string> =>
    ipcRenderer.invoke('pet:requestModel'),
  onPetShowModel: (callback: (dataUrl: string) => void): void => {
    ipcRenderer.on('pet:showModel', (_event, dataUrl) => callback(dataUrl))
  },
  offPetShowModel: (): void => {
    ipcRenderer.removeAllListeners('pet:showModel')
  },
  onPetSetEmotion: (callback: (dataUrl: string) => void): void => {
    ipcRenderer.on('pet:setEmotion', (_event, dataUrl) => callback(dataUrl))
  },
  offPetSetEmotion: (): void => {
    ipcRenderer.removeAllListeners('pet:setEmotion')
  },

  // ── 语音模块 (GPT-SoVITS TTS) ──
  voiceStatus: (): Promise<{ running: boolean; pid: number | null }> =>
    ipcRenderer.invoke('voice:status'),
  voiceStart: (modelPaths?: { gpt?: string; sovits?: string }): Promise<{ success: boolean; message: string; pid?: number | null }> =>
    ipcRenderer.invoke('voice:start', modelPaths),
  voiceStop: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('voice:stop'),
  voiceTts: (params: {
    text: string
    text_lang: string
    ref_audio_path: string
    prompt_text?: string
    prompt_lang?: string
    top_k?: number
    top_p?: number
    temperature?: number
    speed_factor?: number
    repetition_penalty?: number
    sample_steps?: number
  }): Promise<{ success: boolean; message: string; dataUrl: string }> =>
    ipcRenderer.invoke('voice:tts', params),

  // ── AI 对话 (DeepSeek) ──
  chatSend: (params: {
    message: string
    history?: { role: 'user' | 'assistant'; content: string }[]
  }): Promise<{ success: boolean; message: string; reply: string; tts_text?: string; emotion?: string }> =>
    ipcRenderer.invoke('chat:send', params)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
