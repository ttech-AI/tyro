import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { strings as tr } from "@/data/strings.tr"
import { strings as en } from "@/data/strings.en"

const STORAGE_KEY = "tyro-locale"
const DICTIONARIES = { tr, en }
const VALID = ["tr", "en"]
const DEFAULT = "tr"

export const LocaleContext = createContext(null)

function readInitial() {
  if (typeof window === "undefined") return DEFAULT
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return VALID.includes(saved) ? saved : DEFAULT
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitial)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.setAttribute("lang", locale)
  }, [locale])

  const t = useCallback(
    (key, fallback) => {
      const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT]
      return dict[key] ?? fallback ?? key
    },
    [locale],
  )

  const setLocale = useCallback(
    (next) => setLocaleState(VALID.includes(next) ? next : DEFAULT),
    [],
  )

  const toggle = useCallback(
    () => setLocaleState((l) => (l === "tr" ? "en" : "tr")),
    [],
  )

  const value = useMemo(
    () => ({ locale, setLocale, toggle, t }),
    [locale, setLocale, toggle, t],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
