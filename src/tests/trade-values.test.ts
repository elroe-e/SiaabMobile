import { describe, expect, it } from 'vitest'
import { expandModelLines, tradeInValues } from '../data/tradeInValues'

// The shop's original 26 values; the expanded list must keep each of them unchanged.
const original: [string, string, number, number][] = [
  ['Apple', 'iPhone 11', 64, 12000], ['Apple', 'iPhone 12', 128, 18000], ['Apple', 'iPhone 13', 128, 24000], ['Apple', 'iPhone 14', 128, 30000],
  ['Apple', 'iPhone 14 Pro', 128, 40000], ['Apple', 'iPhone 15', 128, 39000], ['Apple', 'iPhone 15 Pro', 128, 49000], ['Apple', 'iPhone 15 Pro Max', 256, 56000],
  ['Google', 'Pixel 7a', 128, 19000], ['Google', 'Pixel 8', 128, 29000], ['Google', 'Pixel 8 Pro', 128, 39000], ['OnePlus', 'Nord CE4', 128, 15000],
  ['OnePlus', 'OnePlus 12', 256, 43000], ['Samsung', 'Galaxy A15', 128, 6500], ['Samsung', 'Galaxy A35 5G', 128, 14000], ['Samsung', 'Galaxy A55 5G', 128, 19000],
  ['Samsung', 'Galaxy S23', 128, 26000], ['Samsung', 'Galaxy S23 Ultra', 256, 39000], ['Samsung', 'Galaxy S24', 128, 39000], ['Samsung', 'Galaxy S24 Ultra', 256, 58000],
  ['Samsung', 'Galaxy S24+', 256, 46000], ['Xiaomi', 'Poco X6 Pro', 256, 18000], ['Xiaomi', 'Redmi 12', 128, 5500], ['Xiaomi', 'Redmi Note 12 Pro', 128, 12000],
  ['Xiaomi', 'Redmi Note 13 Pro', 256, 16000], ['Xiaomi', 'Xiaomi 14', 256, 35000],
]

describe('trade-in value list', () => {
  it('keeps every original value exactly', () => {
    for (const [brand, model, storageGb, baseValue] of original) {
      expect(tradeInValues.find((item) => item.brand === brand && item.model === model && item.storageGb === storageGb)?.baseValue).toBe(baseValue)
    }
  })

  it('offers several storage sizes per model and has no duplicates', () => {
    const keys = tradeInValues.map((item) => `${item.brand}|${item.model}|${item.storageGb}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(tradeInValues.map((item) => item.model)).size).toBeGreaterThan(120)
    expect(tradeInValues.filter((item) => item.model === 'iPhone 15 Pro').map((item) => item.storageGb)).toEqual([128, 256, 512, 1024])
  })

  it('raises the value about 10% per storage step around the anchor', () => {
    expect(expandModelLines([['Test', 'Phone', [128, 256, 512], 20000, 256]]).map((item) => item.baseValue)).toEqual([18000, 20000, 22000])
  })
})
