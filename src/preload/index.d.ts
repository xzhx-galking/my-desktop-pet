import type { ElectronAPI } from '@electron-toolkit/preload'

interface DesktopPetAPI {
  // 文件系统
  selectFolder: () => Promise<string | null>
  selectFile: (opts: { filters: { name: string; extensions: string[] }[]; defaultPath?: string }) => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<{ name: string; ext: string }[]>
  readAsDataUrl: (filePath: string) => Promise<string>

  // 宠物窗口管理
  showPet: (filePath: string, dataUrl: string) => Promise<void>
  hidePet: () => Promise<void>
  getPetPosition: () => Promise<{ x: number; y: number }>
  getPetWindowSize: () => Promise<{ width: number; height: number }>
  movePetWindow: (x: number, y: number) => void
  lockPetSize: (width: number, height: number) => void
  setPetClickThrough: (clickThrough: boolean) => void
  setPetEmotion: (emotion: string) => void
  requestPetModel: () => Promise<string>
  onPetShowModel: (callback: (dataUrl: string) => void) => void
  offPetShowModel: () => void
  onPetSetEmotion: (callback: (dataUrl: string) => void) => void
  offPetSetEmotion: () => void

  // 服务/脚本
  runCommand: (command: string) => Promise<{ success: boolean; message: string; detail?: string }>

  // 语音模块 (GPT-SoVITS TTS)
  getDefaultPromptText: () => Promise<string>
  voiceStatus: () => Promise<{ running: boolean; pid: number | null }>
  voiceStart: (modelPaths?: { gpt?: string; sovits?: string }) => Promise<{ success: boolean; message: string; pid?: number | null }>
  voiceStop: () => Promise<{ success: boolean; message: string }>
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
  }) => Promise<{ success: boolean; message: string; dataUrl: string }>

  // API 配置管理（URL + Key）
  getApiConfig: () => Promise<{ configured: boolean; masked: string; url: string }>
  setApiConfig: (cfg: { url: string; key: string }) => Promise<{ success: boolean; message: string }>

  // AI 对话 (DeepSeek)
  chatSend: (params: {
    message: string
    history?: { role: 'user' | 'assistant'; content: string }[]
  }) => Promise<{ success: boolean; message: string; reply: string; tts_text?: string; emotion?: string; segments?: { emotion: string; text: string; tts_text?: string }[] }>

  // 截屏监控
  screenshotStart: (intervalMs?: number) => Promise<{ success: boolean; message: string }>
  screenshotStop: () => Promise<{ success: boolean; message: string }>
  screenshotStatus: () => Promise<{ running: boolean }>
  screenshotCaptureOnce: () => Promise<{ success: boolean; message: string }>
  onScreenshotReaction: (callback: (data: { emotion: string; text: string; ttsText?: string }) => void) => void
  offScreenshotReaction: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DesktopPetAPI
  }
}
