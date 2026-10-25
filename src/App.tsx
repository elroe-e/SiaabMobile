'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp,
  Clock3, CreditCard, MapPin, MessageCircle, PackageCheck, PhoneCall, Search, ShieldCheck, Smartphone,
  Sparkles, Tag, X,
} from 'lucide-react'
import { phones } from './data/phones'
import { defaultFilters, filterPhones, type CatalogFilters } from './lib/filters'
import { estimateTradeIn } from './lib/tradeIn'
import { formatPrice, formatStorage, fullPhoneName } from './lib/format'
import { createWhatsAppUrl, phoneOrderMessage, tradeInMessage } from './lib/whatsapp'
import { visibleColors } from './lib/colors'
import { productAssurances } from './data/assurances'
import { useSpecMode } from './hooks/useSpecMode'
import { useDebounce } from './hooks/useDebounce'
import type { TradeInAnswers, TradeInEstimate, UpcomingPhone } from './types'
import type { Phone } from './types'
import { AdvancedSpecs, FloatingWhatsApp, Footer, Header, KeySpecs, PhoneCard, SectionHeading, SpecSwitcher, StockBadge, TrustStrip } from './components/Storefront'
import { defaultStoreData, StoreDataProvider, useStoreData, type StoreData } from './context/StoreDataContext'

const PhoneContext = createContext<Phone[]>(phones)
const usePhoneData = () => useContext(PhoneContext)

function App({ initialPhones = phones, initialStoreData = defaultStoreData }: { initialPhones?: Phone[]; initialStoreData?: StoreData }) {
  return <StoreDataProvider value={initialStoreData}><StorefrontApp initialPhones={initialPhones} /></StoreDataProvider>
}

function StorefrontApp({ initialPhones }: { initialPhones: Phone[] }) {
  const phoneData = initialPhones
  const { shop } = useStoreData()
  const pathname = usePathname()
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Find your next phone | Siaab Mobile',
      '/phones': 'Shop phones | Siaab Mobile',
      '/upcoming': 'Coming soon | Siaab Mobile',
      '/trade-in': 'Trade in your phone | Siaab Mobile',
      '/about': 'Our story | Siaab Mobile',
      '/contact': 'Visit or contact us | Siaab Mobile',
    }
    const slug = pathname.startsWith('/phones/') ? pathname.split('/').at(-1) : undefined
    const currentPhone = phoneData.find((phone) => phone.slug === slug)
    document.title = currentPhone
      ? `${fullPhoneName(currentPhone.brand, currentPhone.model)} | Siaab Mobile`
      : titles[pathname] ?? 'Page not found | Siaab Mobile'
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = currentPhone
      ? `${fullPhoneName(currentPhone.brand, currentPhone.model)}: price, storage options, warranty information and full specifications at Siaab Mobile.`
      : 'Browse trusted smartphones, compare simple or advanced specifications and get an in-store trade-in estimate at Siaab Mobile in Addis Ababa.'
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = `${shop.siteUrl}${pathname}`
  }, [pathname, phoneData])
  const page = pathname === '/' ? <Home />
    : pathname === '/phones' ? <Catalog />
      : pathname.startsWith('/phones/') ? <PhoneDetail />
        : pathname === '/upcoming' ? <Upcoming />
          : pathname === '/trade-in' ? <TradeIn />
            : pathname === '/about' ? <About />
              : pathname === '/contact' ? <Contact />
                : <NotFound />
  return <PhoneContext.Provider value={phoneData}><Header /><main id="main-content">{page}</main><Footer /><FloatingWhatsApp /></PhoneContext.Provider>
}

function Home() {
  const phones = usePhoneData()
  const { shop, upcomingPhones } = useStoreData()
  const featured = phones.slice(0, 4)
  const brands = [...new Set(phones.map((phone) => phone.brand))]
  const [faq, setFaq] = useState<number | null>(0)
  const [mode, setMode] = useSpecMode()
  const localBusinessSchema = { '@context': 'https://schema.org', '@type': ['LocalBusiness', 'Store'], name: shop.name, description: shop.tagline, telephone: shop.phones[0], email: shop.email, address: { '@type': 'PostalAddress', streetAddress: shop.address, addressLocality: 'Addis Ababa', addressCountry: 'ET' }, openingHours: shop.hours, url: shop.siteUrl }
  return <div className="home-page">
    <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
    <section className="hero-section container">
      <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT PHONE, FOUND</span>
        <h1>A good phone.<br />A <em>great</em> feeling.</h1>
        <p>Find the right device, get honest advice, and make every upgrade a little easier. Right here in Addis.</p>
        <div className="hero-buttons"><Link href="/phones" className="button button-primary">Find your phone <ArrowRight size={17} /></Link><Link href="/trade-in" className="button button-outline">Get trade-in value <ArrowUpRight size={16} /></Link></div>
        <div className="hero-proof"><span className="hero-proof-mark"><MapPin size={14} /></span><span><strong>Good people, good phones.</strong><small>Local advice in the heart of Addis.</small></span></div>
      </div>
      <div className="hero-art" aria-label="A selection of smartphones available at Siaab Mobile">
        <div className="hero-art-glow" /><div className="hero-card-back"><img src={phones[1]?.images[1]} alt="" /></div><div className="hero-card-main"><img src={phones[0]?.images[0]} alt="Featured Samsung Galaxy smartphone" /><div className="hero-art-label"><span>THE EVERYDAY ICON</span><strong>Meet your next.</strong></div></div>
        <div className="hero-float hero-float-warranty"><span className="icon-circle green"><ShieldCheck size={17} /></span><span><strong>12 month</strong><small>warranty included</small></span></div>
        <div className="hero-float hero-float-price"><span className="icon-circle amber"><Tag size={17} /></span><span><strong>Good value.</strong><small>Good as new options</small></span></div>
        <div className="hero-index">01 <span>/</span> 04</div>
      </div>
    </section>
    <div className="container"><TrustStrip /></div>
    <section className="section container featured-section"><SectionHeading eyebrow="A FEW GOOD PICKS" title="Popular right now" text="Thoughtful picks for every kind of upgrade." link="View all phones" to="/phones" /><div className="home-spec-control"><span>See specs in</span><SpecSwitcher mode={mode} onChange={setMode} /></div><div className="phone-grid">{featured.map((phone) => <PhoneCard key={phone.id} phone={phone} mode={mode} />)}</div></section>
    <section className="trade-banner container"><div className="trade-banner-icon"><Smartphone size={25} /></div><div><span className="eyebrow">YOUR OLD PHONE HAS A NEXT CHAPTER</span><h2>Make your old phone part of your new one.</h2><p>Tell us a little about your device and get an instant estimate. Final value is confirmed in store.</p></div><Link href="/trade-in" className="button button-dark">Get my estimate <ArrowRight size={17} /></Link><div className="trade-banner-decoration">↗</div></section>
    <section className="section upcoming-teaser"><div className="container"><SectionHeading eyebrow="ON THE HORIZON" title="A little something to look forward to" text="See what’s coming next. Dates and details are unconfirmed." link="Explore upcoming" to="/upcoming" />
      <div className="upcoming-mini-grid">{upcomingPhones.slice(0, 3).map((item) => <Link href="/upcoming" className="upcoming-mini" key={item.id}><img src={item.image} alt="" loading="lazy" /><div><span className="eyebrow">{item.expectedDate} · COMING SOON</span><h3>{fullPhoneName(item.brand, item.model)}</h3><p>{item.teaser}</p></div><ArrowUpRight size={17} /></Link>)}</div></div></section>
    <section className="section container brand-section"><div className="brand-row-heading"><span className="eyebrow">A NAME YOU LOVE, A PRICE YOU’LL LOVE MORE</span><h2>Find your favorite.</h2></div><div className="brand-row">{brands.map((brand) => <Link href={`/phones?brand=${encodeURIComponent(brand)}`} key={brand}>{brand}</Link>)}</div></section>
    <section className="section faq-section"><div className="container faq-layout"><div><span className="eyebrow">THE IMPORTANT BITS</span><h2>Good questions.<br />Straight answers.</h2><p>Still unsure? Talk to a real person on WhatsApp or visit us in store.</p><a className="text-link" href={createWhatsAppUrl(`Hello ${shop.name}, I have a question.`, shop.whatsapp[0])} target="_blank" rel="noreferrer">Ask us anything <ArrowUpRight size={16} /></a></div><div className="faq-list">{[
      ['Are your phones genuine?', 'Yes. We carefully source our phones and check each device before it reaches the shelf. Ask our team about a specific model any time.'],
      ['Does every phone include a warranty?', 'Most new devices include a 12-month shop warranty. Refurbished devices have a clearly noted warranty period on their product page.'],
      ['Can I trade in a phone that is not listed?', 'Absolutely. Select “Other / not listed” in the estimator and send us a few details. Our team will help with a manual quote.'],
      ['How can I pay for my phone?', 'We do not accept online payments. Pay in person at our shop after checking your chosen phone with our team.'],
      ['Can you deliver?', 'Contact us on WhatsApp to confirm current delivery options and charges for your area.'],
    ].map(([question, answer], index) => <div className={`faq-item ${faq === index ? 'faq-open' : ''}`} key={question}><button type="button" aria-expanded={faq === index} onClick={() => setFaq(faq === index ? null : index)}><span>{question}</span><ChevronDown size={18} /></button>{faq === index && <p>{answer}</p>}</div>)}</div></div></section>
    <section className="visit-strip container"><div className="visit-icon"><MapPin size={21} /></div><div><span className="eyebrow">COME SAY HELLO</span><strong>Find us in Megenagna, Addis Ababa.</strong><small>{shop.address}</small></div><a href={shop.mapUrl} target="_blank" rel="noreferrer" className="button button-light">View on map <ArrowUpRight size={16} /></a></section>
  </div>
}

