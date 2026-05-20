import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.jsx"
import { ThemeProvider } from "@/providers/ThemeProvider"
import { LocaleProvider } from "@/providers/LocaleProvider"
import { PaletteProvider } from "@/providers/PaletteProvider"
import { ConfigProvider } from "@/providers/ConfigProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

createRoot(document.getElementById("root")).render(
  <StrictMode>
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
  </StrictMode>,
)
