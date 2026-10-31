'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, LayoutGrid, ChevronDown, CircleHelp,
  Clock3, CreditCard, MapPin, MessageCircle, PackageCheck, PhoneCall, Search, ShieldCheck, Smartphone,
  Sparkles, X,
} from 'lucide-react'
import { phones } from './data/phones'
import { defaultFilters, filterPhones, type CatalogFilters } from './lib/filters'
import { estimateTradeIn } from './lib/tradeIn'
import { formatPrice, formatStorage, fullPhoneName } from './lib/format'
import { createWhatsAppUrl, phoneOrderMessage, tradeInMessage } from './lib/whatsapp'
import { visibleColors } from './lib/colors'
import { brandLogo, brandSummary } from './lib/brandLogos'
import { HeroCarousel, newestPhones } from './components/HeroCarousel'
import { productAssurances } from './data/assurances'
import { useSpecMode } from './hooks/useSpecMode'
import { useDebounce } from './hooks/useDebounce'
import type { TradeInAnswers, TradeInEstimate, UpcomingPhone } from './types'
import type { Phone } from './types'
import { AdvancedSpecs, FloatingCall, telLink, Footer, Header, ShareButton, KeySpecs, PhoneCard, SectionHeading, SpecSwitcher, StockBadge, TrustStrip } from './components/Storefront'
import { defaultStoreData, StoreDataProvider, useStoreData, type StoreData } from './context/StoreDataContext'
import { LanguageProvider, useT } from './i18n'
import type { Language } from './i18n/language'

const PhoneContext = createContext<Phone[]>(phones)
const usePhoneData = () => useContext(PhoneContext)

function App({ initialPhones = phones, initialStoreData = defaultStoreData, initialLang = 'en' }: { initialPhones?: Phone[]; initialStoreData?: StoreData; initialLang?: Language }) {
  return <LanguageProvider initialLang={initialLang}><StoreDataProvider value={initialStoreData}><StorefrontApp initialPhones={initialPhones} /></StoreDataProvider></LanguageProvider>
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
      '/brands': 'Shop by brand | Siaab Mobile',
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
                : pathname === '/brands' ? <Brands />
                : <NotFound />
  return <PhoneContext.Provider value={phoneData}><Header /><main id="main-content">{page}</main><Footer /><FloatingCall /></PhoneContext.Provider>
}

