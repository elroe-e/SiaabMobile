'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import specModels from '../../../src/data/spec-models.json'

/** The brands the shop sells most. Any other brand can still be typed. */
export const BRANDS = ['Apple', 'Honor', 'Huawei', 'OnePlus', 'OPPO', 'realme', 'Samsung', 'vivo', 'Xiaomi']

const squash = (value: string) => value.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '')

/** Options that start with the typed text first, then options that contain it ("reno12" also finds "Reno 12"). */
function matchOptions(options: string[], text: string): string[] {
  const query = squash(text)
  if (!query) return options
  const starts = options.filter((option) => squash(option).startsWith(query))
  return [...starts, ...options.filter((option) => !starts.includes(option) && squash(option).includes(query))]
}

/** Brands that start with the typed text first, then brands that contain it. */
export const matchBrands = (text: string) => matchOptions(BRANDS, text)

/** "xiaomi" becomes "Xiaomi", so one brand never ends up saved under two spellings. Other brands stay as typed. */
export function canonicalBrand(text: string): string {
  const trimmed = text.trim()
  return BRANDS.find((brand) => brand.toLowerCase() === trimmed.toLowerCase()) ?? trimmed
}

/** Phones of this brand in the spec library, for the Model suggestions. */
export function libraryModels(brand: string): string[] {
  return (specModels.models as Record<string, string[]>)[canonicalBrand(brand)] ?? []
}

/** Up to 8 library phones of this brand that fit the typed model name. */
export const matchModels = (brand: string, text: string) => (text.trim() ? matchOptions(libraryModels(brand), text).slice(0, 8) : [])

interface SuggestBoxProps {
  label: string
  listLabel: string
  value: string
  onChange: (value: string) => void
  /** Everything the arrow button shows. */
  all: string[]
  /** What to suggest while typing. */
  suggest: (text: string) => string[]
  /** Tidies the value when the box loses focus. */
  tidy?: (text: string) => string
  placeholder: string
  maxLength: number
  /** Tab also takes the highlighted suggestion (brands only; a model name may be longer than any suggestion). */
  tabPicks?: boolean
}

function SuggestBox({ label, listLabel, value, onChange, all, suggest, tidy, placeholder, maxLength, tabPicks }: SuggestBoxProps) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [active, setActive] = useState(0)
  const options = showAll ? all : suggest(value)
  const visible = open && options.length > 0

  const pick = (option: string) => { onChange(option); setOpen(false); setShowAll(false) }
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!visible) { setOpen(true); setActive(0); return }
      setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if ((event.key === 'Enter' || (event.key === 'Tab' && tabPicks)) && visible && (value.trim() || showAll)) {
      if (event.key === 'Enter') event.preventDefault()
      pick(options[active] ?? value)
    } else if (event.key === 'Escape' && visible) {
      event.preventDefault(); setOpen(false)
    }
  }

  return <div className="admin-label">
    <label htmlFor={id}>{label}</label>
    <div className="admin-combo">
      <button type="button" className="admin-combo-toggle" aria-label={`Show ${label.toLowerCase()} list`} aria-expanded={visible} aria-controls={listId} tabIndex={-1} disabled={!all.length}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { const next = !visible; setOpen(next); setShowAll(next); setActive(Math.max(0, all.indexOf(tidy ? tidy(value) : value))); document.getElementById(id)?.focus() }}>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <input id={id} required maxLength={maxLength} value={value} placeholder={placeholder} autoComplete="off" spellCheck={false}
        role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={listId} aria-activedescendant={visible ? `${listId}-${active}` : undefined}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setShowAll(false); setActive(0) }}
        onKeyDown={onKeyDown}
        onBlur={() => { setOpen(false); setShowAll(false); if (tidy && value !== tidy(value)) onChange(tidy(value)) }} />
      {visible && <ul className="admin-combo-list" id={listId} role="listbox" aria-label={listLabel}>
        {options.map((option, index) => <li key={option} id={`${listId}-${index}`} role="option" aria-selected={index === active}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => pick(option)}>{option}</li>)}
      </ul>}
    </div>
  </div>
}

export function BrandPicker({ value, onChange }: { value: string; onChange: (brand: string) => void }) {
  return <SuggestBox label="Brand" listLabel="Brands" value={value} onChange={onChange} all={BRANDS} suggest={matchBrands} tidy={canonicalBrand} placeholder="Samsung" maxLength={80} tabPicks />
}

/** Model box that suggests the phones of the chosen brand found in the spec library. Any model can still be typed. */
export function ModelPicker({ brand, value, onChange }: { brand: string; value: string; onChange: (model: string) => void }) {
  return <SuggestBox label="Model" listLabel="Models" value={value} onChange={onChange} all={libraryModels(brand)} suggest={(text) => matchModels(brand, text)} tidy={(text) => text.trim()} placeholder="Galaxy S25 Ultra" maxLength={120} />
}
