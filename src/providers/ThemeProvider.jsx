import { createContext, useEffect, useState } from "react"

const STORAGE_KEY = "tyro-theme"
const VALID = ["light", "dark"]

export const ThemeContext = createContext(null)

function readInitial() {
  if (typeof window === "undefined") return "light"
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (VALID.includes(saved)) return saved
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitial)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = (next) => setThemeState(VALID.includes(next) ? next : "light")
  const toggle = () => setThemeState((t) => (t === "dark" ? "light" : "dark"))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
