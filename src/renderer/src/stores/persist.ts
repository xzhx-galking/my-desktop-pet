/**
 * persist — localStorage 持久化工具
 * 用于跨会话保存桌宠状态（模型路径、文件夹路径等）
 */

const KEYS = {
  MODEL_PATH: 'pet_model_path',
  MODEL_NAME: 'pet_model_name',
  LAST_FOLDER: 'pet_last_folder',
  MODEL_FOLDER: 'pet_model_folder',
  VOICE_FOLDER: 'pet_voice_folder',
  VOICE_PARAMS: 'pet_voice_params',
  GPT_MODEL: 'pet_gpt_model_path',
  SOVITS_MODEL: 'pet_sovits_model_path'
}

export interface VoiceParams {
  text_lang: string
  top_k: number
  top_p: number
  temperature: number
  speed_factor: number
  repetition_penalty: number
  sample_steps: number
}

export function saveVoiceParams(params: VoiceParams): void {
  try { localStorage.setItem(KEYS.VOICE_PARAMS, JSON.stringify(params)) } catch {}
}

export function loadVoiceParams(): VoiceParams {
  try {
    const raw = localStorage.getItem(KEYS.VOICE_PARAMS)
    if (raw) {
      const p = JSON.parse(raw) as VoiceParams
      // 迁移：如果检测到旧版本保守参数，升级为新参数
      if (p.top_k === 8 || p.repetition_penalty >= 1.2 || p.sample_steps >= 32) {
        const migrated: VoiceParams = {
          text_lang: p.text_lang || 'ja',
          top_k: 15,
          top_p: 0.85,
          temperature: 0.7,
          speed_factor: 1.0,
          repetition_penalty: 1.25,
          sample_steps: 16
        }
        localStorage.setItem(KEYS.VOICE_PARAMS, JSON.stringify(migrated))
        return migrated
      }
      return p
    }
  } catch {}
  // 默认值（2025-06-09 更新：提高 top_k 降低 rep_penalty，减少日文TTS提前EOS）
  return {
    text_lang: 'ja',
    top_k: 15,
    top_p: 0.85,
    temperature: 0.7,
    speed_factor: 1.0,
    repetition_penalty: 1.25,
    sample_steps: 16
  }
}

export function saveModelPath(path: string): void {
  try { localStorage.setItem(KEYS.MODEL_PATH, path) } catch {}
}

export function loadModelPath(): string {
  try { return localStorage.getItem(KEYS.MODEL_PATH) || '' } catch { return '' }
}

export function saveModelName(name: string): void {
  try { localStorage.setItem(KEYS.MODEL_NAME, name) } catch {}
}

export function loadModelName(): string {
  try { return localStorage.getItem(KEYS.MODEL_NAME) || '' } catch { return '' }
}

export function saveLastFolder(path: string): void {
  try { localStorage.setItem(KEYS.LAST_FOLDER, path) } catch {}
}

export function loadLastFolder(): string {
  try { return localStorage.getItem(KEYS.LAST_FOLDER) || '' } catch { return '' }
}

export function saveModelFolder(path: string): void {
  try { localStorage.setItem(KEYS.MODEL_FOLDER, path) } catch {}
}
export function loadModelFolder(): string {
  try { return localStorage.getItem(KEYS.MODEL_FOLDER) || '' } catch { return '' }
}

export function saveVoiceFolder(path: string): void {
  try { localStorage.setItem(KEYS.VOICE_FOLDER, path) } catch {}
}
export function loadVoiceFolder(): string {
  try { return localStorage.getItem(KEYS.VOICE_FOLDER) || '' } catch { return '' }
}

export function clearAll(): void {
  try {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
  } catch {}
}
