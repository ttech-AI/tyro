# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server with HMR
- `npm run build` — production build to `dist/` (root-relative `base: "/"`; the `public/CNAME` file binds GitHub Pages to the custom domain `tyro.ttech.business`)
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

- **Vite 8 + React 19** with `@vitejs/plugin-react` (Oxc-based). React Compiler intentionally **not** enabled — memoize hot paths manually with `useCallback` / `useMemo` (the codebase already does this in `ConfigProvider`, `NavApps`, `ChatScreen`). Don't enable the compiler without first auditing hooks-rules violations across the provider stack.
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

**`.env`** (gitignored) provides `DATAVERSE_URL`, `TENANT_ID`, `MCP_CLIENT_ID`, `SOLUTION_NAME`, `PUBLISHER_PREFIX`, `PAC_AUTH_PROFILE` to the scripts. Also `VITE_MSAL_CLIENT_ID` + `VITE_MSAL_TENANT_ID` for the SPA's MSAL config, `VITE_DATAVERSE_URL` for the launcher Web API, `VITE_COPILOT_ENVIRONMENT_ID` for the Copilot Studio chat environment, and optional `VITE_COPILOT_DATAVERSE_URL` to hard-target the agents' env for icon fetch (skips Global Discovery).

**Solution source-of-truth rule**: the unpacked XML under `solutions/TYROAIPlatform/` is the canonical schema. Cloud edits via maker.powerapps.com or `pac` are allowed, but **every such change must be followed by `python scripts/pull_solution.py` + `git commit`** so the repo doesn't drift. CI/another env can rebuild from the repo via `pac solution pack` + `pac solution import`.

**pac CLI** is installed at `C:\Users\Cenk\AppData\Local\Microsoft\PowerAppsCli\Microsoft.PowerApps.CLI.<ver>\tools\pac.exe` (also a stable shim at `C:\Users\Cenk\AppData\Local\Microsoft\PowerAppsCLI\pac.cmd`). Active auth profile (`UNIVERSAL`) is shared with the VS Code Power Platform extension. To switch envs: `pac org select --environment <url>`.

## MSAL + Dataverse runtime integration

The SPA acquires a Dataverse delegated access token through `@azure/msal-browser` (`acquireTokenSilent` with scope `https://tyro.crm4.dynamics.com/user_impersonation`) and calls the Web API directly from the browser. No backend.

