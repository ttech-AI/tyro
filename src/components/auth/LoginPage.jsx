import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "motion/react"
import { useMsal } from "@azure/msal-react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight02Icon, Moon02Icon, Sun03Icon, VolumeHighIcon, VolumeMute02Icon } from "@hugeicons/core-free-icons"
import { TyroLogo } from "@/components/brand/TyroLogo"
import { PastelVoiceOrb } from "@/components/brand/PastelVoiceOrb"
import { useLocale } from "@/hooks/useLocale"
import { useTheme } from "@/hooks/useTheme"
import { useIsMobile } from "@/hooks/use-mobile"
import { isMsalConfigured, loginRequest, MOCK_LOGGED_IN_KEY } from "@/lib/msal"
import { cn } from "@/lib/utils"

const INSTA_COLORS = {
  gradStart: "#feda77",
  gradEnd: "#dd2a7b",
  fillA: "#ad339d",
  fillB: "#8134af",
  fillC: "#8134af",
}

const INSTA_GRADIENT =
  "linear-gradient(135deg, #feda77 0%, #dd2a7b 50%, #8134af 100%)"

const LOGIN_INIT_FLAG = "tyro-login-initialized"
const LOGIN_MUTED_KEY = "tyro-login-muted"

const VOICE_FILES = [
  "voiceassets/ElevenLabs_Britishv2.mp3",
  "voiceassets/ElevenLabs_britisv3.mp3",
]

function readMuted() {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(LOGIN_MUTED_KEY) === "1"
}

const headlineParent = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.18, delayChildren: 0.35 } },
}