const priceCeiling = (items: Phone[]) => Math.max(defaultFilters.maxPrice, Math.ceil(Math.max(0, ...items.map((item) => item.price)) / 10000) * 10000)

const readFilters = (params: URLSearchParams, ceiling = defaultFilters.maxPrice): CatalogFilters => ({
  ...defaultFilters,
  search: params.get('q') ?? '',
  brand: params.get('brand') ?? '',
  storage: params.get('storage') ?? '',
  condition: params.get('condition') ?? '',
  availability: params.get('availability') ?? '',
  fiveG: params.get('5g') === 'true',
  minPrice: Number(params.get('min')) || 0,
  maxPrice: Number(params.get('max')) || ceiling,
  sort: params.get('sort') ?? 'popular',
})

function Catalog() {
  const phones = usePhoneData()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ceiling = useMemo(() => priceCeiling(phones), [phones])
  const defaults = useMemo(() => ({ ...defaultFilters, maxPrice: ceiling }), [ceiling])
  const [filters, setFilters] = useState(() => readFilters(searchParams, ceiling))
  const debouncedSearch = useDebounce(filters.search, 250)
  const [mode, setMode] = useSpecMode()
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => {
    const next = readFilters(searchParams, ceiling)
    setFilters(next)
  }, [searchParams, ceiling])
  const results = useMemo(() => filterPhones(phones, { ...filters, search: debouncedSearch }), [filters, debouncedSearch])
  const update = (key: keyof CatalogFilters, value: string | number | boolean) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    const params = new URLSearchParams()
    const keys: [keyof CatalogFilters, string][] = [['search', 'q'], ['brand', 'brand'], ['storage', 'storage'], ['condition', 'condition'], ['availability', 'availability'], ['minPrice', 'min'], ['maxPrice', 'max'], ['sort', 'sort'], ['fiveG', '5g']]
    for (const [stateKey, param] of keys) {
      const current = next[stateKey]
      if (current !== defaults[stateKey] && current !== '' && current !== false) params.set(param, String(current))
    }
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false })
  }
  const clear = () => { setFilters(defaults); router.replace(pathname, { scroll: false }) }
  const brands = [...new Set(phones.map((phone) => phone.brand))]
  const filterPanel = <div className="filter-panel">
    <div className="filter-panel-head"><strong>Refine your search</strong><button type="button" className="text-button" onClick={clear}>Clear all</button></div>
    <label className="field-label">Brand<select value={filters.brand} onChange={(event) => update('brand', event.target.value)}><option value="">All brands</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
    <label className="field-label">Storage<select value={filters.storage} onChange={(event) => update('storage', event.target.value)}><option value="">Any storage</option><option value="128">128 GB or more</option><option value="256">256 GB or more</option><option value="512">512 GB or more</option></select></label>
    <div className="filter-group"><span className="field-label">Price range</span><div className="price-range-labels"><span>Br {filters.minPrice.toLocaleString()}</span><span>Br {filters.maxPrice.toLocaleString()}</span></div><input aria-label="Maximum price" type="range" min="0" max={ceiling} step="5000" value={filters.maxPrice} onChange={(event) => update('maxPrice', Number(event.target.value))} /></div>
    <label className="field-label">Condition<select value={filters.condition} onChange={(event) => update('condition', event.target.value)}><option value="">Any condition</option><option value="new">New</option><option value="refurbished">Refurbished</option></select></label>
    <label className="field-label">Availability<select value={filters.availability} onChange={(event) => update('availability', event.target.value)}><option value="">All phones</option><option value="in_stock">In stock</option><option value="low_stock">Few left</option><option value="out_of_stock">Sold out</option></select></label>
    <label className="checkbox-line"><input type="checkbox" checked={filters.fiveG} onChange={(event) => update('fiveG', event.target.checked)} /> 5G capable</label>
  </div>
  return <div className="container page-container catalog-page">
    <div className="page-intro"><div><span className="eyebrow">THE PHONE EDIT</span><h1>Find the one.</h1><p>Explore trusted picks, compare the details, and find a fit for the way you live.</p></div><div className="page-intro-note"><ShieldCheck size={18} /><span>Every phone, backed by<br /><strong>real local support.</strong></span></div></div>
    <div className="catalog-toolbar"><label className="search-field"><Search size={18} /><span className="sr-only">Search by brand or model</span><input value={filters.search} onChange={(event) => update('search', event.target.value)} placeholder="Search a brand or model" /></label><div className="catalog-toolbar-actions"><button className="button button-light filter-open" type="button" onClick={() => setFiltersOpen(true)}>Filters <span className="filter-count">{Number(Boolean(filters.brand)) + Number(Boolean(filters.condition)) + Number(filters.fiveG)}</span></button><label className="sort-select"><span className="sr-only">Sort phones</span><select value={filters.sort} onChange={(event) => update('sort', event.target.value)}><option value="popular">Most popular</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="newest">Newest added</option></select></label></div></div>
    <div className="catalog-layout"><aside className="catalog-sidebar">{filterPanel}</aside><div className="catalog-results"><div className="brand-chips" role="group" aria-label="Filter by brand"><button type="button" className={!filters.brand ? 'active' : ''} aria-pressed={!filters.brand} onClick={() => update('brand', '')}>All</button>{brands.map((brand) => <button key={brand} type="button" className={filters.brand === brand ? 'active' : ''} aria-pressed={filters.brand === brand} onClick={() => update('brand', filters.brand === brand ? '' : brand)}>{brand}</button>)}</div><div className="results-heading"><span><strong>{results.length}</strong> phones for you</span><div className="spec-mode-control"><span>Specs:</span><SpecSwitcher mode={mode} onChange={setMode} /></div></div>
      {results.length ? <><h2 className="sr-only">Phones</h2><div className="phone-grid">{results.map((phone) => <PhoneCard key={phone.id} phone={phone} mode={mode} />)}</div></> : <div className="empty-state"><span className="empty-icon"><Search size={23} /></span><h2>No phones found. Yet.</h2><p>Try another search or clear a filter to see more of our collection.</p><button type="button" onClick={clear} className="button button-primary">Clear filters</button></div>}
    </div></div>
    {filtersOpen && <div className="sheet-backdrop" onClick={() => setFiltersOpen(false)}><div className="mobile-filter-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><h2>Filters</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X /></button></div>{filterPanel}<button type="button" className="button button-primary sheet-apply" onClick={() => setFiltersOpen(false)}>Show {results.length} phones</button></div></div>}
  </div>
}

