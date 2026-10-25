const namedColors: [RegExp, string][] = [
  [/black|midnight|graphite|obsidian|onyx/i, '#1f2430'], [/white|ivory|pearl|cream/i, '#f1efe9'], [/silver|titanium gray|grey|gray|slate|stone/i, '#a7adb8'],
  [/gold|champagne|sand|beige/i, '#d8b878'], [/blue|navy|ocean|sky|cyan/i, '#3b6fd6'], [/green|mint|emerald|olive|forest/i, '#3f8f6b'],
  [/red|crimson|ruby|coral/i, '#c9423f'], [/pink|rose|magenta/i, '#e08aa6'], [/purple|violet|lavender|lilac/i, '#8a6bc9'],
  [/orange|amber|copper/i, '#e08a3c'], [/yellow|lemon/i, '#e3c64a'], [/brown|bronze|mocha/i, '#8a6a4f'], [/natural|titanium/i, '#c3baa8'],
]

/** Owners type only a colour name; the swatch dot on the storefront is derived from it. */
export const colorHex = (name: string): string => namedColors.find(([pattern]) => pattern.test(name))?.[1] ?? '#8a94a6'

export const splitColors = (value: string): string[] =>
  [...new Set(value.split(/[,/&]|\band\b/i).map((part) => part.trim()).filter(Boolean))]

/** Colours worth showing customers; hides empty placeholders. */
export const visibleColors = (colors: { name: string; hex: string }[]) => colors.filter((color) => color.name && !/^unspecified$/i.test(color.name))
