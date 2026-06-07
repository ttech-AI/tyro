import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { strings as tr } from "@/data/strings.tr"
import { strings as en } from "@/data/strings.en"
import { strings as ru } from "@/data/strings.ru"
import { strings as ar } from "@/data/strings.ar"

const STORAGE_KEY = "tyro-locale"
const DICTIONARIES = { tr, en, ru, ar }
// Locales available in the picker. Order = display order in UI. toggle()
// cycles through this list in order — most callsites should call
// setLocale(id) through a dropdown so the user picks their actual language.
export const LOCALES = ["tr", "en", "ru", "ar"]
// Right-to-left languages get document.documentElement.dir = "rtl" so the
// global layout flips. Tailwind logical-property utilities aren't fully
// rolled out yet, so a few hardcoded ml-/mr- still read LTR — acceptable as
// a v1 RTL pass; iterate per screen as needed.
const RTL_LOCALES = new Set(["ar"])
const DEFAULT = "tr"

export const LocaleContext = createContext(null)

function readInitial() {
  if (typeof window === "undefined") return DEFAULT
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return LOCALES.includes(saved) ? saved : DEFAULT
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitial)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.setAttribute("lang", locale)
    document.documentElement.setAttribute("dir", RTL_LOCALES.has(locale) ? "rtl" : "ltr")
  }, [locale])

  const t = useCallback(
    (key, fallback) => {
      const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT]
      return dict[key] ?? fallback ?? key
    },
    [locale],
  )

  const setLocale = useCallback(
    (next) => setLocaleState(LOCALES.includes(next) ? next : DEFAULT),
    [],
  )

  // Cycle through LOCALES in order. Kept for backward compat with the
  // single-tap header toggle pattern.
  const toggle = useCallback(
    () =>
      setLocaleState((l) => {
        const i = LOCALES.indexOf(l)
        return LOCALES[(i + 1) % LOCALES.length]
      }),
    [],
  )

  const value = useMemo(
    () => ({ locale, setLocale, toggle, t }),
    [locale, setLocale, toggle, t],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
