import { parsePastedSpecs } from './paste-parser'
import type { SpecProvider } from './types'

const lastRequest = { at: 0 }

export const wikipediaProvider: SpecProvider = {
  name: 'wikipedia',
  async fetch({ brand, model }) {
    const wait = 1000 - (Date.now() - lastRequest.at)
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequest.at = Date.now()
    const headers = { 'User-Agent': process.env.WIKIPEDIA_USER_AGENT ?? 'SiaabMobileSpecs/1.0 (contact: hello@siaabmobile.com)' }
    const searchUrl = new URL('https://en.wikipedia.org/w/api.php')
    searchUrl.search = new URLSearchParams({ action: 'query', list: 'search', srsearch: `${brand} ${model} smartphone`, format: 'json', origin: '*' }).toString()
    const searchResponse = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    if (!searchResponse.ok) throw new Error(`Wikipedia search returned HTTP ${searchResponse.status}.`)
    const search = await searchResponse.json() as { query?: { search?: { title: string }[] } }
    const title = search.query?.search?.[0]?.title
    if (!title) return { specs: {}, sourceUrls: [] }

    const pageUrl = new URL('https://en.wikipedia.org/w/api.php')
    pageUrl.search = new URLSearchParams({ action: 'parse', page: title, prop: 'wikitext', format: 'json', origin: '*' }).toString()
    const pageResponse = await fetch(pageUrl, { headers, signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    if (!pageResponse.ok) throw new Error(`Wikipedia page lookup returned HTTP ${pageResponse.status}.`)
    const page = await pageResponse.json() as { parse?: { title?: string; wikitext?: { '*'?: string } } }
    const wikiText = page.parse?.wikitext?.['*'] ?? ''
    if (!wikiText) return { specs: {}, sourceUrls: [] }
    const lines = wikiText.split(/\r?\n/).filter((line) => line.includes('=')).map((line) => line.replace(/^\s*\|\s*/, '').replace(/\s*=\s*/, ': ')).join('\n')
    return {
      specs: parsePastedSpecs(lines),
      sourceUrls: [`https://en.wikipedia.org/wiki/${encodeURIComponent((page.parse?.title ?? title).replaceAll(' ', '_'))}`],
    }
  },
}
