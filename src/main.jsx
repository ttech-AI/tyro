import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { MsalProvider } from "@azure/msal-react"
import "@fontsource/kanit/700.css"
import "./index.css"
import App from "./App.jsx"
import { msalInstance, ensureMsalInitialized } from "@/lib/msal"
import { ThemeProvider } from "@/providers/ThemeProvider"
import { LocaleProvider } from "@/providers/LocaleProvider"
import { PaletteProvider } from "@/providers/PaletteProvider"
import { ConfigProvider } from "@/providers/ConfigProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

// BASE_URL is "/" in dev, "/tyro/" on GitHub Pages — strip trailing slash for router basename
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/"

// Detect MSAL OAuth callback. URL-only check because Microsoft's COOP can
// sever window.opener after the cross-origin redirect — a `code=` or `error=`
// in the URL is unambiguous and the only way our app sees one is via OAuth.
function isMsalCallbackWindow() {
  if (typeof window === "undefined") return false
  const h = window.location.hash || ""
  const q = window.location.search || ""
  return (
    h.includes("code=") ||
    h.includes("error=") ||
    h.includes("state=") ||
    q.includes("code=") ||
    q.includes("error=")
  )
}

// CRITICAL: detect popup/iframe callback BEFORE MSAL initialize() clears the URL hash.
// If we wait, the hash is gone by the time we check and React renders inside the popup.
const isCallback = isMsalCallbackWindow() || (typeof window !== "undefined" && window.__TYRO_MSAL_CALLBACK__ === true)

// MSAL must finish initialize() before the app reads accounts
ensureMsalInitialized().finally(() => {
  if (isCallback) {
    // Popup / iframe callback — MSAL has now posted the auth response to the opener
    // via postMessage and will close this window. Do NOT render React.
    return
  }
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter basename={basename}>
        <MsalProvider instance={msalInstance}>
          <ThemeProvider>
            <PaletteProvider>
              <LocaleProvider>
                <ConfigProvider>
                  <TooltipProvider delayDuration={150}>
                    <App />
                  </TooltipProvider>
                </ConfigProvider>
              </LocaleProvider>
            </PaletteProvider>
          </ThemeProvider>
        </MsalProvider>
      </BrowserRouter>
    </StrictMode>,
  )
})
