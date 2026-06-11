import { CopilotStudioClient, ConnectionSettings } from "@microsoft/agents-copilotstudio-client"
import { msalInstance, copilotStudioRequest } from "./msal"

const ENVIRONMENT_ID = import.meta.env.VITE_COPILOT_ENVIRONMENT_ID || "Default-9efa3bdf-67ad-47e3-8dfb-d1df79a6d7fa"

async function getToken() {
  const account = msalInstance.getActiveAccount()
  if (!account) throw new Error("No active account")
  try {
    const result = await msalInstance.acquireTokenSilent({ ...copilotStudioRequest, account })
    return result.accessToken
  } catch {
    const result = await msalInstance.acquireTokenPopup({ ...copilotStudioRequest, account })
    return result.accessToken
  }
}

export function createCopilotClient(schemaName) {
  const settings = new ConnectionSettings({
    environmentId: ENVIRONMENT_ID,
    schemaName,
  })
  return { settings }
}

// Maps a Bot Framework activity to our chunk shape. Captures text, card
// attachments AND suggestedActions (the quick-reply buttons menu-driven
// bots use, e.g. İşlemler / D365 / TİBOT) which live outside attachments.
function activityToChunk(activity) {
  const suggested = activity?.suggestedActions?.actions || []
  const hasContent = activity?.text || activity?.attachments?.length || suggested.length
  if (!hasContent) return null
  // DEV: botun döndürdüğü kart-DIŞI attachment'ların gerçek şekli (dosya
  // indirme renderer'ını/auth'unu kesinleştirmek için). Prod'da çalışmaz.
  if (import.meta.env?.DEV) {
    const files = (activity?.attachments || []).filter(
      (a) => a?.contentType !== "application/vnd.microsoft.card.adaptive",
    )
    if (files.length) console.debug("[copilot] non-card attachments:", files)
  }
  return {
    text: activity.text || "",
    attachments: activity.attachments || [],
    suggestedActions: suggested,
    // Akış protokolü: bot önce ara "typing" delta'ları, en sonda TEK bir
    // tamamlanmış "message" aktivitesi gönderir. `final` yalnızca bu son
    // mesajda true olur — iOS PWA'da bağlantı final gelmeden koparsa
    // ChatScreen yanıtın yarıda kesildiğini buradan anlar.
    final: activity?.type === "message",
    done: false,
  }
}

// Returns an async generator that yields text chunks as they stream in.
export async function* startConversation(schemaName) {
  const token = await getToken()
  const { settings } = createCopilotClient(schemaName)
  const client = new CopilotStudioClient(settings, token)

  for await (const activity of client.startConversationStreaming()) {
    const chunk = activityToChunk(activity)
    if (chunk) yield chunk
  }
  yield { text: "", attachments: [], suggestedActions: [], done: true, client }
}

// Inline attachment limiti. Dosyalar activity'ye base64 data-URI olarak GÖMÜLÜR
// (ayrı bir DirectLine upload endpoint'i yok); base64 ham boyutu ~%33 şişirir ve
// Copilot Studio'nun inline payload'ı ~1 MB civarında sorun çıkarmaya başlar.
// Temkinli bir per-file tavan; gerekirse tek yerden artırılır.
export const MAX_ATTACHMENT_BYTES = 1024 * 1024 // 1 MB

// Bir File'ı Copilot/Bot Framework attachment'ına çevirir:
// { contentType, name, contentUrl: "data:<mime>;base64,..." }. Bot tarafında
// System.Activity.Attachments üzerinden .Name / .Content olarak okunur.
function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error("read failed"))
    reader.onload = () =>
      resolve({
        contentType: file.type || "application/octet-stream",
        name: file.name,
        contentUrl: reader.result, // data:<mime>;base64,<...>
      })
    reader.readAsDataURL(file)
  })
}

// Birden çok File'ı paralel olarak wire attachment'larına çevirir.
export function filesToAttachments(files) {
  return Promise.all((files || []).map(fileToAttachment))
}

export async function* sendMessage(client, text, attachments = []) {
  const activity = { type: "message", text }
  if (attachments.length) activity.attachments = attachments
  for await (const reply of client.sendActivityStreaming(activity)) {
    const chunk = activityToChunk(reply)
    if (chunk) yield chunk
  }
  yield { text: "", attachments: [], suggestedActions: [], done: true }
}

export async function* sendAction(client, actionData) {
  const activity = { type: "message", value: actionData }
  for await (const reply of client.sendActivityStreaming(activity)) {
    const chunk = activityToChunk(reply)
    if (chunk) yield chunk
  }
  yield { text: "", attachments: [], suggestedActions: [], done: true }
}

// imBack/messageBack quick replies: imBack sends the title as a user message;
// messageBack/postBack send the value. Returns { kind, payload } for the caller.
export function resolveSuggestedAction(action) {
  if (action.type === "imBack" || action.type === "messageBack") {
    return { kind: "message", payload: action.value ?? action.title }
  }
  if (action.type === "postBack") {
    return { kind: "action", payload: action.value ?? action.title }
  }
  if (action.type === "openUrl") {
    return { kind: "url", payload: action.value }
  }
  return { kind: "message", payload: action.title }
}
