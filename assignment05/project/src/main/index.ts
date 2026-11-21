import { app, ipcMain, BrowserWindow, Tray } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IpcChannels, type AppInfo, type MatchRecord, type TodayStatus } from '../shared/ipc'
import { createMainWindow, markQuitting, showWindow } from './window'
import { createTray } from './tray'
import { ensureAutostart, isAutostartEnabled, wasLaunchedHidden } from './autostart'
import { getDatabasePath, getMigrationsFolder } from './paths'
import { openDatabase, getSettings, listRecentMatches, type DatabaseHandle } from './core/db'
import { Cs2Integration } from './core/games/cs2/integration'
import { Enforcer } from './core/enforcer'
import { WindowsProcessController, type ProcessController } from './core/process-controller'
import { evaluateToday } from './core/today'
import { getGameDayStart } from './core/game-day'
import { notifyChangeApplied, notifyKilled, notifyMatchRecorded } from './notifications'
import { ProtectionService } from './core/protection'
import { registerProtectionIpc } from './ipc-protection'
import { FaceitSync } from './core/faceit/sync'
import { registerFaceitIpc } from './ipc-faceit'

/** Как часто проверять, не пора ли применить отложенные изменения. */
const APPLY_DUE_INTERVAL_MS = 5000
/** Страховочное обновление окна (смена игрового дня, устаревание данных GSI). */
const FALLBACK_REFRESH_MS = 30_000
/** Плановая синхронизация с FACEIT. */
const FACEIT_SYNC_INTERVAL_MS = 3 * 60_000
/** После катки, засчитанной GSI, FACEIT выкладывает матч не сразу — проверяем дважды. */
const FACEIT_AFTER_MATCH_DELAYS_MS = [60_000, 150_000]

// Ссылки держим на уровне модуля: если Tray окажется только в локальной
// переменной функции, сборщик мусора его удалит и иконка исчезнет из трея.
// `BrowserWindow | null` — объединение типов: «окно или ещё ничего».
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let database: DatabaseHandle | null = null
let cs2: Cs2Integration | null = null
let enforcer: Enforcer | null = null
let broadcastTimer: NodeJS.Timeout | null = null

/**
 * Сообщает окну «состояние изменилось, перечитай данные».
 * Вызовы в пределах 250 мс склеиваются в один (debounce):
 * CS2 шлёт сообщения часто, и без этого окно перегружалось бы запросами.
 */
function broadcastStateChanged(): void {
  if (broadcastTimer) return
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null
    // isDestroyed: окно могло быть уничтожено при выходе.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.stateChanged)
    }
  }, 250)
}

// ── Изолированный профиль разработки ──────────────────────────────────
// GAMEKEEPER_PROFILE=test npm run dev — запуск рядом с установленным Gamekeeper:
// своя папка данных (база и single-instance lock), свой порт GSI, конфиг CS2 не трогаем,
// cs2.exe не закрываем. В собранном приложении переменная игнорируется.
const devProfile = app.isPackaged ? undefined : process.env['GAMEKEEPER_PROFILE']
if (devProfile) {
  // Путь к userData нужно поменять ДО requestSingleInstanceLock: замок привязан к этой папке.
  app.setPath('userData', join(app.getPath('appData'), `gamekeeper-${devProfile}`))
}

/** Контроллер-пустышка для профиля разработки: «процесс не запущен», убивать нечего. */
const noopProcesses: ProcessController = {
  isRunning: async () => false,
  kill: async () => {}
}

// ── Single-instance lock ──────────────────────────────────────────────
// Первый экземпляр получает «замок». Второй получает false и сразу выходит,
// а первому прилетает событие 'second-instance' — в ответ показываем окно.
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) showWindow(mainWindow)
  })

  app.whenReady().then(bootstrap)
}