- `src/lib/msal.js` exposes `loginRequest` (User.Read + OIDC scopes) and `dataverseRequest` (Dataverse scope). Redirect flow is used (`loginRedirect` / `logoutRedirect`) — popup was tried first and fought COOP severing `window.opener` after the cross-origin redirect.
- `src/main.jsx` calls `handleRedirectPromise()` BEFORE `createRoot()` so the active account is set on the first render. After a successful callback it `replaceState`s the URL to `/dashboard` so the auth gate doesn't flash `/login`. **Silent-renewal iframe guard**: `acquireTokenSilent` renews tokens via a hidden iframe pointed at the redirect URI (= the SPA root), which would otherwise boot the whole app inside that iframe and let react-router navigate it off the `#code=` hash the parent MSAL polls for — breaking renewal. `index.html` runs an inline pre-bundle script that, when in an iframe with auth params, sets `window.__MSAL_RENEWAL_FRAME__` + `window.stop()`; `main.jsx`'s `isMsalRenewalFrame()` then skips both redirect handling and `createRoot()`. These two are a pair — don't remove one without the other.
- `src/App.jsx` auth gate uses `useIsAuthenticated()` + `instance.getActiveAccount()` together and gates on `inProgress !== InteractionStatus.None` to ride out the brief race where the hook returns false on the first render after callback. Authenticated user landing on `/login` (e.g. fresh redirect) is bounced to `/dashboard`.
- `src/lib/dataverse.js` is the thin Web API wrapper: `getToken()` → `fetch(API_BASE + path)` with the OData headers. Schema mapping: agents/AI apps/business apps share the `tyro_launcherapps` entity set, distinguished by `tyro_type` (Choice values 100000000 / 100000001 / 100000002). Created via `POST`, updated via `PATCH ...(id)`, deleted via `DELETE ...(id)`. Three non-obvious rules: **(1) `tyro_logo` is a Dataverse _file_ column — it cannot be written via the entity JSON**, so `agentToRow`/`appToRow` deliberately omit it and the server always returns `logo:null`. Uploaded logos persist *client-side only* (the localStorage cache) and are carried through the `createItem`/`updateItem` return values (`{ ...mapped, logo: item.logo }`). Truly persisting a logo to Dataverse would need the file-upload API. **(2)** record ids are GUIDs — `isGuid(id)` decides create-vs-update (a non-GUID id is a seed/`makeId` row that must be POSTed, never used as an OData key → it would 400) and gates the remote `DELETE`. **(3)** `getToken()` rethrows `InteractionRequiredAuthError` as a clear "session expired" `Error` (with `cause`) instead of auto-redirecting from a background fetch.
- `src/providers/ConfigProvider.jsx` reads from Dataverse on `useIsAuthenticated()` flip, falls back to seed/localStorage on failure (e.g. permission not yet consented). Data (`state`) and transient `status` (`loading/error/source`) are **separate `useState`s** so a loading flip doesn't rewrite the localStorage cache or churn every consumer. The fetch **merges** the server snapshot rather than replacing it (`mergeServerData`): carries cached logos onto server rows (matched by id, then by name), keeps genuinely local-only rows (non-GUID id absent from the server), and **dedupes seed rows against the server by name+type** (mirrors the `tyro_NameTypeKey` alternate key) so seeds don't double up on the first authenticated load. CRUD is optimistic locally with a remote write behind it; `upsert`/`remove` are **async and throw on remote failure** — callers (`SettingsPage`) must `await` + `try/catch` and show an error toast, never report success optimistically.

**Azure AD requirements** (set in app registration `1dfbb3bf-0faf-4d17-9d10-3bcb915083f6`):
- Authentication → Platform: Single-page application. Redirect URIs include the production custom domain `https://tyro.ttech.business/`, the legacy GitHub Pages path `https://ttech-ai.github.io/tyro/` (still listed for fallback during migration), and `http://localhost:5173/`. The Vite redirectUri is derived from `window.location.origin + import.meta.env.BASE_URL` (see `src/lib/msal.js#buildOrigin`), so each origin must be listed explicitly in Azure AD.
- API permissions: `Microsoft Graph` → `User.Read` (delegated), `Dynamics CRM` → `user_impersonation` (delegated). Both must have admin consent granted.

## Login page

`src/components/auth/LoginPage.jsx` is the standalone `/login` view (no DashboardLayout). It hardcodes the **Insta gradient palette** (`#feda77 → #dd2a7b → #8134af`) regardless of the global palette/theme so the login surface looks consistent. State machine: `idle → listening → connecting → dissolving`, mapped to PastelVoiceOrb modes plus a 4-layer cinematic portal transition (white flash + Insta-tinted bloom + sweep ring + pastel veil) before `instance.loginRedirect(loginRequest)`.

- Mouse activity → orb `listening` (350ms idle debounce). Connect click → `connecting` (orb thinking with Z-axis spin + orbital satellites) → `dissolving` (portal overlay) at 1.5s → `loginRedirect()` at 2.3s.
- On first visit (no `tyro-login-initialized` flag) the page forces light + tr defaults. Persistent settings (theme, locale, mute) live in `localStorage`; the mock-mode "logged-in" flag lives in `sessionStorage` so login is required every browser session when MSAL isn't configured. The flag's key, `MOCK_LOGGED_IN_KEY`, is exported once from `src/lib/msal.js` and shared by `App.jsx`, `LoginPage.jsx`, and `NavUser.jsx` — don't re-type the literal.
- 2s after mount, a random `voiceassets/*.mp3` plays (orb → speaking). Mute button toggle persisted to `tyro-login-muted`.
- Top bar exposes mute / theme / language toggles. Language button shows the *opposite* locale ("Switch to EN" while in TR).
- Sign-out (`NavUser.handleSignOut`) calls `instance.logoutRedirect({ account })`; MSAL handles the post-logout return to `/login` via `postLogoutRedirectUri`.