function PhoneDetail() {
  const phones = usePhoneData()
  const { shop } = useStoreData()
  const pathname = usePathname()
  const slug = pathname.split('/').at(-1)
  const phone = phones.find((item) => item.slug === slug)
  const [mode, setMode] = useSpecMode()
  const [storage, setStorage] = useState(phone?.storageOptions[0]?.gb ?? 128)
  const [gallery, setGallery] = useState(0)
  const [zoom, setZoom] = useState(false)
  const touchStart = useRef<number | null>(null)
  useEffect(() => {
    if (!phone) return
    setStorage(phone.storageOptions[0]?.gb ?? 128)
    setGallery(0)
  }, [phone?.id])
  useEffect(() => {
    if (!zoom) return
    const dialog = document.querySelector<HTMLElement>('.zoom-overlay')
    const buttons = () => dialog?.querySelectorAll<HTMLButtonElement>('button')
    buttons()?.[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoom(false)
      if (event.key === 'ArrowRight') setGallery((current) => (current + 1) % (phone?.images.length ?? 1))
      if (event.key === 'ArrowLeft') setGallery((current) => (current + (phone?.images.length ?? 1) - 1) % (phone?.images.length ?? 1))
      if (event.key === 'Tab') {
        const items = buttons()
        const first = items?.[0]
        const last = items?.[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom, phone?.images.length])
  if (!phone) return <NotFound />
  const selected = phone.storageOptions.find((option) => option.gb === storage) ?? phone.storageOptions[0]!
  const orderMessage = phone.stock === 'out_of_stock'
    ? `Hello ${shop.name}, please let me know when ${fullPhoneName(phone.brand, phone.model)} is back in stock.`
    : phoneOrderMessage(`${fullPhoneName(phone.brand, phone.model)}`, formatStorage(selected.gb), formatPrice(selected.price), `${shop.siteUrl}${pathname}`, shop.name)
  const orderUrl = createWhatsAppUrl(orderMessage, shop.whatsapp[0])
  const similar = phones.filter((item) => item.id !== phone.id && (item.brand === phone.brand || Math.abs(item.price - phone.price) < 16000)).slice(0, 4)
  const productSchema = { '@context': 'https://schema.org', '@type': 'Product', name: `${fullPhoneName(phone.brand, phone.model)}`, description: `${fullPhoneName(phone.brand, phone.model)} available at Siaab Mobile in Addis Ababa.`, brand: { '@type': 'Brand', name: phone.brand }, offers: { '@type': 'Offer', priceCurrency: 'ETB', price: selected.price, availability: phone.stock === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' } }
  return <div className="container page-container detail-page">
    <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/phones">Phones</Link><span>/</span><span>{fullPhoneName(phone.brand, phone.model)}</span></nav>
    <div className="detail-layout"><div className="gallery-column"><button className="gallery-main" type="button" onClick={() => setZoom(true)} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }} onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (touchStart.current !== null && end !== undefined && Math.abs(end - touchStart.current) > 45) setGallery((current) => (current + (end < touchStart.current! ? 1 : phone.images.length - 1)) % phone.images.length); touchStart.current = null }} aria-label="Enlarge phone photo; swipe to change photos"><img src={phone.images[gallery]} alt={`${fullPhoneName(phone.brand, phone.model)}, view ${gallery + 1}`} /><span className="zoom-hint">Click to zoom <ArrowUpRight size={14} /></span></button><div className="gallery-thumbnails">{phone.images.map((image, index) => <button key={image} className={gallery === index ? 'selected' : ''} type="button" onClick={() => setGallery(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={gallery === index}><img src={image} alt="" /></button>)}</div></div>
      <div className="detail-info"><span className="eyebrow">{phone.brand.toUpperCase()} · {phone.condition === 'new' ? 'BRAND NEW' : 'REFURBISHED'}</span><h1>{phone.model}</h1><div className="detail-badges">{phone.badges.map((badge) => <span key={badge} className="pill">{badge}</span>)}<StockBadge stock={phone.stock} count={phone.stockCount} /></div><div className="detail-price"><strong>{formatPrice(selected.price)}</strong>{phone.oldPrice && <del>{formatPrice(phone.oldPrice)}</del>}<span>Price confirmed in store</span></div><ul className="assurance-list">{productAssurances.map((line) => <li key={line}><Check size={15} />{line}</li>)}</ul>
        {visibleColors(phone.colors).length > 0 && <div className="detail-option"><div className="option-heading"><strong>Available colors</strong></div><ul className="color-list">{visibleColors(phone.colors).map((item) => <li key={item.name}><span className="color-dot" style={{ '--swatch': item.hex } as CSSProperties} aria-hidden="true" />{item.name}</li>)}</ul></div>}
        <div className="detail-option"><div className="option-heading"><strong>Storage</strong><span>Choose capacity</span></div><div className="storage-options">{phone.storageOptions.map((option) => <button key={option.gb} className={`storage-option ${storage === option.gb ? 'selected' : ''}`} type="button" onClick={() => setStorage(option.gb)} aria-pressed={storage === option.gb}><span>{formatStorage(option.gb)}</span><strong>{formatPrice(option.price)}</strong></button>)}</div></div>
        <div className="detail-warranty"><ShieldCheck size={18} /><span><strong>{phone.warrantyMonths}-month warranty</strong><small>Included with your purchase</small></span><Check size={16} /></div>
        <div className="detail-actions"><a href={orderUrl} target="_blank" rel="noreferrer" className={`button button-whatsapp button-large ${phone.stock === 'out_of_stock' ? 'button-disabled' : ''}`}><MessageCircle size={18} />{phone.stock === 'out_of_stock' ? 'Ask when it’s back' : 'Order on WhatsApp'}</a><a href={`tel:${shop.phones[0]}`} className="button button-outline button-large"><PhoneCall size={17} />Call the shop</a></div>
        <Link className="detail-trade-link" href={`/trade-in?target=${phone.slug}`}><Smartphone size={17} />Trade in your old phone toward this one <ArrowRight size={16} /></Link>
        <p className="detail-small-note"><ShieldCheck size={14} /> No online payment. Confirm availability with our team.</p>
      </div></div>
    <section className="detail-specs-section"><div className="spec-heading-row"><div><span className="eyebrow">GET TO KNOW IT</span><h2>All the details.</h2><p>Pick the level of detail that’s right for you.</p></div><SpecSwitcher mode={mode} onChange={setMode} /></div>{mode === 'simple' ? <div className="detail-simple-specs"><KeySpecs phone={phone} mode="simple" /></div> : <AdvancedSpecs phone={phone} />}</section>
    {similar.length > 0 && <section className="section similar-section"><SectionHeading eyebrow="YOU MIGHT ALSO LIKE" title="A few close contenders" /><div className="phone-grid">{similar.map((item) => <PhoneCard key={item.id} phone={item} mode={mode} />)}</div></section>}
    <div className="mobile-sticky-order"><div><span>{formatPrice(selected.price)}</span><small>{phone.model}</small></div><a href={orderUrl} target="_blank" rel="noreferrer" className="button button-whatsapp"><MessageCircle size={17} />WhatsApp</a></div>
    {zoom && <div className="zoom-overlay" role="dialog" aria-modal="true" aria-label={`${phone.model} image viewer`} onClick={() => setZoom(false)}><button className="zoom-close" aria-label="Close image viewer" onClick={() => setZoom(false)}><X /></button><button className="zoom-arrow zoom-prev" aria-label="Previous image" onClick={(event) => { event.stopPropagation(); setGallery((gallery + phone.images.length - 1) % phone.images.length) }}><ArrowLeft /></button><img src={phone.images[gallery]} alt={`${fullPhoneName(phone.brand, phone.model)}`} onClick={(event) => event.stopPropagation()} /><button className="zoom-arrow zoom-next" aria-label="Next image" onClick={(event) => { event.stopPropagation(); setGallery((gallery + 1) % phone.images.length) }}><ArrowRight /></button></div>}
  </div>
}

function Upcoming() {
  const { shop, upcomingPhones } = useStoreData()
  const [selected, setSelected] = useState<UpcomingPhone | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const notifyTrigger = useRef<HTMLButtonElement | null>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!selected) return
    const focusable = () => dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])')
    focusable()?.[1]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items?.[0]
      const last = items?.[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selected])
  const close = () => {
    setSelected(null)
    setError('')
    window.setTimeout(() => notifyTrigger.current?.focus(), 0)
  }
  const notify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !name.trim() || !contact.trim()) {
      setError('Please add your name and one way to reach you.')
      return
    }
    const message = `Hello ${shop.name}, please let me know when ${fullPhoneName(selected.brand, selected.model)} is available.\nName: ${name.trim()}\nContact: ${contact.trim()}`
    const popup = window.open(createWhatsAppUrl(message, shop.whatsapp[0]), '_blank', 'noopener,noreferrer')
    void fetch('/api/leads', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'notify_me', name: name.trim(), contact: contact.trim(), payload: { model: `${fullPhoneName(selected.brand, selected.model)}` } }),
    }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        window.alert(result.error ?? 'Your WhatsApp message is ready, but the request was not saved to the shop inbox.')
      }
    }).catch(() => window.alert('Your WhatsApp message is ready, but the request could not be saved to the shop inbox.'))
    if (!popup) window.location.assign(createWhatsAppUrl(message, shop.whatsapp[0]))
    close()
    setName('')
    setContact('')
  }
  return <div className="container page-container upcoming-page">
    <div className="page-intro"><div><span className="eyebrow">A SNEAK PEEK</span><h1>Coming into view.</h1><p>Keep an eye on these upcoming devices. We’ll share news as soon as we have it.</p></div><span className="notice-badge"><Sparkles size={17} />Dates & specs are unconfirmed</span></div>
    <div className="upcoming-grid">{[...upcomingPhones].sort((a, b) => a.dateSort.localeCompare(b.dateSort)).map((phone) => <article className="upcoming-card" key={phone.id}><div className="upcoming-art"><img src={phone.image} alt={`${fullPhoneName(phone.brand, phone.model)} concept artwork`} loading="lazy" /><span className="pill">Coming soon</span><span className="upcoming-date">{phone.expectedDate}</span></div><div className="upcoming-card-content"><span className="eyebrow">{phone.brand.toUpperCase()} · EXPECTED {phone.expectedDate.toUpperCase()}</span><h2>{phone.model}</h2><p>{phone.teaser}</p><div className="rumor-list">{phone.keyRumoredSpecs.map((spec) => <span key={spec}><span />{spec}</span>)}</div><div className="upcoming-price"><small>Expected price range</small><strong>{phone.expectedPriceRange}</strong></div><button type="button" className="button button-outline button-full" onClick={(event) => { notifyTrigger.current = event.currentTarget; setSelected(phone) }}>Let me know when it’s here <ArrowRight size={16} /></button></div></article>)}</div>
    <div className="upcoming-disclaimer"><CircleHelp size={19} /><p><strong>A note about upcoming phones</strong><br />Dates, prices and specifications are indicative only and can change. Availability and details are not confirmed until the shop verifies local stock.</p></div>
    {selected && <div className="modal-backdrop" onClick={close}><section ref={dialogRef} className="notify-modal" role="dialog" aria-modal="true" aria-labelledby="notify-title" onClick={(event) => event.stopPropagation()}><button type="button" aria-label="Close dialog" className="modal-close" onClick={close}><X /></button><span className="eyebrow">KEEP ME IN THE LOOP</span><h2 id="notify-title">A heads-up, when it’s here.</h2><p>Leave your details and we’ll send a message to the shop so the team can follow up when <strong>{fullPhoneName(selected.brand, selected.model)}</strong> arrives.</p><form onSubmit={notify}><label className="field-label">Your name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="field-label">Phone, Telegram or email<input value={contact} onChange={(event) => setContact(event.target.value)} required placeholder="+251 … / @username / email" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button button-whatsapp button-full"><MessageCircle size={17} />Send my request</button><small className="modal-privacy">This opens WhatsApp so you can review the message before sending. We don’t store your details.</small></form></section></div>}
  </div>
}

