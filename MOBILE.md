# MOBILE.md

Operating guide for mobile + tablet + PWA UX in this codebase. Every new
screen, button, dialog, or input MUST pass these checks before merging.
Generated from the mobile-overhaul audit (Q2 2026) against ChatGPT iOS,
Claude iOS, and Microsoft Copilot mobile patterns.

Future contributors (humans or Claude): read this BEFORE touching layout,
inputs, sticky chrome, or chat code.

---

## 1. Full-height layouts use `dvh` / `svh`, never `vh` or `h-screen`

**Why.** iOS Safari's `100vh` measures the LARGEST viewport (URL bar
hidden). On first paint the URL bar is visible, so content under that
height gets clipped or pushed below the fold. The keyboard also doesn't
shrink `vh`. `dvh` / `svh` / `lvh` (Safari 15.4+, all evergreen browsers)
are the supported replacements.

- `100svh` (smallest viewport) — content that must always fit even with
  browser chrome visible. Use for splash / login.
- `100dvh` (dynamic) — layout that should follow keyboard opening /
  toolbar collapsing. Use for chat shells and other "fill the visible
  area" containers.
- `100lvh` (largest) — full bleed background art only.

**How to verify.** `git grep "h-screen\|100vh\|min-h-screen" src/`. Every
hit must be replaced with `h-[100dvh]` (keyboard-aware) or
`min-h-[100svh]` (must-fit splash). Reproduce on iOS Safari with URL bar
visible AND keyboard open — the layout should not clip.

**Standalone-PWA exception — `pwa:h-screen`.** The full-height *app shell*
(`DashboardLayout`, `LoginPage`) is `h-[100dvh] pwa:h-screen` and `body` gets
`min-height:100vh` under `@media (display-mode: standalone)`. Reason: on a
freshly-launched home-screen PWA, iOS miscomputes the DYNAMIC viewport (`dvh`,
and equivalently `window.innerHeight`) on the FIRST paint — the shell renders
shorter than the screen, leaving a bottom gap that only fills after a manual
scroll forces a reflow. The static LARGEST viewport (`vh`) equals the full
screen from frame one, and in standalone there's no URL bar for `dvh` to track,
so the original `vh` ban doesn't apply. Keep `100dvh` as the browser-tab base
and override with `pwa:` (the `@custom-variant pwa (display-mode: standalone)`
in `index.css`) — do NOT replace dvh with vh globally. Verified against the
tyrostrategy PWA, whose shell is `h-screen`/`100vh`. A JS `--app-height`
(innerHeight) approach was tried and did NOT fix it — innerHeight rides the same
buggy dynamic viewport.

---

## 2. Every interactive element is ≥ 44 × 44 CSS pixels on coarse pointers

**Why.** Apple HIG 44 pt minimum; Material 48 dp; WCAG 2.5.5 (AAA) 44 px.
Below that = mis-taps. Two adjacent under-sized buttons (composer send +
mic, settings edit + delete) are the worst offenders because mis-tap
consequence is destructive.

- Mobile-first sizing: `size-11 sm:size-10` (44 → 40 px).
- For 28 px desktop heights: `h-11 sm:h-7` plus a `w-11 sm:w-auto` if the
  element shrinks to a square on mobile.
- Use the `.touch-target` utility (defined in `src/index.css`) to make
  the HIT AREA 44 px without changing visual size — useful when a tight
  layout can't accommodate a bigger button visually.

**How to verify.** Chrome DevTools → Accessibility panel → Touch target
audit. Any element with `onClick` / `role="button"` / `href` must compute
`min-height >= 44px` and `min-width >= 44px` under
`@media (pointer: coarse)`. Run on every PR that touches a button.

---

## 3. All text inputs use 16 px font-size on mobile (`text-base`)

**Why.** iOS Safari auto-zooms the viewport when focusing any input with
computed `font-size < 16px`, trapping the user in a zoomed state with a
broken layout. The fix MUST be a font-size change — disabling pinch-zoom
via `maximum-scale=1` violates WCAG 1.4.4.

- The `<Input>` and `<Textarea>` primitives default to
  `text-base sm:text-sm md:text-xs/relaxed`.
- Any custom `<input>` / `<textarea>` that overrides font size must keep
  16 px on mobile: `text-[16px] sm:text-xs`.

**How to verify.** Focus every form field on real iOS Safari (Simulator
counts). If the page zooms in, you have a violation. Also `git grep
"<input\|<textarea\|text-xs\|text-\[12px\]\|text-\[14px\]" src/` and
audit each match.

---

## 4. Sticky/fixed bottom elements pad through the safe area

**Why.** iPhone X+ home indicator reserves 34 px at the bottom. Without
inset padding, sticky composers, toolbars, footers, and toasters sit
*under* the indicator. `viewport-fit=cover` (already in `index.html`)
ONLY enables `env()` — components must opt in.

Use the helpers in `src/index.css`:

