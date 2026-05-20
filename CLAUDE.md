# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server with HMR
- `npm run build` — production build to `dist/` (uses `base: "/tyro/"` for GitHub Pages, `/` in dev)
- `npm run preview` — serve the built `dist/` for local verification
- `npm run lint` — ESLint over the whole repo (no autofix flag wired up; run `npx eslint . --fix` manually)

No test runner configured.

For Dataverse work (see Dataverse backend section), Python scripts live in `scripts/`:
- `python scripts/auth.py` — verify auth token acquisition
- `python scripts/list_publishers.py` — list publishers in the connected env
- `python scripts/list_columns.py` — list custom vs system columns of `tyro_launcherapp`
- `python scripts/import_seed_data.py` — idempotent seed-data importer

## Stack & conventions

- **Vite 8 + React 19** with `@vitejs/plugin-react` (Oxc-based). React Compiler intentionally **not** enabled.
- **JavaScript + JSX, not TypeScript.** `components.json` has `"tsx": false`, `jsconfig.json` (not `tsconfig.json`) drives `@/*` → `./src`. When adding shadcn components, scaffold `.jsx`. Path alias mirrored in `vite.config.js` and `jsconfig.json` — keep both in sync.
- **Tailwind CSS v4** via `@tailwindcss/vite`. No JS config — theme tokens live in `src/index.css` under `@theme inline { … }`. Add new design tokens there, not in a JS config.
- **shadcn/ui** configured for `radix-mira` style with `baseColor: mist` and **hugeicons** as the icon library (`components.json`). Run `npx shadcn@latest add <component>` to scaffold — components land in `src/components/ui/`. shadcn MCP and Context7 MCP are registered in `.mcp.json` for in-conversation lookup.
- **Icons: `@hugeicons/react` + `@hugeicons/core-free-icons`** is the single source. Pattern: `<HugeiconsIcon icon={Search01Icon} />`. **Do not introduce lucide-react** — it was migrated out (the npm package may still be installed but no longer imported). To verify an icon name before using it: `node --input-type=module -e "import * as i from '@hugeicons/core-free-icons'; console.log(Object.keys(i).filter(n=>n.includes('Search')))"`. There is also `src/lib/iconRegistry.js` with `searchIcons(query)` — used by the Settings icon-picker UI.
- **Fonts**: Inter Variable (primary, `--font-sans`), Roboto Variable fallback. Outfit also installed but unused. Wired in `src/index.css`.
- **`cn()` helper** at `src/lib/utils.js` (`clsx` + `tailwind-merge`). Use for conditional class composition.
- **Motion**: `motion` package (framer-motion successor — import from `motion/react`). Used for orb animations, AppLauncher hero/cards stagger, NavApps overflow expand, sonner toast spring.

## Provider stack (composition order matters)

`src/main.jsx` wraps `<App />` in this order (outermost first):

```
ThemeProvider     → src/providers/ThemeProvider.jsx     → tyro-theme        (light/dark)
  PaletteProvider → src/providers/PaletteProvider.jsx   → tyro-palette      (brand palette)
    LocaleProvider→ src/providers/LocaleProvider.jsx    → tyro-locale       (tr/en)
      ConfigProvider → src/providers/ConfigProvider.jsx → tyro-config-v1    (agents/aiApps/businessApps)
        TooltipProvider
          App
```

All four set an attribute on `<html>` (`.dark`, `data-palette="…"`, `lang="…"`) and persist to `localStorage` under the keys shown. Hooks: `useTheme`, `usePalette`, `useLocale`, `useConfig`.

**ConfigProvider** holds the dynamic admin data (agents, AI products, business apps). It seeds from `src/data/seedConfig.js` on first load, then becomes the source of truth — `AppLauncher`, `NavApps`, `ChatScreen`, `AgentSelect`, `ChatMessage` all read from `useConfig()`. The Settings admin panel writes back to it (and thus to localStorage). When wiring real backend, replace the `localStorage` read/write in `ConfigProvider` with API calls — consumers won't change.

