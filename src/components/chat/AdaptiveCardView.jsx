import { useEffect, useRef } from "react"
import * as AC from "adaptivecards"
import MarkdownIt from "markdown-it"
import { useTheme } from "@/hooks/useTheme"
import { normalizeBotMarkdown } from "@/lib/markdown"

// Markdown processor — Copilot Studio TextBlocks frequently contain markdown
// (**bold**, lists, links). The official renderer leaves text raw unless a
// global markdown processor is wired up; markdown-it is the processor
// Microsoft's own samples recommend.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
AC.AdaptiveCard.onProcessMarkdown = (text, result) => {
  result.outputHtml = md.render(normalizeBotMarkdown(text))
  result.didProcess = true
}

function readVar(el, name) {
  return getComputedStyle(el).getPropertyValue(name).trim()
}

// Copilot Studio butonları ikonları gerçek URL yerine "icon:Eye" gibi bir
// Fluent System Icon referansıyla gönderir. Microsoft'un kendi host'u (WebChat)
// bu şemayı çözer; standart adaptivecards SDK'sı ise onu URL sanıp
// ERR_UNKNOWN_URL_SCHEME ile kırık görsel basar. "icon:<Ad>"ı Fluent System
// Icons SVG CDN URL'sine çeviriyoruz: "CursorClick" → cursor_click_24_regular.svg
const FLUENT_SVG_BASE = "https://unpkg.com/@fluentui/svg-icons/icons/"
function fluentIconUrl(name) {
  const snake = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()
  return `${FLUENT_SVG_BASE}${snake}_24_regular.svg`
}
// Kart ağacını gezip iconUrl/url alanlarındaki "icon:" şemasını yeniden yazar.
function rewriteIconScheme(node) {
  if (Array.isArray(node)) {
    node.forEach(rewriteIconScheme)
    return
  }
  if (node && typeof node === "object") {
    for (const key of Object.keys(node)) {
      const val = node[key]
      if ((key === "iconUrl" || key === "url") && typeof val === "string" && val.startsWith("icon:")) {
        node[key] = fluentIconUrl(val.slice(5))
      } else {
        rewriteIconScheme(val)
      }
    }
  }
}

// Build a HostConfig from the app's live CSS variables so the card inherits
// the active palette + light/dark theme (oklch values are valid CSS colors
// and the renderer applies them as inline styles).
function buildHostConfig(rootEl) {
  const fg = readVar(rootEl, "--foreground") || "#1a1a1a"
  const subtle = readVar(rootEl, "--muted-foreground") || "#6b7280"
  const accent = readVar(rootEl, "--brand-via") || readVar(rootEl, "--primary") || "#2563eb"
  const destructive = readVar(rootEl, "--destructive") || "#dc2626"
  const border = readVar(rootEl, "--border") || "#e5e7eb"
  const muted = readVar(rootEl, "--muted") || "#f3f4f6"

  const fgColors = {
    default: { default: fg, subtle },
    dark: { default: fg, subtle },
    light: { default: fg, subtle },
    accent: { default: accent, subtle: accent },
    good: { default: "#16a34a", subtle: "#16a34a" },
    warning: { default: "#d97706", subtle: "#d97706" },
    attention: { default: destructive, subtle: destructive },
  }

  return new AC.HostConfig({
    fontFamily: "'Inter Variable', 'Roboto Variable', sans-serif",
    supportsInteractivity: true,
    spacing: { small: 4, default: 8, medium: 12, large: 16, extraLarge: 20, padding: 12 },
    separator: { lineThickness: 1, lineColor: border },
    fontSizes: { small: 12, default: 14, medium: 16, large: 18, extraLarge: 22 },
    fontWeights: { lighter: 300, default: 400, bolder: 600 },
    imageSizes: { small: 32, medium: 52, large: 100 },
    containerStyles: {
      default: { backgroundColor: "#00000000", foregroundColors: fgColors },
      emphasis: { backgroundColor: muted, foregroundColors: fgColors },
    },
    actions: {
      maxActions: 100,
      spacing: "default",
      buttonSpacing: 8,
      actionsOrientation: "horizontal",
      actionAlignment: "stretch",
      showCard: { actionMode: "inline", inlineTopMargin: 8 },
    },
    inputs: { label: { requiredInputs: { suffix: " *" } } },
  })
}

// Renders a Copilot Studio Adaptive Card via Microsoft's official SDK.
// Handles the full card schema (every input type, action, layout) so we
// don't maintain a partial hand-rolled renderer. onAction fires with the
// merged input values when the user submits.
export function AdaptiveCardView({ card, onAction }) {
  const containerRef = useRef(null)
  const { theme } = useTheme()
  // Keep the callback in a ref so a new function identity from the parent
  // doesn't re-run the render effect (which would wipe in-progress input
  // state). Synced in its own effect to satisfy the no-ref-write-in-render rule.
  const onActionRef = useRef(onAction)
  useEffect(() => {
    onActionRef.current = onAction
  }, [onAction])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ""

    const adaptiveCard = new AC.AdaptiveCard()
    adaptiveCard.hostConfig = buildHostConfig(document.documentElement)
    adaptiveCard.onExecuteAction = (action) => {
      if (action instanceof AC.OpenUrlAction) {
        const href = action.getHref?.() || action.url
        if (href) window.open(href, "_blank", "noopener,noreferrer")
        return
      }
      if (action instanceof AC.SubmitAction || action instanceof AC.ExecuteAction) {
        const data = action.data || {}
        const verb = action instanceof AC.ExecuteAction ? action.verb : undefined
        onActionRef.current?.(verb ? { verb, ...data } : { ...data })
      }
    }

    try {
      // "icon:" şemasını Fluent SVG URL'sine çevir (orijinali bozma → klonla).
      const cardJson = JSON.parse(JSON.stringify(card))
      rewriteIconScheme(cardJson)
      adaptiveCard.parse(cardJson)
      const rendered = adaptiveCard.render()
      if (rendered) {
        container.appendChild(rendered)
        // Kart/buton ikonları (Action.iconUrl, Image) yüklenemezse tarayıcı
        // çirkin kırık-görsel (default) placeholder'ı basıyor. Yükleme
        // başarısız olanı gizle ve hangi URL'in patladığını konsola yaz ki
        // kök sebebi (404 / 401-auth / geçersiz URL) teşhis edebilelim.
        container.querySelectorAll("img").forEach((img) => {
          img.addEventListener("error", () => {
            console.warn("[AdaptiveCard] görsel yüklenemedi:", img.src)
            img.style.display = "none"
          })
        })
        // DEV: her input alanının render biçimini dök. ChoiceSet "compact" →
        // <select>, "filtered" → <input type=text>+datalist olarak gelir;
        // chevron ikonunun neden bazı alanlarda eksik olduğunu buradan görürüz.
        if (import.meta.env?.DEV) {
          const fields = [...container.querySelectorAll("input, select, textarea")].map((el) => ({
            label: el.closest(".ac-input-container")?.querySelector(".ac-input-label")?.textContent?.trim() || el.getAttribute("aria-label") || el.placeholder || "(etiketsiz)",
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute("type") || "",
            cls: el.className,
          }))
          console.debug("[AdaptiveCard] input alanları:", fields)
        }
      }
    } catch (err) {
      console.error("AdaptiveCard render error:", err)
      container.textContent = card?.fallbackText || ""
    }

    return () => {
      container.innerHTML = ""
    }
    // theme drives a HostConfig rebuild so colors follow light/dark + palette.
  }, [card, theme])

  return <div ref={containerRef} className="ac-host" />
}
