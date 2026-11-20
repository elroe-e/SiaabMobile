import { normalizeResolution, parseNumber, validateSpecs } from './normalize'
import type { PartialSpecs } from './types'

/**
 * Reads the phone box ("Infobox mobile phone") of a Wikipedia page and turns it into one spec entry per phone.
 * Pages often cover a whole series ("S24", "S24+", "S24 Ultra"): values labelled for one model go only to that
 * model. When a value is labelled for other models only, it stays empty, because a blank box is safer than a wrong one.
 */
export interface WikiPhone { brand: string; model: string; title: string; released: number | null; specs: PartialSpecs }

interface Segment { label: string | null; text: string }

const MODEL_FIELDS = ['battery', 'dimensions', 'weight', 'display']
const DATE_FIELDS = ['released', 'available', 'first_released', 'release_date', 'announced']
const NOT_PHONES = /\b(Tab|Watch|Band|Buds|Pad|MatePad|MateBook|Book|Glass|Vision|Gear|TV|Router|Pencil)\b/i
const REGION_WORDS = /\b(Global|China|Chinese|India|Indian|International|North|America|Worldwide|Europe|Korea|Japan|version|model|variant|edition)\b/i

/** Drops "(smartphone)" and " series" from a page title, but keeps "(2018)" and "(3rd generation)", which tell phones apart. */
const pageNameOf = (title: string) => title.replace(/\s*\(([^)]*)\)\s*$/, (whole, inside: string) => (/generation|\b20\d\d\b/i.test(inside) ? whole : '')).replace(/\s+(series|smartphones?)$/i, '').trim()

/** Shop brand and model name for a page or phone title, or null when it is not one of the shop's brands. */
export function brandAndModel(title: string): { brand: string; model: string } | null {
  const clean = pageNameOf(title).replace(/^IPhone\b/, 'iPhone').replace(/^IQOO\b/, 'iQOO')
  const rules: [RegExp, string][] = [
    [/^(?:Apple )?(iPhone\b.*)$/, 'Apple'],
    [/^Samsung (.+)$/, 'Samsung'],
    [/^(?:Xiaomi )?((?:Redmi|Poco|POCO|Mi) .+)$/, 'Xiaomi'],
    [/^Xiaomi (.+)$/, 'Xiaomi'],
    [/^OnePlus (.+)$/, 'OnePlus'],
    [/^(?:Oppo|OPPO) (.+)$/, 'OPPO'],
    [/^(?:Realme|realme) (.+)$/, 'realme'],
    [/^(?:Vivo |vivo )?(iQOO\b.*)$/, 'vivo'],
    [/^(?:Vivo|vivo) (.+)$/, 'vivo'],
    [/^(?:Huawei )?Honor (.+)$/, 'Honor'],
    [/^(?:Huawei )?(Nova .+)$/, 'Huawei'],
    [/^Huawei (.+)$/, 'Huawei'],
  ]
  for (const [pattern, brand] of rules) {
    const model = pattern.exec(clean)?.[1]?.replace(/^POCO\b/, 'Poco').trim()
    if (model) return { brand, model }
  }
  return null
}

