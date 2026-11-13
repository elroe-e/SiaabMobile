export const formatPrice = (amount: number, compact = false) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(amount)

export const formatStorage = (gb: number) => gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`

const dayCodes: Record<string, string> = { monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th', friday: 'Fr', saturday: 'Sa', sunday: 'Su' }
const to24 = (hour: string, minutes = '00', half: string) => `${String((Number(hour) % 12) + (half.toLowerCase() === 'pm' ? 12 : 0)).padStart(2, '0')}:${minutes}`

/**
 * Rewrites hours such as "Monday–Saturday, 9:00 AM–7:00 PM" in the form search engines read ("Mo-Sa 09:00-19:00").
 * The owner types the hours freely, so anything written another way gives undefined and is left out of the page data.
 */
export function openingHoursForSearch(text: string): string | undefined {
  const match = text.trim().match(/^([a-z]+)\s*[–—-]\s*([a-z]+),?\s+(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\s*[–—-]\s*(\d{1,2})(?::([0-5]\d))?\s*(am|pm)$/i)
  if (!match) return undefined
  const [, from = '', to = '', opens = '', opensMinutes, opensHalf = '', closes = '', closesMinutes, closesHalf = ''] = match
  const first = dayCodes[from.toLowerCase()], last = dayCodes[to.toLowerCase()]
  const isHour = (hour: string) => Number(hour) >= 1 && Number(hour) <= 12
  if (!first || !last || !isHour(opens) || !isHour(closes)) return undefined
  return `${first}-${last} ${to24(opens, opensMinutes, opensHalf)}-${to24(closes, closesMinutes, closesHalf)}`
}

/** "Honor" + "Honor 400" reads as "Honor 400", not "Honor Honor 400". */
export const fullPhoneName = (brand: string, model: string) =>
  model.trim().toLowerCase().startsWith(brand.trim().toLowerCase()) ? model.trim() : `${brand.trim()} ${model.trim()}`
