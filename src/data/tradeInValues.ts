import type { TradeInValue } from '../types'

/**
 * Trade-in base values (perfect condition) in ETB.
 *
 * The models and their storage sizes are the real retail configurations. The ETB values are
 * estimates anchored to the shop's original values: each model has one anchor price (at `at`,
 * or its smallest storage), and every storage step up or down changes the value by about 10%.
 * Check them against what the shop actually pays before relying on them.
 *
 * Within each brand, newer phones come first so the estimator's quick picks show recent models.
 */
type ModelLine = [brand: string, model: string, storages: number[], value: number, at?: number]

const lines: ModelLine[] = [
  // Apple
  ['Apple', 'iPhone 17 Pro Max', [256, 512, 1024, 2048], 92000],
  ['Apple', 'iPhone 17 Pro', [256, 512, 1024], 82000],
  ['Apple', 'iPhone Air', [256, 512, 1024], 72000],
  ['Apple', 'iPhone 17', [256, 512], 68000],
  ['Apple', 'iPhone 16 Pro Max', [256, 512, 1024], 70000],
  ['Apple', 'iPhone 16 Pro', [128, 256, 512, 1024], 62000],
  ['Apple', 'iPhone 16 Plus', [128, 256, 512], 54000],
  ['Apple', 'iPhone 16', [128, 256, 512], 50000],
  ['Apple', 'iPhone 16e', [128, 256, 512], 42000],
  ['Apple', 'iPhone 15 Pro Max', [256, 512, 1024], 56000],
  ['Apple', 'iPhone 15 Pro', [128, 256, 512, 1024], 49000],
  ['Apple', 'iPhone 15 Plus', [128, 256, 512], 42000],
  ['Apple', 'iPhone 15', [128, 256, 512], 39000],
  ['Apple', 'iPhone 14 Pro Max', [128, 256, 512, 1024], 45000],
  ['Apple', 'iPhone 14 Pro', [128, 256, 512, 1024], 40000],
  ['Apple', 'iPhone 14 Plus', [128, 256, 512], 32000],
  ['Apple', 'iPhone 14', [128, 256, 512], 30000],
  ['Apple', 'iPhone 13 Pro Max', [128, 256, 512, 1024], 34000],
  ['Apple', 'iPhone 13 Pro', [128, 256, 512, 1024], 30000],
  ['Apple', 'iPhone 13', [128, 256, 512], 24000],
  ['Apple', 'iPhone 12 Pro Max', [128, 256, 512], 26000],
  ['Apple', 'iPhone 12 Pro', [128, 256, 512], 23000],
  ['Apple', 'iPhone 12', [64, 128, 256], 18000, 128],
  ['Apple', 'iPhone 11 Pro Max', [64, 256, 512], 17000],
  ['Apple', 'iPhone 11 Pro', [64, 256, 512], 15000],
  ['Apple', 'iPhone 11', [64, 128, 256], 12000],
  ['Apple', 'iPhone SE (2022)', [64, 128, 256], 9000],

  // Samsung
  ['Samsung', 'Galaxy S25 Ultra', [256, 512, 1024], 70000],
  ['Samsung', 'Galaxy S25 Edge', [256, 512], 58000],
  ['Samsung', 'Galaxy S25+', [256, 512], 56000],
  ['Samsung', 'Galaxy S25', [128, 256, 512], 50000],
  ['Samsung', 'Galaxy S25 FE', [128, 256, 512], 38000],
  ['Samsung', 'Galaxy Z Fold7', [256, 512, 1024], 80000],
  ['Samsung', 'Galaxy Z Flip7', [256, 512], 50000],
  ['Samsung', 'Galaxy Z Fold6', [256, 512, 1024], 62000],
  ['Samsung', 'Galaxy Z Flip6', [256, 512], 40000],
  ['Samsung', 'Galaxy Z Fold5', [256, 512, 1024], 50000],
  ['Samsung', 'Galaxy Z Flip5', [256, 512], 30000],
  ['Samsung', 'Galaxy S24 Ultra', [256, 512, 1024], 58000],
  ['Samsung', 'Galaxy S24+', [256, 512], 46000],
  ['Samsung', 'Galaxy S24', [128, 256, 512], 39000],
  ['Samsung', 'Galaxy S24 FE', [128, 256, 512], 30000],
  ['Samsung', 'Galaxy S23 Ultra', [256, 512, 1024], 39000],
  ['Samsung', 'Galaxy S23+', [256, 512], 30000],
  ['Samsung', 'Galaxy S23', [128, 256, 512], 26000],
  ['Samsung', 'Galaxy S23 FE', [128, 256], 20000],
  ['Samsung', 'Galaxy S22 Ultra', [128, 256, 512, 1024], 27000],
  ['Samsung', 'Galaxy S22+', [128, 256], 21000],
  ['Samsung', 'Galaxy S22', [128, 256], 18000],
  ['Samsung', 'Galaxy S21 Ultra', [128, 256, 512], 20000],
  ['Samsung', 'Galaxy S21', [128, 256], 14000],
  ['Samsung', 'Galaxy A56 5G', [128, 256], 23000],
  ['Samsung', 'Galaxy A36 5G', [128, 256], 17000],
  ['Samsung', 'Galaxy A26 5G', [128, 256], 11000],
  ['Samsung', 'Galaxy A16', [128, 256], 8000],
  ['Samsung', 'Galaxy A06', [64, 128], 4500],
  ['Samsung', 'Galaxy A55 5G', [128, 256], 19000],
  ['Samsung', 'Galaxy A35 5G', [128, 256], 14000],
  ['Samsung', 'Galaxy A25 5G', [128, 256], 9000],
  ['Samsung', 'Galaxy A15', [128, 256], 6500],
  ['Samsung', 'Galaxy A05s', [64, 128], 4000],
  ['Samsung', 'Galaxy A54 5G', [128, 256], 15000],
  ['Samsung', 'Galaxy A34 5G', [128, 256], 11000],
  ['Samsung', 'Galaxy A24', [128], 7000],
  ['Samsung', 'Galaxy A14', [64, 128], 5000],

  // Xiaomi, Redmi and POCO
  ['Xiaomi', 'Xiaomi 15 Ultra', [512, 1024], 65000],
  ['Xiaomi', 'Xiaomi 15T Pro', [256, 512, 1024], 52000],
  ['Xiaomi', 'Xiaomi 15T', [256, 512], 42000],
  ['Xiaomi', 'Xiaomi 15', [256, 512], 48000],
  ['Xiaomi', 'Xiaomi 14 Ultra', [512], 50000],
  ['Xiaomi', 'Xiaomi 14T Pro', [512, 1024], 40000],
  ['Xiaomi', 'Xiaomi 14T', [256, 512], 32000],
  ['Xiaomi', 'Xiaomi 14', [256, 512], 35000],
  ['Xiaomi', 'Xiaomi 13T Pro', [512], 28000],
  ['Xiaomi', 'Xiaomi 13T', [256], 22000],
  ['Xiaomi', 'Redmi Note 15 Pro+', [256, 512], 29000],
  ['Xiaomi', 'Redmi Note 15 Pro', [256, 512], 24000],
  ['Xiaomi', 'Redmi Note 14 Pro+', [256, 512], 24000],
  ['Xiaomi', 'Redmi Note 14 Pro', [256, 512], 19000],
  ['Xiaomi', 'Redmi Note 14', [128, 256], 12000],
  ['Xiaomi', 'Redmi Note 13 Pro+', [256, 512], 20000],
  ['Xiaomi', 'Redmi Note 13 Pro', [128, 256, 512], 16000, 256],
  ['Xiaomi', 'Redmi Note 13', [128, 256], 10000],
  ['Xiaomi', 'Redmi Note 12 Pro', [128, 256], 12000],
  ['Xiaomi', 'Redmi Note 12', [128, 256], 8000],
  ['Xiaomi', 'Redmi 15', [128, 256], 8000],
  ['Xiaomi', 'Redmi 14C', [128, 256], 5000],
  ['Xiaomi', 'Redmi 13', [128, 256], 6500],
  ['Xiaomi', 'Redmi 12', [128, 256], 5500],
  ['Xiaomi', 'Redmi A3', [64, 128], 3500],
  ['Xiaomi', 'Poco F7 Pro', [256, 512], 32000],
  ['Xiaomi', 'Poco F7', [256, 512], 28000],
  ['Xiaomi', 'Poco F6', [256, 512], 24000],
  ['Xiaomi', 'Poco X7 Pro', [256, 512], 23000],
  ['Xiaomi', 'Poco X6 Pro', [256, 512], 18000],

  // Google
  ['Google', 'Pixel 10 Pro XL', [256, 512, 1024], 72000],
  ['Google', 'Pixel 10 Pro', [128, 256, 512, 1024], 66000],
  ['Google', 'Pixel 10', [128, 256], 52000],
  ['Google', 'Pixel 9 Pro XL', [128, 256, 512, 1024], 58000],
  ['Google', 'Pixel 9 Pro', [128, 256, 512, 1024], 52000],
  ['Google', 'Pixel 9', [128, 256], 40000],
  ['Google', 'Pixel 9a', [128, 256], 32000],
  ['Google', 'Pixel 8 Pro', [128, 256, 512, 1024], 39000],
  ['Google', 'Pixel 8', [128, 256], 29000],
  ['Google', 'Pixel 8a', [128, 256], 25000],
  ['Google', 'Pixel 7 Pro', [128, 256, 512], 23000],
  ['Google', 'Pixel 7', [128, 256], 18000],
  ['Google', 'Pixel 7a', [128], 19000],

  // OnePlus
  ['OnePlus', 'OnePlus 15', [256, 512], 75000],
  ['OnePlus', 'OnePlus 13', [256, 512], 55000],
  ['OnePlus', 'OnePlus 13R', [256, 512], 38000],
  ['OnePlus', 'OnePlus 12', [256, 512], 43000],
  ['OnePlus', 'OnePlus 12R', [128, 256], 30000],
  ['OnePlus', 'OnePlus 11', [128, 256], 25000],
  ['OnePlus', 'Nord 4', [256, 512], 22000],
  ['OnePlus', 'Nord CE4', [128, 256], 15000],
  ['OnePlus', 'Nord CE4 Lite', [128, 256], 11000],

  // Honor
  ['Honor', 'Honor Magic7 Pro', [512], 58000],
  ['Honor', 'Honor Magic6 Pro', [512], 45000],
  ['Honor', 'Honor Magic5 Pro', [256, 512], 30000],
  ['Honor', 'Honor 400 Pro', [512], 40000],
  ['Honor', 'Honor 400', [256, 512], 32000],
  ['Honor', 'Honor 200', [256, 512], 25000],
  ['Honor', 'Honor X9c', [256, 512], 20000],
  ['Honor', 'Honor X9b', [256], 15000],
  ['Honor', 'Honor X8b', [256], 10000],
  ['Honor', 'Honor X7c', [128, 256], 9000],
  ['Honor', 'Honor X6b', [128, 256], 6000],

  // TECNO
  ['TECNO', 'Camon 40 Pro', [256, 512], 17000],
  ['TECNO', 'Camon 30 Pro', [256, 512], 13000],
  ['TECNO', 'Camon 30', [256, 512], 11000],
  ['TECNO', 'Camon 20 Pro', [256], 8000],
  ['TECNO', 'Phantom V Flip', [256], 15000],
  ['TECNO', 'Pova 6 Pro', [256], 11000],
  ['TECNO', 'Spark 30 Pro', [128, 256], 7500],
  ['TECNO', 'Spark 30', [128, 256], 6000],
  ['TECNO', 'Spark 20 Pro', [256], 6000],
  ['TECNO', 'Spark 20', [128, 256], 4500],

  // Infinix
  ['Infinix', 'Zero 40', [256, 512], 16000],
  ['Infinix', 'Note 50 Pro', [256], 14000],
  ['Infinix', 'Note 40 Pro', [256], 10000],
  ['Infinix', 'Note 40', [256], 8000],
  ['Infinix', 'Hot 50', [128, 256], 5500],
  ['Infinix', 'Hot 40 Pro', [256], 5500],
  ['Infinix', 'Hot 40i', [128, 256], 4000],

  // OPPO, vivo, realme, HUAWEI, itel
  ['OPPO', 'Reno13 F', [256], 18000],
  ['OPPO', 'Reno12 F', [256], 15000],
  ['OPPO', 'Reno11 F', [256], 13000],
  ['OPPO', 'OPPO A79', [256], 9000],
  ['OPPO', 'OPPO A3x', [64, 128], 5000],
  ['vivo', 'vivo V40', [256, 512], 22000],
  ['vivo', 'vivo V30', [256, 512], 18000],
  ['vivo', 'vivo Y36', [128, 256], 7000],
  ['realme', 'realme 13 Pro', [256, 512], 16000],
  ['realme', 'realme 12 Pro', [256], 13000],
  ['realme', 'realme C67', [128, 256], 5500],
  ['HUAWEI', 'Pura 70 Pro', [512], 40000],
  ['HUAWEI', 'P60 Pro', [256, 512], 30000],
  ['HUAWEI', 'nova 12i', [128], 8000],
  ['itel', 'itel S24', [128, 256], 3500],
]

const roundTo500 = (value: number) => Math.round(value / 500) * 500

/** Expands each model line into one entry per storage size; about 10% more per storage step up. */
export function expandModelLines(source: ModelLine[]): TradeInValue[] {
  return source.flatMap(([brand, model, storages, value, at]) => {
    const anchor = Math.max(0, storages.indexOf(at ?? storages[0]!))
    return storages.map((storageGb, index) => ({ brand, model, storageGb, baseValue: roundTo500(value * 1.1 ** (index - anchor)) }))
  })
}

export const tradeInValues: TradeInValue[] = expandModelLines(lines)
