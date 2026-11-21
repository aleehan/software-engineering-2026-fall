import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { parseGsiPayload, type GsiPayload } from './games/cs2/gsi-payload'

const MAX_BODY_BYTES = 1024 * 1024 // 1 МБ — реальные сообщения GSI занимают пару килобайт

export interface GsiServerOptions {
  port: number
  /** Токен из cfg. Сообщения с другим токеном отбрасываются. */
  token: string
  onPayload: (payload: GsiPayload) => void
  /** Необязательный колбэк для ошибок разбора (для логов). `?` — поле можно не передавать. */
  onError?: (error: Error) => void
}

/**
 * HTTP-сервер, принимающий POST-запросы от CS2.
 * Слушает только 127.0.0.1 — с других компьютеров сети к нему не подключиться.
 */
export class GsiServer {
  // `private` — поле доступно только внутри класса.
  // `readonly` — присваивается один раз (в конструкторе) и больше не меняется.
  private readonly server: Server

  // Параметр конструктора с модификатором `private readonly` сразу становится полем класса —
  // это сокращение вместо объявления поля и присваивания this.options = options.
  constructor(private readonly options: GsiServerOptions) {
    // Стрелочная функция сохраняет `this` класса — поэтому передаём её, а не this.handle напрямую.
    this.server = createServer((req, res) => this.handle(req, res))
  }

  /** Запускает сервер. Promise отклоняется, если порт занят (EADDRINUSE). */
  start(): Promise<void> {
    // new Promise((resolve, reject) => ...) — превращаем событийный API в Promise.
    return new Promise((resolve, reject) => {
      const onError = (error: Error): void => reject(error)
      this.server.once('error', onError)
      this.server.listen(this.options.port, '127.0.0.1', () => {
        this.server.off('error', onError)
        resolve()
      })
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()))
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }

    // Тело запроса приходит кусками (chunks) — собираем их в массив Buffer.
    const chunks: Buffer[] = []
    let size = 0
    let aborted = false

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        aborted = true
        res.writeHead(413).end()
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (aborted) return

      let payload: GsiPayload | null = null
      try {
        payload = parseGsiPayload(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        // В catch переменная имеет тип unknown — проверяем, что это Error, прежде чем передать.
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)))
      }

      if (!payload) {
        res.writeHead(400).end()
        return
      }
      if (payload.token !== this.options.token) {
        res.writeHead(401).end()
        return
      }

      // Отвечаем CS2 сразу, а потом обрабатываем: игре не нужно ждать нашу логику.
      res.writeHead(200).end()
      try {
        this.options.onPayload(payload)
      } catch (error) {
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}
