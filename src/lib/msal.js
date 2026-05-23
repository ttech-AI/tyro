import { PublicClientApplication, EventType, LogLevel } from "@azure/msal-browser"

// Build redirect URI from Vite's BASE_URL so it works in dev (/) and prod (/tyro/)
function buildOrigin() {
  if (typeof window === "undefined") return "/"
  return window.location.origin + import.meta.env.BASE_URL
}

// Defaults baked in so the SPA also works when env vars aren't loaded (e.g. GH Pages
// build without a .env file). Override via VITE_MSAL_* if a different tenant/app is used.
// Note: SPA client IDs are not secrets — they ship in the bundle and are tied to
// allowed redirect URIs in Azure AD.
const TENANT_ID = import.meta.env.VITE_MSAL_TENANT_ID || "9efa3bdf-67ad-47e3-8dfb-d1df79a6d7fa"
const CLIENT_ID = import.meta.env.VITE_MSAL_CLIENT_ID || "1dfbb3bf-0faf-4d17-9d10-3bcb915083f6"

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: buildOrigin(),
    postLogoutRedirectUri: buildOrigin() + "login",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    // localStorage so tokens survive tab close; sessionStorage if you want per-session
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error,
      piiLoggingEnabled: false,
      loggerCallback: () => {},
    },
  },
}

export const loginRequest = {
  scopes: ["User.Read", "openid", "profile", "email"],
  prompt: "select_account",
}

// Dataverse Web API access. Requires the SPA app registration to have
// "Dynamics CRM > user_impersonation" delegated permission (admin consented).
// The scope is the Dataverse environment URL + /user_impersonation.
export const DATAVERSE_URL = "https://tyro.crm4.dynamics.com"
export const dataverseRequest = {
  scopes: [`${DATAVERSE_URL}/user_impersonation`],
}

export const isMsalConfigured = Boolean(CLIENT_ID)

export const msalInstance = new PublicClientApplication(msalConfig)

// Initialize the instance and pick up the active account if one exists in cache.
// Must be awaited before any login/account calls.
let initPromise = null
export function ensureMsalInitialized() {
  if (!initPromise) {
    initPromise = msalInstance.initialize().then(() => {
      const accounts = msalInstance.getAllAccounts()
      if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
        msalInstance.setActiveAccount(accounts[0])
      }
    })
  }
  return initPromise
}

// Keep active account in sync with login / logout events
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
    msalInstance.setActiveAccount(event.payload.account)
  }
  if (event.eventType === EventType.LOGOUT_SUCCESS) {
    msalInstance.setActiveAccount(null)
  }
})
