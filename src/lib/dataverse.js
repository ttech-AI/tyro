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

async function getToken() {
  const account = msalInstance.getActiveAccount()
  if (!account) throw new Error("No active MSAL account")
  const result = await msalInstance.acquireTokenSilent({
    ...dataverseRequest,
    account,
  })
  return result.accessToken
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
  return collection === "agents" ? rowToAgent(created) : rowToApp(created)
}

export async function updateItem(collection, item) {
  const type = COLLECTION_TO_TYPE[collection]
  const row = collection === "agents" ? agentToRow(item) : appToRow(item, type)
  await api(`/${TABLE}(${item.id})`, {
    method: "PATCH",
    body: JSON.stringify(row),
  })
  return { ...item }
}

export async function deleteItem(id) {
  await api(`/${TABLE}(${id})`, { method: "DELETE" })
}
