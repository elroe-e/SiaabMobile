export type Language = 'en' | 'am'

export const LANGUAGE_COOKIE = 'siaab-lang'
export const parseLanguage = (value: string | undefined): Language => value === 'am' ? 'am' : 'en'
