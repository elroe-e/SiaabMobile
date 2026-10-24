export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'
export type SpecMode = 'simple' | 'advanced'
export interface StorageOption { gb: number; price: number }
export interface Phone {
  id: string
  slug: string
  brand: string
  model: string
  tagline: string
  price: number
  oldPrice?: number
  currency: 'ETB'
  stock: StockStatus
  stockCount: number
  condition: 'new' | 'refurbished'
  warrantyMonths: number
  colors: { name: string; hex: string }[]
  storageOptions: StorageOption[]
  images: string[]
  badges: string[]
  popular: number
  createdAt: string
  tradeInEligible: boolean
  fiveG: boolean
  ram: number
  simpleSpecs: { display: string; camera: string; battery: string; storage: string; ram: string; chipset: string }
  advancedSpecs: Record<string, Record<string, string>>
}
export interface UpcomingPhone {
  id: string
  slug: string
  brand: string
  model: string
  expectedDate: string
  dateSort: string
  teaser: string
  expectedPriceRange: string
  keyRumoredSpecs: string[]
  image: string
  notifyEnabled: boolean
}
export interface TradeInValue { brand: string; model: string; storageGb: number; baseValue: number }
export type Condition = 'like_new' | 'good' | 'fair' | 'poor'
export type ScreenCondition = 'perfect' | 'light_scratches' | 'cracked'
export type BodyCondition = 'perfect' | 'scratched' | 'cracked_bent'
export type BatteryCondition = '90_plus' | '80_89' | 'below_80' | 'unknown'
export type Accessories = 'full' | 'phone_only'
export interface TradeInAnswers {
  condition: Condition
  screen: ScreenCondition
  body: BodyCondition
  battery: BatteryCondition
  powersOn: boolean
  issues: string[]
  accessories: Accessories
  locked: boolean
}
export interface TradeInEstimate {
  eligible: boolean
  estimate: number | null
  min: number | null
  max: number | null
  deductions: { label: string; amount: number }[]
  baseValue: number
}
