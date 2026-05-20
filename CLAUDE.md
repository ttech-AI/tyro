# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built `dist/` for local verification
- `npm run lint` — ESLint over the whole repo (no autofix flag wired up; run `npx eslint . --fix` manually)

No test runner configured.

## Stack & conventions

- **Vite 8 + React 19** with `@vitejs/plugin-react` (Oxc-based). React Compiler intentionally **not** enabled.
- **JavaScript + JSX, not TypeScript.** `components.json` has `"tsx": false`, `jsconfig.json` (not `tsconfig.json`) drives `@/*` → `./src`. When adding shadcn components, scaffold `.jsx`. Path alias is mirrored in `vite.config.js` and `jsconfig.json` — keep both in sync.
- **Tailwind CSS v4** via `@tailwindcss/vite`. No JS config file — theme tokens live in `src/index.css` under `@theme inline { … }`. Add new design tokens there, not in a JS config.
- **shadcn/ui** configured for `radix-mira` style with `baseColor: mist` and **hugeicons** as the icon library (`components.json`). Run `npx shadcn@latest add <component>` to scaffold — components land in `src/components/ui/`. shadcn MCP server is registered in `.mcp.json` for in-conversation component lookup. Context7 MCP is also registered for library docs.
- **Icon library: `@hugeicons/react` + `@hugeicons/core-free-icons`** is the single source. Pattern: `<HugeiconsIcon icon={Search01Icon} />`. **Do not introduce lucide-react** — it was migrated out (the npm package may still be installed but no longer imported). When you need a new icon, search the core-free-icons package for an `XxxIcon` export (e.g. `node --input-type=module -e "import * as i from '@hugeicons/core-free-icons'; console.log(Object.keys(i).filter(n=>n.includes('Search')))"`).
- **Fonts**: **Inter Variable** (primary, `--font-sans`), Roboto Variable kept as fallback. Outfit also installed but unused. Brand wordmark uses `Inter Variable` via `--font-sans`. Wired in `src/index.css`.
- **`cn()` helper** at `src/lib/utils.js` (`clsx` + `tailwind-merge`). Use for conditional class composition.
- **Motion**: `motion` package (framer-motion successor — import from `motion/react`). Used for AppCard stagger / hover lift.

## Brand palette system — single source of truth

The visual brand identity (gradients, accents, logo tones) is driven by **CSS variables**, not Tailwind hardcoded utility classes. Three independent layers:

| Layer | Concern | Provider | Persist key |
|---|---|---|---|
| **Theme** | light / dark | `ThemeProvider` (`src/providers/ThemeProvider.jsx`) | `tyro-theme` |
| **Palette** | brand colors (currently Ocean Breeze + v2) | `PaletteProvider` (`src/providers/PaletteProvider.jsx`) | `tyro-palette` |
| **Locale** | tr / en | `LocaleProvider` (`src/providers/LocaleProvider.jsx`) | `tyro-locale` |

All three set a corresponding attribute on `<html>` (`.dark`, `data-palette="…"`, `lang="…"`). All three persist to `localStorage`. Providers compose in `src/main.jsx` as Theme → Palette → Locale → Tooltip → App.

**Palette tokens** (`src/index.css` under `:root[data-palette="ocean-breeze"]`):

```
--brand-from / --brand-via / --brand-to    ← main 3-stop gradient
--brand-soft / --brand-deep / --brand-text ← accents (text adapts in `.dark`)
--brand-orb-0..4                           ← radial gradient stops for PastelOrb avatar
--brand-logo-1..5                          ← logo-specific tones (sky/cyan biased)
--chart-1 / --chart-2                      ← recharts colors (overridden per palette)
```

Bridged to Tailwind utilities via `@theme inline`:
```
--color-brand-from, --color-brand-via, --color-brand-to,
--color-brand-soft, --color-brand-deep, --color-brand
```

