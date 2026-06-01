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

// Returns an async generator that yields text chunks as they stream in.
// Usage: for await (const chunk of sendMessage(client, token, text)) { ... }
export async function* startConversation(schemaName) {
  const token = await getToken()
  const { settings } = createCopilotClient(schemaName)
  const client = new CopilotStudioClient(settings, token)

  for await (const activity of client.startConversationStreaming()) {
    const hasContent = activity?.text || activity?.attachments?.length
    if (hasContent) yield { text: activity.text || "", attachments: activity.attachments || [], done: false }
  }
  yield { text: "", attachments: [], done: true, client }
}

export async function* sendMessage(client, text) {
  const activity = { type: "message", text }
  for await (const reply of client.sendActivityStreaming(activity)) {
    const hasContent = reply?.text || reply?.attachments?.length
    if (hasContent) yield { text: reply.text || "", attachments: reply.attachments || [], done: false }
  }
  yield { text: "", attachments: [], done: true }
}

export async function* sendAction(client, actionData) {
  const activity = { type: "message", value: actionData }
  for await (const reply of client.sendActivityStreaming(activity)) {
    const hasContent = reply?.text || reply?.attachments?.length
    if (hasContent) yield { text: reply.text || "", attachments: reply.attachments || [], done: false }
  }
  yield { text: "", attachments: [], done: true }
}
