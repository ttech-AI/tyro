import { InteractionRequiredAuthError } from "@azure/msal-browser"
import { msalInstance, dataverseRequest, DATAVERSE_URL } from "./msal"

const API_BASE = `${DATAVERSE_URL}/api/data/v9.2`
const TABLE = "tyro_launcherapps" // entity-set name (plural)

// tyro_type choice values — match scripts/import_seed_data.py
export const TYPE_AGENT = 100000000
export const TYPE_AI_APP = 100000001
export const TYPE_BUSINESS_APP = 100000002

const COLLECTION_TO_TYPE = {
  agents: TYPE_AGENT,
  aiApps: TYPE_AI_APP,
  businessApps: TYPE_BUSINESS_APP,
}

// Dataverse record ids are GUIDs. Client-generated fallback ids (makeId) and the
// static seed ids are NOT — using one as an OData key (PATCH/DELETE) returns 400.
// Used to decide create-vs-update and to skip remote calls on local-only rows.
export function isGuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value ?? ""),
  )
}

async function getToken() {
  const account = msalInstance.getActiveAccount()
  if (!account) throw new Error("No active MSAL account")
  try {
    const result = await msalInstance.acquireTokenSilent({
      ...dataverseRequest,
      account,
    })
    return result.accessToken
  } catch (err) {
    // Silent renewal failed (refresh token expired or Dataverse consent missing).
    // We deliberately do NOT auto-trigger an interactive redirect from a background
    // data call — that would yank the whole page to AAD without user action. Surface
    // a clear error so ConfigProvider falls back to cached/seed and CRUD shows a real
    // failure; reconnecting requires an explicit sign-out / sign-in.
    if (err instanceof InteractionRequiredAuthError) {
      throw new Error(
        "Dataverse session expired — sign out and sign in again to reconnect.",
        { cause: err },
      )
    }
    throw err
  }
}

async function api(path, init = {}) {
  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Dataverse ${res.status}: ${text || res.statusText}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ---- row ↔ UI item mapping ----

function rowToAgent(r) {
  return {
    id: r.tyro_launcherappid,
    name: r.tyro_name ?? "",
    description: r.tyro_description ?? "",
    tenantId: r.tyro_tenantid ?? "",
    clientId: r.tyro_clientid ?? "",
    agentId: r.tyro_agentid ?? "",
    iconName: r.tyro_iconname ?? "",
    logo: null,
  }
}

function rowToApp(r) {
  return {
    id: r.tyro_launcherappid,
    name: r.tyro_name ?? "",
    description: r.tyro_description ?? "",
    url: r.tyro_url ?? "#",
    iconName: r.tyro_iconname ?? "",
    logo: null,
  }
}

function agentToRow(item) {
  return {
    tyro_name: item.name ?? "",
    tyro_type: TYPE_AGENT,
    tyro_description: item.description ?? "",
    tyro_tenantid: item.tenantId ?? "",
    tyro_clientid: item.clientId ?? "",
    tyro_agentid: item.agentId ?? "",
    tyro_iconname: item.iconName ?? "",
    tyro_isactive: true,
  }
}

function appToRow(item, type) {
  return {
    tyro_name: item.name ?? "",
    tyro_type: type,
    tyro_description: item.description ?? "",
    tyro_url: item.url ?? "#",
    tyro_iconname: item.iconName ?? "",
    tyro_isactive: true,
  }
}

// ---- public API ----

export async function fetchAllItems() {
  const select = [
    "tyro_launcherappid",
    "tyro_name",
    "tyro_type",
    "tyro_description",
    "tyro_url",
    "tyro_tenantid",
    "tyro_clientid",
    "tyro_agentid",
    "tyro_iconname",
    "tyro_sortorder",
    "tyro_isactive",
  ].join(",")
  const data = await api(
    `/${TABLE}?$select=${select}&$filter=tyro_isactive eq true&$orderby=tyro_sortorder`,
  )
  const rows = data.value || []
  return {
    agents: rows.filter((r) => r.tyro_type === TYPE_AGENT).map(rowToAgent),
    aiApps: rows.filter((r) => r.tyro_type === TYPE_AI_APP).map(rowToApp),
    businessApps: rows.filter((r) => r.tyro_type === TYPE_BUSINESS_APP).map(rowToApp),
  }
}

export async function createItem(collection, item) {
  const type = COLLECTION_TO_TYPE[collection]
  const row = collection === "agents" ? agentToRow(item) : appToRow(item, type)
  const created = await api(`/${TABLE}`, {
    method: "POST",
    body: JSON.stringify(row),
    headers: { Prefer: "return=representation" },
  })
  const mapped = collection === "agents" ? rowToAgent(created) : rowToApp(created)
  // tyro_logo is a Dataverse *file* column and can't be written via the entity JSON,
  // so the server row always comes back with logo:null. Carry the client's uploaded
  // logo forward so it survives in local state + cache (see ConfigProvider merge).
  return { ...mapped, logo: item.logo ?? null }
}

export async function updateItem(collection, item) {
  const type = COLLECTION_TO_TYPE[collection]
  const row = collection === "agents" ? agentToRow(item) : appToRow(item, type)
  const updated = await api(`/${TABLE}(${item.id})`, {
    method: "PATCH",
    body: JSON.stringify(row),
    headers: { Prefer: "return=representation" },
  })
  // Return authoritative server fields when the PATCH echoed the row; fall back to
  // the local item if the server answered 204. Either way preserve the client logo
  // (tyro_logo is a file column the entity JSON can't set — see createItem).
  if (!updated) return { ...item }
  const mapped = collection === "agents" ? rowToAgent(updated) : rowToApp(updated)
  return { ...mapped, logo: item.logo ?? null }
}

export async function deleteItem(id) {
  await api(`/${TABLE}(${id})`, { method: "DELETE" })
}