So in JSX use `bg-gradient-to-r from-brand-from via-brand-via to-brand-to`, `text-brand`, `bg-brand-via`, etc. **Do not write `from-sky-400` or `#22d3ee` directly.**

**Adding a new palette** (e.g. "Sunset Glow"):
1. Push to `palettes` array in `src/data/palettes.js` with `id`, `labelKey`, `swatch`
2. Add `:root[data-palette="sunset-glow"] { … }` block in `src/index.css` defining the same full set of `--brand-*` + `--brand-orb-*` + `--brand-logo-*` + `--chart-1/2` variables
3. Add `palette.sunsetGlow` keys to both string dictionaries
4. PaletteSwitcher dropdown picks it up automatically

**Semantic status colors** (emerald / amber / sky in `DataTable` status badges) are intentionally **outside the palette system** — they convey "done / waiting / in-review" meaning, not brand.

## i18n — bilingual rule (strict)

**Every user-facing string MUST be a `t("namespace.key")` lookup** with the same key defined in **both** `src/data/strings.tr.js` and `src/data/strings.en.js`. No hardcoded TR (or EN) literals in JSX, toasts, aria-labels, placeholders, tooltips. Existing namespaces: `brand.*`, `nav.*`, `header.*`, `hero.*`, `stats.*`, `apps.*`, `activity.*`, `activities.*`, `notif.*`, `cmd.*`, `user.*`, `locale.*`, `palette.*`, `construction.*`, `table.*`, `sheet.*`, `chart.*`. Add new namespaces categorically.

**Pattern in components:**
```jsx
const { t, locale } = useLocale()
return <h1>{t("hero.welcome")}, {currentUser.name}</h1>
```

**Pattern in data files** (when a field belongs to data, not UI): use a `{ tr, en }` object — see `src/data/apps.js` (`description`), `src/data/activities.js` (`target`), `src/data/notifications.js` (`body`). Display side: `app.description[locale] ?? app.description.tr`.

**Token interpolation**: keys with `{name}` or `{label}` placeholders are filled via `.replace("{name}", value)` at call site (see `table.toast.saving`, `construction.title`, `hero.summary`, `table.rowsSelected`, `table.page`).

**Exceptions** (no i18n needed): brand wordmarks (TYROAI), app IDs (`tyroSign`, `tyroStrategy`, `tyroWMS`, `tyroTrade`, `tyroProjects`, `tyroAIOps`), hex / numbers, dates (use `Intl.DateTimeFormat` with locale-aware format — see `src/lib/date.js`).

## App layout architecture

`App.jsx` mounts a single dashboard page inside `DashboardLayout`:

```
DashboardLayout (src/components/layout/DashboardLayout.jsx)
├── SidebarProvider                 ← shadcn sidebar context
├── AppSidebar (variant="inset", collapsible="icon")
│   ├── SidebarHeader → TyroLogo + BrandText ("tyroAI")
│   ├── SidebarContent
│   │   ├── NavMain          ← "Yeni sohbet" quick action + Dashboard/Aktivite/Analitik/Chat
│   │   ├── NavApps          ← 5 TYRO apps as external links (target="_blank")
│   │   ├── SidebarCopyright ← "© {year} TTECH Business Solutions"
│   │   └── NavSecondary     ← Ayarlar / Yardım (group label hidden)
│   └── SidebarFooter → NavUser (avatar + dropdown menu)
└── SidebarInset
    ├── Header (sticky)
    │   ├── SidebarTrigger
    │   ├── Breadcrumb (tyroAI > Dashboard)
    │   ├── HeaderSearch    ← Popover-based command palette ("Ara…")
    │   ├── ThemeToggle / PaletteSwitcher / LanguageSwitcher / DateTimePill / HeaderUserButton
    └── main → Dashboard content
        ├── HeroSection
        ├── SectionCards (4 KPI cards, shadcn dashboard-01 pattern)
        ├── ChartAreaInteractive (recharts area chart with toggle)
        └── DataTable (drag-drop + sort + pagination + sheet detail)
```

