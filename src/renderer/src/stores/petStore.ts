import { reactive } from 'vue'

/** 桌宠全局状态——跨组件共享 */
export const petStore = reactive({
  /** 是否正在桌面显示 */
  isActive: false,
  /** 语音/模型正在加载中 */
  isVoiceLoading: false,
  /** 截屏监控是否开启 */
  screenshotEnabled: false,
  /** 当前模型的完整路径 */
  currentModelPath: '',
  /** 当前模型的 DataURL */
  currentModelDataUrl: '',
  /** 当前模型的文件名 */
  currentModelName: ''
})
