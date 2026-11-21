import 'server-only'
import { advancedSpecGroups, simpleSpecLines } from '../specs/simple-specs'
import { createDbClient } from './client'
import { photoUrl } from './photos'
import { phones as samplePhones, placeholderImages } from '../../data/phones'
import { isDatabaseConfigured } from './pool'
import type { Phone } from '../../types'

type PublicModel = {
  id: string
  created_at?: string
  brand: string
  name: string
  slug: string
  status: 'available' | 'upcoming'
  expected_date: string | null
  tagline: string
  specs: Record<string, unknown>
  specs_reviewed: boolean
}
type PublicVariant = {
  id: string
  model_id: string
  ram_gb: number
  storage_gb: number
  color_name: string
  color_hex: string
  price: number
  old_price: number | null
  stock_count: number
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock'
}
type PublicUsedUnit = {
  id: string
  model_id: string
  ram_gb: number
  storage_gb: number
  color_name: string
  grade: 'A' | 'B' | 'C'
  battery_health_pct: number | null
  accessories: string
  warranty_months: number
  price: number
  display_status: 'available' | 'reserved' | 'sold'
  photos: { path: string; alt_text: string; sort_order: number }[]
}
type PublicModelPhoto = { model_id: string; path: string; alt_text: string; sort_order: number; is_main: boolean }


/** Simple specs for a card; unknown values read "Not specified" and are left off the card. */
function shopSimpleSpecs(specs: Record<string, unknown>, storageGb: number, ramGb: number): Phone['simpleSpecs'] {
  const lines = simpleSpecLines(specs)
  const or = (text: string) => text || 'Not specified'
  return { display: or(lines.display), camera: or(lines.camera), battery: or(lines.battery), storage: `${storageGb} GB`, ram: `${ramGb} GB`, chipset: or(lines.chipset) }
}

function toPhone(model: PublicModel, variant: PublicVariant, photos: PublicModelPhoto[], modelVariants: Map<string, PublicVariant[]>): Phone {
  const modelPhotos = photos.filter((photo) => photo.model_id === model.id).sort((a, b) => a.sort_order - b.sort_order)
  const storageVariants = modelVariants.get(model.id) ?? [variant]
  const totalStock = storageVariants.reduce((sum, item) => sum + item.stock_count, 0)
  const advancedSpecs = advancedSpecGroups(model.specs)
  const imagePaths = modelPhotos.length ? modelPhotos.map((photo) => photoUrl(photo.path)) : []
  const imageSet = imagePaths.length ? imagePaths : samplePhones.find((phone) => phone.slug === model.slug)?.images ?? placeholderImages(model.slug)
  return {
    id: variant.id,
    slug: model.slug,
    brand: model.brand,
    model: model.name,
    tagline: model.tagline,
    price: Number(variant.price),
    ...(variant.old_price ? { oldPrice: Number(variant.old_price) } : {}),
    currency: 'ETB',
    stock: totalStock === 0 ? 'out_of_stock' : totalStock <= 2 ? 'low_stock' : 'in_stock',
    stockCount: totalStock,
    condition: 'new',
    warrantyMonths: 12,
    colors: [...new Map(storageVariants.map((item) => [item.color_name, { name: item.color_name, hex: item.color_hex }])).values()],
    storageOptions: [...new Map(storageVariants.map((item) => [item.storage_gb, { gb: item.storage_gb, price: Number(item.price) }])).values()].sort((a, b) => a.gb - b.gb),
    images: imageSet,
    badges: [],
    popular: variant.stock_count,
    createdAt: model.created_at ?? '',
    tradeInEligible: true,
    fiveG: model.specs.fiveG === true,
    ram: variant.ram_gb,
    simpleSpecs: shopSimpleSpecs(model.specs, variant.storage_gb, variant.ram_gb),
    advancedSpecs,
  }
}

export async function getPublicCatalog(): Promise<Phone[]> {
  if (!isDatabaseConfigured) return samplePhones
  const db = createDbClient()
  const [modelsResult, variantsResult, photosResult, unitsResult] = await Promise.all([
    db.from('public_models').select('*').eq('status', 'available'),
    db.from('public_variants').select('*'),
    db.from('public_model_photos').select('*'),
    db.from('public_used_units').select('*'),
  ])
  const errors = [modelsResult.error, variantsResult.error, photosResult.error, unitsResult.error].filter(Boolean)
  if (errors.length) throw new Error(`Could not load the shop catalog: ${errors.map((error) => error?.message).join('; ')}`)
  const models = (modelsResult.data ?? []) as PublicModel[]
  const variants = (variantsResult.data ?? []) as PublicVariant[]
  const photos = (photosResult.data ?? []) as PublicModelPhoto[]
  const units = (unitsResult.data ?? []) as PublicUsedUnit[]
  const modelVariants = new Map<string, PublicVariant[]>()
  for (const variant of variants) {
    const current = modelVariants.get(variant.model_id) ?? []
    current.push(variant)
    modelVariants.set(variant.model_id, current)
  }
  // One card per phone model, led by its cheapest variant; colours and storage options are gathered inside toPhone.
  const newPhones = models.flatMap((model) => {
    const cheapest = [...(modelVariants.get(model.id) ?? [])].sort((a, b) => Number(a.price) - Number(b.price))[0]
    return cheapest ? [toPhone(model, cheapest, photos, modelVariants)] : []
  })
  const usedPhones = units.map((unit): Phone | null => {
    const model = models.find((item) => item.id === unit.model_id)
    if (!model) return null
    const imagePaths = unit.photos.map((photo) => photoUrl(photo.path))
    const images = imagePaths.length ? imagePaths : samplePhones.find((phone) => phone.slug === model.slug)?.images ?? placeholderImages(model.slug)
    return {
      id: unit.id, slug: `${model.slug}-used-${unit.id}`, brand: model.brand, model: model.name,
      tagline: `Grade ${unit.grade} · ${unit.battery_health_pct ?? 'Unknown'}% battery health`,
      price: Number(unit.price), currency: 'ETB', stock: unit.display_status === 'available' ? 'in_stock' : 'out_of_stock',
      stockCount: unit.display_status === 'available' ? 1 : 0, condition: 'refurbished',
      warrantyMonths: unit.warranty_months, colors: [{ name: unit.color_name, hex: '#777777' }],
      storageOptions: [{ gb: unit.storage_gb, price: Number(unit.price) }], images,
      badges: [`Used · Grade ${unit.grade}`, ...(unit.display_status === 'sold' ? ['Sold'] : unit.display_status === 'reserved' ? ['Reserved'] : [])],
      popular: 1, createdAt: model.id, tradeInEligible: false, fiveG: model.specs.fiveG === true,
      ram: unit.ram_gb,
      simpleSpecs: shopSimpleSpecs(model.specs, unit.storage_gb, unit.ram_gb),
      advancedSpecs: advancedSpecGroups(model.specs),
    }
  }).filter((phone): phone is Phone => phone !== null)
  return [...newPhones, ...usedPhones]
}