**Active page state** lives in `AppSidebar` via `useState("dashboard")`. Clicking a non-`ready` nav item triggers a **sonner toast** ("…yapım aşamasında") instead of navigating — see `showComingSoon()`. Only the `dashboard` item has `ready: true`. There is no router yet.

**Old vs. new dashboard components**: An older app-launcher set (`AppCard`, `AppsSection`, `CategoryFilter`, `StatCard`, `StatsGrid`, `ActivityFeed`, `ActivityItem`, `HeroSection`) coexists with the new dashboard-01-derived set (`SectionCards`, `ChartAreaInteractive`, `DataTable`). `App.jsx` currently uses only `HeroSection` + the new dashboard-01 set. The legacy components remain in the tree but are unused — safe to delete if you're confident no future plan needs them.

## Mock data layer

`src/data/`:
- `apps.js` — 6 TYRO apps with hugeicon refs, `{ tr, en }` descriptions, URLs (placeholders `#`), last-used timestamps
- `categories.js` — operations/management/trade/project/it with Tailwind tone classes per category
- `stats.js` — KPI definitions (label key + value + source app id)
- `activities.js` — feed entries with actionKey + `{ tr, en }` target
- `notifications.js` — bell popover entries with read state
- `tableData.js` — DataTable rows; status/type are i18n keys (`done`, `progress`, `strategy`, ...) — display side calls `t(\`table.status.${row.status}\`)`
- `chartData.js` — 90-day pseudo-random series for ChartAreaInteractive
- `user.js` — `currentUser` mock (no auth)
- `nav.js` — workspace + tools nav group definitions (note: `Sidebar.jsx` inlines its own `navMain` array; `nav.js` is mostly historical)
- `palettes.js` — palette registry (only `ocean-breeze` + `ocean-breeze-v2` so far)
- `strings.tr.js` / `strings.en.js` — i18n dictionaries (must stay key-aligned)

When wiring real data, replace these module exports with API calls but keep the same shape — components read from these directly.

## Logo system

`TyroLogo` (`src/components/brand/TyroLogo.jsx`) is the actual 4-path origami "T" SVG ported from the TYROStrategy production project (`C:\Users\Cenk\Desktop\tyrostrategy-repo\…\TyroLogo.tsx`). Default colors pull from `--brand-logo-1..5`, so the logo follows the active palette. `themeColors` prop can override per-instance.

`PastelOrb` (`src/components/brand/PastelOrb.jsx`) is the avatar/orb visual — a CSS radial gradient using `--brand-orb-0..4` for the milky-white → ocean-deep falloff. Used inside `HeaderUserButton`'s gradient ring and `NavUser`.

`BrandText` (`src/components/brand/BrandText.jsx`) renders `tyro` + gradient `AI` ("TYROAI" wordmark) — uses Inter + `tracking-tight` + `text-[16px]`.

## Skill / agent context

- The `tyro-interactive-login` skill describes login-page patterns (cinematic intros, MSAL, scene types) but contains **only docs/templates**, not the actual `TyroLogo` SVG — that came from the TYROStrategy repo on disk.
- A demo reference project sits at `C:\Users\Cenk\Desktop\demo\` (TYROForecast). Useful for cross-checking patterns (sidebar LED-strip active indicator was lifted from there).
- Persistent project memories live in `C:\Users\Cenk\.claude\projects\c--Users-Cenk-Desktop-TYRO-AI-Web-App\memory\`. The bilingual i18n rule is enforced there — do not weaken without updating that memory.

## Platform notes

Development is on **Windows + PowerShell**. Prefer cross-platform `npm` scripts. For one-off shell commands: PowerShell 5.1 has no `&&` chaining (use `;` or `if ($?) { … }`), `$env:VAR` for env vars, `$null` not `/dev/null`. The Bash tool is also available for POSIX scripts.
