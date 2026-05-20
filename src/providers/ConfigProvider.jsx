import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { seedAgents, seedAiApps, seedBusinessApps } from "@/data/seedConfig"

const STORAGE_KEY = "tyro-config-v1"

export const ConfigContext = createContext(null)

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function readInitial() {
  if (typeof window === "undefined") {
    return { agents: seedAgents, aiApps: seedAiApps, businessApps: seedBusinessApps }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { agents: seedAgents, aiApps: seedAiApps, businessApps: seedBusinessApps }
    }
    const parsed = JSON.parse(raw)
    return {
      agents: Array.isArray(parsed.agents) ? parsed.agents : seedAgents,
      aiApps: Array.isArray(parsed.aiApps) ? parsed.aiApps : seedAiApps,
      businessApps: Array.isArray(parsed.businessApps) ? parsed.businessApps : seedBusinessApps,
    }
  } catch {
    return { agents: seedAgents, aiApps: seedAiApps, businessApps: seedBusinessApps }
  }
}

export function ConfigProvider({ children }) {
  const [state, setState] = useState(readInitial)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* quota / privacy mode — fail silently */
    }
  }, [state])

  const upsert = useCallback((collection, item) => {
    setState((prev) => {
      const list = prev[collection]
      const id = item.id || makeId()
      const next = { ...item, id }
      const idx = list.findIndex((x) => x.id === id)
      const updated = idx >= 0 ? list.map((x, i) => (i === idx ? next : x)) : [...list, next]
      return { ...prev, [collection]: updated }
    })
  }, [])

  const remove = useCallback((collection, id) => {
    setState((prev) => ({
      ...prev,
      [collection]: prev[collection].filter((x) => x.id !== id),
    }))
  }, [])

  const reset = useCallback((collection) => {
    setState((prev) => {
      if (collection === "agents") return { ...prev, agents: seedAgents }
      if (collection === "aiApps") return { ...prev, aiApps: seedAiApps }
      if (collection === "businessApps") return { ...prev, businessApps: seedBusinessApps }
      return { agents: seedAgents, aiApps: seedAiApps, businessApps: seedBusinessApps }
    })
  }, [])

  const value = useMemo(
    () => ({
      agents: state.agents,
      aiApps: state.aiApps,
      businessApps: state.businessApps,
      upsertAgent: (item) => upsert("agents", item),
      removeAgent: (id) => remove("agents", id),
      upsertAiApp: (item) => upsert("aiApps", item),
      removeAiApp: (id) => remove("aiApps", id),
      upsertBusinessApp: (item) => upsert("businessApps", item),
      removeBusinessApp: (id) => remove("businessApps", id),
      reset,
      getAgent: (id) => state.agents.find((a) => a.id === id) ?? state.agents[0],
    }),
    [state, upsert, remove, reset],
  )

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}
