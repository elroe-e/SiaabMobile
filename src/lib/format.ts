export const formatPrice = (amount: number, compact = false) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(amount)

export const formatStorage = (gb: number) => gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`

/** "Honor" + "Honor 400" reads as "Honor 400", not "Honor Honor 400". */
export const fullPhoneName = (brand: string, model: string) =>
  model.trim().toLowerCase().startsWith(brand.trim().toLowerCase()) ? model.trim() : `${brand.trim()} ${model.trim()}`
