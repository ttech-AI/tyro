import { useMsal } from "@azure/msal-react"
import { isMsalConfigured } from "@/lib/msal"
import { currentUser as mockUser } from "@/data/user"

function initialsFromName(name) {
  if (!name) return ""
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

/**
 * Returns the currently signed-in user in a shape matching `currentUser`:
 *   { name, fullName, initials, email, title }
 *
 * When MSAL is configured and a session is active, values come from the active
 * MSAL account claims. Otherwise it falls back to the mock currentUser so the
 * UI keeps working in preview / no-auth mode.
 */
export function useMe() {
  // Always call useMsal — provider exists in both modes (configured / not)
  const { accounts } = useMsal()
  const account = accounts[0]

  if (!isMsalConfigured || !account) return mockUser

  const fullName = account.name || account.username || mockUser.fullName
  const firstName = fullName.split(/\s+/)[0]

  return {
    name: firstName,
    fullName,
    initials: initialsFromName(fullName) || mockUser.initials,
    email: account.username || mockUser.email,
    title: mockUser.title,
  }
}
