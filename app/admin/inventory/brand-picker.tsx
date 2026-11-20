'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

/** The brands the shop sells most. Any other brand can still be typed. */
export const BRANDS = ['Apple', 'Honor', 'Huawei', 'OnePlus', 'OPPO', 'realme', 'Samsung', 'vivo', 'Xiaomi']

/** Brands that start with the typed text first, then brands that contain it. */
export function matchBrands(text: string): string[] {
  const query = text.trim().toLowerCase()
  if (!query) return BRANDS
  const starts = BRANDS.filter((brand) => brand.toLowerCase().startsWith(query))
  return [...starts, ...BRANDS.filter((brand) => !starts.includes(brand) && brand.toLowerCase().includes(query))]
}

/** "xiaomi" becomes "Xiaomi", so one brand never ends up saved under two spellings. Other brands stay as typed. */
export function canonicalBrand(text: string): string {
  const trimmed = text.trim()
  return BRANDS.find((brand) => brand.toLowerCase() === trimmed.toLowerCase()) ?? trimmed
}

export function BrandPicker({ value, onChange }: { value: string; onChange: (brand: string) => void }) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [active, setActive] = useState(0)
  const options = showAll ? BRANDS : matchBrands(value)
  const visible = open && options.length > 0

  const pick = (brand: string) => { onChange(brand); setOpen(false); setShowAll(false) }
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!visible) { setOpen(true); setActive(0); return }
      setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if ((event.key === 'Enter' || event.key === 'Tab') && visible && (value.trim() || showAll)) {
      if (event.key === 'Enter') event.preventDefault()
      pick(options[active] ?? value)
    } else if (event.key === 'Escape' && visible) {
      event.preventDefault(); setOpen(false)
    }
  }

  return <div className="admin-label">
    <label htmlFor={id}>Brand</label>
    <div className="admin-combo">
      <button type="button" className="admin-combo-toggle" aria-label="Show brand list" aria-expanded={visible} aria-controls={listId} tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { const next = !visible; setOpen(next); setShowAll(next); setActive(Math.max(0, BRANDS.indexOf(canonicalBrand(value)))); document.getElementById(id)?.focus() }}>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <input id={id} required maxLength={80} value={value} placeholder="Samsung" autoComplete="off" spellCheck={false}
        role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={listId} aria-activedescendant={visible ? `${listId}-${active}` : undefined}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setShowAll(false); setActive(0) }}
        onKeyDown={onKeyDown}
        onBlur={() => { setOpen(false); setShowAll(false); if (value !== canonicalBrand(value)) onChange(canonicalBrand(value)) }} />
      {visible && <ul className="admin-combo-list" id={listId} role="listbox" aria-label="Brands">
        {options.map((brand, index) => <li key={brand} id={`${listId}-${index}`} role="option" aria-selected={index === active}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => pick(brand)}>{brand}</li>)}
      </ul>}
    </div>
  </div>
}
