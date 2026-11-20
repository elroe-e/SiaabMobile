// Downloads the Wikipedia phone pages for the shop's brands into .cache/wiki-phones.json.
// Free, no key needed. Run through `npm run specs:library`. Pass --cached to reuse the last download.
/* global fetch, AbortSignal, URLSearchParams, setTimeout, process, console */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const CACHE = '.cache/wiki-phones.json'
const API = 'https://en.wikipedia.org/w/api.php'
const headers = { 'User-Agent': process.env.WIKIPEDIA_USER_AGENT ?? 'SiaabMobileSpecs/1.0 (spec library builder; contact: hello@siaabmobile.com)' }
// Titles that belong to the shop's nine brands, including their sub-brands.
const BRAND_TITLE = /^(Apple |iPhone|IPhone|IQOO|Samsung |Xiaomi |Redmi |Poco |POCO |Mi |OnePlus |Oppo |OPPO |Realme |realme |Vivo |vivo |iQOO |Huawei |Honor |Nova )/

if (existsSync(CACHE) && process.argv.includes('--cached')) {
  console.log(`Using the pages saved in ${CACHE}.`)
  process.exit(0)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) }).catch((error) => ({ ok: false, status: error.message }))
    if (response.ok) {
      const body = await response.json()
      if (!body.error) return body
      if (attempt >= 5) throw new Error(`Wikipedia said: ${body.error.info}`)
    } else if (attempt >= 5) throw new Error(`Wikipedia returned ${response.status}`)
    await sleep(5000 * attempt)
  }
}

const titles = []
let next = {}
do {
  const body = await api({ action: 'query', list: 'embeddedin', eititle: 'Template:Infobox mobile phone', einamespace: '0', eilimit: '500', ...next })
  titles.push(...body.query.embeddedin.map((page) => page.title))
  next = body.continue ?? null
  await sleep(500)
} while (next)
const wanted = titles.filter((title) => BRAND_TITLE.test(title))
console.log(`Wikipedia has ${titles.length} phone pages; ${wanted.length} are for the shop's brands.`)

const pages = {}
for (let start = 0; start < wanted.length; start += 50) {
  const body = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: wanted.slice(start, start + 50).join('|') })
  for (const page of body.query.pages) {
    const text = page.revisions?.[0]?.slots?.main?.content
    if (text) pages[page.title] = text
  }
  process.stdout.write(`\rDownloaded ${Object.keys(pages).length} of ${wanted.length} pages`)
  await sleep(1000)
}
mkdirSync('.cache', { recursive: true })
writeFileSync(CACHE, JSON.stringify({ downloadedAt: new Date().toISOString(), pages }))
console.log(`\nSaved to ${CACHE}.`)