## App layout architecture

`src/App.jsx` is a state-based router (no react-router). Active page lives in `activeId` state, lifted up so the sidebar can drive it:

```
App.jsx
├── state: activeId ("dashboard" | "chat" | "analytics" | "settings")
├── state: chatResetKey (incremented to remount ChatScreen on "new chat")
├── state: chatPrefilledAgent (agent id to preselect on chat open)
└── DashboardLayout (passes activeId + onActiveIdChange + onNewChat to sidebar)
    ├── AppSidebar
    │   ├── nav.dashboard / nav.chat / nav.analytics (ready)
    │   ├── NavApps (Business + AI groups from useConfig)
    │   └── nav.settings (ready), nav.help (comingSoon)
    └── content (switch on activeId):
        ├── dashboard  → AppLauncher (hero + 3 sections)
        ├── chat       → ChatScreen (key={chatResetKey})
        ├── analytics  → legacy dashboard-01 (HeroSection + SectionCards + Chart + DataTable)
        └── settings   → SettingsPage (General + Agentlar + AI Ürünler + İş Uygulamaları tabs)
```

Sidebar "Yeni sohbet" quick-action → `handleNewChat()` resets ChatScreen via key bump. Agent card in AppLauncher → `handleOpenChatWithAgent(id)` opens chat preselected. Clicking a non-`ready` nav item triggers a custom sonner toast (`showComingSoon` in `Sidebar.jsx`).

**NavApps overflow** (`src/components/layout/NavApps.jsx`): groups with > 3 items show first 3 + a "{count} tane daha ▾" toggle, expanding the rest with staggered fade-in. Threshold constant: `COLLAPSE_THRESHOLD`. Sidebar's icon-collapsed mode hides NavApps entirely (`group-data-[collapsible=icon]:hidden`).

## Brand palette system — single source of truth

The visual brand identity (gradients, accents, logo tones, orb colors, avatar text) is driven by **CSS variables**, not Tailwind hardcoded utility classes.

Palettes are grouped into two kinds in `src/data/palettes.js`:

- **Solid** (`group: "solid"`): Black, Amber, Navy, Sky, Violet — single-color (no gradient, all 3 brand stops the same)
- **Gradient** (`group: "gradient"`): Ocean Breeze (default), Ocean Breeze v2, Insta, Peach Sorbet, Sunset, Pastel Lavender, Green Garden, Fiery Red, Chocolate Delight

`PaletteSwitcher` renders them in two grouped sections with a separator.

**Palette tokens** (`src/index.css` under `:root[data-palette="…"]`):

```
--brand-from / --brand-via / --brand-to    ← main 3-stop gradient (solid palettes use same color for all 3)
--brand-soft / --brand-deep / --brand-text ← accents (dark mode overrides --brand-text per palette)
--brand-orb-0..4                            ← radial gradient stops for PastelOrb avatar
--brand-logo-1..5                           ← TyroLogo SVG paint colors
--chart-1 / --chart-2                       ← recharts colors
--voiceorb-c1..c5                           ← PastelVoiceOrb (chat) palette adaptation (RGB triples, used as rgba(var(--voiceorb-cN), opacity))
--avatar-text                               ← header initial letter color (auto: orb-4 for light palettes, orb-1 for dark palettes)
```

Bridged to Tailwind utilities via `@theme inline`:
```
--color-brand-from, --color-brand-via, --color-brand-to,
--color-brand-soft, --color-brand-deep, --color-brand
```

In JSX use `bg-gradient-to-r from-brand-from via-brand-via to-brand-to`, `text-brand`, `bg-brand-via`, etc. **Do not write `from-sky-400` or hex literals directly.**

