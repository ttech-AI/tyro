import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "@fontsource/kanit/700.css"
import "./index.css"
import App from "./App.jsx"
import { ThemeProvider } from "@/providers/ThemeProvider"
import { LocaleProvider } from "@/providers/LocaleProvider"
import { PaletteProvider } from "@/providers/PaletteProvider"
import { ConfigProvider } from "@/providers/ConfigProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

// BASE_URL is "/" in dev, "/tyro/" on GitHub Pages — strip trailing slash for router basename
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
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
    </BrowserRouter>
  </StrictMode>,
)
