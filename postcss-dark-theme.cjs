/* global module */
/**
 * Builds the storefront's dark theme from its light stylesheet.
 *
 * For every rule in src/index.css that sets a colour, it adds a copy scoped to
 * html[data-theme="dark"] with the colour converted: light surfaces become dark
 * surfaces, light borders become dark borders and dark text becomes light text.
 * Saturated colours (brand blue, WhatsApp green) and already-dark areas are kept.
 * The design tokens and any hand-tuned dark rules live in src/index.css itself.
 */
const DARK = 'html[data-theme="dark"]:not(:has(.admin-root))'
const COLOR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi

function parse(token) {
  if (token[0] === '#') {
    let hex = token.slice(1)
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('')
    const n = (i) => parseInt(hex.slice(i, i + 2), 16)
    return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 }
  }
  const parts = token.replace(/rgba?\(|\)/g, '').split(',').map((p) => p.trim())
  if (parts.length < 3 || parts.some((p, i) => i < 3 && !/^\d+(\.\d+)?$/.test(p))) return null
  return { r: +parts[0], g: +parts[1], b: +parts[2], a: parts[3] === undefined ? 1 : +parts[3] }
}

function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s, l }
}

function format({ h, s, l }, a) {
  const pct = (v) => `${Math.round(Math.min(1, Math.max(0, v)) * 1000) / 10}%`
  const hue = Math.round(h)
  return a < 1 ? `hsla(${hue}, ${pct(s)}, ${pct(l)}, ${a})` : `hsl(${hue}, ${pct(s)}, ${pct(l)})`
}

/** Returns the dark-theme replacement for one colour, or null to keep it. */
function convert(token, role) {
  const rgba = parse(token)
  if (!rgba) return null
  const hsl = toHsl(rgba)
  if (role === 'text') {
    if (hsl.l > 0.62) return null
    return format({ h: hsl.h, s: hsl.s * 0.7, l: 1 - hsl.l * 0.5 }, rgba.a)
  }
  if (hsl.l < 0.62) return null
  if (role === 'border') return format({ h: hsl.h, s: hsl.s * 0.35, l: 0.19 + (1 - hsl.l) * 0.5 }, rgba.a)
  return format({ h: hsl.h || 220, s: Math.min(hsl.s, 0.4) * 0.6 + 0.12, l: 0.1 + (1 - hsl.l) * 0.55 }, rgba.a)
}

function roleOf(prop) {
  if (prop === 'color' || prop === 'fill' || prop === '-webkit-text-fill-color') return 'text'
  if (prop.startsWith('border') || prop.startsWith('outline')) return 'border'
  if (prop.startsWith('background') || prop === 'box-shadow') return prop === 'box-shadow' ? 'border' : 'surface'
  return null
}

const scope = (selector) => selector.split(',').map((part) => {
  const s = part.trim()
  if (/^html\b/.test(s)) return s.replace(/^html/, DARK)
  return `${DARK} ${s}`
}).join(', ')

module.exports = () => ({
  postcssPlugin: 'siaab-dark-theme',
  OnceExit(root) {
    const file = (root.source && root.source.input && root.source.input.file) || ''
    if (!/src[\\/]index\.css$/.test(file)) return
    const additions = []
    root.walkRules((rule) => {
      if (rule.parent && rule.parent.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return
      if (/:root|data-theme|::-webkit-scrollbar/.test(rule.selector)) return
      const decls = []
      rule.walkDecls((decl) => {
        if (decl.prop.startsWith('--')) return
        const role = roleOf(decl.prop)
        if (!role) return
        let changed = false
        const value = decl.value.replace(COLOR, (token) => {
          const next = convert(token, role)
          if (next) { changed = true; return next }
          return token
        })
        if (changed) decls.push(decl.clone({ value }))
      })
      if (decls.length) additions.push([rule, decls])
    })
    for (const [rule, decls] of additions) {
      const dark = rule.clone({ selector: scope(rule.selector), nodes: [] })
      decls.forEach((decl) => dark.append(decl))
      rule.after(dark)
    }
  },
})
module.exports.postcss = true
module.exports.convert = convert
