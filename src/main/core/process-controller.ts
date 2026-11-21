import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Всё, что enforcer'у нужно от операционной системы.
 * Интерфейс позволяет в тестах подставить фальшивую реализацию,
 * не убивая настоящие процессы.
 */
export interface ProcessController {
  isRunning(imageName: string): Promise<boolean>
  kill(imageName: string): Promise<void>
}

/** Реализация для Windows через встроенные tasklist.exe и taskkill.exe. */
export class WindowsProcessController implements ProcessController {
  // `implements` — компилятор проверит, что класс реализует все методы интерфейса.

  async isRunning(imageName: string): Promise<boolean> {
    // /FO CSV /NH — вывод в CSV без заголовка: "cs2.exe","1234","Console",...
    // Если процесса нет, tasklist выводит локализованное сообщение («ИНФОРМАЦИЯ: …»),
    // поэтому ищем именно имя в кавычках, а не разбираем текст сообщения.
    const { stdout } = await execFileAsync(
      'tasklist',
      ['/FI', `IMAGENAME eq ${imageName}`, '/FO', 'CSV', '/NH'],
      { windowsHide: true }
    )
    return stdout.toLowerCase().includes(`"${imageName.toLowerCase()}"`)
  }

  async kill(imageName: string): Promise<void> {
    try {
      // /F — принудительно (CS2 может проигнорировать обычный запрос на закрытие),
      // /T — вместе с дочерними процессами.
      await execFileAsync('taskkill', ['/F', '/T', '/IM', imageName], { windowsHide: true })
    } catch {
      // Код ошибки 128 — процесса уже нет. Это нас устраивает.
    }
  }
}
