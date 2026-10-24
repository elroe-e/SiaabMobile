import type { Phone } from '../types'

export interface CatalogFilters {
  search: string
  brand: string
  storage: string
  condition: string
  availability: string
  fiveG: boolean
  minPrice: number
  maxPrice: number
  sort: string
}

export const defaultFilters: CatalogFilters = {
  search: '', brand: '', storage: '', condition: '', availability: '', fiveG: false,
  minPrice: 0, maxPrice: 150000, sort: 'popular',
}

export function filterPhones(phones: Phone[], filters: CatalogFilters): Phone[] {
  return phones.filter((phone) => {
    const search = filters.search.trim().toLowerCase()
    return (!search || `${phone.brand} ${phone.model}`.toLowerCase().includes(search))
      && (!filters.brand || phone.brand === filters.brand)
      && (!filters.storage || phone.storageOptions.some((option) => option.gb >= Number(filters.storage)))
      && (!filters.condition || phone.condition === filters.condition)
      && (!filters.availability || phone.stock === filters.availability)
      && (!filters.fiveG || phone.fiveG)
      && phone.price >= filters.minPrice && phone.price <= filters.maxPrice
  }).sort((left, right) => {
    if (filters.sort === 'price-asc') return left.price - right.price
    if (filters.sort === 'price-desc') return right.price - left.price
    if (filters.sort === 'newest') return right.createdAt.localeCompare(left.createdAt)
    return right.popular - left.popular
  })
}
