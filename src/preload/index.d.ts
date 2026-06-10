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
  requestPetModel: () => Promise<string>
  onPetShowModel: (callback: (dataUrl: string) => void) => void
  offPetShowModel: () => void
  onPetSetEmotion: (callback: (dataUrl: string) => void) => void
  offPetSetEmotion: () => void

  // 语音模块 (GPT-SoVITS TTS)
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

  // AI 对话 (DeepSeek)
  chatSend: (params: {
    message: string
    history?: { role: 'user' | 'assistant'; content: string }[]
  }) => Promise<{ success: boolean; message: string; reply: string; tts_text?: string; emotion?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DesktopPetAPI
  }
}
