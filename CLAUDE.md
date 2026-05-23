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
- `python scripts/pull_solution.py` — **after ANY metadata change**: re-export `TYROAIPlatform` and unpack atomically into `solutions/TYROAIPlatform/` for source control (verifies pac is on the right org, prints `git status` summary at end)

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
BrowserRouter
  MsalProvider     → @azure/msal-react             (Azure AD identity, no localStorage key — MSAL owns its own cache)
    ThemeProvider  → src/providers/ThemeProvider   → tyro-theme        (light/dark)
      PaletteProvider → src/providers/PaletteProvider → tyro-palette   (brand palette)
        LocaleProvider → src/providers/LocaleProvider → tyro-locale    (tr/en)
          ConfigProvider → src/providers/ConfigProvider → tyro-config-v1 (agents/aiApps/businessApps cache)
            TooltipProvider
              App
```

Theme / Palette / Locale providers each set an attribute on `<html>` (`.dark`, `data-palette="…"`, `lang="…"`) and persist their selection to `localStorage`. Hooks: `useTheme`, `usePalette`, `useLocale`, `useConfig`. `useMe` (`src/hooks/useMe.js`) returns `{ name, fullName, initials, email, title }` from the MSAL active account when authenticated, or from `src/data/user.js` as a mock.

**ConfigProvider** is the source of truth for agents / AI products / business apps. When the user is MSAL-authenticated it fetches from Dataverse (`fetchAllItems()` → `tyro_launcherapps`) and updates via optimistic-local + remote `POST/PATCH/DELETE`. The cached state is mirrored to `localStorage` so the app boots with last-known data offline. Pre-auth or on Dataverse error (e.g. permission not consented) it falls back to `src/data/seedConfig.js`. Consumers (`AppLauncher`, `NavApps`, `ChatScreen`, `AgentSelect`, `ChatMessage`, Settings tabs) all read the same shape from `useConfig()` regardless of source.

## App layout architecture

`src/App.jsx` uses **react-router-dom** with `BrowserRouter` (basename from `import.meta.env.BASE_URL`). `activeId` is derived from `location.pathname` via the `PATH_TO_ID` map so the sidebar can drive routing without holding its own state:

```
main.jsx
└── BrowserRouter (basename = "/tyro" in prod, "/" in dev)
    └── MsalProvider → ThemeProvider → PaletteProvider → LocaleProvider → ConfigProvider → TooltipProvider
        └── App.jsx — auth gate + Routes
            ├── /login   → LoginPage (standalone, no DashboardLayout)
            ├── /        → Navigate to /dashboard
            ├── /dashboard → AppLauncher (hero + 3 sections)
            ├── /chat?agent=…&reset=… → ChatScreen (key from reset param to remount)
            ├── /analytics → legacy dashboard-01 (HeroSection + SectionCards + Chart + DataTable)
            ├── /settings → SettingsPage (Genel + AI Agentlar + AI Ürünler + İş Uygulamaları)
            ├── /help    → HelpPage
            └── *        → Navigate to /dashboard
```

**Auth gate** (in App.jsx): three guards before the inner routes render —
1. authenticated user on `/login` → `Navigate("/dashboard")` (skip the login page on a fresh redirect callback);
2. `inProgress !== InteractionStatus.None` → return `null` (don't make routing decisions while MSAL is in startup/handleRedirect/login);
3. not authenticated AND not loading → `Navigate("/login")`.

`isAuthenticated` is computed from `useIsAuthenticated() || !!instance.getActiveAccount()` so the first render after `handleRedirectPromise()` succeeds doesn't briefly bounce to `/login` while the hook catches up.

Sidebar "Yeni sohbet" → `navigate("/chat?reset=" + Date.now())` remounts ChatScreen via the `reset` param. Agent card → `navigate("/chat?agent=…&reset=…")` opens chat preselected. Clicking a non-`ready` nav item triggers a custom sonner toast (`showComingSoon` in `Sidebar.jsx`).

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
- `user.js` — `currentUser` mock used by the `useMe` hook when MSAL isn't configured or the user isn't signed in. With MSAL configured the hook returns `{ name, fullName, initials, email }` derived from the active account.
- `agents.js`, `apps.js`, `nav.js`, `categories.js`, `stats.js`, `activities.js`, `notifications.js`, `tableData.js`, `chartData.js` — legacy static mock data still used by the Analytics page (HeroSection, SectionCards, DataTable, etc.). Dashboard launcher and chat reference ConfigProvider instead.

## Dataverse backend

The SPA is wired to a real Dataverse environment for the launcher items. ConfigProvider reads + writes via the Web API at runtime.

- **Environment**: `https://tyro.crm4.dynamics.com/` — tenant `9efa3bdf-67ad-47e3-8dfb-d1df79a6d7fa` (Tiryaki)
- **Solution**: `TYROAIPlatform` ("TYRO AI Platform" display, publisher prefix **`tyro`**)
- **Table**: `tyro_launcherapp` (display "TYRO Launcher App") — **OrganizationOwned** (no per-row ownership; access via Security Roles only)
- **Columns**: `tyro_name` (primary), `tyro_type` (Choice: Agent=100000000 / AI App=100000001 / Business App=100000002), `tyro_description`, `tyro_url`, `tyro_tenantid`, `tyro_clientid`, `tyro_agentid`, `tyro_iconname`, `tyro_sortorder`, `tyro_isactive`, `tyro_logo` (file)
- **Alternate key**: `tyro_NameTypeKey` (`tyro_name + tyro_type`) — enables upsert by business key instead of GUID

