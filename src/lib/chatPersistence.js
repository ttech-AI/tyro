// Per-agent chat persistence backed by sessionStorage. Survives in-tab nav
// (back to dashboard then re-open chat) but clears when the tab closes,
// matching ChatGPT's "new chat on app relaunch" behavior. Don't lift to
// localStorage — agent messages may contain sensitive info.

const PREFIX = "tyro-chat-v1:"
const MAX_MESSAGES = 200 // safety cap; sessionStorage tops out around 5 MB

function key(agentId) {
  return PREFIX + (agentId || "default")
}

export function loadMessages(agentId) {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(key(agentId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Dates were serialized to ISO strings — rehydrate.
    return parsed.map((m) => ({ ...m, time: m.time ? new Date(m.time) : new Date() }))
  } catch {
    return []
  }
}

export function saveMessages(agentId, messages) {
  if (typeof window === "undefined") return
  try {
    const trimmed = messages.slice(-MAX_MESSAGES)
    window.sessionStorage.setItem(key(agentId), JSON.stringify(trimmed))
  } catch {
    /* quota / privacy mode — fail silently */
  }
}

export function clearMessages(agentId) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(key(agentId))
  } catch {
    /* ignore */
  }
}
