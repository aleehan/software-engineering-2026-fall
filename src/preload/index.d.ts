import type { GamekeeperApi } from '../shared/ipc'

// `declare global` дополняет глобальный тип Window из DOM.
// После этого в renderer `window.gamekeeper` типизирован, и автодополнение работает.
declare global {
  interface Window {
    gamekeeper: GamekeeperApi
  }
}