/** Splits the phone box into its fields, keeping links and templates whole. */
export function infoboxFields(wikitext: string): Record<string, string> | null {
  const text = wikitext.replace(/<!--[\s\S]*?-->/g, '')
  const start = text.search(/\{\{\s*Infobox[ _]mobile[ _]phone/i)
  if (start < 0) return null
  const pieces: string[] = []
  let braces = 0, links = 0, from = start
  for (let i = start; i < text.length; i++) {
    const two = text.slice(i, i + 2)
    if (two === '{{') { braces++; i++ } else if (two === '}}') {
      braces--; i++
      if (braces === 0) { pieces.push(text.slice(from, i - 1)); break }
    } else if (two === '[[') { links++; i++ } else if (two === ']]') { links = Math.max(0, links - 1); i++ } else if (text[i] === '|' && braces === 1 && links === 0) {
      pieces.push(text.slice(from, i)); from = i + 1
    }
  }
  const fields: Record<string, string> = {}
  for (const piece of pieces.slice(1)) {
    const equals = piece.indexOf('=')
    if (equals < 0) continue
    const key = piece.slice(0, equals).trim().toLowerCase().replace(/\s+/g, '_')
    const value = piece.slice(equals + 1).trim()
    if (key && value) fields[key] = value
  }
  return fields
}

function template(inner: string): string {
  const parts = inner.split('|').map((part) => part.trim())
  const name = (parts[0] ?? '').toLowerCase().replace(/_/g, ' ').trim()
  const named = Object.fromEntries(parts.slice(1).filter((part) => /^[\w ]+=/.test(part)).map((part) => [part.slice(0, part.indexOf('=')).trim(), part.slice(part.indexOf('=') + 1).trim()]))
  const args = parts.slice(1).filter((part) => !/^[\w ]+=/.test(part))
  if (name === 'convert' || name === 'cvt') {
    const value = (args[0] ?? '').replace(/\s*[*x×]\s*/g, ' × ')
    const unit = args[1] === 'in' ? 'inches' : args[1] ?? ''
    return /^[-–]|^to$|^and$/.test(unit) ? `${value} to ${args[2] ?? ''} ${args[3] === 'in' ? 'inches' : args[3] ?? ''}` : `${value} ${unit}`
  }
  if (name === 'resx' || name === 'resolution') return `${args[0] ?? ''} × ${args[1] ?? ''} pixels`
  if (name === 'f/') return `f/${args[0] ?? ''}`
  if (name === 'val') return `${args[0] ?? ''} ${named.u ?? named.ul ?? ''}`
  if (/date|^dts$/.test(name)) return args.filter((arg) => /^\d+$/.test(arg)).join('-')
  if (name === 'nbsp' || name === '\\') return ' '
  if (name === 'times') return '×'
  if (/^(nowrap|nobr|small|abbr|mono|lang|nowrap begin)$/.test(name)) return name === 'lang' ? args[1] ?? '' : args[0] ?? ''
  if (/^(ubl|unbulleted list|ublist|plainlist|plain list|flatlist|hlist|bulleted list|ul|collapsible list)$/.test(name)) return args.join('\n')
  return ''
}

/** Turns wiki markup into plain text, keeping bold model labels and line breaks. */
export function wikiToText(value: string): string {
  let text = value
    .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\[\[(?:File|Image):[^[\]]*(?:\[\[[^\]]*\]\][^[\]]*)*\]\]/gi, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
  for (let round = 0; round < 10; round++) {
    const next = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => template(inner))
    if (next === text) break
    text = next
  }
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&times;/g, '×').replace(/&ndash;|&mdash;/g, '–').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/'''|''/g, (quotes) => (quotes.length === 3 ? quotes : ''))
    .replace(/^\s*[*#:]+\s*/gm, '')
    .replace(/[ \t]+/g, ' ')
}

function segments(text: string): Segment[] {
  const label = /'''([^'\n]+?)'''\s*:|'''([^'\n]+?):\s*'''/g
  const result: Segment[] = []
  let last = 0, current: string | null = null
  for (const match of text.matchAll(label)) {
    result.push({ label: current, text: text.slice(last, match.index) })
    current = (match[1] ?? match[2] ?? '').trim()
    last = (match.index ?? 0) + match[0].length
  }
  result.push({ label: current, text: text.slice(last) })
  return result
    .map((segment) => ({ label: segment.label, text: segment.text.replace(/'''/g, '').split('\n').map((line) => line.trim().replace(/^[,;:]\s*|\s*[,;]$/g, '')).filter(Boolean).join('\n') }))
    .filter((segment) => segment.text)
}

const labelPieces = (label: string) => label.replace(/\([^)]*\)/g, ' ').split(/\s*(?:,|&|\band\b|\/|\bor\b)\s*/).map((piece) => piece.trim()).filter(Boolean)
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** "S24 Ultra" on the page "Samsung Galaxy S24" means "Samsung Galaxy S24 Ultra". */
function resolveName(piece: string, titleWords: string[]): string | null {
  const words = piece.split(/\s+/)
  const first = words[0]?.toLowerCase() ?? ''
  for (let index = titleWords.length - 1; index >= 0; index--) {
    const word = titleWords[index]!.toLowerCase()
    if (first === word || (first.startsWith(word) && /^\++$/.test(first.slice(word.length)))) {
      const name = [...titleWords.slice(0, index), ...words].join(' ')
      return name.split(' ').length >= titleWords.length ? name : null
    }
  }
  return null
}

/** The phones on this page that a label is about, longest name first, so "S24 Ultra" never counts as "S24". */
function owners(label: string, variants: string[], titleWords: string[]): Set<string> {
  const found = new Set<string>()
  for (const piece of labelPieces(label)) {
    const name = resolveName(piece, titleWords)
    if (!name) continue
    const owner = variants.filter((variant) => same(name, variant) || name.toLowerCase().startsWith(`${variant.toLowerCase()} `)).sort((a, b) => b.length - a.length)[0]
    if (owner) found.add(owner)
  }
  return found
}

function valueFor(field: Segment[] | undefined, variant: string, variants: string[], titleWords: string[], key: string): string | null {
  if (!field?.length) return null
  const common = field.filter((segment) => !segment.label).map((segment) => segment.text)
  const labelled = field.filter((segment) => segment.label).map((segment) => ({ ...segment, owners: owners(segment.label!, variants, titleWords) }))
  if (labelled.some((segment) => segment.owners.size)) {
    const mine = labelled.filter((segment) => segment.owners.has(variant)).map((segment) => segment.text)
    return [...common, ...mine].join('\n') || null
  }
  if (!labelled.length) return common.join('\n') || null
  if (key === 'os') return (labelled.find((segment) => /^(original|initial|launch|at launch|first)/i.test(segment.label!)) ?? labelled[0])!.text
  if (key === 'soc' || key === 'chipset') return [...common, ...labelled.map((segment) => segment.text)].join(' / ')
  return [...common, ...labelled.map((segment) => `${segment.label}: ${segment.text}`)].join(' / ')
}

const flat = (text: string | null) => text?.replace(/\n+/g, ', ').replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/,(\s*,)+/g, ',').replace(/^[,\s]+|[,\s]+$/g, '').trim() || null
const short = (text: string | null, max = 120) => { const value = flat(text); return value && value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value }
const largest = (text: string | null, pattern: RegExp) => {
  const numbers = [...(text ?? '').matchAll(pattern)].map((match) => Number(match[1]!.replaceAll(',', ''))).filter(Number.isFinite)
  return numbers.length ? Math.max(...numbers) : null
}

function cameraName(line: string, index: number) {
  if (/periscope/i.test(line)) return 'Periscope telephoto'
  if (/tele|zoom/i.test(line)) return 'Telephoto'
  if (/ultra[\s-]?wide|\bUW\b/i.test(line)) return 'Ultra-wide'
  if (/macro/i.test(line)) return 'Macro'
  if (/depth|bokeh/i.test(line)) return 'Depth'
  if (/monochrome|\bmono\b/i.test(line)) return 'Monochrome'
  if (/wide|main|primary/i.test(line) || index === 0) return 'Main'
  return `Camera ${index + 1}`
}

function rearCameras(text: string | null) {
  if (!text) return null
  const lines = text.split('\n').flatMap((line) => ((line.match(/\d\s*MP/gi) ?? []).length > 1 ? line.split(/\s*(?:\+|;|\band\b)\s*(?=[^,]*\d\s*MP)/i) : [line]))
  const cameras = lines.filter((line) => /\d\s*MP/i.test(line)).map((line, index) => {
    const details = line.replace(/^[^\d]*?([\d.]+)\s*MP\s*[,:–-]?\s*/i, '').trim()
    return { name: cameraName(line, index), megapixels: parseNumber(line, /([\d.]+)\s*MP/i), details: short(details, 100) }
  })
  return cameras.length ? cameras : null
}

function specsFrom(get: (key: string) => string | null): PartialSpecs {
  const displayText = flat(get('display'))
  const resolutionText = displayText?.match(/\d{3,4}\s*[×xX]\s*\d{3,4}/)?.[0]
  const resolution = resolutionText ? normalizeResolution(resolutionText) : null
  const chargingText = flat(get('charging')) ?? flat(get('battery'))
  const frontText = flat(get('front_camera') ?? get('front-camera') ?? get('secondary_camera'))
  const dimensionsText = flat(get('dimensions'))
  const everything = ['display', 'water_resistance', 'water_resist', 'other', 'input', 'connectivity', 'networks', 'sim', 'type'].map(get).filter(Boolean).join(' ')
  const parsed: Record<string, unknown> = {}

  if (displayText) {
    const display = {
      sizeInches: parseNumber(displayText, /([\d.]+)\s*(?:inches|inch|in\b|["″])/i),
      resolution: resolution && { width: Math.min(resolution.width, resolution.height), height: Math.max(resolution.width, resolution.height) },
      type: displayText.match(/\b(?:Dynamic\s+AMOLED(?:\s+2X)?|Super\s+Retina(?:\s+XDR)?(?:\s+OLED)?|Super\s+AMOLED(?:\s+Plus)?|Fluid\s+AMOLED|P-?OLED|LTPO\s*\d?(?:\.\d)?\s*(?:AMOLED|OLED)?|AMOLED|OLED|IPS\s+LCD|LTPS\s+LCD|TFT\s+LCD|Liquid\s+Retina(?:\s+HD)?|IPS|LCD)\b/i)?.[0]?.trim() ?? null,
      refreshRateHz: largest(displayText, /(\d+(?:\.\d+)?)\s*Hz/gi),
      brightnessNits: largest(displayText, /([\d,]+)\s*(?:nits?|cd\/m)/gi),
      protection: displayText.match(/(?:Corning\s+)?Gorilla\s+(?:Glass|Armor)(?:\s+(?:Victus\s*\d?\+?|\d+\+?|DX\+?|Armor\s*\d?))*|Ceramic\s+Shield|Dragon\s*Trail(?:\s+(?:Star\s*\d?|Pro|X))?|Kunlun\s+Glass(?:\s*\d)?|Panda\s+Glass|Crystal\s+(?:Shield|Armor)[\w\s]*?(?=,|$)|Armor\s+Glass/i)?.[0]?.trim() ?? null,
    }
    if (Object.values(display).some((value) => value !== null)) parsed.display = display
  }
  const chipset = short(get('soc') ?? get('chipset') ?? get('processor'))
  if (chipset) parsed.chipset = chipset
  const cpu = short(get('cpu')); if (cpu) parsed.cpu = cpu
  const gpu = short(get('gpu')); if (gpu) parsed.gpu = gpu
  const battery = flat(get('battery'))
  const batteryMah = battery ? parseNumber(battery, /([\d,]+)\s*mAh/i) : null
  if (batteryMah) parsed.batteryMah = batteryMah
  const chargingWatts = largest(chargingText, /(\d+(?:\.\d+)?)\s*W\b/g)
  if (chargingWatts) parsed.chargingWatts = chargingWatts
  const rear = rearCameras(get('rear_camera') ?? get('rear-camera') ?? get('primary_camera') ?? get('camera'))
  if (rear) parsed.rearCamera = rear
  if (frontText) parsed.frontCamera = { megapixels: parseNumber(frontText, /([\d.]+)\s*MP/i), details: short(frontText.replace(/^[^\d]*?([\d.]+)\s*MP\s*[,:–-]?\s*/i, ''), 100) }
  const os = short(get('os') ?? get('operating_system'), 80)
  if (os) parsed.os = os.replace(/^(?:Original|Initial|At launch)\s*:\s*/i, '')
  if (dimensionsText) {
    const compact = /([\d.]+)\s*[x×]\s*([\d.]+)\s*[x×]\s*([\d.]+)\s*mm/i.exec(dimensionsText)
    const numbers = compact ? [compact[1], compact[2], compact[3]].map(Number) : [...dimensionsText.matchAll(/([\d.]+)\s*mm/gi)].map((match) => Number(match[1]))
    if (numbers.length >= 3 && numbers.slice(0, 3).every((number) => number > 0)) parsed.dimensionsMm = { height: numbers[0], width: numbers[1], depth: numbers[2] }
  }
  const weight = flat(get('weight'))
  const weightGrams = weight ? parseNumber(weight, /([\d.]+)\s*g\b/) : null
  if (weightGrams) parsed.weightGrams = weightGrams
  const water = everything.match(/\bIP[X\d]\d\b/i)?.[0]
  if (water) parsed.waterRating = water.toUpperCase()
  if (/\b5G\b/.test(flat(get('networks')) ?? '')) parsed.fiveG = true
  if (/\bNFC\b/.test(flat(get('connectivity')) ?? '')) parsed.nfc = true
  if (/\beSIM\b/i.test(flat(get('sim')) ?? '')) parsed.esim = true
  return validateSpecs(parsed).specs
}

const yearIn = (text: string | null) => {
  const years = [...(text ?? '').matchAll(/\b(20[0-3]\d)\b/g)].map((match) => Number(match[1]))
  return years.length ? Math.min(...years) : null
}

/** Every phone described on one Wikipedia page, with its first release year. */
export function parseWikiPhonePage(title: string, wikitext: string): WikiPhone[] {
  if (NOT_PHONES.test(title)) return []
  const raw = infoboxFields(wikitext)
  if (!raw || /tablet|watch|phablet tablet/i.test(raw.type ?? '')) return []
  const fields: Record<string, Segment[]> = {}
  for (const [key, value] of Object.entries(raw)) fields[key] = segments(wikiToText(value))
  const pageName = pageNameOf(title)
  const titleWords = pageName.split(/\s+/)

  const found = new Map<string, string>()
  for (const key of MODEL_FIELDS) {
    for (const segment of fields[key] ?? []) {
      if (!segment.label) continue
      for (const piece of labelPieces(segment.label)) {
        if (REGION_WORDS.test(piece)) continue
        const name = resolveName(piece, titleWords)
        if (name && !found.has(name.toLowerCase())) found.set(name.toLowerCase(), name)
      }
    }
  }
  const variants = found.size ? [...found.values()] : [pageName]

  return variants.flatMap((variant) => {
    const get = (key: string) => valueFor(fields[key], variant, variants, titleWords, key)
    const named = brandAndModel(variant)
    if (!named || !/\d|\bX[SR]?\b|\bAir\b/.test(named.model)) return []
    const released = DATE_FIELDS.map((key) => yearIn(get(key))).find((year) => year !== null)
      ?? DATE_FIELDS.map((key) => yearIn(fields[key]?.map((segment) => segment.text).join(' ') ?? null)).find((year) => year !== null) ?? null
    return [{ ...named, title, released, specs: specsFrom(get) }]
  })
}