function bootstrap(): void {
  // AppUserModelId нужен Windows для уведомлений и группировки в панели задач.
  // Должен совпадать с appId в electron-builder.yml.
  electronApp.setAppUserModelId('com.gamekeeper.app')

  // F12 — DevTools в dev; в собранной версии отключает Ctrl+R (перезагрузку).
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ensureAutostart()

  // База открывается до IPC и окна: всё остальное читает из неё настройки.
  // Если открыть не удалось (файл повреждён, нет прав), исключение
  // прервёт bootstrap — лучше упасть явно, чем работать без лимитов.
  database = openDatabase({
    filePath: getDatabasePath(),
    migrationsFolder: getMigrationsFolder()
  })
  const db = database.db

  // ── FACEIT ──────────────────────────────────────────────────────────
  const faceitSync = new FaceitSync({ db, log: (message) => console.log(`[faceit] ${message}`) })

  const runFaceitSync = async (): Promise<void> => {
    const result = await faceitSync.sync()
    // Новые матчи за текущий игровой день — это засчитанные катки: уведомить и проверить лимит.
    const dayStart = getGameDayStart(new Date())
    if (result.added.some((m) => m.finishedAt >= dayStart)) {
      notifyMatchRecorded(evaluateToday(db))
      void enforcer?.tick()
    }
    broadcastStateChanged()
  }

  // Интеграция с CS2 стартует асинхронно (поиск Steam, запись cfg, запуск сервера).
  // `void` явно говорит: «результат Promise нам не нужен», ошибки она логирует сама.
  cs2 = new Cs2Integration({
    db,
    ...(devProfile ? { port: 47816, installConfig: false } : {}),
    log: (message) => console.log(`[cs2] ${message}`),
    onMatchRecorded: () => {
      notifyMatchRecorded(evaluateToday(db))
      // Не ждём следующего тика: если лимит исчерпан, закрываем сразу.
      void enforcer?.tick()
      // Если это был FACEIT-матч, через пару минут он появится в API — привяжем данные.
      for (const delay of FACEIT_AFTER_MATCH_DELAYS_MS)
        setTimeout(() => void runFaceitSync(), delay)
    },
    onStatusChanged: broadcastStateChanged
  })
  void cs2.start()

  // Локальная константа: внутри стрелочных функций ниже TS точно знает, что это не null
  // (модульная переменная cs2 теоретически могла бы стать null).
  const integration = cs2
  enforcer = new Enforcer({
    processes: devProfile ? noopProcesses : new WindowsProcessController(),
    getRules: () => evaluateToday(db),
    isInMatch: () => integration.isInMatch(),
    getMatchKey: () => integration.getMatchKey(),
    onKilled: (reason) => {
      console.log(`[enforcer] cs2.exe закрыта: ${reason}`)
      notifyKilled(reason, evaluateToday(db))
      broadcastStateChanged()
    },
    onError: (error) => console.error('[enforcer]', error)
  })
  enforcer.start()

  // ── Защита ──────────────────────────────────────────────────────────
  const protection = new ProtectionService({ db })
  protection.discardStaleQuitRequests()

  const applyDueChanges = (): void => {
    const applied = protection.applyDue()
    for (const change of applied) {
      console.log(`[protection] применено: ${change.kind} ${change.value ?? ''}`)
      notifyChangeApplied(change)
    }
    // Лимит/блокировка могли измениться — пусть enforcer пересчитает сразу.
    if (applied.length > 0) {
      void enforcer?.tick()
      broadcastStateChanged()
    }
    // `some` — есть ли хотя бы один элемент, подходящий под условие.
    if (applied.some((c) => c.kind === 'change_faceit')) void runFaceitSync()
    if (applied.some((c) => c.kind === 'quit')) app.quit()
  }
  applyDueChanges()
  setInterval(applyDueChanges, APPLY_DUE_INTERVAL_MS)

  registerIpc(db, cs2)
  registerProtectionIpc(db, protection, () => {
    void enforcer?.tick()
    broadcastStateChanged()
  })
  registerFaceitIpc({
    db,
    protection,
    sync: faceitSync,
    runSync: runFaceitSync,
    onChanged: () => {
      void enforcer?.tick()
      broadcastStateChanged()
    }
  })
  setInterval(broadcastStateChanged, FALLBACK_REFRESH_MS)
  setTimeout(() => void runFaceitSync(), 5000)
  setInterval(() => void runFaceitSync(), FACEIT_SYNC_INTERVAL_MS)

  // При автозапуске с флагом --hidden окно создаём, но не показываем.
  mainWindow = createMainWindow({ showOnReady: !wasLaunchedHidden() })

  tray = createTray({
    onShow: () => {
      if (mainWindow) showWindow(mainWindow)
    },
    // Выйти напрямую нельзя: показываем окно, где выход запрашивается по паролю.
    onQuit: () => {
      if (mainWindow) showWindow(mainWindow)
    }
  })
}