const defaultAnswers: TradeInAnswers = {
  condition: 'good', screen: 'perfect', body: 'perfect', battery: 'unknown',
  powersOn: true, issues: [], accessories: 'phone_only', locked: false,
}
const conditionOptions = {
  condition: [['like_new', 'Like new'], ['good', 'Good'], ['fair', 'Fair'], ['poor', 'Poor']],
  screen: [['perfect', 'Perfect'], ['light_scratches', 'Light scratches'], ['cracked', 'Cracked']],
  body: [['perfect', 'Perfect'], ['scratched', 'Dents or scratches'], ['cracked_bent', 'Cracked or bent']],
  battery: [['90_plus', '90% or more'], ['80_89', '80–89%'], ['below_80', 'Below 80%'], ['unknown', 'I don’t know']],
  accessories: [['full', 'Box and charger'], ['phone_only', 'Phone only']],
} as const
const issueOptions = ['Camera', 'Speaker', 'Microphone', 'Buttons', 'Charging port', 'Face ID / fingerprint', 'Touch screen']
export function TradeIn() {
  const phones = usePhoneData()
  const { shop, tradeInValues, tradeInConfig } = useStoreData()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [storage, setStorage] = useState('')
  const [otherModel, setOtherModel] = useState('')
  const [query, setQuery] = useState('')
  const [answers, setAnswers] = useState<TradeInAnswers>(defaultAnswers)
  const [answered, setAnswered] = useState<string[]>([])
  const [error, setError] = useState('')
  const [targetSlug, setTargetSlug] = useState(searchParams.get('target') ?? '')
  const [manualName, setManualName] = useState('')
  const [manualContact, setManualContact] = useState('')
  const [manualSent, setManualSent] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [bookName, setBookName] = useState('')
  const [bookContact, setBookContact] = useState('')
  const [mode, setMode] = useState<'estimate' | 'manual' | 'result'>('estimate')
  const brands = [...new Set(tradeInValues.map((item) => item.brand))]
  const models = [...new Set(tradeInValues.filter((item) => item.brand === brand).map((item) => item.model))]
  const isOther = model === '__other__'
  const modelOptions = models.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
  const tradeInItem = tradeInValues.find((item) => item.brand === brand && item.model === model && item.storageGb === Number(storage))
  const estimate = useMemo<TradeInEstimate | null>(() => tradeInItem ? estimateTradeIn(tradeInItem.baseValue, answers, tradeInConfig) : null, [tradeInItem, answers, tradeInConfig])
  const changeAnswer = <K extends keyof TradeInAnswers>(key: K, value: TradeInAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }))
    setAnswered((current) => current.includes(key) ? current : [...current, key])
  }
  const picked = (key: string) => answered.includes(key)
  const bookInspection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!estimate || !bookName.trim() || !bookContact.trim()) return
    const message = tradeInMessage(`${fullPhoneName(brand, model)}`, `${storage} GB`, answers, estimate, shop.name)
    const url = createWhatsAppUrl(`${message}
Name: ${bookName.trim()}
Contact: ${bookContact.trim()}`, shop.whatsapp[0])
    const popup = window.open(url, '_blank', 'noopener,noreferrer')
    void fetch('/api/leads', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'trade_in', name: bookName.trim(), contact: bookContact.trim(), payload: { model: `${fullPhoneName(brand, model)}`, storageGb: Number(storage), answers, estimate: estimate.estimate, target: target?.model } }),
    }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        window.alert(result.error ?? 'Your WhatsApp message is ready, but the request was not saved to the shop inbox.')
      }
    }).catch(() => window.alert('Your WhatsApp message is ready, but the request could not be saved to the shop inbox.'))
    if (!popup) window.location.assign(url)
  }
  const validateStep = () => {
    if (step === 1 && (!brand || !model || (!isOther && !storage))) {
      setError('Choose a brand, model and storage to continue.')
      return false
    }
    if (step === 2 && ['condition', 'screen', 'body', 'battery', 'accessories', 'powersOn', 'locked'].some((key) => !answered.includes(key))) {
      setError('Answer each condition question to continue.')
      return false
    }
    if (step === 2 && !answers.powersOn && answers.issues.length === 0) {
      setError('Choose at least one functional issue, or mark the phone as fully functional.')
      return false
    }
    setError('')
    return true
  }
  const next = () => {
    if (!validateStep()) return
    if (step === 1 && isOther) { setMode('manual'); return }
    if (step === 2) { setStep(3); return }
    setStep(Math.min(3, step + 1))
  }
  const reset = () => {
    setStep(1); setBrand(''); setModel(''); setStorage(''); setOtherModel(''); setQuery('')
    setAnswers(defaultAnswers); setAnswered([]); setError(''); setMode('estimate'); setManualSent(false)
  }
  const manualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = `Hello ${shop.name}, I need a manual trade-in quote.\nPhone: ${brand} ${otherModel || 'model not listed'}\nName: ${manualName}\nContact: ${manualContact}`
    const url = createWhatsAppUrl(text, shop.whatsapp[0])
    const popup = window.open(url, '_blank', 'noopener,noreferrer')
    void fetch('/api/leads', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'trade_in', name: manualName.trim(), contact: manualContact.trim(), payload: { model: `${brand} ${otherModel || 'not listed'}`, request: 'Manual trade-in quote' } }),
    }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        window.alert(result.error ?? 'Your WhatsApp message is ready, but your request was not saved to the shop inbox.')
      }
    }).catch(() => window.alert('Your WhatsApp message is ready, but your request could not be saved to the shop inbox.'))
    if (!popup) window.location.assign(url)
    setManualSent(true)
  }
  const target = phones.find((phone) => phone.slug === targetSlug)
  const targetPrice = target?.storageOptions[0]?.price ?? target?.price ?? 0
  const tradeValue = estimate?.estimate ?? 0
  return <div className="container page-container trade-page">
    <div className="trade-intro"><span className="eyebrow"><span className="eyebrow-dot" /> GOODBYE OLD PHONE, HELLO NEXT</span><h1>Give your old phone<br />a <em>new beginning.</em></h1><p>Answer a few quick questions and see what your phone could be worth toward your next upgrade.</p><div className="trade-trust"><span><Check size={15} />Takes about 2 minutes</span><span><Check size={15} />No obligation, ever</span></div></div>
    <div className="trade-layout"><aside className="trade-aside"><div className="trade-aside-illustration"><div className="trade-phone-shape"><Smartphone size={41} /></div><div className="trade-sparkle">✦</div><div className="trade-orbit" /></div><span className="eyebrow">HOW IT WORKS</span><h2>A better way to upgrade.</h2><ol className="trade-steps-list"><li className={step === 1 ? 'active' : ''}><span>01</span><div><strong>Tell us about it</strong><small>Model, storage and condition.</small></div></li><li className={step === 2 ? 'active' : ''}><span>02</span><div><strong>Answer a few questions</strong><small>It helps us estimate fairly.</small></div></li><li className={step === 3 ? 'active' : ''}><span>03</span><div><strong>See your estimate</strong><small>Then bring it by for a check.</small></div></li></ol><div className="trade-aside-note"><ShieldCheck size={18} /><p><strong>Good to know</strong><br />Your estimate is a guide. A final offer is confirmed after an in-store inspection.</p></div></aside>
      <section className="trade-form-card" aria-live="polite">
        {mode === 'manual' ? <div className="manual-quote"><button type="button" className="back-link" onClick={() => { setMode('estimate'); setError('') }}><ArrowLeft size={16} />Back to phone details</button>{manualSent ? <div className="manual-success"><span className="success-icon"><Check /></span><h2>Your message is ready.</h2><p>WhatsApp opened with your details. Send it to our team and we’ll get back to you with a manual quote.</p><button type="button" className="button button-primary" onClick={reset}>Start another estimate</button></div> : <><span className="eyebrow">WE’LL TAKE IT FROM HERE</span><h2>Let’s find out together.</h2><p>We don’t have a set value for that model yet. Share a few details and our team will personally help you.</p><form onSubmit={manualSubmit} className="manual-form"><label className="field-label">Phone model<input value={otherModel} onChange={(event) => setOtherModel(event.target.value)} placeholder="Brand, model and storage if known" required /></label><label className="field-label">Your name<input value={manualName} onChange={(event) => setManualName(event.target.value)} autoComplete="name" required /></label><label className="field-label">Phone, Telegram or email<input value={manualContact} onChange={(event) => setManualContact(event.target.value)} required placeholder="+251 … / @username / email" /></label><button type="submit" className="button button-whatsapp"><MessageCircle size={17} />Ask for a manual quote</button></form></>}</div> :
          <>
            <div className="progress-header"><div><span className="eyebrow">YOUR TRADE-IN ESTIMATE</span><span className="step-count">STEP {step} OF 3</span></div><div className="progress-track"><span style={{ width: `${step * 33.333}%` }} /></div><div className="progress-labels"><span className={step >= 1 ? 'current' : ''}>Phone</span><span className={step >= 2 ? 'current' : ''}>Condition</span><span className={step >= 3 ? 'current' : ''}>Estimate</span></div></div>
            {step === 1 && <div className="trade-step-content"><span className="step-icon"><Smartphone size={20} /></span><h2>First, what are we looking at?</h2><p>Pick your current phone to get started.</p><label className="field-label">Brand<select value={brand} onChange={(event) => { setBrand(event.target.value); setModel(''); setStorage(''); setQuery('') }}><option value="">Choose a brand</option>{brands.map((item) => <option key={item}>{item}</option>)}<option value="Other">Other brand</option></select></label>
              {brand && brand !== 'Other' && <><label className="field-label">Model<input value={query || model} onChange={(event) => { const value = event.target.value; setQuery(value); setModel(models.includes(value) ? value : value === 'Other / not listed' ? '__other__' : ''); setStorage('') }} placeholder="Search or choose a model" list="model-options" autoComplete="off" /><datalist id="model-options">{modelOptions.map((item) => <option key={item} value={item} />)}<option value="Other / not listed" /></datalist></label><div className="model-quick-picks">{modelOptions.slice(0, 4).map((item) => <button key={item} type="button" className={model === item ? 'selected' : ''} onClick={() => { setModel(item); setQuery(item); setStorage('') }}>{item}</button>)}<button type="button" className={isOther ? 'selected' : ''} onClick={() => { setModel('__other__'); setQuery(''); setStorage('') }}>Other / not listed</button></div></>}
              {(brand === 'Other' || isOther) && <div className="not-listed-note"><CircleHelp size={17} /><span>That’s okay! Our team can still help. We’ll ask for a few details to prepare a manual quote.</span></div>}
              {brand && model && !isOther && <label className="field-label">Storage<select value={storage} onChange={(event) => setStorage(event.target.value)}><option value="">Choose storage</option>{tradeInValues.filter((item) => item.brand === brand && item.model === model).map((item) => <option key={item.storageGb} value={item.storageGb}>{item.storageGb} GB</option>)}{!tradeInValues.some((item) => item.brand === brand && item.model === model) && <option value="128">128 GB</option>}</select></label>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="button" className="button button-primary button-full trade-next" onClick={() => { if (brand === 'Other') { setMode('manual'); return } if (model === 'Other / not listed') setModel('__other__'); next() }}>Continue <ArrowRight size={17} /></button>
            </div>}
            {step === 2 && <div className="trade-step-content"><button type="button" className="back-link" onClick={() => setStep(1)}><ArrowLeft size={15} />Back</button><span className="step-icon"><ShieldCheck size={20} /></span><h2>Let’s check its condition.</h2><p>A few honest answers help us make a fair estimate.</p>
              {(Object.entries(conditionOptions) as [keyof typeof conditionOptions, readonly (readonly [string, string])[]][]).map(([field, options]) => <fieldset className="choice-field" key={field}><legend>{field === 'condition' ? 'Overall condition' : field === 'screen' ? 'Screen' : field === 'body' ? 'Back & body' : field === 'battery' ? 'Battery health' : 'Accessories'}</legend><div className={`choice-grid ${options.length === 4 ? 'four' : ''}`}>{options.map(([value, label]) => <label key={value} className={`choice-card ${picked(field) && answers[field] === value ? 'selected' : ''}`}><input type="radio" name={field} checked={picked(field) && answers[field] === value} onChange={() => {
                if (field === 'condition') changeAnswer('condition', value as TradeInAnswers['condition'])
                else if (field === 'screen') changeAnswer('screen', value as TradeInAnswers['screen'])
                else if (field === 'body') changeAnswer('body', value as TradeInAnswers['body'])
                else if (field === 'battery') changeAnswer('battery', value as TradeInAnswers['battery'])
                else changeAnswer('accessories', value as TradeInAnswers['accessories'])
              }} /><span>{label}</span>{picked(field) && answers[field] === value && <Check size={14} />}</label>)}</div></fieldset>)}
              <fieldset className="choice-field"><legend>Does it power on and work fully?</legend><div className="choice-grid two"><label className={`choice-card ${picked('powersOn') && answers.powersOn ? 'selected' : ''}`}><input type="radio" name="power" checked={picked('powersOn') && answers.powersOn} onChange={() => changeAnswer('powersOn', true)} /><span>Yes, fully</span>{picked('powersOn') && answers.powersOn && <Check size={14} />}</label><label className={`choice-card ${picked('powersOn') && !answers.powersOn ? 'selected' : ''}`}><input type="radio" name="power" checked={picked('powersOn') && !answers.powersOn} onChange={() => changeAnswer('powersOn', false)} /><span>It has issues</span>{picked('powersOn') && !answers.powersOn && <Check size={14} />}</label></div>{!answers.powersOn && <div className="issue-options">{issueOptions.map((issue) => <label key={issue}><input type="checkbox" checked={answers.issues.includes(issue)} onChange={(event) => changeAnswer('issues', event.target.checked ? [...answers.issues, issue] : answers.issues.filter((item) => item !== issue))} />{issue}</label>)}</div>}</fieldset>
              <fieldset className="choice-field"><legend>Is it locked to an account or carrier?</legend><div className="choice-grid two"><label className={`choice-card ${picked('locked') && !answers.locked ? 'selected' : ''}`}><input type="radio" name="locked" checked={picked('locked') && !answers.locked} onChange={() => changeAnswer('locked', false)} /><span>No, it’s unlocked</span>{picked('locked') && !answers.locked && <Check size={14} />}</label><label className={`choice-card ${picked('locked') && answers.locked ? 'selected' : ''}`}><input type="radio" name="locked" checked={picked('locked') && answers.locked} onChange={() => changeAnswer('locked', true)} /><span>Yes, it’s locked</span>{picked('locked') && answers.locked && <Check size={14} />}</label></div>{answers.locked && <p className="locked-warning" role="alert"><CircleHelp size={16} />Locked phones can’t be accepted until they are fully unlocked.</p>}</fieldset>
              {error && <p className="form-error" role="alert">{error}</p>}<button type="button" className="button button-primary button-full trade-next" onClick={next}>See my estimate <ArrowRight size={17} /></button>
            </div>}
            {step === 3 && estimate && <div className="trade-result"><button type="button" className="back-link" onClick={() => setStep(2)}><ArrowLeft size={15} />Back to condition</button><div className={`estimate-hero ${!estimate.eligible ? 'estimate-ineligible' : ''}`}><span className="eyebrow">{estimate.eligible ? 'YOUR ESTIMATED TRADE-IN VALUE' : 'TRADE-IN STATUS'}</span>{estimate.eligible ? <><strong>{formatPrice(estimate.estimate ?? 0)}</strong><span className="estimate-range">{formatPrice(estimate.min ?? 0)} – {formatPrice(estimate.max ?? 0)}</span><small>Estimated value range</small></> : <><strong className="ineligible-title">Not eligible yet</strong><span className="estimate-range">Unlock this phone first</span><small>We can only accept unlocked devices.</small></>}</div>
              {estimate.eligible && <><div className="estimate-breakdown"><div><strong>Estimate breakdown</strong><span>Starting value: {formatPrice(estimate.baseValue)}</span></div>{estimate.deductions.length ? estimate.deductions.map((deduction) => <div key={deduction.label}><span>{deduction.label}</span><span>− {formatPrice(deduction.amount)}</span></div>) : <div><span>Excellent condition</span><span>No deductions</span></div>}</div><p className="estimate-disclaimer">Estimate only. Final value is confirmed after an in-store inspection.</p></>}
              {target && estimate.eligible && <div className="trade-target"><span className="eyebrow">PUT IT TOWARD SOMETHING NEW</span><label className="field-label">Choose a phone<select value={targetSlug} onChange={(event) => setTargetSlug(event.target.value)}>{phones.map((phone) => <option key={phone.slug} value={phone.slug}>{fullPhoneName(phone.brand, phone.model)}</option>)}</select></label><div><span>{formatPrice(targetPrice)} − {formatPrice(tradeValue)}</span><strong>≈ {formatPrice(Math.max(0, targetPrice - tradeValue))}</strong></div><small>Estimated balance after trade-in. Subject to inspection.</small></div>}
              {bookOpen ? <form className="trade-book" onSubmit={bookInspection}><label className="field-label">Your name<input autoComplete="name" value={bookName} onChange={(event) => setBookName(event.target.value)} required /></label><label className="field-label">Phone, Telegram or email<input value={bookContact} onChange={(event) => setBookContact(event.target.value)} required placeholder="+251 … / @username / email" /></label><button type="submit" className="button button-whatsapp button-full"><MessageCircle size={17} />Send on WhatsApp</button></form> : <button type="button" onClick={() => setBookOpen(true)} className="button button-whatsapp button-full"><MessageCircle size={17} />Book an inspection on WhatsApp</button>}<button type="button" className="button button-outline button-full" onClick={() => { if (!target) setTargetSlug(phones[0]?.slug ?? '') }}><CreditCard size={17} />{target ? 'Estimated price above' : 'Use this toward a new phone'}</button><button type="button" className="text-button start-over" onClick={reset}>Start over</button>
            </div>}
          </>}
      </section>
    </div>
    <div className="trade-footnote"><ShieldCheck size={17} /><span>Your details stay yours. This estimate isn’t a final offer; our team confirms value after inspecting the phone in person.</span></div>
  </div>
}

