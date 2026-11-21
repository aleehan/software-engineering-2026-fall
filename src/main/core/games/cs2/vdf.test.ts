import { describe, expect, it } from 'vitest'
import { parseVdf } from './vdf'

describe('parseVdf', () => {
  it('разбирает libraryfolders.vdf с экранированными путями', () => {
    const text = `
"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
		"apps"
		{
			"730"		"71797149735"
		}
	}
	"1"
	{
		"path"		"D:\\\\SteamLibrary"
		"apps"		{ }
	}
}`
    expect(parseVdf(text)).toEqual({
      libraryfolders: {
        '0': { path: 'C:\\Program Files (x86)\\Steam', apps: { '730': '71797149735' } },
        '1': { path: 'D:\\SteamLibrary', apps: {} }
      }
    })
  })

  it('пропускает комментарии и экранированные кавычки', () => {
    expect(parseVdf('// comment\n"a" { "b" "say \\"hi\\"" }')).toEqual({ a: { b: 'say "hi"' } })
  })

  it('бросает ошибку на незакрытой скобке', () => {
    expect(() => parseVdf('"a" { "b" "c"')).toThrow()
  })
})