// `DatabaseHandle['db']` — индексный доступ к типу: «тип поля db из DatabaseHandle».
function registerIpc(db: DatabaseHandle['db'], cs2: Cs2Integration): void {
  // ipcMain.handle отвечает на ipcRenderer.invoke из preload.
  // Возвращаемое значение автоматически становится Promise на той стороне.
  ipcMain.handle(IpcChannels.getAppInfo, (): AppInfo => {
    return {
      version: app.getVersion(),
      autostartEnabled: isAutostartEnabled(),
      isPackaged: app.isPackaged,
      databasePath: getDatabasePath(),
      matchLimit: getSettings(db).matchLimit
    }
  })

  ipcMain.handle(IpcChannels.getCs2Status, () => cs2.getStatus())

  ipcMain.handle(IpcChannels.getTodayStatus, (): TodayStatus => {
    const rules = evaluateToday(db)
    return {
      status: rules.status,
      matchesToday: rules.matchesToday,
      limit: rules.limit,
      remaining: rules.remaining,
      // `?.` + `??`: если closeAt null — получим null, иначе число миллисекунд.
      closeAt: rules.closeAt?.getTime() ?? null,
      nextResetAt: rules.nextResetAt.getTime(),
      unlockedUntil: rules.unlockedUntil?.getTime() ?? null
    }
  })

  // Параметры обработчика: первый — событие IPC (нам не нужно, поэтому `_event`),
  // дальше — аргументы, которые renderer передал в invoke.
  // Аргументы из renderer нельзя принимать на веру — тип в сигнатуре лишь обещание,
  // по IPC может прийти что угодно. Поэтому принимаем unknown и проверяем.
  ipcMain.handle(IpcChannels.getRecentMatches, (_event, limit: unknown): MatchRecord[] => {
    const safeLimit =
      typeof limit === 'number' && Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 500) : 100
    // .map превращает каждую строку базы в объект для интерфейса.
    return listRecentMatches(db, safeLimit).map((m) => ({
      id: m.id,
      finishedAt: m.finishedAt.getTime(),
      mode: m.mode,
      map: m.map,
      ctScore: m.ctScore,
      tScore: m.tScore,
      gameDay: getGameDayStart(m.finishedAt).getTime(),
      faceit: m.faceitMatchId !== null,
      ownScore: m.ownScore,
      oppScore: m.oppScore,
      result: m.result,
      kills: m.kills,
      deaths: m.deaths
    }))
  })
}

// 'before-quit' срабатывает при app.quit() — разрешаем окну закрыться по-настоящему.
app.on('before-quit', () => {
  markQuitting()
  tray?.destroy() // `?.` — вызвать, только если tray не null
  enforcer?.stop()
  void cs2?.stop()
})

// 'will-quit' — последний момент перед завершением: аккуратно закрываем базу,
// чтобы SQLite дописал WAL-журнал в основной файл.
app.on('will-quit', () => {
  database?.close()
})

// По умолчанию Electron завершает приложение, когда закрыты все окна.
// Нам это не нужно: Gamekeeper живёт в трее. Пустой обработчик отменяет это поведение.
app.on('window-all-closed', () => {})