function About() {
  const phones = usePhoneData()
  const { shop } = useStoreData()
  return <div className="container page-container story-page">
    <section className="story-hero"><span className="eyebrow"><span className="eyebrow-dot" /> ROOTED IN ADDIS, HERE FOR YOU</span><h1>Phones are personal.<br /><em>Shopping should be too.</em></h1><p>At Siaab Mobile, we believe finding a phone should feel simple, honest and just a little exciting.</p><Link href="/phones" className="button button-primary">Meet the collection <ArrowRight size={17} /></Link><div className="story-art" aria-label="Smartphone illustration"><img src={phones[0]?.images[1]} alt="A thoughtfully sourced smartphone" /></div></section>
    <section className="story-section"><div><span className="eyebrow">WHY WE’RE HERE</span><h2>A friendly face for your next upgrade.</h2></div><div className="story-copy"><p>Phones are how we connect, create and get through the day. But choosing one can be overwhelming. We started Siaab Mobile to make the experience feel more human: useful guidance, carefully chosen devices and a real person ready to help.</p><p>We’re proud to be part of the Megenagna neighborhood. Whether you’re shopping for a first smartphone, replacing a well-loved device or curious about a trade-in, you’ll find us ready to listen.</p><a href={shop.mapUrl} target="_blank" rel="noreferrer" className="text-link">Come meet us in person <ArrowUpRight size={16} /></a></div></section>
    <section className="values-grid"><article><span className="value-icon"><ShieldCheck /></span><span className="eyebrow">01 · GOOD ADVICE</span><h3>Honest, always.</h3><p>Clear answers about condition, price and warranty. If we don’t know, we’ll say so.</p></article><article><span className="value-icon"><PackageCheck /></span><span className="eyebrow">02 · CAREFULLY CHOSEN</span><h3>Good phones, checked.</h3><p>We take care with our selection and help you confirm details before you buy.</p></article><article><span className="value-icon"><MessageCircle /></span><span className="eyebrow">03 · HERE TO HELP</span><h3>Support that stays.</h3><p>Our relationship doesn’t end at checkout. Come back, call or message us any time.</p></article></section>
    <section className="story-bottom"><div><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h2>Come in curious.<br />Leave feeling sure.</h2></div><div><p>We’re at Megenagna Marathon Building, first floor, room 34. Come see what feels right.</p><Link href="/contact" className="button button-light">Plan your visit <ArrowRight size={16} /></Link></div></section>
  </div>
}

