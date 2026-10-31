import { describe, expect, it } from 'vitest'
import { deckDepth } from '../components/HeroCarousel'

describe('hero card deck', () => {
  it('puts the active card on top and sends the previous top card to the back', () => {
    expect([0, 1, 2, 3].map((index) => deckDepth(index, 0, 4))).toEqual([0, 1, 2, 3])
    expect([0, 1, 2, 3].map((index) => deckDepth(index, 1, 4))).toEqual([3, 0, 1, 2])
  })
})
