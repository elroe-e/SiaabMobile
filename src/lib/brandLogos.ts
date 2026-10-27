import { logoIcons } from './brandLogoPaths'

type Icon = { path: string; hex: string }

// Brands not listed in brandLogoPaths get a letter tile instead.
const logos: Record<string, Icon> = logoIcons

const key = (brand: string) => brand.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Returns the brand's logo path and a display colour, or null when we have no logo for it. */
export function brandLogo(brand: string): { path: string; color: string } | null {
  const icon = logos[key(brand)]
  if (!icon) return null
  const hex = icon.hex.toUpperCase()
  return { path: icon.path, color: hex === '000000' || hex === 'FFFFFF' ? 'var(--ink)' : `#${hex}` }
}

/** Groups phones by brand, most phones first, then alphabetically. */
export function brandSummary(items: { brand: string }[]): { brand: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.brand, (counts.get(item.brand) ?? 0) + 1)
  return [...counts].map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand))
}
