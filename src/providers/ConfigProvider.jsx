import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { useIsAuthenticated } from "@azure/msal-react"
import { seedAgents, seedAiApps, seedBusinessApps } from "@/data/seedConfig"
import { isMsalConfigured } from "@/lib/msal"
import * as dv from "@/lib/dataverse"

const STORAGE_KEY = "tyro-config-v1"

export const ConfigContext = createContext(null)

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function readCache() {
  if (typeof window === "undefined") {
    return { agents: seedAgents, aiApps: seedAiApps, businessApps: seedBusinessApps }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { agents: seedAgents, aiApps: seedAiApps, businessApps: seedBusinessApps }
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

function writeCache(state) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        agents: state.agents,
        aiApps: state.aiApps,
        businessApps: state.businessApps,
      }),
    )
  } catch {
    /* quota / privacy mode — fail silently */
  }
}

export function ConfigProvider({ children }) {
  // Start with localStorage cache (so the UI has something while Dataverse loads)
  const [state, setState] = useState(() => ({
    ...readCache(),
    loading: false,
    error: null,
    source: "local",
  }))
  const isAuthed = useIsAuthenticated()
  const useDataverse = isMsalConfigured && isAuthed

  // Fetch from Dataverse when authenticated; fall back to cached/seed on failure.
  useEffect(() => {
    if (!useDataverse) return
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    dv.fetchAllItems()
      .then((data) => {
        if (cancelled) return
        setState({ ...data, loading: false, error: null, source: "dataverse" })
        writeCache(data)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn("[Dataverse] fetch failed, using cached/seed:", err.message)
        setState((prev) => ({ ...prev, loading: false, error: err.message, source: "local" }))
      })
    return () => {
      cancelled = true
    }
  }, [useDataverse])

  // Persist local cache so the next session sees the same data offline.
  useEffect(() => {
    writeCache(state)
  }, [state])

  const upsert = useCallback(
    async (collection, item) => {
      // Optimistic local update
      const id = item.id || makeId()
      const next = { ...item, id }
      setState((prev) => {
        const list = prev[collection]
        const idx = list.findIndex((x) => x.id === id)
        const updated = idx >= 0 ? list.map((x, i) => (i === idx ? next : x)) : [...list, next]
        return { ...prev, [collection]: updated }
      })
      // Remote write
      if (!useDataverse) return next
      try {
        const isExisting =
          state[collection]?.some((x) => x.id === id) || Boolean(item.id)
        const saved = isExisting
          ? await dv.updateItem(collection, next)
          : await dv.createItem(collection, next)
        // Reconcile id if server returned one (insert case)
        if (saved.id && saved.id !== id) {
          setState((prev) => ({
            ...prev,
            [collection]: prev[collection].map((x) => (x.id === id ? saved : x)),
          }))
        }
        return saved
      } catch (err) {
        console.warn("[Dataverse] upsert failed:", err.message)
        setState((prev) => ({ ...prev, error: err.message }))
        throw err
      }
    },
    [useDataverse, state],
  )

  const remove = useCallback(
    async (collection, id) => {
      // Optimistic local remove
      setState((prev) => ({
        ...prev,
        [collection]: prev[collection].filter((x) => x.id !== id),
      }))
      if (!useDataverse) return
      try {
        await dv.deleteItem(id)
      } catch (err) {
        console.warn("[Dataverse] delete failed:", err.message)
        setState((prev) => ({ ...prev, error: err.message }))
        throw err
      }
    },
    [useDataverse],
  )

  const reset = useCallback((collection) => {
    setState((prev) => {
      if (collection === "agents") return { ...prev, agents: seedAgents }
      if (collection === "aiApps") return { ...prev, aiApps: seedAiApps }
      if (collection === "businessApps") return { ...prev, businessApps: seedBusinessApps }
      return {
        ...prev,
        agents: seedAgents,
        aiApps: seedAiApps,
        businessApps: seedBusinessApps,
      }
    })
  }, [])

  const value = useMemo(
    () => ({
      agents: state.agents,
      aiApps: state.aiApps,
      businessApps: state.businessApps,
      loading: state.loading,
      error: state.error,
      source: state.source,
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