**Adding a new palette**:
1. Push to `palettes` array in `src/data/palettes.js` with `id`, `labelKey`, `swatch`, `group`
2. Add `:root[data-palette="<id>"] { … }` block in `src/index.css` defining the full set of `--brand-*` + `--brand-orb-*` + `--brand-logo-*` + `--chart-1/2` + `--voiceorb-c1..c5` variables
3. Add the palette id to the dark-orb list near `--avatar-text` if its orb-3 stop is dark (so initials flip from orb-4 to orb-1)
4. Add `palette.<id>` keys to both `strings.tr.js` and `strings.en.js`
5. Add a `.dark[data-palette="<id>"]` override block if the base color is too dark to read on dark backgrounds

**Semantic status colors** (emerald/amber/sky in DataTable badges) are intentionally **outside the palette system** — they convey done/waiting/in-review meaning, not brand.

## i18n — bilingual rule (strict)

**Every user-facing string MUST be a `t("namespace.key")` lookup** with the same key in **both** `src/data/strings.tr.js` and `src/data/strings.en.js`. No hardcoded TR/EN literals in JSX, toasts, aria-labels, placeholders, tooltips. Existing namespaces: `brand`, `nav`, `header`, `hero`, `stats`, `apps`, `activity`, `activities`, `notif`, `cmd`, `user`, `locale`, `palette`, `construction`, `table`, `sheet`, `chart`, `chat`, `launcher`, `dashboard.hero`, `settings`.

**Pattern in components**:
```jsx
const { t, locale } = useLocale()
return <h1>{t("hero.welcome")}, {currentUser.name}</h1>
```

**Token interpolation**: keys with `{name}` or `{label}` placeholders are filled via `.replace("{name}", value)` at call site.

**Exceptions** (no i18n): brand wordmarks ("TYROAI"), app IDs (`tyroSign`, `tyroStrategy`, …), agent IDs (`tyroHR`, `tyroTrader`), hex/numbers, dates (use `Intl.DateTimeFormat` with locale — see `src/lib/date.js`).

**Dynamic admin data** is single-language (`description: string` not `{tr, en}`) because the user types it once. Pre-Settings static data still uses `{tr, en}` objects (see legacy `src/data/apps.js`).

## Settings admin panel

`src/components/settings/SettingsPage.jsx` is a 4-tab admin UI for the dynamic ConfigProvider data.

