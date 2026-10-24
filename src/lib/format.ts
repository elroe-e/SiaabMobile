export const formatPrice = (amount: number, compact = false) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(amount)

export const formatStorage = (gb: number) => gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`
