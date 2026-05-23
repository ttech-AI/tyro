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

// MSAL redirect flow: initialize, then process any auth response the redirect
// landed us with (clears the URL hash + sets the active account) BEFORE React
// mounts. App's auth gate then sees the authenticated state on first render.
ensureMsalInitialized()
  .then(() => msalInstance.handleRedirectPromise())
  .then((result) => {
    if (result?.account) {
      msalInstance.setActiveAccount(result.account)
    }
  })
  .catch((err) => {
    console.warn("[MSAL] redirect handler failed:", err?.errorCode || err?.message || err)
  })
  .finally(() => {
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