## Chat screen + PastelVoiceOrb

`src/components/chat/ChatScreen.jsx` is the standalone chat view. State-driven 4-mode interactive `PastelVoiceOrb` (`src/components/brand/PastelVoiceOrb.jsx`) is the focal element — 12-layer SVG-and-CSS animated orb (outer aura, listening ripples ×3, milky base, conic undercurrent, lavender wave, secondary ribbon, warm glow, salmon wash, violet bloom, glass highlight, shimmer, soft edge, bright bead, 9 particles). Modes:

- **idle** — subtle pulse + waveform visible
- **listening** — focus ring + 3 outward ripples (activated when user types)
- **thinking** — particle convergence + violet rotation (activated on send)
- **speaking** — level-reactive scale (random 0.22–1.0) during a 2.4s post-reply visual window. **No audio** — auto-TTS on replies was removed; only the orb-click greeting speaks (`handleOrbClick` → `useSpeechSynthesis`).

**Empty-state welcome**: `isEmpty` is true when no message has *renderable* content (ignores the content-less placeholder bubble the init flow inserts), so the orb welcome screen stays — with the orb in `thinking` mode as the loading cue — until the greeting actually streams in. Don't revert `isEmpty` to a plain `messages.length === 0` or the open flash returns.

**Reply flow is real Copilot Studio, not mock** (see next section). `handleSend`/`handleSuggestedAction`/`handleCardAction` all: append the user turn → `setBusy(true)` + orb `thinking` → `await conversationReadyRef.current` (the init-flow gate) → `streamReply(...)` updating a single assistant bubble as chunks arrive → orb `speaking` 2.4s → `idle`. `abortGenRef` (a monotonically increasing generation counter) cancels stale streams on agent change / reset; `busy` locks the composer only while the bot is genuinely generating.

Orb's `--voiceorb-c1..c5` CSS variables are palette-aware (see `src/index.css` under each palette's voiceorb block). Default `:root` keeps the spec's pastel tones for Ocean Breeze v2, Peach Sorbet, Pastel Lavender; other palettes override.

The Dashboard hero (`AppLauncher.jsx`) embeds a non-interactive PastelVoiceOrb (`state="idle"`, size 180) on the right — clicking it triggers `onNewChat`.

## Copilot Studio chat integration

The chat talks to **real Copilot Studio agents** via `@microsoft/agents-copilotstudio-client`, NOT Dataverse.

- **`src/lib/copilot.js`** wraps the client. `startConversation(schemaName)` / `sendMessage(client, text)` / `sendAction(client, data)` are **async generators** yielding `{ text, attachments, suggestedActions, done }` chunks (Bot Framework activities mapped by `activityToChunk`). The agent's `agentId` IS the Copilot **schemaName**. `resolveSuggestedAction` maps imBack/messageBack/postBack/openUrl quick-replies.
- **Auth is a separate scope from Dataverse**: `COPILOT_STUDIO_SCOPE = https://api.powerplatform.com/CopilotStudio.Copilots.Invoke` (in `msal.js`, also pre-consented via `loginRequest.extraScopesToConsent`). The environment is `VITE_COPILOT_ENVIRONMENT_ID` (default `Default-<tenant>`). **Consequence**: an agent's chat can work (invoke scope + env) while its Dataverse `bot` record is unreadable (needs `user_impersonation` read on that env's `bot` table) — these are independent permissions. Don't assume "chat works ⇒ bot row readable".
- **ChatScreen init flow** (`useEffect` on `[agent, schemaName, resetNonce]`): inserts one empty placeholder assistant bubble, streams the greeting into it, then auto-submits the greeting card's first `Action.Submit` (the bot's menu). `conversationReadyRef` is a promise that resolves only when this whole init finishes — `handleSend` awaits it so a user turn can't collide with init on the same server conversation (which would trigger "Sohbet durduruldu"). Re-run init in the same mount via `setResetNonce` (header "yeni sohbet"); the sidebar "Yeni sohbet" remounts via the route `?reset=` key instead.
- **Persistence**: `src/lib/chatPersistence.js` mirrors messages to **sessionStorage** per-agent (survives in-tab nav, clears on tab close — matches ChatGPT). The Copilot *server* conversation can't be resumed, so init always restarts it.

