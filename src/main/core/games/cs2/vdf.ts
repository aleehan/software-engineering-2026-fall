// Парсер текстового формата Valve KeyValues (VDF/ACF).
// В нём записаны libraryfolders.vdf и appmanifest_*.acf. Пример:
//
//   "libraryfolders"
//   {
//       "0"
//       {
//           "path"    "C:\\Program Files (x86)\\Steam"
//           "apps"    { "730" "71797149735" }
//       }
//   }

// Рекурсивный тип: значение — либо строка, либо объект из таких же значений.
// interface может ссылаться сам на себя, поэтому дерево любой глубины описывается одной строкой.
export interface VdfObject {
  [key: string]: VdfValue
}
export type VdfValue = string | VdfObject

// Токен — минимальная смысловая единица текста.
// Это «размеченное объединение» (discriminated union): по полю `type`
// TypeScript понимает, есть ли у токена поле `value`.
type Token = { type: 'string'; value: string } | { type: 'open' } | { type: 'close' }

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (ch === '"') {
      // Строка в кавычках; внутри возможны экранирования \\ и \".
      let value = ''
      i++
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length) {
          const next = text[i + 1]
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next
          i += 2
        } else {
          value += text[i]
          i++
        }
      }
      i++ // закрывающая кавычка
      tokens.push({ type: 'string', value })
    } else if (ch === '{') {
      tokens.push({ type: 'open' })
      i++
    } else if (ch === '}') {
      tokens.push({ type: 'close' })
      i++
    } else if (ch === '/' && text[i + 1] === '/') {
      // Комментарий до конца строки.
      while (i < text.length && text[i] !== '\n') i++
    } else {
      i++ // пробелы, переводы строк, табы
    }
  }

  return tokens
}

/** Разбирает текст VDF в дерево объектов. Бросает Error при нарушенной структуре. */
export function parseVdf(text: string): VdfObject {
  const tokens = tokenize(text)
  let pos = 0

  // Вложенная функция видит переменные `tokens` и `pos` из внешней — это замыкание.
  function parseObject(isRoot: boolean): VdfObject {
    const result: VdfObject = {}

    while (pos < tokens.length) {
      const token = tokens[pos]

      if (token.type === 'close') {
        if (isRoot) throw new Error('VDF: лишняя закрывающая скобка')
        pos++
        return result
      }
      if (token.type !== 'string') throw new Error('VDF: ожидался ключ')
      // Здесь TS уже знает, что token — вариант со строкой, и token.value доступен.
      const key = token.value
      pos++

      const next = tokens[pos]
      if (next === undefined) throw new Error(`VDF: нет значения для ключа "${key}"`)
      if (next.type === 'string') {
        result[key] = next.value
        pos++
      } else if (next.type === 'open') {
        pos++
        result[key] = parseObject(false)
      } else {
        throw new Error(`VDF: неожиданная "}" после ключа "${key}"`)
      }
    }

    if (!isRoot) throw new Error('VDF: не хватает закрывающей скобки')
    return result
  }

  return parseObject(true)
}

/** Безопасно достаёт вложенный объект по ключу (или undefined). */
export function vdfObject(obj: VdfObject | undefined, key: string): VdfObject | undefined {
  const value = obj?.[key]
  return typeof value === 'object' ? value : undefined
}

/** Безопасно достаёт строку по ключу (или undefined). */
export function vdfString(obj: VdfObject | undefined, key: string): string | undefined {
  const value = obj?.[key]
  return typeof value === 'string' ? value : undefined
}