function Contact() {
  const { shop } = useStoreData()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [leadError, setLeadError] = useState('')
  const [leadNotice, setLeadNotice] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = `Hello ${shop.name}, I’m ${name.trim()}.\n${message.trim()}`
    const url = createWhatsAppUrl(text, shop.whatsapp[0])
    const popup = window.open(url, '_blank', 'noopener,noreferrer')
    setLeadError('')
    setLeadNotice('Your message is ready in WhatsApp.')
    void fetch('/api/leads', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'contact', name: name.trim(), contact: contact.trim(), payload: { message: message.trim() } }),
    }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        setLeadError(result.error ?? 'The WhatsApp message is ready, but the request was not saved to the shop inbox.')
      } else setLeadNotice('Thanks — your request was saved. Send the prepared WhatsApp message to reach our team directly.')
    }).catch(() => setLeadError('The WhatsApp message is ready, but the request could not be saved to the shop inbox.'))
    if (!popup) window.location.assign(url)
  }
  return <div className="container page-container contact-page">
    <div className="page-intro"><div><span className="eyebrow">A REAL PERSON, A REAL ANSWER</span><h1>Say hello.</h1><p>Questions about a phone, a trade-in, or the best way to find us? We’re just a message away.</p></div><div className="contact-open-badge"><span /> Open today <small>{shop.hours}</small></div></div>
    <div className="contact-layout"><div className="contact-methods"><a className="contact-method" href={`tel:${shop.phones[0]}`}><span className="contact-method-icon"><PhoneCall /></span><span><small>CALL THE SHOP</small><strong>{shop.phones[0]}</strong>{shop.phones[1] && <em>Or {shop.phones[1]}</em>}</span><ArrowUpRight /></a><a className="contact-method" href={createWhatsAppUrl(`Hello ${shop.name}, I have a question.`, shop.whatsapp[0])} target="_blank" rel="noreferrer"><span className="contact-method-icon whatsapp-contact"><MessageCircle /></span><span><small>WHATSAPP</small><strong>Chat with our team</strong><em>Quick, friendly help</em></span><ArrowUpRight /></a><a className="contact-method" href={shop.telegram} target="_blank" rel="noreferrer"><span className="contact-method-icon"><SendIcon /></span><span><small>TELEGRAM</small><strong>@Siaabmobiles</strong><em>Find us on Telegram</em></span><ArrowUpRight /></a><a className="contact-method" href={`mailto:${shop.email}`}><span className="contact-method-icon"><MailIcon /></span><span><small>EMAIL</small><strong>{shop.email}</strong><em>We’ll get back to you</em></span><ArrowUpRight /></a>
      <div className="address-card"><span className="eyebrow">COME FIND US</span><h2>Megenagna, Addis Ababa.</h2><p>{shop.address}</p><p><Clock3 size={16} />{shop.hours}</p><a href={shop.mapUrl} target="_blank" rel="noreferrer" className="button button-primary">View on map <ArrowUpRight size={16} /></a></div>
    </div><section className="contact-form-card"><span className="eyebrow">A NOTE TO OUR TEAM</span><h2>What’s on your mind?</h2><p>Write us a note and WhatsApp will open with your message ready to send.</p><form onSubmit={submit}><label className="field-label">Your name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label><label className="field-label">Phone, Telegram or email<input value={contact} onChange={(event) => setContact(event.target.value)} required placeholder="+251 … / @username / email" /></label><label className="field-label">How can we help?<textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} required placeholder="I’m looking for…" /></label>{leadError && <p className="form-error" role="alert">{leadError}</p>}{leadNotice && <p className="form-success" role="status">{leadNotice}</p>}<button type="submit" className="button button-whatsapp button-full"><MessageCircle size={17} />Continue in WhatsApp</button><small>This opens a message to our WhatsApp number. Nothing is sent until you choose to send it.</small></form></section></div>
  </div>
}

function SendIcon() { return <ArrowUpRight size={21} /> }
function MailIcon() { return <MessageCircle size={21} /> }

function NotFound() {
  const router = useRouter()
  return <div className="container not-found"><div className="not-found-number">404</div><span className="eyebrow">A WRONG TURN, MAYBE?</span><h1>This page isn’t here.</h1><p>Let’s get you back to good phones and good advice.</p><div><button type="button" className="button button-outline" onClick={() => router.back()}><ArrowLeft size={17} />Go back</button><Link href="/" className="button button-primary">Back to home <ArrowRight size={17} /></Link></div></div>
}

export default App