- `.pb-safe` — `padding-bottom: max(env(safe-area-inset-bottom), 0.5rem)`
- `.pt-safe` — top inset (Dynamic Island)
- `.pl-safe` / `.pr-safe` — lateral insets (landscape notches)

Apply to: chat composer wrappers, `NavUser` footer, Sonner toaster,
DataTable pagination, any `position: sticky bottom-0` or
`position: fixed bottom-0` element.

**How to verify.** Open the app on an iPhone with home indicator (or
Chrome DevTools Device Mode → iPhone 14 Pro with "show device frame"
on). Bottom-anchored chrome should sit clearly above the indicator
band, not under it.

---

## 5. On mobile (`<= md`), sidebars are Sheets that close on selection

**Why.** Sheets cover ~85 % of viewport width and visually preempt the
page. Leaving them open after the user makes a nav selection traps them
behind the drawer. Material spec and iOS HIG both prescribe dismissing
the drawer on selection.

```jsx
const { isMobile, setOpenMobile } = useSidebar()

function handleSelect(item) {
  // ... do the navigation
  if (isMobile) setOpenMobile(false)
}
```

Apply to: primary nav, secondary nav, external app links, brand link at
the top of the sidebar — every tappable row inside a `<Sheet>`-backed
sidebar.

**How to verify.** On a 375 px viewport (Chrome DevTools iPhone SE
preset), open the sidebar, tap any nav row, confirm the sheet
animates out and the destination page is fully visible underneath.

---

## 6. Honor `prefers-reduced-motion` globally

**Why.** WCAG 2.3.3 requires reduced-motion conformance. Heavy
animations (login portal bloom, particle convergence in PastelVoiceOrb,
message-bubble staggers) are vestibular triggers. Users with motion
sensitivity physically cannot use the app without an opt-out.

`src/index.css` contains a `@media (prefers-reduced-motion: reduce)`
block that zeroes animation/transition durations app-wide. New
animations don't need to do anything extra — they're already gated.

For motion/react specifically, wrap heavy choreography in a
`MotionConfig` with `reducedMotion="user"` if global zeroing isn't
enough (it usually is).

**How to verify.** macOS: System Settings → Accessibility → Display →
Reduce Motion. iOS: Settings → Accessibility → Motion → Reduce Motion.
Reload — orb internal animations should be static, portal transitions
should snap (no smooth interpolation), scroll smoothing off.

---

## 7. Per-surface scroll containment + body-level overscroll behavior

**Why.** Without containment, a downward swipe at the top of any
scrollable region triggers Android Chrome's pull-to-refresh (reloading
the SPA mid-conversation, losing in-flight state) or iOS Safari's
rubber-band (revealing white background under the chat). Both look
broken.

- `body { overscroll-behavior-y: none }` in `src/index.css` blocks
  page-level PTR / rubber-band. Already done globally.
- Each scrollable region adds Tailwind `overscroll-contain` so swipes
  inside don't bubble to the page.
- Combine with `touch-action: pan-y` when the surface only wants
  vertical scrolling (long-press, swipe gestures stay accessible).

```jsx
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
  ...
</div>
```

**How to verify.** At the TOP of the chat scroller on iOS or Android,
pull DOWN hard. Neither pull-to-refresh nor rubber-band should fire.
The thread should clamp at scroll-top.

---

## 8. Chat auto-scroll only when the user is near the bottom

**Why.** Yanking a user back to the bottom while they're scrolled up
reading older messages is the #1 rage-inducing chat bug. ChatGPT,
Claude, and Gemini all converge on the same threshold: ~120 px from
bottom = auto-scroll; above = pill with unread count.

`ChatScreen.jsx` tracks `isNearBottom` via an `onScroll` handler with a
120 px threshold. The auto-scroll `useLayoutEffect` gates on that flag;
otherwise an unread counter increments via a ref and the
`ScrollToBottomPill` motion.button surfaces above the composer.

**How to verify.** Send yourself a message in chat, scroll the thread
up 300 px, trigger another assistant reply. The thread should NOT
snap-scroll to the new message; instead a "{N} yeni mesaj ↓" pill
appears above the composer. Tap it → smooth scroll to bottom + pill
dismisses + counter resets.

---

## 9. Hover-revealed controls do not work on touch — design tap-first

**Why.** On touch devices, `:hover` either never fires or sticks after
the first tap (sticky-hover bug on Android). Patterns like
`opacity-0 group-hover:opacity-100` make the affordance invisible on
mobile, requiring users to guess where to tap.

Two acceptable patterns for "secondary" controls (edit / delete /
overflow):

a. **Always-visible on touch, hover-revealed on desktop:**
   ```jsx
   className="md:opacity-0 md:group-hover:opacity-100"
   ```
   The control shows on mobile; the `md:` scope keeps the hover-reveal
   only on hover-capable viewports.

b. **Replace with overflow menu on touch:**
   Render a `MoreVerticalIcon` DropdownMenu trigger at the row's edge
   that opens an action sheet with Edit / Delete / etc. at `min-h-11`.

