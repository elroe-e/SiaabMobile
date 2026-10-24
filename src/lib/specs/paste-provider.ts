import { parsePastedSpecs } from './paste-parser'
import type { SpecProvider } from './types'

export const pasteProvider: SpecProvider = {
  name: 'pasted',
  async fetch({ pastedText }) {
    return { specs: pastedText ? parsePastedSpecs(pastedText) : {}, sourceUrls: [] }
  },
}
