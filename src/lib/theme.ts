export type Theme = 'light' | 'dark'

export const THEME_COOKIE = 'siaab-theme'
export const parseTheme = (value: string | undefined): Theme | null => value === 'dark' || value === 'light' ? value : null

/**
 * Runs in <head> before the page paints: uses the saved choice, otherwise the phone's own
 * dark-mode setting, so the page never flashes the wrong theme.
 */
export const themeBootScript = `(function(){try{if(document.documentElement.getAttribute('data-theme'))return;var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var t=m?m[1]:(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`