**How to verify.** `git grep "group-hover:opacity\|opacity-0" src/`.
Every match must have a touch-visible fallback (either `md:` scope or
an overflow-menu replacement at smaller breakpoints).

---

## 10. Modals exceeding viewport height switch to bottom-Sheets on mobile

**Why.** A centered `<Dialog>` that overflows the viewport (especially
when the soft keyboard is open) traps the Save button below the keyboard
with no way to scroll the modal itself. The native mobile pattern is a
bottom-sheet with internal scroll and a sticky footer.

The shared `<Dialog>` primitive already sets:
```
max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain
pb-[max(env(safe-area-inset-bottom),1rem)]
```

So short dialogs are fine. For long forms (EntityForm, future edit
dialogs), branch on `useIsMobile()` to render `<Sheet side="bottom">`
instead:

```jsx
const isMobile = useIsMobile()
const Container = isMobile ? Sheet : Dialog
const Body = isMobile ? SheetContent : DialogContent
```

Form body inside is `flex-1 overflow-y-auto`; the footer (Save / Cancel)
sticks outside the scroll region so it's always reachable above the
keyboard.

**How to verify.** Open EntityForm on iPhone, focus the first input,
ensure you can scroll to the Save button without dismissing the
keyboard.

---

## 11. Chat / scroll-region layouts: `min-h-0` on EVERY `flex-1` ancestor

**Why.** In a CSS flex column, every `flex-1` child defaults to `min-height:
auto` — meaning its minimum height equals its content's height. If the
inner content (a message list, a long form, a settings inventory) is
taller than the viewport, the flex-1 child can't shrink below its content
size and pushes the parent past its bounds. The result on a chat screen:
the WHOLE page starts scrolling — header, composer, sidebar trigger all
slide off the viewport — instead of only the message thread scrolling.

The fix is `min-height: 0` (Tailwind `min-h-0`) on every `flex-1`
ancestor between the chat scroller and the viewport root. It tells flex
"yes, you ARE allowed to shrink this child below its content height —
the scroller's overflow-y-auto will handle the overflow".

Concrete chain in this app (top to bottom):

```
SidebarProvider  (h-svh)
  └ SidebarInset  (flex-1 min-h-0)   ← min-h-0 REQUIRED
     └ Header (shrink-0)
     └ main  (flex-1 min-h-0)        ← min-h-0 REQUIRED
        └ ChatScreen  (flex-1 min-h-0) ← min-h-0 REQUIRED
           └ chat-header (shrink-0)
           └ scroller  (flex-1 min-h-0 overflow-y-auto)  ← THE scroll region
           └ composer (shrink-0)
```

The canonical 3-row chat shell is `shrink-0 header / flex-1 min-h-0
overflow-y-auto scroller / shrink-0 composer`. Anything wrapping that
shell — and anything wrapping THAT wrapper, up to the viewport root —
must propagate `min-h-0`.

**How to verify.** Open chat on mobile, send 10+ messages. Try to scroll
DOWN further from the latest bubble. If the WHOLE page scrolls (sidebar
trigger / dashboard header disappear upward), some ancestor in the
flex-1 chain is missing `min-h-0`. Trace from the chat scroller upward
until you find the unbounded link.

---

## Anti-patterns — DON'T

- ❌ `<meta name="viewport" content="... maximum-scale=1, user-scalable=no">`
  (breaks pinch-zoom, violates WCAG 1.4.4 — already correctly omitted
  from `index.html`).
- ❌ Programmatic `taRef.current?.focus()` on mount on any screen the
  user lands on. Allowed only when `(pointer: fine)` AND not
  `ontouchstart`.
- ❌ `100vh` anywhere in new code.
- ❌ `position: sticky` inside a `transform`ed or `overflow: hidden`
  ancestor — sticky needs a scrolling ancestor; use the 3-row flex
  layout pattern instead (header auto / scroller `flex-1 min-h-0` /
  composer auto).
- ❌ `cursor: pointer` only on hover-capable devices. Always use
  `touch-action: manipulation` for tappable elements.

---

## Workflow

When adding a new screen or interactive surface:

1. Sketch the mobile (375 px) layout first, then scale up.
2. Use Tailwind mobile-first responsive classes: bare = mobile, `sm:`
   = tablet portrait, `md:` = tablet landscape / small laptop, `lg:` =
   desktop.
3. Sanity-check against each numbered principle above.
4. Add a touch-target audit screenshot to the PR if the surface has
   ≥ 3 interactive controls.

When changing the chat or sidebar:

1. Test on real iOS Safari (Simulator counts) — emulators don't always
   show the keyboard regression.
2. Test in PWA standalone mode (Add to Home Screen on iOS) — safe-area
   behavior differs from in-browser.

When adding a new dialog / form:

1. Start from the shared `<Dialog>` primitive (already responsive).
2. If the form is longer than ~6 inputs, branch to `<Sheet>` on
   `useIsMobile()`.
3. Verify the keyboard test from principle 10 before merging.
