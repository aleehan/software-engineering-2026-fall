import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type GamekeeperApi } from '../shared/ipc'

// Preload выполняется до загрузки страницы и имеет доступ к ipcRenderer.
// Мы НЕ отдаём странице ipcRenderer целиком (это дыра в безопасности),
// а только узкий набор функций.
//
// `satisfies GamekeeperApi` проверяет, что объект соответствует интерфейсу,
// но сохраняет его точный тип. Забудешь метод или ошибёшься в типе — будет ошибка компиляции.
const api = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo),
  getCs2Status: () => ipcRenderer.invoke(IpcChannels.getCs2Status),
  getRecentMatches: (limit?: number) => ipcRenderer.invoke(IpcChannels.getRecentMatches, limit),
  getTodayStatus: () => ipcRenderer.invoke(IpcChannels.getTodayStatus),
  getProtectionState: () => ipcRenderer.invoke(IpcChannels.getProtectionState),
  setInitialPassword: (password: string, matchLimit?: number) =>
    ipcRenderer.invoke(IpcChannels.setInitialPassword, password, matchLimit),
  changePassword: (current: string, next: string) =>
    ipcRenderer.invoke(IpcChannels.changePassword, current, next),
  setMatchLimit: (value: number, password?: string) =>
    ipcRenderer.invoke(IpcChannels.setMatchLimit, value, password),
  setCloseDelay: (seconds: number, password?: string) =>
    ipcRenderer.invoke(IpcChannels.setCloseDelay, seconds, password),
  requestUnlock: (password: string) => ipcRenderer.invoke(IpcChannels.requestUnlock, password),
  requestQuit: (password: string) => ipcRenderer.invoke(IpcChannels.requestQuit, password),
  cancelPending: (id: number) => ipcRenderer.invoke(IpcChannels.cancelPending, id),
  getFaceitState: () => ipcRenderer.invoke(IpcChannels.getFaceitState),
  connectFaceit: (nickname: string, apiKey: string, password?: string) =>
    ipcRenderer.invoke(IpcChannels.connectFaceit, nickname, apiKey, password),
  disconnectFaceit: (password: string) =>
    ipcRenderer.invoke(IpcChannels.disconnectFaceit, password),
  syncFaceit: () => ipcRenderer.invoke(IpcChannels.syncFaceit),
  onStateChanged: (listener: () => void) => {
    // Оборачиваем слушатель, чтобы странице не утекал объект события IPC.
    const handler = (): void => listener()
    ipcRenderer.on(IpcChannels.stateChanged, handler)
    return () => {
      ipcRenderer.removeListener(IpcChannels.stateChanged, handler)
    }
  }
} satisfies GamekeeperApi

contextBridge.exposeInMainWorld('gamekeeper', api)