**Scripts** (in `scripts/`, all use Python SDK `PowerPlatform-Dataverse-Client` + `requests` for Web API fallback):
- `auth.py` — `load_env()` + `get_credential()` chain (SharedTokenCache → InteractiveBrowser → DeviceCode)
- `setup_tyro_platform.py` — idempotent publisher + solution + table creation (SDK)
- `recreate_table_org_owned.py` — destructive drop+recreate as OrganizationOwned (used once to switch ownership; keep for reference)
- `add_columns_only.py` — adds remaining columns + fixes choice labels via Web API
- `fix_choice_labels.py` — `UpdateOptionValue` + display name PUT for the Type choice
- `inspect_table.py` / `list_columns.py` / `list_publishers.py` — read-only inspectors
- `import_seed_data.py` — imports the 12 seedConfig items into `tyro_launcherapp` (idempotent — dedupes on `tyro_name + tyro_type`)
- `create_alternate_key.py` — idempotent creation of `tyro_NameTypeKey` (`tyro_name + tyro_type`) for upsert idempotency
- `pull_solution.py` — **run after ANY metadata change** (column, choice value, view, form, alternate key, relationship). Verifies pac is on the right org, exports `TYROAIPlatform`, unpacks atomically into `solutions/TYROAIPlatform/`, prints a git diff summary. Data changes (rows in Settings or `import_seed_data.py`) are NOT part of the solution and don't need a re-pull.

**`.env`** (gitignored) provides `DATAVERSE_URL`, `TENANT_ID`, `MCP_CLIENT_ID`, `SOLUTION_NAME`, `PUBLISHER_PREFIX`, `PAC_AUTH_PROFILE` to the scripts. Also `VITE_MSAL_CLIENT_ID` + `VITE_MSAL_TENANT_ID` for the SPA's MSAL config.

**Solution source-of-truth rule**: the unpacked XML under `solutions/TYROAIPlatform/` is the canonical schema. Cloud edits via maker.powerapps.com or `pac` are allowed, but **every such change must be followed by `python scripts/pull_solution.py` + `git commit`** so the repo doesn't drift. CI/another env can rebuild from the repo via `pac solution pack` + `pac solution import`.

**pac CLI** is installed at `C:\Users\Cenk\AppData\Local\Microsoft\PowerAppsCli\Microsoft.PowerApps.CLI.<ver>\tools\pac.exe` (also a stable shim at `C:\Users\Cenk\AppData\Local\Microsoft\PowerAppsCLI\pac.cmd`). Active auth profile (`UNIVERSAL`) is shared with the VS Code Power Platform extension. To switch envs: `pac org select --environment <url>`.

## MSAL + Dataverse runtime integration

The SPA acquires a Dataverse delegated access token through `@azure/msal-browser` (`acquireTokenSilent` with scope `https://tyro.crm4.dynamics.com/user_impersonation`) and calls the Web API directly from the browser. No backend.

- `src/lib/msal.js` exposes `loginRequest` (User.Read + OIDC scopes) and `dataverseRequest` (Dataverse scope). Redirect flow is used (`loginRedirect` / `logoutRedirect`) — popup was tried first and fought COOP severing `window.opener` after the cross-origin redirect.
- `src/main.jsx` calls `handleRedirectPromise()` BEFORE `createRoot()` so the active account is set on the first render. After a successful callback it `replaceState`s the URL to `/dashboard` so the auth gate doesn't flash `/login`.
- `src/App.jsx` auth gate uses `useIsAuthenticated()` + `instance.getActiveAccount()` together and gates on `inProgress !== InteractionStatus.None` to ride out the brief race where the hook returns false on the first render after callback. Authenticated user landing on `/login` (e.g. fresh redirect) is bounced to `/dashboard`.
- `src/lib/dataverse.js` is the thin Web API wrapper: `getToken()` → `fetch(API_BASE + path)` with the OData headers. Schema mapping: agents/AI apps/business apps share the `tyro_launcherapps` entity set, distinguished by `tyro_type` (Choice values 100000000 / 100000001 / 100000002). Created via `POST`, updated via `PATCH ...(id)`, deleted via `DELETE ...(id)`.
- `src/providers/ConfigProvider.jsx` reads from Dataverse on `useIsAuthenticated()` flip, falls back to seed/localStorage on failure (e.g. permission not yet consented). CRUD is optimistic locally with a remote write behind it.

