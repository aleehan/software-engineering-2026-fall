import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'crypto'

// Пароль не хранится нигде — только хеш scrypt со случайной «солью».
// scrypt специально медленный и требует много памяти: подбор пароля перебором
// по украденному хешу становится очень дорогим.
//
// Формат строки в базе: scrypt$N$r$p$соль$хеш (всё, что нужно для проверки).

const PARAMS = { N: 16384, r: 8, p: 1 } as const
const KEY_LENGTH = 32
const SALT_BYTES = 16

export const MIN_PASSWORD_LENGTH = 4

// У scrypt из 'crypto' несколько перегрузок, поэтому promisify выводит тип неточно.
// Пишем маленькую обёртку руками: так тип результата — точно Promise<Buffer>.
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key)
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const hash = await scryptAsync(password, salt, KEY_LENGTH, PARAMS)
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('hex'), hash.toString('hex')].join(
    '$'
  )
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  // Деструктуризация массива с пропуском первого элемента (запятая в начале).
  const [, n, r, p, saltHex, hashHex] = parts
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  })

  // timingSafeEqual сравнивает за одинаковое время независимо от того, где первое различие.
  // Обычное === по времени ответа подсказывало бы, сколько байт совпало.
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