## Adaptive Cards rendering

`src/components/chat/AdaptiveCardView.jsx` renders Copilot card attachments with Microsoft's official `adaptivecards` SDK (full schema, every input/action). Non-obvious rules:

- **HostConfig is built from live CSS variables** (`buildHostConfig` reads `--foreground`, `--brand-via`, etc.) so cards follow the active palette + light/dark; rebuilt on `theme` change. Interactive controls only get class names → restyled in `src/index.css` under `.ac-host` (inputs, buttons, **mobile-responsive** column-stacking + image clamping, Fluent-icon recolor on positive/dark buttons).
- **`icon:<Name>` scheme**: Copilot sends button icons as Fluent System Icon refs (e.g. `icon:Eye`), which the SDK would try to load as a URL → `ERR_UNKNOWN_URL_SCHEME`. `rewriteIconScheme` (run on a clone before `parse`) converts them to Fluent SVG CDN URLs (`unpkg.com/@fluentui/svg-icons`, snake_cased). Icons that still fail to load are hidden via an `onerror` handler.
- **Markdown**: text goes through `markdown-it` (`onProcessMarkdown`). Bot text in both cards and the chat bubble is first passed through **`normalizeBotMarkdown`** (`src/lib/markdown.js`) which converts raw `<br>`/`<hr>` HTML (Copilot emits these) to CommonMark — our renderers keep raw HTML off for safety, so without this the tags show as literal text. Chat bubbles use `react-markdown` + `remark-gfm` (GFM tables, styled via `prose-table:*` in `ChatMessage.jsx`).

## Agent icons from the Copilot `bot` table (cross-environment)

`dv.fetchBotIcons(schemaNames)` (`src/lib/dataverse.js`) enriches agents with their **real Copilot Studio icon**. The conversation SDK exposes no icon, so the icon is read from the Dataverse `bot` table's **`iconbase64`** (Memo) column — there is no image-type column on `bot`, so it discovers icon-ish columns by name pattern, not a fixed name. Agents usually live in a **different environment** than the launcher Dataverse (`tyro.crm4`), so it enumerates all reachable orgs via the **Global Discovery Service** (`globaldisco.crm.dynamics.com`), acquires a per-org token (`<orgUrl>/user_impersonation`), and searches each for the missing `schemaName`s, merging results. Mime is sniffed from the base64 signature. `ConfigProvider` calls this only for agents lacking a cached `logo`, attaches the result as `logo` (rendered by `IconOrLogo` everywhere), and **degrades gracefully** to the hugeicon on any failure (403 on an inaccessible env, no match, etc.). The icon is cached in `localStorage`, so changing it in Copilot Studio won't refresh until the cache is cleared.

## Logo system