**Azure AD requirements** (set in app registration `1dfbb3bf-0faf-4d17-9d10-3bcb915083f6`):
- Authentication → Platform: Single-page application. Redirect URIs include `https://ttech-ai.github.io/tyro/` and `http://localhost:5173/`.
- API permissions: `Microsoft Graph` → `User.Read` (delegated), `Dynamics CRM` → `user_impersonation` (delegated). Both must have admin consent granted.

## Login page

`src/components/auth/LoginPage.jsx` is the standalone `/login` view (no DashboardLayout). It hardcodes the **Insta gradient palette** (`#feda77 → #dd2a7b → #8134af`) regardless of the global palette/theme so the login surface looks consistent. State machine: `idle → listening → connecting → dissolving`, mapped to PastelVoiceOrb modes plus a 4-layer cinematic portal transition (white flash + Insta-tinted bloom + sweep ring + pastel veil) before `instance.loginRedirect(loginRequest)`.

- Mouse activity → orb `listening` (350ms idle debounce). Connect click → `connecting` (orb thinking with Z-axis spin + orbital satellites) → `dissolving` (portal overlay) at 1.5s → `loginRedirect()` at 2.3s.
- On first visit (no `tyro-login-initialized` flag) the page forces light + tr defaults. Persistent settings (theme, locale, mute) live in `localStorage`; the mock-mode "logged-in" flag lives in `sessionStorage` so login is required every browser session when MSAL isn't configured.
- 2s after mount, a random `voiceassets/*.mp3` plays (orb → speaking). Mute button toggle persisted to `tyro-login-muted`.
- Top bar exposes mute / theme / language toggles. Language button shows the *opposite* locale ("Switch to EN" while in TR).
- Sign-out (`NavUser.handleSignOut`) calls `instance.logoutRedirect({ account })`; MSAL handles the post-logout return to `/login` via `postLogoutRedirectUri`.

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
- `index.html` copied to `404.html` in the workflow for SPA fallback (BrowserRouter routes other than `/` need this so a direct hit on `/tyro/dashboard` doesn't 404)
- Live URL: `https://ttech-ai.github.io/tyro/`

When adding new asset paths that aren't bundled by Vite (rare), reference them as `import.meta.env.BASE_URL + "..."` not absolute `/`. Remote: `https://github.com/ttech-AI/tyro.git`. The `ttech-AI` org enforces SAML SSO — pushing from a fresh clone requires `gh auth login` then SSO authorize for the org, or a PAT with SSO-authorized.

**PWA (`vite-plugin-pwa`)**: `registerType: autoUpdate` with `skipWaiting + clientsClaim` so a new deploy takes over immediately. **HTML uses NetworkFirst** (3s timeout, falls back to cache) — this matters because old SPA bundles can otherwise block a fix from reaching the user. Precache cap is raised to 10 MiB (main bundle ~6.6 MiB). Manifest uses the Insta-gradient `pwa-icon.svg`. When debugging cache-staleness issues, the test recipe is: DevTools → Application → Storage → Clear site data, then hard reload — this evicts both the SW registration and Workbox caches at once.

## Skill / agent context

- **Dataverse skills** (in `.claude/plugins/.../dataverse/`): `dv-connect`, `dv-metadata`, `dv-data`, `dv-query`, `dv-solution`, `dv-admin`, `dv-security`, `dv-overview`. Skill conventions enforce SDK-over-Web-API, environment-first metadata, solution-pull-after-changes. The dv-metadata skill's "Phased Creation" rule (15–30s between table → key → lookup) matters when scripting bulk schema changes.
- The `tyro-interactive-login` skill describes login-page patterns (cinematic intros, MSAL, scene types) — relevant when wiring real MSAL auth.
- A demo reference project at `C:\Users\Cenk\Desktop\demo\` (TYROForecast) is useful for cross-checking patterns (sidebar LED-strip active indicator was lifted from there).
- Persistent project memories at `C:\Users\Cenk\.claude\projects\c--Users-Cenk-Desktop-TYRO-AI-Web-App\memory\`. The bilingual i18n rule and UI library choices are enforced there — don't weaken without updating the memory.

## Platform notes

Development is on **Windows + PowerShell**. Prefer cross-platform `npm` scripts. For one-off shell commands: PowerShell 5.1 has no `&&` chaining (use `;` or `if ($?) { … }`), `$env:VAR` for env vars, `$null` not `/dev/null`. The Bash tool is also available for POSIX scripts.

`pac` CLI auth and the Dataverse env URL/tenant in `.env` are sensitive to which Power Platform tenant the user is currently logged into. If `pac org who` shows the wrong env, `pac org select --environment <url>` switches it within the active profile.
