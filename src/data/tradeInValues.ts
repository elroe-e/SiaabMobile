import type { TradeInValue } from '../types'

const entries: [string, string, number, number][] = [
  ['Apple', 'iPhone 15 Pro Max', 256, 56000], ['Apple', 'iPhone 15 Pro', 128, 49000], ['Apple', 'iPhone 15', 128, 39000], ['Apple', 'iPhone 14 Pro', 128, 40000], ['Apple', 'iPhone 14', 128, 30000], ['Apple', 'iPhone 13', 128, 24000], ['Apple', 'iPhone 12', 128, 18000], ['Apple', 'iPhone 11', 64, 12000],
  ['Samsung', 'Galaxy S24 Ultra', 256, 58000], ['Samsung', 'Galaxy S24+', 256, 46000], ['Samsung', 'Galaxy S24', 128, 39000], ['Samsung', 'Galaxy S23 Ultra', 256, 39000], ['Samsung', 'Galaxy S23', 128, 26000], ['Samsung', 'Galaxy A55 5G', 128, 19000], ['Samsung', 'Galaxy A35 5G', 128, 14000], ['Samsung', 'Galaxy A15', 128, 6500],
  ['Xiaomi', 'Xiaomi 14', 256, 35000], ['Xiaomi', 'Redmi Note 13 Pro', 256, 16000], ['Xiaomi', 'Redmi Note 12 Pro', 128, 12000], ['Xiaomi', 'Poco X6 Pro', 256, 18000], ['Xiaomi', 'Redmi 12', 128, 5500],
  ['Google', 'Pixel 8 Pro', 128, 39000], ['Google', 'Pixel 8', 128, 29000], ['Google', 'Pixel 7a', 128, 19000],
  ['OnePlus', 'OnePlus 12', 256, 43000], ['OnePlus', 'Nord CE4', 128, 15000],
]

export const tradeInValues: TradeInValue[] = entries.map(([brand, model, storageGb, baseValue]) => ({ brand, model, storageGb, baseValue }))
