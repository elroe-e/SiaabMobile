import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { shop as sampleShop } from '../../data/shop'
import { tradeInValues as sampleTradeValues } from '../../data/tradeInValues'
import { upcomingPhones as sampleUpcoming } from '../../data/upcoming'
import { placeholderImages } from '../../data/phones'
import { tradeInConfig as sampleTradeConfig } from '../tradeIn'
import type { StoreData } from '../../context/StoreDataContext'
import type { TradeInConfig } from '../tradeIn'
import type { UpcomingPhone } from '../../types'
import { getSupabasePublicConfig, isSupabaseConfigured } from './config'

type DbModel = { id: string; brand: string; name: string; slug: string; expected_date: string | null; expected_price_range: string | null; tagline: string; specs: Record<string, unknown> }
type DbPhoto = { model_id: string; path: string; sort_order: number; is_main: boolean }

function dateSort(value: string) {
  const parsed = Date.parse(value)
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10)
  const year = value.match(/\b20\d{2}\b/)?.[0] ?? '9999'
  return `${year}-12-31`
}

function stringifySpec(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export async function getPublicStoreData(): Promise<StoreData> {
  if (!isSupabaseConfigured) return {
    shop: sampleShop,
    tradeInValues: sampleTradeValues,
    tradeInConfig: sampleTradeConfig,
    upcomingPhones: sampleUpcoming,
  }

  const { url, key } = getSupabasePublicConfig()
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const [modelsResult, photosResult, valuesResult, configResult, settingsResult] = await Promise.all([
    supabase.from('public_models').select('id,brand,name,slug,expected_date,expected_price_range,tagline,specs').eq('status', 'upcoming'),
    supabase.from('public_model_photos').select('model_id,path,sort_order,is_main').order('sort_order'),
    supabase.from('public_trade_in_values').select('brand_text,model_text,storage_gb,base_value'),
    supabase.from('public_trade_in_config').select('config').maybeSingle(),
    supabase.from('public_shop_settings').select('*').maybeSingle(),
  ])
  const errors = [modelsResult.error, photosResult.error, valuesResult.error, configResult.error, settingsResult.error].filter(Boolean)
  if (errors.length) throw new Error(`Could not load public store settings: ${errors.map((error) => error?.message).join('; ')}`)

  const models = (modelsResult.data ?? []) as DbModel[]
  const photos = (photosResult.data ?? []) as DbPhoto[]
  const upcoming: UpcomingPhone[] = models.map((model) => {
    const sample = sampleUpcoming.find((item) => item.slug === model.slug)
    const photo = photos.filter((item) => item.model_id === model.id).sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.sort_order - b.sort_order)[0]
    const specs = Object.entries(model.specs ?? {}).flatMap(([key, value]) => {
      const text = stringifySpec(value)
      return text ? [`${key.replaceAll(/([A-Z])/g, ' $1')}: ${text}`] : []
    }).slice(0, 3)
    const expectedDate = model.expected_date ?? sample?.expectedDate ?? 'To be announced'
    return {
      id: model.id,
      slug: model.slug,
      brand: model.brand,
      model: model.name,
      expectedDate,
      dateSort: dateSort(expectedDate),
      teaser: model.tagline || sample?.teaser || 'More details coming soon.',
      expectedPriceRange: model.expected_price_range || sample?.expectedPriceRange || 'To be announced',
      keyRumoredSpecs: specs.length ? specs : sample?.keyRumoredSpecs ?? ['Details to be announced'],
      image: photo ? `${url}/storage/v1/object/public/phone-photos/${photo.path}` : sample?.image ?? placeholderImages(model.slug)[0] ?? '/og-image.svg',
      notifyEnabled: true,
    }
  })
  const settings = settingsResult.data
  const configuredShop = settings ? {
    ...sampleShop,
    name: settings.name,
    phones: [settings.phone, ...sampleShop.phones.slice(1)],
    whatsapp: [settings.whatsapp, ...sampleShop.whatsapp.slice(1)],
    telegram: settings.telegram,
    email: settings.email,
    address: settings.address,
    hours: settings.hours,
    mapUrl: `https://maps.google.com/?q=${encodeURIComponent(settings.address)}`,
  } : sampleShop

  return {
    shop: configuredShop,
    tradeInValues: (valuesResult.data ?? []).map((item) => ({
      brand: item.brand_text, model: item.model_text, storageGb: item.storage_gb, baseValue: Number(item.base_value),
    })),
    tradeInConfig: (configResult.data?.config ?? sampleTradeConfig) as TradeInConfig,
    upcomingPhones: upcoming,
  }
}
