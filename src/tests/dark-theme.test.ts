// @vitest-environment node
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import { parseTheme, themeBootScript } from '../lib/theme'

const require = createRequire(import.meta.url)
const plugin = require('../../postcss-dark-theme.cjs') as (() => postcss.Plugin) & { convert: (token: string, role: string) => string | null }

describe('dark theme build step', () => {
  it('turns light surfaces dark, dark text light, and keeps brand colours', () => {
    expect(plugin.convert('#fff', 'surface')).toMatch(/^hsl\(220, 1[0-9.]+%, 10%\)$/)
    expect(plugin.convert('#17243c', 'text')).toMatch(/^hsl\(/)
    expect(plugin.convert('#155eef', 'surface')).toBeNull()
    expect(plugin.convert('#fff', 'text')).toBeNull()
    expect(plugin.convert('rgba(255,255,255,.5)', 'surface')).toMatch(/^hsla\(.*, 0\.5\)$/)
  })

  it('adds scoped dark rules for the storefront stylesheet only, never for the admin', async () => {
    const css = '.card { background: #fff; color: #647086; border: 1px solid #e4e8ef; } .brand { background: #155eef; }'
    const store = await postcss([plugin()]).process(css, { from: resolve('src/index.css') })
    expect(store.css).toContain('html[data-theme="dark"]:not(:has(.admin-root)) .card')
    expect(store.css).not.toContain('html[data-theme="dark"]:not(:has(.admin-root)) .brand')
    const admin = await postcss([plugin()]).process(css, { from: resolve('app/admin/admin.css') })
    expect(admin.css).toBe(css)
  })

  it('reads only valid theme cookies and boots from the saved choice', () => {
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('purple')).toBeNull()
    expect(themeBootScript).toContain('siaab-theme=(light|dark)')
    expect(readFileSync(resolve('src/index.css'), 'utf8')).toContain('--paper: #0d121b')
  })
})
