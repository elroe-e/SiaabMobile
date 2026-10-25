'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { amharic } from './am'
import { LANGUAGE_COOKIE, type Language } from './language'

type LanguageValue = { lang: Language; setLang: (lang: Language) => void; t: (text: string) => string }

const LanguageContext = createContext<LanguageValue>({ lang: 'en', setLang: () => undefined, t: (text) => text })

/** Looks the English text up in the Amharic dictionary; anything not translated yet stays in English. */
export const translate = (lang: Language, text: string) => lang === 'am' ? amharic[text] ?? text : text

export function LanguageProvider({ initialLang, children }: { initialLang: Language; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLang)
  const setLang = useCallback((next: Language) => {
    setLangState(next)
    try { document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax` } catch { /* cookies blocked: the choice lasts until reload */ }
    document.documentElement.lang = next
  }, [])
  const t = useCallback((text: string) => translate(lang, text), [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export const useT = () => useContext(LanguageContext).t
export const useLanguage = () => useContext(LanguageContext)
