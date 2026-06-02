import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { useIsAuthenticated } from "@azure/msal-react"
import { seedAgents, seedAiApps, seedBusinessApps } from "@/data/seedConfig"
import { isMsalConfigured } from "@/lib/msal"
import * as dv from "@/lib/dataverse"

const STORAGE_KEY = "tyro-config-v1"
const COLLECTIONS = ["agents", "aiApps", "businessApps"]

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

// Business key for a launcher item within a collection. The collection already
// fixes the type, so name (normalized) is the per-collection half of the server's
// tyro_NameTypeKey (name + type) alternate key.
const nameKey = (x) => (x.name ?? "").trim().toLowerCase()

// Reconcile a fresh Dataverse snapshot with current local state:
// - carry forward any cached logo (tyro_logo is a file column not returned inline),
//   matching by id first then by business name (covers a local row whose id was
//   reconciled to a server GUID under the no-crypto makeId fallback path).
// - keep genuinely local-only rows (created offline, not yet on the server) so an
//   optimistic add isn't dropped on the first authenticated fetch — but exclude the
//   seed rows, whose non-GUID ids differ from the server GUIDs yet name+type-match an
//   already-imported server row (otherwise every seed item would appear twice).
function mergeServerData(prev, data) {
  const merged = {}
  for (const key of COLLECTIONS) {
    const serverList = data[key] || []
    const prevList = prev[key] || []
    const prevById = new Map(prevList.map((x) => [x.id, x]))
    const prevByName = new Map(prevList.map((x) => [nameKey(x), x]))
    const serverIds = new Set(serverList.map((x) => x.id))
    const serverNames = new Set(serverList.map(nameKey))
    const withLogos = serverList.map((row) => {
      const cached = prevById.get(row.id) || prevByName.get(nameKey(row))
      return cached?.logo ? { ...row, logo: cached.logo } : row
    })
    const localOnly = prevList.filter(
      (x) => !dv.isGuid(x.id) && !serverIds.has(x.id) && !serverNames.has(nameKey(x)),
    )
    merged[key] = [...withLogos, ...localOnly]
  }
  return merged
}

export function ConfigProvider({ children }) {
  // Data lives in `state`; transient status (loading/error/source) is kept separate
  // so a loading flip doesn't churn the localStorage write or re-render every consumer.
  const [state, setState] = useState(readCache)
  const [status, setStatus] = useState({ loading: false, error: null, source: "local" })
  const isAuthed = useIsAuthenticated()
  const useDataverse = isMsalConfigured && isAuthed

  // Fetch from Dataverse when authenticated; fall back to cached/seed on failure.
  useEffect(() => {
    if (!useDataverse) return
    let cancelled = false
    setStatus((s) => ({ ...s, loading: true, error: null }))
    dv.fetchAllItems()
      .then((data) => {
        if (cancelled) return
        // Merge rather than replace — preserve cached logos and local-only rows.
        // Merge sırasında, ikonu HENÜZ olmayan (cache'te logosu bulunmayan)
        // agent'ların schemaName'lerini topla — yalnızca onlar için ikon çekeriz.
        let needIcons = []
        setState((prev) => {
          const merged = mergeServerData(prev, data)
          needIcons = merged.agents
            .filter((a) => a.agentId && a.agentId !== "agent-id" && !a.logo)
            .map((a) => a.agentId)
          return merged
        })
        setStatus({ loading: false, error: null, source: "dataverse" })

        // Best-effort: Copilot Studio agent'larının gerçek ikonunu `bot`
        // tablosundan çekip logo olarak iliştir. Yetki yoksa sessizce atlanır
        // (fetchBotIcons {} döner) → agent mevcut hugeicon'unu korur. Admin'in
        // elle yüklediği özel logoyu (!a.logo) ezmeyiz. İkonu cache'lenmiş
        // agent'lar needIcons'ta olmadığı için her açılışta yeniden sorgulanmaz.
        if (!needIcons.length) return
        dv.fetchBotIcons(needIcons)
          .then((icons) => {
            if (cancelled || !Object.keys(icons).length) return
            setState((prev) => ({
              ...prev,
              agents: prev.agents.map((a) =>
                a.agentId && icons[a.agentId] && !a.logo
                  ? { ...a, logo: icons[a.agentId] }
                  : a,
              ),
            }))
          })
          .catch((err) => console.warn("[Dataverse] agent ikon zenginleştirme hatası:", err.message))
      })
      .catch((err) => {
        if (cancelled) return
        console.warn("[Dataverse] fetch failed, using cached/seed:", err.message)
        setStatus({ loading: false, error: err.message, source: "local" })
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
      // Remote write. Decide create-vs-update by whether the id is a real Dataverse
      // GUID — a non-GUID id is a local-only/seed row that must be POSTed, never
      // PATCHed (PATCH on a non-GUID key 400s).
      if (!useDataverse) return next
      try {
        const saved = dv.isGuid(item.id)
          ? await dv.updateItem(collection, next)
          : await dv.createItem(collection, next)
        // Reconcile id if the server assigned one (insert case).
        if (saved.id && saved.id !== id) {
          setState((prev) => ({
            ...prev,
            [collection]: prev[collection].map((x) => (x.id === id ? saved : x)),
          }))
        }
        return saved
      } catch (err) {
        console.warn("[Dataverse] upsert failed:", err.message)
        setStatus((s) => ({ ...s, error: err.message }))
        throw err
      }
    },
    [useDataverse],
  )

  const remove = useCallback(
    async (collection, id) => {
      // Optimistic local remove
      setState((prev) => ({
        ...prev,
        [collection]: prev[collection].filter((x) => x.id !== id),
      }))
      // Local-only rows (non-GUID id) were never persisted — nothing to delete remotely.
      if (!useDataverse || !dv.isGuid(id)) return
      try {
        await dv.deleteItem(id)
      } catch (err) {
        console.warn("[Dataverse] delete failed:", err.message)
        setStatus((s) => ({ ...s, error: err.message }))
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
      loading: status.loading,
      error: status.error,
      source: status.source,
      upsertAgent: (item) => upsert("agents", item),
      removeAgent: (id) => remove("agents", id),
      upsertAiApp: (item) => upsert("aiApps", item),
      removeAiApp: (id) => remove("aiApps", id),
      upsertBusinessApp: (item) => upsert("businessApps", item),
      removeBusinessApp: (id) => remove("businessApps", id),
      reset,
      getAgent: (id) => state.agents.find((a) => a.id === id) ?? state.agents[0],
    }),
    [state, status, upsert, remove, reset],
  )

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}