const headlineLetter = {
  hidden: { opacity: 0, y: 40, filter: "blur(14px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -12,
    filter: "blur(12px)",
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

export function LoginPage() {
  const { t } = useLocale()
  const { theme, setTheme } = useTheme()
  const { setLocale } = useLocale()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { instance } = useMsal()

  // phase: idle | listening | connecting | dissolving
  const [phase, setPhase] = useState("idle")
  const activityTimer = useRef(null)
  // Connect-flow timers (dissolve + loginRedirect). Held so they can be cleared on
  // unmount — otherwise a stale timer fires loginRedirect after the user left.
  const connectTimers = useRef([])

  // Voice greeting state
  const [muted, setMuted] = useState(readMuted)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingLevel, setSpeakingLevel] = useState(0)
  const audioRef = useRef(null)
  const speakingTimer = useRef(null)

  const isDark = theme === "dark"
  const isSpinning = phase === "connecting" || phase === "dissolving"
  // Same boolean, named for what it drives in the JSX: when true, all chrome
  // (header, headline, tagline, CTA, footer) fades out and the orb takes
  // the whole stage and grows.
  const isConnecting = isSpinning
  // How much the orb scales during the handoff. Subtle bump during connecting
  // (1.25×) → dramatic bloom during dissolving (3×) so the last beat reads
  // as "the orb is the portal", then loginRedirect fires.
  const orbScale =
    phase === "dissolving" ? (isMobile ? 2.4 : 3) : phase === "connecting" ? 1.22 : 1
  // On Connect: orb stays still and just plays the speaking-mode visual.
  // The handoff effect comes from the page chrome fading and the orb scaling
  // up — no rotation, no orbital satellites, no axial wobble.
  const orbState = isSpinning
    ? "speaking"
    : isSpeaking
      ? "speaking"
      : phase === "listening"
        ? "listening"
        : "idle"

  // First-time defaults: light + tr (only on first ever login visit)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.localStorage.getItem(LOGIN_INIT_FLAG)) {
      setTheme("light")
      setLocale("tr")
      window.localStorage.setItem(LOGIN_INIT_FLAG, "1")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track short viewports (laptops ≤ 820px height) so orb / spacing can shrink to fit
  const [isShortHeight, setIsShortHeight] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-height: 820px)").matches
  })
  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia("(max-height: 820px)")
    const update = (e) => setIsShortHeight(e.matches)
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])

  // ---------- Voice greeting: play one random file 2s after mount ----------
  useEffect(() => {
    if (muted) return
    const playTimer = setTimeout(() => {
      const pick = VOICE_FILES[Math.floor(Math.random() * VOICE_FILES.length)]
      const src = import.meta.env.BASE_URL + pick
      const audio = new Audio(src)
      audio.preload = "auto"
      audioRef.current = audio
      audio.addEventListener("ended", () => setIsSpeaking(false))
      audio.addEventListener("pause", () => setIsSpeaking(false))
      audio
        .play()
        .then(() => setIsSpeaking(true))
        .catch(() => {
          // Autoplay blocked — fail silently, orb stays in idle/listening
        })
    }, 2000)
    return () => {
      clearTimeout(playTimer)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
        audioRef.current = null
      }
      setIsSpeaking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- Speaking level oscillation (drives orb scale during speak) ----------
  useEffect(() => {
    if (!isSpeaking) return
    speakingTimer.current = setInterval(() => {
      setSpeakingLevel(0.25 + Math.random() * 0.75)
    }, 95)
    return () => clearInterval(speakingTimer.current)
  }, [isSpeaking])

  const effectiveLevel = isSpeaking ? speakingLevel : 0

  function handleToggleMute() {
    const next = !muted
    setMuted(next)
    if (next) {
      // Mute: stop playback + remember
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
        audioRef.current = null
      }
      setIsSpeaking(false)
      window.localStorage.setItem(LOGIN_MUTED_KEY, "1")
    } else {
      window.localStorage.removeItem(LOGIN_MUTED_KEY)
    }
  }

  // ---------- Mouse movement → listening, stops → idle quickly ----------
  const triggerListening = useCallback(() => {
    setPhase((p) => {
      if (p === "connecting" || p === "dissolving") return p
      return "listening"
    })
    if (activityTimer.current) clearTimeout(activityTimer.current)
    activityTimer.current = setTimeout(() => {
      setPhase((p) => (p === "listening" ? "idle" : p))
    }, 350)
  }, [])

  useEffect(() => {
    const timers = connectTimers.current
    return () => {
      if (activityTimer.current) clearTimeout(activityTimer.current)
      timers.forEach(clearTimeout)
    }
  }, [])

  async function handleConnect() {
    if (isSpinning) return
    if (activityTimer.current) clearTimeout(activityTimer.current)
    // Clear any fired-timer ids left over from previous failed attempts so
    // the array doesn't grow across retries. Mutate in place (length = 0)
    // rather than reassigning — the unmount cleanup captured this array
    // reference at mount, so reassigning would orphan new timer ids.
    connectTimers.current.forEach(clearTimeout)
    connectTimers.current.length = 0
    setPhase("connecting")

    // MSAL configured → real Azure AD login via redirect; otherwise mock flag.
    // Redirect flow: globe spins (~1.1s), short corporate wash (~500ms),
    // then loginRedirect. Total ~1.6s — Stripe/MS-365 territory rather than
    // the previous 2.3s which read as a hang.
    if (isMsalConfigured) {
      connectTimers.current.push(setTimeout(() => setPhase("dissolving"), 1100))
      connectTimers.current.push(
        setTimeout(() => {
          instance.loginRedirect(loginRequest).catch((err) => {
            console.warn("[MSAL] login failed:", err?.errorCode || err?.message || err)
            setPhase("idle")
            toast.error(t("login.error"))
          })
        }, 1600),
      )
      return
    }

    // Mock auth fallback
    connectTimers.current.push(setTimeout(() => setPhase("dissolving"), 1100))
    connectTimers.current.push(
      setTimeout(() => {
        try {
          window.sessionStorage.setItem(MOCK_LOGGED_IN_KEY, "1")
          window.localStorage.removeItem(MOCK_LOGGED_IN_KEY)
          navigate("/dashboard")
        } catch (err) {
          console.warn("[mock-auth] navigate failed:", err?.message || err)
          setPhase("idle")
          toast.error(t("login.error"))
        }
      }, 1600),
    )
  }

  const orbSize = isMobile ? 170 : isShortHeight ? 200 : 280

  return (
    <div
      onMouseMove={triggerListening}
      className={cn(
        "relative flex h-[100svh] w-full flex-col overflow-hidden",
        // PWA standalone safe-area: status bar (Dynamic Island / notch)
        // would cover the top brand row, home indicator would clip the
        // footer copyright. Browser-tab visits get insets=0 so the layout
        // is identical there. Total height stays 100svh; the safe-area
        // is applied as inner padding via Tailwind utilities defined in
        // src/index.css.
        "pt-safe pb-safe pl-safe pr-safe",
        isDark ? "bg-[#0c0c0c] text-[#D7E2EA]" : "bg-[#fafafa] text-[#1a1a1a]",
      )}
      style={{ fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif' }}
    >
      {/* Diagonal grain backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: isDark
            ? "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.02) 100%)"
            : "linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0) 40%, rgba(221,42,123,0.04) 100%)",
        }}
      />

      {/* Insta tinted radial glow (light mode) */}
      {!isDark && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at top right, rgba(254,218,119,0.08), transparent 50%), radial-gradient(ellipse at bottom left, rgba(129,52,175,0.06), transparent 55%)",
          }}
        />
      )}

      {/* Border frame — also fades during handoff so the stage is just the orb. */}
      <motion.div
        aria-hidden="true"
        animate={{ opacity: isConnecting ? 0 : 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute inset-0"
      >
        <div className={cn("absolute left-0 right-0 top-[76px] h-px sm:top-[92px]", isDark ? "bg-white/10" : "bg-black/10")} />
        <div className={cn("absolute left-0 right-0 bottom-[48px] h-px sm:bottom-[56px]", isDark ? "bg-white/10" : "bg-black/10")} />
        <div className={cn("absolute left-0 top-0 bottom-0 w-px", isDark ? "bg-white/[0.06]" : "bg-black/[0.06]")} />
        <div className={cn("absolute right-0 top-0 bottom-0 w-px", isDark ? "bg-white/[0.06]" : "bg-black/[0.06]")} />
      </motion.div>

      {/* TOP bar (in-flow, shrink-0) — fades out during the handoff so only
          the orb remains on the stage. */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={
          isConnecting
            ? { opacity: 0, y: -8, filter: "blur(6px)" }
            : { opacity: 1, y: 0, filter: "blur(0px)" }
        }
        transition={{
          duration: isConnecting ? 0.42 : 0.8,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="relative z-20 flex h-[76px] shrink-0 items-center justify-between px-4 sm:h-[92px] sm:px-10 lg:px-14"
      >
        {/* Brand block left */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <TyroLogo size={36} className="size-[34px] shrink-0 sm:size-[42px]" themeColors={INSTA_COLORS} />
          <div className="flex min-w-0 flex-col leading-none">
            <span className={cn("inline-flex items-baseline text-lg font-bold tracking-tight sm:text-2xl", isDark ? "text-white" : "text-[#1a1a1a]")}>
              <span>tyro</span>
              <span
                style={{
                  backgroundImage: INSTA_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                AI
              </span>
            </span>
            <span
              className={cn("mt-1 hidden text-[10px] font-medium uppercase sm:mt-1.5 sm:inline", isDark ? "text-[#D7E2EA]/55" : "text-[#1a1a1a]/50")}
              style={{ letterSpacing: "0.18em" }}
            >
              {t("login.subBrand")}
            </span>
          </div>
        </div>

        {/* Controls right */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <LoginMuteToggle muted={muted} isDark={isDark} onToggle={handleToggleMute} />
          <LoginThemeToggle isDark={isDark} />
          <LoginLanguageToggle isDark={isDark} />
        </div>
      </motion.header>

      {/* MAIN STAGE (fills remaining viewport between header and footer) */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-6 sm:px-10 sm:py-10">
        {/* Stage: headline behind, orb on top */}
        <div className="relative flex w-full items-center justify-center">
          <motion.h1
            initial="hidden"
            animate={isConnecting ? "exit" : "visible"}
            variants={headlineParent}
            aria-label="HI, I'M TYRO"
            className="pointer-events-none absolute inset-x-0 select-none text-center"
            style={{
              fontFamily: '"Kanit", "Inter Variable", system-ui, sans-serif',
              fontWeight: 700,
              fontSize: isMobile
                ? "clamp(56px, 22vw, 100px)"
                : isShortHeight
                  ? "clamp(80px, 14vw, 180px)"
                  : "clamp(96px, 18vw, 240px)",
              lineHeight: 0.92,
              letterSpacing: "-0.0023em",
              textTransform: "uppercase",
              whiteSpace: isMobile ? "normal" : "nowrap",
            }}
          >
            <motion.span
              variants={headlineLetter}
              className={cn(
                "inline-block bg-clip-text text-transparent",
                isDark
                  ? "bg-gradient-to-b from-white via-white/85 to-white/30"
                  : "bg-gradient-to-b from-[#1a1a1a] via-[#1a1a1a]/70 to-[#1a1a1a]/20",
              )}
            >
              {isMobile ? (
                <>
                  {t("login.headlineGreeting")}
                  <br />
                  {t("login.headlineBrand")}
                </>
              ) : (
                <>{t("login.headlineGreeting")}&nbsp;{t("login.headlineBrand")}</>
              )}
            </motion.span>
          </motion.h1>

          {/* Orb container — entrance fade-in for first paint, then the inner
              scale wrapper drives the connect handoff (1× → 1.22× → 3×). The
              orb itself sits in speaking-mode visual the whole time; no
              rotation, no satellites, no axial wobble. Page chrome fades out
              in parallel so the orb is the sole focal point by the time
              loginRedirect fires. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10"
          >
            {/* Scale wrapper — the orb doesn't rotate, doesn't wobble, doesn't
                have satellites. Just sits in speaking-mode visual and grows
                from 1× → 1.22× during connecting → 3× during dissolving. The
                page chrome fades in parallel so the orb becomes the entire
                stage by the time loginRedirect fires.

                No width/height/transformOrigin here on purpose — PastelVoiceOrb
                renders its outer button at 1.78× size (aura overflow), so the
                wrapper must shrink-wrap to that natural box. v1 did the same;
                boxing this to orbSize×orbSize pushed the orb's optical center
                ~109px below where the absolute headline's items-center landed,
                which is the "orb drifted off HI" regression. */}
            <motion.div
              animate={{ scale: orbScale }}
              transition={{
                duration: phase === "dissolving" ? 0.95 : 0.55,
                ease: phase === "dissolving" ? [0.45, 0, 0.2, 1] : [0.22, 1, 0.36, 1],
              }}
              className="relative"
            >
              <PastelVoiceOrb state={orbState} level={effectiveLevel} size={orbSize} />
            </motion.div>
          </motion.div>
        </div>

        {/* Tagline + CTA — both fade out together when the handoff starts so
            only the orb remains on the stage. */}
        <motion.div
          animate={
            isConnecting
              ? { opacity: 0, y: 12, filter: "blur(6px)" }
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          transition={{ duration: isConnecting ? 0.38 : 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative z-10 flex flex-col items-center text-center",
            isShortHeight
              ? "mt-4 gap-4 sm:mt-6 sm:gap-5"
              : "mt-6 gap-5 sm:mt-10 sm:gap-7",
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-w-3xl flex-col items-center gap-2 text-center"
          >
            <span className="inline-flex items-baseline text-lg font-bold tracking-tight sm:text-2xl">
              <span className={cn(isDark ? "text-white" : "text-[#1a1a1a]")}>TYRO</span>
              <span
                className="ml-1.5"
                style={{
                  backgroundImage: INSTA_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                AI
              </span>
            </span>
            <p
              className={cn(
                "text-sm leading-relaxed sm:text-xl",
                isDark ? "text-[#D7E2EA]/85" : "text-[#1a1a1a]/75",
              )}
            >
              {t("login.motto")}
            </p>
            <p
              className={cn(
                "text-sm leading-relaxed sm:text-xl",
                isDark ? "text-[#D7E2EA]/85" : "text-[#1a1a1a]/75",
              )}
            >
              {t("login.mottoEnd")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <CtaButton
              onClick={handleConnect}
              disabled={isSpinning}
              label={t("login.cta")}
              isDark={isDark}
            />
          </motion.div>
        </motion.div>
      </main>

      {/* Footer — fades out with the rest of the chrome during the handoff. */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={
          isConnecting
            ? { opacity: 0, y: 6, filter: "blur(4px)" }
            : { opacity: 1, y: 0, filter: "blur(0px)" }
        }
        transition={{
          duration: isConnecting ? 0.4 : 0.6,
          delay: isConnecting ? 0 : 1.5,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="relative z-10 flex h-[48px] shrink-0 items-center justify-center px-3 sm:h-[56px] sm:px-10"
      >
        <p className={cn("text-center text-[9px] tracking-[0.04em] sm:text-[11px]", isDark ? "text-[#D7E2EA]/50" : "text-[#1a1a1a]/45")}>
          {t("login.copyright")}
        </p>
      </motion.footer>

      {/* Screen-reader announcement for the handoff — visually hidden so the
          orb stays the sole focal point but assistive tech still hears that
          the system is authenticating. */}
      {isConnecting && (
        <span className="sr-only" aria-live="polite" aria-busy="true">
          {t("login.connectingTitle")}
        </span>
      )}

      {/* Backdrop dim — fades in as the orb grows so the orb's pastel bloom
          reads brighter against a slightly darker stage. Sits BEHIND the orb
          (z-0) so the orb stays the focal point. No text, no spinner, no
          logo — the orb itself is the transition. */}
      <motion.div
        aria-hidden="true"
        animate={{
          opacity:
            phase === "dissolving" ? 1 : phase === "connecting" ? 0.35 : 0,
        }}
        transition={{
          duration: phase === "dissolving" ? 0.7 : 0.5,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 90% 70% at 50% 50%, rgba(10,22,40,0.55) 0%, rgba(10,22,40,0.85) 60%, rgba(10,22,40,0.95) 100%)"
            : "radial-gradient(ellipse 90% 70% at 50% 50%, rgba(255,255,255,0.35) 0%, rgba(245,240,250,0.65) 60%, rgba(235,225,245,0.85) 100%)",
        }}
      />
    </div>
  )
}

// --- Controls ---

function LoginMuteToggle({ muted, isDark, onToggle }) {
  const { t } = useLocale()
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? t("login.audio.unmute") : t("login.audio.mute")}
      title={muted ? t("login.audio.unmute") : t("login.audio.mute")}
      className={cn(
        "grid size-10 place-items-center rounded-full transition",
        isDark
          ? "text-white/70 hover:bg-white/[0.06] hover:text-white"
          : "text-[#1a1a1a]/70 hover:bg-black/[0.04] hover:text-[#1a1a1a]",
      )}
    >
      <HugeiconsIcon icon={muted ? VolumeMute02Icon : VolumeHighIcon} className="size-[18px]" strokeWidth={1.6} />
    </button>
  )
}

function LoginThemeToggle({ isDark }) {
  const { toggle } = useTheme()
  const { t } = useLocale()
  const label = isDark ? t("header.toggleLight") : t("header.toggleDark")
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className={cn(
        "grid size-10 place-items-center rounded-full transition",
        isDark
          ? "text-white/70 hover:bg-white/[0.06] hover:text-white"
          : "text-[#1a1a1a]/70 hover:bg-black/[0.04] hover:text-[#1a1a1a]",
      )}
    >
      <HugeiconsIcon icon={isDark ? Sun03Icon : Moon02Icon} className="size-[18px]" strokeWidth={1.6} />
    </button>
  )
}

function LoginLanguageToggle({ isDark }) {
  const { locale, setLocale } = useLocale()
  const next = locale === "tr" ? "en" : "tr"
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={`Switch to ${next.toUpperCase()}`}
      className={cn(
        "grid h-10 min-w-10 place-items-center rounded-full px-3 text-[11px] font-semibold uppercase transition",
        isDark
          ? "text-white/70 hover:bg-white/[0.06] hover:text-white"
          : "text-[#1a1a1a]/70 hover:bg-black/[0.04] hover:text-[#1a1a1a]",
      )}
      style={{ letterSpacing: "0.18em" }}
    >
      {next}
    </button>
  )
}

function CtaButton({ onClick, disabled, label, isDark }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.03 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(
        "group relative inline-flex items-center gap-6 overflow-hidden rounded-lg border px-8 py-4 text-[13px] font-semibold uppercase tracking-[0.18em] transition-all duration-300",
        isDark
          ? "border-white/20 bg-transparent text-white hover:border-transparent"
          : "border-[#1a1a1a]/25 bg-transparent text-[#1a1a1a] hover:border-transparent hover:text-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundImage: INSTA_GRADIENT }}
      />
      <span className="relative z-10 transition-colors duration-300 group-hover:text-white">
        {label}
      </span>
      <span
        className={cn(
          "relative z-10 grid size-8 shrink-0 place-items-center rounded-md border transition-all duration-300",
          isDark ? "border-white/30 group-hover:border-white/70" : "border-[#1a1a1a]/30 group-hover:border-white/70",
          "group-hover:bg-white/[0.12]",
        )}
      >
        <HugeiconsIcon
          icon={ArrowRight02Icon}
          className="size-4 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white"
          strokeWidth={1.8}
        />
      </span>
    </motion.button>
  )
}
