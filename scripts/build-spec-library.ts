// Builds the free spec library from the Wikipedia pages saved by fetch-wiki-phones.mjs.
// Run with `npm run specs:library`. It replaces src/data/spec-library.generated.json and src/data/spec-models.json.
import { readFileSync, writeFileSync } from 'node:fs'
import curated from '../src/data/spec-library.json'
import { parseWikiPhonePage, type WikiPhone } from '../src/lib/specs/wiki-infobox'

const FIRST_YEAR = 2018
const BRANDS = ['Apple', 'Honor', 'Huawei', 'OnePlus', 'OPPO', 'realme', 'Samsung', 'vivo', 'Xiaomi']
const CHECK: Record<string, string[]> = {
  Apple: ['iPhone XR', 'iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14 Pro', 'iPhone 15 Pro Max', 'iPhone 16', 'iPhone 16e', 'iPhone 17 Pro', 'iPhone Air'],
  Samsung: ['Galaxy S10', 'Galaxy S21 Ultra', 'Galaxy S23', 'Galaxy S24 Ultra', 'Galaxy S25 Ultra', 'Galaxy S25 Edge', 'Galaxy A15', 'Galaxy A54', 'Galaxy A55', 'Galaxy Z Fold 6', 'Galaxy Z Flip 6'],
  Xiaomi: ['13 Ultra', '14', '15 Ultra', 'Mi 9', 'Redmi Note 13 Pro', 'Redmi Note 14', 'Redmi 13C', 'Poco X6 Pro', 'Poco F6'],
  OnePlus: ['7 Pro', '9', '11', '12', '13', '15', 'Nord 4', 'Nord CE 3'],
  OPPO: ['Find X5 Pro', 'Find X8', 'Reno 12', 'A78'],
  realme: ['GT 6', '12 Pro', 'Narzo 60', 'C55'],
  vivo: ['X100 Pro', 'X200', 'V30', 'iQOO 12'],
  Huawei: ['P30 Pro', 'Mate 40 Pro', 'Mate 60 Pro', 'Pura 70 Ultra', 'Nova 12'],
  Honor: ['Magic 6 Pro', '90', 'X9b', 'Magic V3'],
}

// "Reno 12" and "Reno12" are one phone. "A54" and "A54 5G" can be two different phones, so only the coverage check ignores "5G".
const squash = (value: string) => value.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '')
const loose = (value: string) => squash(value).replace(/5g$/, '')
const filled = (value: unknown): boolean => value !== null && value !== undefined && value !== '' && (typeof value !== 'object' || (Array.isArray(value) ? value.length > 0 : Object.values(value).some(filled)))
const score = (phone: WikiPhone) => Object.values(phone.specs).filter(filled).length
const core = ['display', 'chipset', 'batteryMah', 'rearCamera', 'os'] as const

const { downloadedAt, pages } = JSON.parse(readFileSync('.cache/wiki-phones.json', 'utf8')) as { downloadedAt: string; pages: Record<string, string> }
const best = new Map<string, WikiPhone>()
let undated = 0, older = 0
for (const [title, text] of Object.entries(pages)) {
  for (const phone of parseWikiPhonePage(title, text)) {
    if (phone.released === null) { undated++; continue }
    if (phone.released < FIRST_YEAR) { older++; continue }
    const key = `${phone.brand}|${squash(phone.model)}`
    const current = best.get(key)
    if (!current || score(phone) > score(current)) best.set(key, phone)
  }
}

const curatedKeys = new Set((curated as { brand: string; model: string }[]).map((entry) => `${entry.brand}|${squash(entry.model)}`))
const phones = [...best.entries()].filter(([key]) => !curatedKeys.has(key)).map(([, phone]) => phone)
  .sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model, 'en', { numeric: true }))
const entries = phones.map((phone) => ({
  brand: phone.brand, model: phone.model, released: phone.released, needsReview: true,
  sourceUrls: [`https://en.wikipedia.org/wiki/${encodeURIComponent(phone.title.replaceAll(' ', '_'))}`],
  specs: phone.specs,
}))
writeFileSync('src/data/spec-library.generated.json', `${JSON.stringify(entries, null, 1)}\n`)

const models: Record<string, string[]> = {}
for (const entry of [...(curated as { brand: string; model: string }[]), ...entries]) (models[entry.brand] ??= []).push(entry.model)
for (const brand of Object.keys(models)) models[brand] = [...new Set(models[brand])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
writeFileSync('src/data/spec-models.json', `${JSON.stringify({ updatedFrom: `Wikipedia, downloaded ${downloadedAt.slice(0, 10)}`, models }, null, 1)}\n`)

console.log(`\nSpec library: ${entries.length} phones from ${FIRST_YEAR} on (Wikipedia pages downloaded ${downloadedAt.slice(0, 10)}).`)
console.log(`Left out: ${older} older phones, ${undated} phones with no release date on Wikipedia.\n`)
console.log('Brand      Phones  All 5 main specs  Newest')
for (const brand of BRANDS) {
  const list = phones.filter((phone) => phone.brand === brand)
  const full = list.filter((phone) => core.every((field) => filled(phone.specs[field]))).length
  const newest = Math.max(0, ...list.map((phone) => phone.released ?? 0))
  console.log(`${brand.padEnd(10)} ${String(list.length).padStart(6)}  ${String(full).padStart(16)}  ${newest || '-'}`)
}
const have = new Set([...best.values(), ...(curated as { brand: string; model: string }[])].map((phone) => `${phone.brand}|${loose(phone.model)}`))
const missing = Object.entries(CHECK).flatMap(([brand, list]) => list.filter((model) => !have.has(`${brand}|${loose(model)}`)).map((model) => `${brand} ${model}`))
const checked = Object.values(CHECK).flat().length
console.log(`\nWell-known phones found: ${checked - missing.length} of ${checked}.`)
if (missing.length) console.log(`Not in the library: ${missing.join(', ')}`)
