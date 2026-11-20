import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { BRANDS, BrandPicker, canonicalBrand, matchBrands } from '../../app/admin/inventory/brand-picker'

function Harness() {
  const [brand, setBrand] = useState('')
  return <form><BrandPicker value={brand} onChange={setBrand} /><input aria-label="Model" /><output data-testid="value">{brand}</output></form>
}

describe('brand list', () => {
  it('has the shop’s nine brands', () => {
    expect(BRANDS).toEqual(['Apple', 'Honor', 'Huawei', 'OnePlus', 'OPPO', 'realme', 'Samsung', 'vivo', 'Xiaomi'])
  })

  it('guesses from the first letters, ignoring capitals', () => {
    expect(matchBrands('x')).toEqual(['Xiaomi'])
    expect(matchBrands('h')).toEqual(['Honor', 'Huawei'])
    expect(matchBrands('p')).toEqual(['Apple', 'OnePlus', 'OPPO'])
    expect(matchBrands('ONE')).toEqual(['OnePlus'])
    expect(matchBrands('nokia')).toEqual([])
    expect(canonicalBrand(' xiaomi ')).toBe('Xiaomi')
    expect(canonicalBrand('Nokia')).toBe('Nokia')
  })
})

describe('brand picker', () => {
  it('suggests Xiaomi after typing X and takes it with Enter', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Brand'), 'x')
    expect(screen.getByRole('option', { name: 'Xiaomi' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('value')).toHaveTextContent('Xiaomi')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens the whole list from the arrow button and picks with a tap', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Show brand list' }))
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(BRANDS)
    await user.click(screen.getByRole('option', { name: 'vivo' }))
    expect(screen.getByTestId('value')).toHaveTextContent('vivo')
  })

  it('still accepts a brand that is not in the list', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Brand'), 'Nokia')
    expect(screen.queryByRole('listbox')).toBeNull()
    await user.click(screen.getByLabelText('Model'))
    expect(screen.getByTestId('value')).toHaveTextContent('Nokia')
  })

  it('fixes the capitals of a listed brand typed by hand', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Brand'), 'SAMSUNG')
    await user.keyboard('{Escape}')
    await user.click(screen.getByLabelText('Model'))
    expect(screen.getByTestId('value')).toHaveTextContent('Samsung')
  })
})