function Home() {
  const t = useT()
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
      <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot" /> {t("Your next phone, found")}</span>
        <h1>{t("A good phone")}<br />{t("A")} <em>{t("great")}</em> {t("feeling")}</h1>
        <p>{t("Find the right device, get honest advice, and make every upgrade a little easier. Right here in Addis.")}</p>
        <div className="hero-buttons"><Link href="/phones" className="button button-primary">{t("Find your phone")} <ArrowRight size={17} /></Link><Link href="/trade-in" className="button button-outline">{t("Get trade-in value")} <ArrowUpRight size={16} /></Link><Link href="/brands" className="button button-outline">{t("Shop by brand")} <LayoutGrid size={16} /></Link></div>
      </div>
      <HeroCarousel phones={newestPhones(phones)} />
    </section>
    <div className="container"><TrustStrip /></div>
    <section className="section upcoming-teaser"><div className="container"><SectionHeading eyebrow="On the horizon" title={t("A little something to look forward to")} text="See what’s coming next. Dates and details are unconfirmed." link="Explore upcoming" to="/upcoming" />
      <div className="upcoming-mini-grid">{upcomingPhones.slice(0, 3).map((item) => <Link href="/upcoming" className="upcoming-mini" key={item.id}><img src={item.image} alt="" loading="lazy" /><div><span className="eyebrow">{item.expectedDate} {t("· Coming soon")}</span><h3>{fullPhoneName(item.brand, item.model)}</h3><p>{item.teaser}</p></div><ArrowUpRight size={17} /></Link>)}</div></div></section>
    <section className="section container featured-section"><SectionHeading eyebrow="A few good picks" title={t("Popular right now")} text="In stock at the shop now, priced in birr" link="View all phones" to="/phones" /><div className="home-spec-control"><span>{t("See specs in")}</span><SpecSwitcher mode={mode} onChange={setMode} /></div><div className="phone-grid">{featured.map((phone) => <PhoneCard key={phone.id} phone={phone} mode={mode} />)}</div></section>
    <section className="trade-banner container"><div className="trade-banner-icon"><Smartphone size={25} /></div><div><span className="eyebrow">{t("Your old phone has a next chapter")}</span><h2>{t("Make your old phone part of your new one")}</h2><p>{t("Tell us a little about your device and get an instant estimate. Final value is confirmed in store.")}</p></div><Link href="/trade-in" className="button button-dark">{t("Get my estimate")} <ArrowRight size={17} /></Link></section>
    <section className="section container brand-section"><div className="brand-row-heading"><span className="eyebrow">{t("Brands we stock")}</span><h2>{t("Find your favorite")}</h2></div><div className="brand-row">{brands.map((brand) => {
      const logo = brandLogo(brand)
      return <Link href={`/phones?brand=${encodeURIComponent(brand)}`} key={brand}>{logo && <svg viewBox="0 0 24 24" aria-hidden="true"><path d={logo.path} /></svg>}{brand}</Link>
    })}</div></section>
    <section className="section faq-section"><div className="container faq-layout"><div><span className="eyebrow">{t("The important bits")}</span><h2>{t("Good questions")}<br />{t("Straight answers")}</h2><p>{t("Still unsure? Talk to a real person on WhatsApp or visit us in store.")}</p><a className="text-link" href={createWhatsAppUrl(`Hello ${shop.name}, I have a question.`, shop.whatsapp[0])} target="_blank" rel="noreferrer">{t("Ask us anything")} <ArrowUpRight size={16} /></a></div><div className="faq-list">{[
      ['Are your phones genuine?', 'Yes. We carefully source our phones and check each device before it reaches the shelf. Ask our team about a specific model any time.'],
      ['Does every phone include a warranty?', 'Most new devices include a 12-month shop warranty. Refurbished devices have a clearly noted warranty period on their product page.'],
      ['Can I trade in a phone that is not listed?', 'Absolutely. Select “Other / not listed” in the estimator and send us a few details. Our team will help with a manual quote.'],
      ['How can I pay for my phone?', 'We do not accept online payments. Pay in person at our shop after checking your chosen phone with our team.'],
      ['Can you deliver?', 'Contact us on WhatsApp to confirm current delivery options and charges for your area.'],
    ].map(([question, answer], index) => <div className={`faq-item ${faq === index ? 'faq-open' : ''}`} key={question}><button type="button" aria-expanded={faq === index} onClick={() => setFaq(faq === index ? null : index)}><span>{t(question ?? '')}</span><ChevronDown size={18} /></button>{faq === index && <p>{t(answer ?? '')}</p>}</div>)}</div></div></section>
    <section className="visit-strip container"><div className="visit-icon"><MapPin size={21} /></div><div><span className="eyebrow">{t("Come say hello")}</span><strong>{t("Find us in Megenagna, Addis Ababa.")}</strong><small>{shop.address}</small></div><a href={shop.mapUrl} target="_blank" rel="noreferrer" className="button button-light">{t("View on map")} <ArrowUpRight size={16} /></a></section>
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
  const t = useT()
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
    <div className="filter-panel-head"><strong>{t("Refine your search")}</strong><button type="button" className="text-button" onClick={clear}>{t("Clear all")}</button></div>
    <label className="field-label">{t("Brand")}<select value={filters.brand} onChange={(event) => update('brand', event.target.value)}><option value="">{t("All brands")}</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
    <label className="field-label">{t("Storage")}<select value={filters.storage} onChange={(event) => update('storage', event.target.value)}><option value="">{t("Any storage")}</option><option value="128">{t("128 GB or more")}</option><option value="256">{t("256 GB or more")}</option><option value="512">{t("512 GB or more")}</option></select></label>
    <div className="filter-group"><span className="field-label">{t("Price range")}</span><div className="price-range-labels"><span>{t("Br")} {filters.minPrice.toLocaleString()}</span><span>{t("Br")} {filters.maxPrice.toLocaleString()}</span></div><input aria-label={t("Maximum price")} type="range" min="0" max={ceiling} step="5000" value={filters.maxPrice} onChange={(event) => update('maxPrice', Number(event.target.value))} /></div>
    <label className="field-label">{t("Condition")}<select value={filters.condition} onChange={(event) => update('condition', event.target.value)}><option value="">{t("Any condition")}</option><option value="new">{t("New")}</option><option value="refurbished">{t("Refurbished")}</option></select></label>
    <label className="field-label">{t("Availability")}<select value={filters.availability} onChange={(event) => update('availability', event.target.value)}><option value="">{t("All phones")}</option><option value="in_stock">{t("In stock")}</option><option value="low_stock">{t("Few left")}</option><option value="out_of_stock">{t("Sold out")}</option></select></label>
    <label className="checkbox-line"><input type="checkbox" checked={filters.fiveG} onChange={(event) => update('fiveG', event.target.checked)} /> {t("5G capable")}</label>
  </div>
  return <div className="container page-container catalog-page">
    <div className="page-intro"><div><span className="eyebrow">{t("The phone edit")}</span><h1>{t("Find the one")}</h1><p>{t("Explore trusted picks, compare the details, and find a fit for the way you live.")}</p></div><div className="page-intro-note"><ShieldCheck size={18} /><span>{t("Every phone, backed by")}<br /><strong>{t("real local support.")}</strong></span></div></div>
    <div className="catalog-toolbar"><label className="search-field"><Search size={18} /><span className="sr-only">{t("Search by brand or model")}</span><input value={filters.search} onChange={(event) => update('search', event.target.value)} placeholder={t("Search a brand or model")} /></label><div className="catalog-toolbar-actions"><button className="button button-light filter-open" type="button" onClick={() => setFiltersOpen(true)}>{t("Filters")} <span className="filter-count">{Number(Boolean(filters.brand)) + Number(Boolean(filters.condition)) + Number(filters.fiveG)}</span></button><label className="sort-select"><span className="sr-only">{t("Sort phones")}</span><select value={filters.sort} onChange={(event) => update('sort', event.target.value)}><option value="popular">{t("Most popular")}</option><option value="price-asc">{t("Price: low to high")}</option><option value="price-desc">{t("Price: high to low")}</option><option value="newest">{t("Newest added")}</option></select></label></div></div>
    <div className="catalog-layout"><aside className="catalog-sidebar">{filterPanel}</aside><div className="catalog-results"><div className="brand-chips" role="group" aria-label={t("Filter by brand")}><button type="button" className={!filters.brand ? 'active' : ''} aria-pressed={!filters.brand} onClick={() => update('brand', '')}>{t("All")}</button>{brands.map((brand) => <button key={brand} type="button" className={filters.brand === brand ? 'active' : ''} aria-pressed={filters.brand === brand} onClick={() => update('brand', filters.brand === brand ? '' : brand)}>{brand}</button>)}</div><div className="results-heading"><span><strong>{results.length}</strong> {t("phones for you")}</span><div className="spec-mode-control"><span>{t("Specs:")}</span><SpecSwitcher mode={mode} onChange={setMode} /></div></div>
      {results.length ? <><h2 className="sr-only">{t("Phones")}</h2><div className="phone-grid">{results.map((phone) => <PhoneCard key={phone.id} phone={phone} mode={mode} />)}</div></> : <div className="empty-state"><span className="empty-icon"><Search size={23} /></span><h2>{t("No phones found. Yet")}</h2><p>{t("Try another search or clear a filter to see more of our collection.")}</p><button type="button" onClick={clear} className="button button-primary">{t("Clear filters")}</button></div>}
    </div></div>
    {filtersOpen && <div className="sheet-backdrop" onClick={() => setFiltersOpen(false)}><div className="mobile-filter-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><h2>{t("Filters")}</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label={t("Close filters")}><X /></button></div>{filterPanel}<button type="button" className="button button-primary sheet-apply" onClick={() => setFiltersOpen(false)}>{t("Show")} {results.length} {t("phones")}</button></div></div>}
  </div>
}

function PhoneDetail() {
  const t = useT()
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
  const zoomTouch = useRef<number | null>(null)
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
    <nav className="breadcrumbs" aria-label={t("Breadcrumb")}><Link href="/">{t("Home")}</Link><span>/</span><Link href="/phones">{t("Phones")}</Link><span>/</span><span>{fullPhoneName(phone.brand, phone.model)}</span></nav>
    <div className="detail-layout"><div className="gallery-column"><button className="gallery-main" type="button" onClick={() => setZoom(true)} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }} onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (touchStart.current !== null && end !== undefined && Math.abs(end - touchStart.current) > 45) setGallery((current) => (current + (end < touchStart.current! ? 1 : phone.images.length - 1)) % phone.images.length); touchStart.current = null }} aria-label={`${t("Click to zoom")}. ${t("Enlarge phone photo; swipe to change photos")}`}><img src={phone.images[gallery]} alt={`${fullPhoneName(phone.brand, phone.model)}, view ${gallery + 1}`} /><span className="zoom-hint">{t("Click to zoom")} <ArrowUpRight size={14} /></span></button><div className="gallery-thumbnails">{phone.images.map((image, index) => <button key={image} className={gallery === index ? 'selected' : ''} type="button" onClick={() => setGallery(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={gallery === index}><img src={image} alt="" /></button>)}</div></div>
      <div className="detail-info"><span className="eyebrow">{phone.brand.toUpperCase()} · {phone.condition === 'new' ? t("Brand new") : t("Refurbished")}</span><h1>{phone.model}</h1><div className="detail-badges">{phone.badges.map((badge) => <span key={badge} className="pill">{badge}</span>)}<StockBadge stock={phone.stock} count={phone.stockCount} /></div><div className="detail-price"><strong>{formatPrice(selected.price)}</strong>{phone.oldPrice && <del>{formatPrice(phone.oldPrice)}</del>}<span>{t("Price confirmed in store")}</span></div><ul className="assurance-list">{productAssurances.map((line) => <li key={line}><Check size={15} />{line}</li>)}</ul>
        {visibleColors(phone.colors).length > 0 && <div className="detail-option"><div className="option-heading"><strong>{t("Available colors")}</strong></div><ul className="color-list">{visibleColors(phone.colors).map((item) => <li key={item.name}><span className="color-dot" style={{ '--swatch': item.hex } as CSSProperties} aria-hidden="true" />{item.name}</li>)}</ul></div>}
        <div className="detail-option"><div className="option-heading"><strong>{t("Storage")}</strong><span>{t("Choose capacity")}</span></div><div className="storage-options">{phone.storageOptions.map((option) => <button key={option.gb} className={`storage-option ${storage === option.gb ? 'selected' : ''}`} type="button" onClick={() => setStorage(option.gb)} aria-pressed={storage === option.gb}><span>{formatStorage(option.gb)}</span><strong>{formatPrice(option.price)}</strong></button>)}</div></div>
        <div className="detail-warranty"><ShieldCheck size={18} /><span><strong>{phone.warrantyMonths}{t("-month warranty")}</strong><small>{t("Included with your purchase")}</small></span><Check size={16} /></div>
        <div className="detail-actions"><a href={orderUrl} target="_blank" rel="noreferrer" className={`button button-whatsapp button-large ${phone.stock === 'out_of_stock' ? 'button-disabled' : ''}`}><MessageCircle size={18} />{phone.stock === 'out_of_stock' ? t("Ask when it’s back") : t("Order on WhatsApp")}</a><a href={telLink(shop.phones[0] ?? '')} className="button button-outline button-large"><PhoneCall size={17} />{t("Call the shop")}</a><ShareButton title={fullPhoneName(phone.brand, phone.model)} url={`${shop.siteUrl}${pathname}`} /></div>
        <Link className="detail-trade-link" href={`/trade-in?target=${phone.slug}`}><Smartphone size={17} />{t("Trade in your old phone toward this one")} <ArrowRight size={16} /></Link>
        <p className="detail-small-note"><ShieldCheck size={14} /> {t("No online payment. Confirm availability with our team.")}</p>
      </div></div>
    <section className="detail-specs-section"><div className="spec-heading-row"><div><span className="eyebrow">{t("Get to know it")}</span><h2>{t("All the details")}</h2><p>{t("Pick the level of detail that’s right for you.")}</p></div><SpecSwitcher mode={mode} onChange={setMode} /></div>{mode === 'simple' ? <div className="detail-simple-specs"><KeySpecs phone={phone} mode="simple" /></div> : <AdvancedSpecs phone={phone} />}</section>
    {similar.length > 0 && <section className="section similar-section"><SectionHeading eyebrow="You might also like" title={t("A few close contenders")} /><div className="phone-grid">{similar.map((item) => <PhoneCard key={item.id} phone={item} mode={mode} />)}</div></section>}
    <div className="mobile-sticky-order"><div><span>{formatPrice(selected.price)}</span><small>{phone.model}</small></div><div className="mobile-sticky-actions"><a href={telLink(shop.phones[0] ?? '')} className="button button-call" aria-label={t("Call the shop")}><PhoneCall size={17} /></a><a href={orderUrl} target="_blank" rel="noreferrer" className="button button-whatsapp"><MessageCircle size={17} />{t("WhatsApp")}</a></div></div>
    {zoom && <div className="zoom-overlay" role="dialog" aria-modal="true" aria-label={`${phone.model} image viewer`} onClick={() => setZoom(false)} onTouchStart={(event) => { zoomTouch.current = event.touches[0]?.clientX ?? null }} onTouchEnd={(event) => { const start = zoomTouch.current; const end = event.changedTouches[0]?.clientX; zoomTouch.current = null; if (start === null || end === undefined || Math.abs(end - start) < 40) return; setGallery((current) => (current + (end < start ? 1 : phone.images.length - 1)) % phone.images.length) }}><button className="zoom-close" aria-label={t("Close image viewer")} onClick={() => setZoom(false)}><X /></button><button className="zoom-arrow zoom-prev" aria-label={t("Previous image")} onClick={(event) => { event.stopPropagation(); setGallery((gallery + phone.images.length - 1) % phone.images.length) }}><ArrowLeft /></button><img src={phone.images[gallery]} alt={`${fullPhoneName(phone.brand, phone.model)}`} onClick={(event) => event.stopPropagation()} /><button className="zoom-arrow zoom-next" aria-label={t("Next image")} onClick={(event) => { event.stopPropagation(); setGallery((gallery + 1) % phone.images.length) }}><ArrowRight /></button>{phone.images.length > 1 && <div className="zoom-dots" aria-hidden="true">{phone.images.map((image, index) => <span key={image} className={index === gallery ? 'active' : ''} />)}</div>}</div>}
  </div>
}

function Upcoming() {
  const t = useT()
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
    setError(t(''))
    window.setTimeout(() => notifyTrigger.current?.focus(), 0)
  }
  const notify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !name.trim() || !contact.trim()) {
      setError(t('Please add your name and one way to reach you.'))
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
    <div className="page-intro"><div><span className="eyebrow">{t("A sneak peek")}</span><h1>{t("Coming into view")}</h1><p>{t("Keep an eye on these upcoming devices. We’ll share news as soon as we have it.")}</p></div><span className="notice-badge"><Sparkles size={17} />{t("Dates & specs are unconfirmed")}</span></div>
    <div className="upcoming-grid">{[...upcomingPhones].sort((a, b) => a.dateSort.localeCompare(b.dateSort)).map((phone) => <article className="upcoming-card" key={phone.id}><div className="upcoming-art"><img src={phone.image} alt={`${fullPhoneName(phone.brand, phone.model)} concept artwork`} loading="lazy" /><span className="pill">{t("Coming soon")}</span><span className="upcoming-date">{phone.expectedDate}</span></div><div className="upcoming-card-content"><span className="eyebrow">{phone.brand.toUpperCase()} {t("· Expected")} {phone.expectedDate.toUpperCase()}</span><h2>{phone.model}</h2><p>{phone.teaser}</p><div className="rumor-list">{phone.keyRumoredSpecs.map((spec) => <span key={spec}><span />{spec}</span>)}</div><div className="upcoming-price"><small>{t("Expected price range")}</small><strong>{phone.expectedPriceRange}</strong></div><button type="button" className="button button-outline button-full" onClick={(event) => { notifyTrigger.current = event.currentTarget; setSelected(phone) }}>{t("Let me know when it’s here")} <ArrowRight size={16} /></button></div></article>)}</div>
    <div className="upcoming-disclaimer"><CircleHelp size={19} /><p><strong>{t("A note about upcoming phones")}</strong><br />{t("Dates, prices and specifications are indicative only and can change. Availability and details are not confirmed until the shop verifies local stock.")}</p></div>
    {selected && <div className="modal-backdrop" onClick={close}><section ref={dialogRef} className="notify-modal" role="dialog" aria-modal="true" aria-labelledby="notify-title" onClick={(event) => event.stopPropagation()}><button type="button" aria-label={t("Close dialog")} className="modal-close" onClick={close}><X /></button><span className="eyebrow">{t("Keep me in the loop")}</span><h2 id="notify-title">{t("A heads-up, when it’s here")}</h2><p>{t("Leave your details and we’ll send a message to the shop so the team can follow up when")} <strong>{fullPhoneName(selected.brand, selected.model)}</strong> {t("arrives.")}</p><form onSubmit={notify}><label className="field-label">{t("Your name")}<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="field-label">{t("Phone, Telegram or email")}<input value={contact} onChange={(event) => setContact(event.target.value)} required placeholder={t("+251 … / @username / email")} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button button-whatsapp button-full"><MessageCircle size={17} />{t("Send my request")}</button><small className="modal-privacy">{t("This opens WhatsApp so you can review the message before sending. Your request is also saved so the team can follow up.")}</small></form></section></div>}
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
  const t = useT()
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
      setError(t('Choose a brand, model and storage to continue.'))
      return false
    }
    if (step === 2 && ['condition', 'screen', 'body', 'battery', 'accessories', 'powersOn', 'locked'].some((key) => !answered.includes(key))) {
      setError(t('Answer each condition question to continue.'))
      return false
    }
    if (step === 2 && !answers.powersOn && answers.issues.length === 0) {
      setError(t('Choose at least one functional issue, or mark the phone as fully functional.'))
      return false
    }
    setError(t(''))
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
    setAnswers(defaultAnswers); setAnswered([]); setError(t('')); setMode('estimate'); setManualSent(false)
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
    <div className="trade-intro"><span className="eyebrow"><span className="eyebrow-dot" /> {t("Goodbye old phone, hello next")}</span><h1>{t("Give your old phone")}<br />{t("a")} <em>{t("new beginning")}</em></h1><p>{t("Answer a few quick questions and see what your phone could be worth toward your next upgrade.")}</p><div className="trade-trust"><span><Check size={15} />{t("Takes about 2 minutes")}</span><span><Check size={15} />{t("No obligation, ever")}</span></div></div>
    <div className="trade-layout"><aside className="trade-aside"><div className="trade-aside-illustration"><div className="trade-phone-shape"><Smartphone size={41} /></div><div className="trade-sparkle">✦</div><div className="trade-orbit" /></div><span className="eyebrow">{t("How it works")}</span><h2>{t("A better way to upgrade")}</h2><ol className="trade-steps-list"><li className={step === 1 ? 'active' : ''}><span>01</span><div><strong>{t("Tell us about it")}</strong><small>{t("Model, storage and condition.")}</small></div></li><li className={step === 2 ? 'active' : ''}><span>02</span><div><strong>{t("Answer a few questions")}</strong><small>{t("It helps us estimate fairly.")}</small></div></li><li className={step === 3 ? 'active' : ''}><span>03</span><div><strong>{t("See your estimate")}</strong><small>{t("Then bring it by for a check.")}</small></div></li></ol><div className="trade-aside-note"><ShieldCheck size={18} /><p><strong>{t("Good to know")}</strong><br />{t("Your estimate is a guide. A final offer is confirmed after an in-store inspection.")}</p></div></aside>
      <section className="trade-form-card" aria-live="polite">
        {mode === 'manual' ? <div className="manual-quote"><button type="button" className="back-link" onClick={() => { setMode('estimate'); setError(t('')) }}><ArrowLeft size={16} />{t("Back to phone details")}</button>{manualSent ? <div className="manual-success"><span className="success-icon"><Check /></span><h2>{t("Your message is ready")}</h2><p>{t("WhatsApp opened with your details. Send it to our team and we’ll get back to you with a manual quote.")}</p><button type="button" className="button button-primary" onClick={reset}>{t("Start another estimate")}</button></div> : <><span className="eyebrow">{t("We’ll take it from here")}</span><h2>{t("Let’s find out together")}</h2><p>{t("We don’t have a set value for that model yet. Share a few details and our team will personally help you.")}</p><form onSubmit={manualSubmit} className="manual-form"><label className="field-label">{t("Phone model")}<input value={otherModel} onChange={(event) => setOtherModel(event.target.value)} placeholder={t("Brand, model and storage if known")} required /></label><label className="field-label">{t("Your name")}<input value={manualName} onChange={(event) => setManualName(event.target.value)} autoComplete="name" required /></label><label className="field-label">{t("Phone, Telegram or email")}<input value={manualContact} onChange={(event) => setManualContact(event.target.value)} required placeholder={t("+251 … / @username / email")} /></label><button type="submit" className="button button-whatsapp"><MessageCircle size={17} />{t("Ask for a manual quote")}</button></form></>}</div> :
          <>
            <div className="progress-header"><div><span className="eyebrow">{t("Your trade-in estimate")}</span><span className="step-count">{t("Step")} {step} {t("of 3")}</span></div><div className="progress-track"><span style={{ width: `${step * 33.333}%` }} /></div><div className="progress-labels"><span className={step >= 1 ? 'current' : ''}>{t("Phone")}</span><span className={step >= 2 ? 'current' : ''}>{t("Condition")}</span><span className={step >= 3 ? 'current' : ''}>{t("Estimate")}</span></div></div>
            {step === 1 && <div className="trade-step-content"><span className="step-icon"><Smartphone size={20} /></span><h2>{t("First, what are we looking at?")}</h2><p>{t("Pick your current phone to get started.")}</p><label className="field-label">{t("Brand")}<select value={brand} onChange={(event) => { setBrand(event.target.value); setModel(''); setStorage(''); setQuery('') }}><option value="">{t("Choose a brand")}</option>{brands.map((item) => <option key={item}>{item}</option>)}<option value="Other">{t("Other brand")}</option></select></label>
              {brand && brand !== 'Other' && <><label className="field-label">{t("Model")}<input value={query || model} onChange={(event) => { const value = event.target.value; setQuery(value); setModel(models.includes(value) ? value : value === 'Other / not listed' ? '__other__' : ''); setStorage('') }} placeholder={t("Search or choose a model")} list="model-options" autoComplete="off" /><datalist id="model-options">{modelOptions.map((item) => <option key={item} value={item} />)}<option value="Other / not listed" /></datalist></label><div className="model-quick-picks">{modelOptions.slice(0, 4).map((item) => <button key={item} type="button" className={model === item ? 'selected' : ''} onClick={() => { setModel(item); setQuery(item); setStorage('') }}>{item}</button>)}<button type="button" className={isOther ? 'selected' : ''} onClick={() => { setModel('__other__'); setQuery(''); setStorage('') }}>{t("Other / not listed")}</button></div></>}
              {(brand === 'Other' || isOther) && <div className="not-listed-note"><CircleHelp size={17} /><span>{t("That’s okay! Our team can still help. We’ll ask for a few details to prepare a manual quote.")}</span></div>}
              {brand && model && !isOther && <label className="field-label">{t("Storage")}<select value={storage} onChange={(event) => setStorage(event.target.value)}><option value="">{t("Choose storage")}</option>{tradeInValues.filter((item) => item.brand === brand && item.model === model).sort((left, right) => left.storageGb - right.storageGb).map((item) => <option key={item.storageGb} value={item.storageGb}>{formatStorage(item.storageGb)}</option>)}{!tradeInValues.some((item) => item.brand === brand && item.model === model) && <option value="128">{t("128 GB")}</option>}</select></label>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="button" className="button button-primary button-full trade-next" onClick={() => { if (brand === 'Other') { setMode('manual'); return } if (model === 'Other / not listed') setModel('__other__'); next() }}>{t("Continue")} <ArrowRight size={17} /></button>
            </div>}
            {step === 2 && <div className="trade-step-content"><button type="button" className="back-link" onClick={() => setStep(1)}><ArrowLeft size={15} />{t("Back")}</button><span className="step-icon"><ShieldCheck size={20} /></span><h2>{t("Let’s check its condition")}</h2><p>{t("A few honest answers help us make a fair estimate.")}</p>
              {(Object.entries(conditionOptions) as [keyof typeof conditionOptions, readonly (readonly [string, string])[]][]).map(([field, options]) => <fieldset className="choice-field" key={field}><legend>{field === 'condition' ? t("Overall condition") : field === 'screen' ? t("Screen") : field === 'body' ? t("Back & body") : field === 'battery' ? t("Battery health") : t("Accessories")}</legend><div className={`choice-grid ${options.length === 4 ? 'four' : ''}`}>{options.map(([value, label]) => <label key={value} className={`choice-card ${picked(field) && answers[field] === value ? 'selected' : ''}`}><input type="radio" name={field} checked={picked(field) && answers[field] === value} onChange={() => {
                if (field === 'condition') changeAnswer('condition', value as TradeInAnswers['condition'])
                else if (field === 'screen') changeAnswer('screen', value as TradeInAnswers['screen'])
                else if (field === 'body') changeAnswer('body', value as TradeInAnswers['body'])
                else if (field === 'battery') changeAnswer('battery', value as TradeInAnswers['battery'])
                else changeAnswer('accessories', value as TradeInAnswers['accessories'])
              }} /><span>{t(label)}</span>{picked(field) && answers[field] === value && <Check size={14} />}</label>)}</div></fieldset>)}
              <fieldset className="choice-field"><legend>{t("Does it power on and work fully?")}</legend><div className="choice-grid two"><label className={`choice-card ${picked('powersOn') && answers.powersOn ? 'selected' : ''}`}><input type="radio" name="power" checked={picked('powersOn') && answers.powersOn} onChange={() => changeAnswer('powersOn', true)} /><span>{t("Yes, fully")}</span>{picked('powersOn') && answers.powersOn && <Check size={14} />}</label><label className={`choice-card ${picked('powersOn') && !answers.powersOn ? 'selected' : ''}`}><input type="radio" name="power" checked={picked('powersOn') && !answers.powersOn} onChange={() => changeAnswer('powersOn', false)} /><span>{t("It has issues")}</span>{picked('powersOn') && !answers.powersOn && <Check size={14} />}</label></div>{!answers.powersOn && <div className="issue-options">{issueOptions.map((issue) => <label key={issue}><input type="checkbox" checked={answers.issues.includes(issue)} onChange={(event) => changeAnswer('issues', event.target.checked ? [...answers.issues, issue] : answers.issues.filter((item) => item !== issue))} />{t(issue)}</label>)}</div>}</fieldset>
              <fieldset className="choice-field"><legend>{t("Is it locked to an account or carrier?")}</legend><div className="choice-grid two"><label className={`choice-card ${picked('locked') && !answers.locked ? 'selected' : ''}`}><input type="radio" name="locked" checked={picked('locked') && !answers.locked} onChange={() => changeAnswer('locked', false)} /><span>{t("No, it’s unlocked")}</span>{picked('locked') && !answers.locked && <Check size={14} />}</label><label className={`choice-card ${picked('locked') && answers.locked ? 'selected' : ''}`}><input type="radio" name="locked" checked={picked('locked') && answers.locked} onChange={() => changeAnswer('locked', true)} /><span>{t("Yes, it’s locked")}</span>{picked('locked') && answers.locked && <Check size={14} />}</label></div>{answers.locked && <p className="locked-warning" role="alert"><CircleHelp size={16} />{t("Locked phones can’t be accepted until they are fully unlocked.")}</p>}</fieldset>
              {error && <p className="form-error" role="alert">{error}</p>}<button type="button" className="button button-primary button-full trade-next" onClick={next}>{t("See my estimate")} <ArrowRight size={17} /></button>
            </div>}
            {step === 3 && estimate && <div className="trade-result"><button type="button" className="back-link" onClick={() => setStep(2)}><ArrowLeft size={15} />{t("Back to condition")}</button><div className={`estimate-hero ${!estimate.eligible ? 'estimate-ineligible' : ''}`}><span className="eyebrow">{estimate.eligible ? t("Your estimated trade-in value") : t("Trade-in status")}</span>{estimate.eligible ? <><strong>{formatPrice(estimate.estimate ?? 0)}</strong><span className="estimate-range">{formatPrice(estimate.min ?? 0)} – {formatPrice(estimate.max ?? 0)}</span><small>{t("Estimated value range")}</small></> : <><strong className="ineligible-title">{t("Not eligible yet")}</strong><span className="estimate-range">{t("Unlock this phone first")}</span><small>{t("We can only accept unlocked devices.")}</small></>}</div>
              {estimate.eligible && <><div className="estimate-breakdown"><div><strong>{t("Estimate breakdown")}</strong><span>{t("Starting value:")} {formatPrice(estimate.baseValue)}</span></div>{estimate.deductions.length ? estimate.deductions.map((deduction) => <div key={deduction.label}><span>{deduction.label}</span><span>− {formatPrice(deduction.amount)}</span></div>) : <div><span>{t("Excellent condition")}</span><span>{t("No deductions")}</span></div>}</div><p className="estimate-disclaimer">{t("Estimate only. Final value is confirmed after an in-store inspection.")}</p></>}
              {target && estimate.eligible && <div className="trade-target"><span className="eyebrow">{t("Put it toward something new")}</span><label className="field-label">{t("Choose a phone")}<select value={targetSlug} onChange={(event) => setTargetSlug(event.target.value)}>{phones.map((phone) => <option key={phone.slug} value={phone.slug}>{fullPhoneName(phone.brand, phone.model)}</option>)}</select></label><div><span>{formatPrice(targetPrice)} − {formatPrice(tradeValue)}</span><strong>≈ {formatPrice(Math.max(0, targetPrice - tradeValue))}</strong></div><small>{t("Estimated balance after trade-in. Subject to inspection.")}</small></div>}
              {bookOpen ? <form className="trade-book" onSubmit={bookInspection}><label className="field-label">{t("Your name")}<input autoComplete="name" value={bookName} onChange={(event) => setBookName(event.target.value)} required /></label><label className="field-label">{t("Phone, Telegram or email")}<input value={bookContact} onChange={(event) => setBookContact(event.target.value)} required placeholder={t("+251 … / @username / email")} /></label><button type="submit" className="button button-whatsapp button-full"><MessageCircle size={17} />{t("Send on WhatsApp")}</button></form> : <button type="button" onClick={() => setBookOpen(true)} className="button button-whatsapp button-full"><MessageCircle size={17} />{t("Book an inspection on WhatsApp")}</button>}<button type="button" className="button button-outline button-full" onClick={() => { if (!target) setTargetSlug(phones[0]?.slug ?? '') }}><CreditCard size={17} />{target ? t("Estimated price above") : t("Use this toward a new phone")}</button><button type="button" className="text-button start-over" onClick={reset}>{t("Start over")}</button>
            </div>}
          </>}
      </section>
    </div>
    <div className="trade-footnote"><ShieldCheck size={17} /><span>{t("Your details stay yours. This estimate isn’t a final offer; our team confirms value after inspecting the phone in person.")}</span></div>
  </div>
}

function About() {
  const t = useT()
  const phones = usePhoneData()
  const { shop } = useStoreData()
  return <div className="container page-container story-page">
    <section className="story-hero"><span className="eyebrow"><span className="eyebrow-dot" /> {t("Rooted in Addis, here for you")}</span><h1>{t("Phones are personal")}<br /><em>{t("Shopping should be too")}</em></h1><p>{t("At Siaab Mobile, we believe finding a phone should feel simple, honest and just a little exciting.")}</p><Link href="/phones" className="button button-primary">{t("Meet the collection")} <ArrowRight size={17} /></Link><div className="story-art" aria-label={t("Smartphone illustration")}><img src={phones[0]?.images[1]} alt="A thoughtfully sourced smartphone" /></div></section>
    <section className="story-section"><div><span className="eyebrow">{t("Why we’re here")}</span><h2>{t("A friendly face for your next upgrade")}</h2></div><div className="story-copy"><p>{t("Phones are how we connect, create and get through the day. But choosing one can be overwhelming. We started Siaab Mobile to make the experience feel more human: useful guidance, carefully chosen devices and a real person ready to help.")}</p><p>{t("We’re proud to be part of the Megenagna neighborhood. Whether you’re shopping for a first smartphone, replacing a well-loved device or curious about a trade-in, you’ll find us ready to listen.")}</p><a href={shop.mapUrl} target="_blank" rel="noreferrer" className="text-link">{t("Come meet us in person")} <ArrowUpRight size={16} /></a></div></section>
    <section className="values-grid"><article><span className="value-icon"><ShieldCheck /></span><span className="eyebrow">{t("01 · Good advice")}</span><h3>{t("Honest, always.")}</h3><p>{t("Clear answers about condition, price and warranty. If we don’t know, we’ll say so.")}</p></article><article><span className="value-icon"><PackageCheck /></span><span className="eyebrow">{t("02 · Carefully chosen")}</span><h3>{t("Good phones, checked.")}</h3><p>{t("We take care with our selection and help you confirm details before you buy.")}</p></article><article><span className="value-icon"><MessageCircle /></span><span className="eyebrow">{t("03 · Here to help")}</span><h3>{t("Support that stays.")}</h3><p>{t("Our relationship doesn’t end at checkout. Come back, call or message us any time.")}</p></article></section>
    <section className="story-bottom"><div><span className="eyebrow">{t("Your next chapter starts here")}</span><h2>{t("Come in curious")}<br />{t("Leave feeling sure")}</h2></div><div><p>{t("We’re at Megenagna Marathon Building, first floor, room 34. Come see what feels right.")}</p><Link href="/contact" className="button button-light">{t("Plan your visit")} <ArrowRight size={16} /></Link></div></section>
  </div>
}

function Brands() {
  const t = useT()
  const phones = usePhoneData()
  const brands = brandSummary(phones)
  return <div className="container page-container brands-page">
    <div className="page-intro"><div><span className="eyebrow">{t("Shop by brand")}</span><h1>{t("Pick a brand")}</h1><p>{t("Every brand we have in the shop right now. Tap one to see its phones.")}</p></div></div>
    <h2 className="sr-only">{t("Brands")}</h2>
    {brands.length ? <ul className="brand-grid" aria-label={t("Brands")}>{brands.map(({ brand, count }) => {
      const logo = brandLogo(brand)
      return <li key={brand}><Link href={`/phones?brand=${encodeURIComponent(brand)}`} className="brand-tile">
        <span className="brand-tile-logo" aria-hidden="true">{logo ? <svg viewBox="0 0 24 24" role="presentation"><path d={logo.path} fill={logo.color} /></svg> : <span className="brand-tile-letter">{brand.charAt(0).toUpperCase()}</span>}</span>
        <strong>{brand}</strong>
        <small>{count} {t(count === 1 ? 'phone' : 'phones')}</small>
      </Link></li>
    })}</ul> : <div className="empty-state"><h2>{t("No phones found. Yet")}</h2><Link href="/phones" className="button button-primary">{t("All phones")}</Link></div>}
  </div>
}

function Contact() {
  const t = useT()
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
    <div className="page-intro"><div><span className="eyebrow">{t("A real person, a real answer")}</span><h1>{t("Say hello")}</h1><p>{t("Questions about a phone, a trade-in, or the best way to find us? We’re just a message away.")}</p></div><div className="contact-open-badge"><span /> {t("Open today")} <small>{shop.hours}</small></div></div>
    <div className="contact-layout"><div className="contact-methods"><a className="contact-method" href={`tel:${shop.phones[0]}`}><span className="contact-method-icon"><PhoneCall /></span><span><small>{t("Call the shop")}</small><strong>{shop.phones[0]}</strong>{shop.phones[1] && <em>{t("Or")} {shop.phones[1]}</em>}</span><ArrowUpRight /></a><a className="contact-method" href={createWhatsAppUrl(`Hello ${shop.name}, I have a question.`, shop.whatsapp[0])} target="_blank" rel="noreferrer"><span className="contact-method-icon whatsapp-contact"><MessageCircle /></span><span><small>{t("WhatsApp")}</small><strong>{t("Chat with our team")}</strong><em>{t("Quick, friendly help")}</em></span><ArrowUpRight /></a><a className="contact-method" href={shop.telegram} target="_blank" rel="noreferrer"><span className="contact-method-icon"><SendIcon /></span><span><small>{t("Telegram")}</small><strong>{t("@Siaabmobiles")}</strong><em>{t("Find us on Telegram")}</em></span><ArrowUpRight /></a><a className="contact-method" href={`mailto:${shop.email}`}><span className="contact-method-icon"><MailIcon /></span><span><small>{t("Email")}</small><strong>{shop.email}</strong><em>{t("We’ll get back to you")}</em></span><ArrowUpRight /></a>
      <div className="address-card"><span className="eyebrow">{t("Come find us")}</span><h2>{t("Megenagna, Addis Ababa")}</h2><p>{shop.address}</p><p><Clock3 size={16} />{shop.hours}</p><a href={shop.mapUrl} target="_blank" rel="noreferrer" className="button button-primary">{t("View on map")} <ArrowUpRight size={16} /></a></div>
    </div><section className="contact-form-card"><span className="eyebrow">{t("A note to our team")}</span><h2>{t("What’s on your mind?")}</h2><p>{t("Write us a note and WhatsApp will open with your message ready to send.")}</p><form onSubmit={submit}><label className="field-label">{t("Your name")}<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label><label className="field-label">{t("Phone, Telegram or email")}<input value={contact} onChange={(event) => setContact(event.target.value)} required placeholder={t("+251 … / @username / email")} /></label><label className="field-label">{t("How can we help?")}<textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} required placeholder={t("I’m looking for…")} /></label>{leadError && <p className="form-error" role="alert">{leadError}</p>}{leadNotice && <p className="form-success" role="status">{leadNotice}</p>}<button type="submit" className="button button-whatsapp button-full"><MessageCircle size={17} />{t("Continue in WhatsApp")}</button><small>{t("This opens a message to our WhatsApp number. Nothing is sent until you choose to send it.")}</small></form></section></div>
  </div>
}

function SendIcon() { return <ArrowUpRight size={21} /> }
function MailIcon() { return <MessageCircle size={21} /> }

function NotFound() {
  const t = useT()
  const router = useRouter()
  return <div className="container not-found"><div className="not-found-number">404</div><span className="eyebrow">{t("A wrong turn, maybe?")}</span><h1>{t("This page isn’t here")}</h1><p>{t("Let’s get you back to good phones and good advice.")}</p><div><button type="button" className="button button-outline" onClick={() => router.back()}><ArrowLeft size={17} />{t("Go back")}</button><Link href="/" className="button button-primary">{t("Back to home")} <ArrowRight size={17} /></Link></div></div>
}

export default App
