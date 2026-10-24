'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { shop as sampleShop } from '../data/shop'
import { tradeInValues as sampleTradeValues } from '../data/tradeInValues'
import { upcomingPhones as sampleUpcoming } from '../data/upcoming'
import { tradeInConfig as sampleTradeConfig } from '../lib/tradeIn'
import type { TradeInValue, UpcomingPhone } from '../types'
import type { TradeInConfig } from '../lib/tradeIn'

export type StoreInfo = {
  name: string
  tagline: string
  currency: string
  currencySymbol: string
  phones: string[]
  whatsapp: string[]
  telegram: string
  email: string
  address: string
  hours: string
  mapUrl: string
  siteUrl: string
}

export type StoreData = {
  shop: StoreInfo
  tradeInValues: TradeInValue[]
  tradeInConfig: TradeInConfig
  upcomingPhones: UpcomingPhone[]
}

export const defaultStoreData: StoreData = {
  shop: sampleShop,
  tradeInValues: sampleTradeValues,
  tradeInConfig: sampleTradeConfig,
  upcomingPhones: sampleUpcoming,
}

const StoreDataContext = createContext<StoreData>(defaultStoreData)

export function StoreDataProvider({ value, children }: { value: StoreData; children: ReactNode }) {
  return <StoreDataContext.Provider value={value}>{children}</StoreDataContext.Provider>
}

export const useStoreData = () => useContext(StoreDataContext)