`TyroLogo` (`src/components/brand/TyroLogo.jsx`) — 4-path origami "T" SVG. Default colors pull from `--brand-logo-1..5`, so the logo follows the active palette. `themeColors` prop can override per-instance (Settings General tab passes the active palette's `swatch` array to keep the logo on white bg readable in dark mode).

`PastelOrb` (`src/components/brand/PastelOrb.jsx`) — avatar visual. CSS radial gradient using `--brand-orb-0..4` for the milky→deep falloff. Accepts `children` (user initials etc.). The chat assistant avatar in `ChatMessage.jsx` and the user message avatar both compose this.

`BrandText` (`src/components/brand/BrandText.jsx`) — "tyro" + solid-brand `AI` wordmark. Uses Inter `tracking-tight`.

The `public/favicon.svg` is the same TyroLogo paths, exported with hardcoded sky/cyan hex (palette-bound favicons would require service-worker manipulation).

## Deployment

`.github/workflows/deploy.yml` triggers on push to `main` and pushes the Vite build to GitHub Pages (Source: GitHub Actions in repo settings). Required:

- `vite.config.js` sets `base: "/"` (root-relative) — the custom domain `tyro.ttech.business` serves the SPA from its root, so no subpath prefix is needed for asset URLs
- `public/CNAME` contains `tyro.ttech.business` — GitHub Pages reads this file from the deployed artifact and binds the deployment to the custom domain. **Do not delete or rename it**; if it goes missing, Pages reverts to `ttech-ai.github.io/tyro/` and the redirect URIs break
- `index.html` copied to `404.html` in the workflow for SPA fallback (BrowserRouter routes other than `/` need this so a direct hit on `/dashboard` doesn't 404)
- Live URL: `https://tyro.ttech.business/` (DNS CNAME maintained by Tiryaki IT)
- Legacy URL `https://ttech-ai.github.io/tyro/` is still in the Azure AD redirect-URI allow-list as a fallback during migration; once everything is confirmed working on the custom domain it can be removed

When adding new asset paths that aren't bundled by Vite (rare), reference them as `import.meta.env.BASE_URL + "..."` not absolute `/`. Remote: `https://github.com/ttech-AI/tyro.git`. The `ttech-AI` org enforces SAML SSO — pushing from a fresh clone requires `gh auth login` then SSO authorize for the org, or a PAT with SSO-authorized.

**PWA (`vite-plugin-pwa`)**: `registerType: autoUpdate` with `skipWaiting + clientsClaim` so a new deploy takes over immediately. **HTML uses NetworkFirst** (3s timeout, falls back to cache) — this matters because old SPA bundles can otherwise block a fix from reaching the user. Precache cap is raised to 10 MiB (main bundle ~6.6 MiB). Manifest uses the Insta-gradient `pwa-icon.svg`. When debugging cache-staleness issues, the test recipe is: DevTools → Application → Storage → Clear site data, then hard reload — this evicts both the SW registration and Workbox caches at once.

## Skill / agent context

- **Dataverse skills** (in `.claude/plugins/.../dataverse/`): `dv-connect`, `dv-metadata`, `dv-data`, `dv-query`, `dv-solution`, `dv-admin`, `dv-security`, `dv-overview`. Skill conventions enforce SDK-over-Web-API, environment-first metadata, solution-pull-after-changes. The dv-metadata skill's "Phased Creation" rule (15–30s between table → key → lookup) matters when scripting bulk schema changes.
- The `tyro-interactive-login` skill describes login-page patterns (cinematic intros, MSAL, scene types) — relevant when wiring real MSAL auth.
- A sibling reference project (TYROForecast demo) on the same workstation provided some patterns — e.g. the sidebar LED-strip active indicator. If you don't have access to it locally, fall back to what's already in this repo.
- Persistent project memories live under the Claude Code session memory directory (auto-loaded on session start). The bilingual i18n rule and UI library choices are enforced there — don't weaken them without also updating memory.

## Platform notes

Development is on **Windows + PowerShell**. Prefer cross-platform `npm` scripts. For one-off shell commands: PowerShell 5.1 has no `&&` chaining (use `;` or `if ($?) { … }`), `$env:VAR` for env vars, `$null` not `/dev/null`. The Bash tool is also available for POSIX scripts.

`pac` CLI auth and the Dataverse env URL/tenant in `.env` are sensitive to which Power Platform tenant the user is currently logged into. If `pac org who` shows the wrong env, `pac org select --environment <url>` switches it within the active profile.