- **Genel** (`GeneralTab.jsx`): app metadata card (logo + version) + localStorage inventory (`tyro-theme`, `tyro-palette`, `tyro-locale`, `tyro-config-v1`) with per-key size + clear actions. Logo uses palette swatch via `themeColors` prop to TyroLogo (palette-aware, not CSS-variable-bound so it doesn't flip in dark mode on white bg).
- **AI Agentlar / AI Ürünler / İş Uygulamaları**: CRUD list of items in respective ConfigProvider arrays. Each item: name, description, icon (Hugeicon search via `IconPicker`), optional custom logo upload (`LogoUpload`, base64 in localStorage, max 256 KB, overrides icon). Agents also have `tenantId`, `clientId`, `agentId` (for MSAL). Apps also have `url`.

`EntityForm.jsx` uses a key-based remount pattern (`<EntityFormInner key={initialValue?.id ?? "new-${kind}"}>`) to reset form state without useEffect setState — required by the `react-hooks/set-state-in-effect` lint rule.

`IconOrLogo` (`src/components/common/IconOrLogo.jsx`) is the rendering primitive: shows `<img>` if `logo` is set, else looks up `iconName` in `iconRegistry`, else renders a `?` placeholder.

## Mock/seed data layer

`src/data/`:
- **`seedConfig.js`** — initial 12 items (2 agents + 6 AI apps + 4 business apps). Loaded by ConfigProvider on first run. The dynamic source of truth at runtime is ConfigProvider's localStorage; seedConfig is fallback.
- `appMeta.js` — app version (read from `package.json`), brand, stack list — used by Settings General tab.
- `palettes.js` — palette registry (14 palettes across two groups)
- `strings.tr.js` / `strings.en.js` — i18n dictionaries (must stay key-aligned)
- `user.js` — `currentUser` mock (no auth yet — will be replaced by MSAL claims)
- `agents.js`, `apps.js`, `nav.js`, `categories.js`, `stats.js`, `activities.js`, `notifications.js`, `tableData.js`, `chartData.js` — legacy static mock data still used by the Analytics page (HeroSection, SectionCards, DataTable, etc.). Dashboard launcher and chat reference ConfigProvider instead.

## Dataverse backend (early integration)

A Dataverse environment is wired for storing launcher items (currently parallel to localStorage; MSAL-backed frontend integration is a TODO).

- **Environment**: `https://tyro.crm4.dynamics.com/` — tenant `9efa3bdf-67ad-47e3-8dfb-d1df79a6d7fa` (Tiryaki)
- **Solution**: `TYROAIPlatform` ("TYRO AI Platform" display, publisher prefix **`tyro`**)
- **Table**: `tyro_launcherapp` (display "TYRO Launcher App") — **OrganizationOwned** (no per-row ownership; access via Security Roles only)
- **Columns**: `tyro_name` (primary), `tyro_type` (Choice: Agent=100000000 / AI App=100000001 / Business App=100000002), `tyro_description`, `tyro_url`, `tyro_tenantid`, `tyro_clientid`, `tyro_agentid`, `tyro_iconname`, `tyro_sortorder`, `tyro_isactive`, `tyro_logo` (file)

**Scripts** (in `scripts/`, all use Python SDK `PowerPlatform-Dataverse-Client` + `requests` for Web API fallback):
- `auth.py` — `load_env()` + `get_credential()` chain (SharedTokenCache → InteractiveBrowser → DeviceCode)
- `setup_tyro_platform.py` — idempotent publisher + solution + table creation (SDK)
- `recreate_table_org_owned.py` — destructive drop+recreate as OrganizationOwned (used once to switch ownership; keep for reference)
- `add_columns_only.py` — adds remaining columns + fixes choice labels via Web API
- `fix_choice_labels.py` — `UpdateOptionValue` + display name PUT for the Type choice
- `inspect_table.py` / `list_columns.py` / `list_publishers.py` — read-only inspectors
- `import_seed_data.py` — imports the 12 seedConfig items into `tyro_launcherapp` (idempotent — dedupes on `tyro_name + tyro_type`)

**`.env`** (gitignored) provides `DATAVERSE_URL`, `TENANT_ID`, `MCP_CLIENT_ID`, `SOLUTION_NAME`, `PUBLISHER_PREFIX`, `PAC_AUTH_PROFILE` to the scripts.

**pac CLI** is installed at `C:\Users\Cenk\AppData\Local\Microsoft\PowerAppsCli\Microsoft.PowerApps.CLI.<ver>\tools\pac.exe`. Active auth profile (`UNIVERSAL`) is shared with the VS Code Power Platform extension. To switch envs: `pac org select --environment <url>`.

**Open items** (in todo list):
- MSAL setup in the SPA (`@azure/msal-react` + `@azure/msal-browser`)
- After MSAL: migrate ConfigProvider's localStorage CRUD to Dataverse Web API
- Create alternate key on `tyro_name + tyro_type` for upsert idempotency
- `pac solution export → solutions/TYROAIPlatform/` → commit (currently solution lives only in Dataverse)

## Chat screen + PastelVoiceOrb

`src/components/chat/ChatScreen.jsx` is the standalone chat view. State-driven 4-mode interactive `PastelVoiceOrb` (`src/components/brand/PastelVoiceOrb.jsx`) is the focal element — 12-layer SVG-and-CSS animated orb (outer aura, listening ripples ×3, milky base, conic undercurrent, lavender wave, secondary ribbon, warm glow, salmon wash, violet bloom, glass highlight, shimmer, soft edge, bright bead, 9 particles). Modes:

- **idle** — subtle pulse + waveform visible
- **listening** — focus ring + 3 outward ripples (activated when user types)
- **thinking** — particle convergence + violet rotation (activated on send)
- **speaking** — level-reactive scale (random 0.22–1.0 oscillating during a fake 2.4s reply window)

Mock reply flow: on `handleSend`, user message appended → orb `thinking` → 1.5s wait → assistant reply (uses agent's `description` from ConfigProvider, falls back to greeting concat) → orb `speaking` → after 2.4s → `idle`.

Orb's `--voiceorb-c1..c5` CSS variables are palette-aware (see `src/index.css` under each palette's voiceorb block). Default `:root` keeps the spec's pastel tones for Ocean Breeze v2, Peach Sorbet, Pastel Lavender; other palettes override.

The Dashboard hero (`AppLauncher.jsx`) embeds a non-interactive PastelVoiceOrb (`state="idle"`, size 180) on the right — clicking it triggers `onNewChat`.

## Logo system

`TyroLogo` (`src/components/brand/TyroLogo.jsx`) — 4-path origami "T" SVG. Default colors pull from `--brand-logo-1..5`, so the logo follows the active palette. `themeColors` prop can override per-instance (Settings General tab passes the active palette's `swatch` array to keep the logo on white bg readable in dark mode).

`PastelOrb` (`src/components/brand/PastelOrb.jsx`) — avatar visual. CSS radial gradient using `--brand-orb-0..4` for the milky→deep falloff. Accepts `children` (user initials etc.). The chat assistant avatar in `ChatMessage.jsx` and the user message avatar both compose this.

`BrandText` (`src/components/brand/BrandText.jsx`) — "tyro" + solid-brand `AI` wordmark. Uses Inter `tracking-tight`.

The `public/favicon.svg` is the same TyroLogo paths, exported with hardcoded sky/cyan hex (palette-bound favicons would require service-worker manipulation).

## Deployment

`.github/workflows/deploy.yml` triggers on push to `main` and pushes the Vite build to GitHub Pages (Source: GitHub Actions in repo settings). Required:

- `vite.config.js` sets `base: command === "build" ? "/tyro/" : "/"` so assets resolve under `/tyro/` on Pages
- 404.html copy from `index.html` in the workflow for SPA-style 404 fallback (we use state-based routing, no real routes — this is just defensive)
- Live URL: `https://ttech-ai.github.io/tyro/`

When adding new asset paths that aren't bundled by Vite (rare), reference them as `import.meta.env.BASE_URL + "..."` not absolute `/`. Remote: `https://github.com/ttech-AI/tyro.git`. The `ttech-AI` org enforces SAML SSO — pushing from a fresh clone requires `gh auth login` then SSO authorize for the org, or a PAT with SSO-authorized.

## Skill / agent context

- **Dataverse skills** (in `.claude/plugins/.../dataverse/`): `dv-connect`, `dv-metadata`, `dv-data`, `dv-query`, `dv-solution`, `dv-admin`, `dv-security`, `dv-overview`. Skill conventions enforce SDK-over-Web-API, environment-first metadata, solution-pull-after-changes. The dv-metadata skill's "Phased Creation" rule (15–30s between table → key → lookup) matters when scripting bulk schema changes.
- The `tyro-interactive-login` skill describes login-page patterns (cinematic intros, MSAL, scene types) — relevant when wiring real MSAL auth.
- A demo reference project at `C:\Users\Cenk\Desktop\demo\` (TYROForecast) is useful for cross-checking patterns (sidebar LED-strip active indicator was lifted from there).
- Persistent project memories at `C:\Users\Cenk\.claude\projects\c--Users-Cenk-Desktop-TYRO-AI-Web-App\memory\`. The bilingual i18n rule and UI library choices are enforced there — don't weaken without updating the memory.

## Platform notes

Development is on **Windows + PowerShell**. Prefer cross-platform `npm` scripts. For one-off shell commands: PowerShell 5.1 has no `&&` chaining (use `;` or `if ($?) { … }`), `$env:VAR` for env vars, `$null` not `/dev/null`. The Bash tool is also available for POSIX scripts.

`pac` CLI auth and the Dataverse env URL/tenant in `.env` are sensitive to which Power Platform tenant the user is currently logged into. If `pac org who` shows the wrong env, `pac org select --environment <url>` switches it within the active profile.
