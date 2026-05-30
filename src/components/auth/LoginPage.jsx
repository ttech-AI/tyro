import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "motion/react"
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
  const orbState = isSpinning
    ? "thinking"
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
    setPhase("connecting")

    // MSAL configured → real Azure AD login via redirect; otherwise mock flag.
    // Redirect flow: cinematic transition first, then send the user to MS.
    // On return, main.jsx's handleRedirectPromise() picks up the auth and the
    // auth gate sends them to /dashboard.
    if (isMsalConfigured) {
      connectTimers.current.push(setTimeout(() => setPhase("dissolving"), 1500))
      connectTimers.current.push(
        setTimeout(() => {
          instance.loginRedirect(loginRequest).catch((err) => {
            console.warn("[MSAL] login failed:", err?.errorCode || err?.message || err)
            setPhase("idle")
            toast.error(t("login.error"))
          })
        }, 2300),
      )
      return
    }

    // Mock auth fallback
    connectTimers.current.push(setTimeout(() => setPhase("dissolving"), 1500))
    connectTimers.current.push(
      setTimeout(() => {
        window.sessionStorage.setItem(MOCK_LOGGED_IN_KEY, "1")
        window.localStorage.removeItem(MOCK_LOGGED_IN_KEY)
        navigate("/dashboard")
      }, 2300),
    )
  }

  const orbSize = isMobile ? 170 : isShortHeight ? 200 : 280

  return (
    <div
      onMouseMove={triggerListening}
      className={cn(
        "relative flex h-screen w-full flex-col overflow-hidden",
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

      {/* Border frame */}
      <div aria-hidden="true" className={cn("pointer-events-none absolute left-0 right-0 top-[76px] h-px sm:top-[92px]", isDark ? "bg-white/10" : "bg-black/10")} />
      <div aria-hidden="true" className={cn("pointer-events-none absolute left-0 right-0 bottom-[48px] h-px sm:bottom-[56px]", isDark ? "bg-white/10" : "bg-black/10")} />
      <div aria-hidden="true" className={cn("pointer-events-none absolute left-0 top-0 bottom-0 w-px", isDark ? "bg-white/[0.06]" : "bg-black/[0.06]")} />
      <div aria-hidden="true" className={cn("pointer-events-none absolute right-0 top-0 bottom-0 w-px", isDark ? "bg-white/[0.06]" : "bg-black/[0.06]")} />

      {/* TOP bar (in-flow, shrink-0) */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
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
      <main
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 sm:px-10",
          // Bias the centered column upward (extra bottom padding) so the tagline + CTA
          // don't crowd the footer. Short viewports stay near-symmetric to avoid clipping.
          isShortHeight ? "pt-4 pb-8 sm:pt-6 sm:pb-12" : "pt-6 pb-20 sm:pt-8 sm:pb-28",
        )}
      >
        {/* Stage: headline behind, orb on top */}
        <div className="relative flex w-full items-center justify-center">
          <motion.h1
            initial="hidden"
            animate="visible"
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

          {/* Orb container — orb rotates + satellites orbit during connect */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, filter: "blur(20px)" }}
            animate={{
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
            }}
            transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10"
          >
            {/* Orb itself spins around its own Z axis (gradient highlight rotates) */}
            <motion.div
              animate={{ rotate: isSpinning ? 360 : 0 }}
              transition={
                isSpinning
                  ? { rotate: { duration: 2, repeat: Infinity, ease: "linear" } }
                  : { rotate: { duration: 0.5, ease: "easeOut" } }
              }
            >
              <PastelVoiceOrb state={orbState} level={effectiveLevel} size={orbSize} />
            </motion.div>

            {/* Orbital satellites — faster counter-spin around orb */}
            <AnimatePresence>
              {isSpinning && (
                <motion.div
                  key="orbit"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1, rotate: 360 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    opacity: { duration: 0.3 },
                    scale: { duration: 0.3 },
                    rotate: { duration: 1.2, repeat: Infinity, ease: "linear" },
                  }}
                  className="pointer-events-none absolute inset-0 z-20"
                >
                  <div aria-hidden="true" className="absolute inset-[6%] rounded-full border border-white/15" />
                  <div
                    aria-hidden="true"
                    className="absolute left-1/2 top-[6%] -ml-1.5 size-3 rounded-full bg-white"
                    style={{
                      boxShadow:
                        "0 0 12px 4px rgba(255,255,255,0.6), 0 0 24px 8px rgba(221,42,123,0.4)",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute left-1/2 bottom-[6%] -ml-1 size-2 rounded-full bg-[#feda77]"
                    style={{
                      boxShadow:
                        "0 0 8px 3px rgba(254,218,119,0.7), 0 0 18px 6px rgba(129,52,175,0.4)",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Tagline + CTA */}
        <div
          className={cn(
            "relative z-10 flex flex-col items-center text-center",
            isShortHeight
              ? "mt-6 gap-4 sm:mt-8 sm:gap-5"
              : "mt-8 gap-5 sm:mt-14 sm:gap-7",
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
        </div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.5 }}
        className="relative z-10 flex h-[48px] shrink-0 items-center justify-center px-3 sm:h-[56px] sm:px-10"
      >
        <p className={cn("text-center text-[9px] tracking-[0.04em] sm:text-[11px]", isDark ? "text-[#D7E2EA]/50" : "text-[#1a1a1a]/45")}>
          {t("login.copyright")}
        </p>
      </motion.footer>

      {/* Cinematic portal — bloom from orb center, pastel Insta veil, soft flash */}
      <AnimatePresence>
        {phase === "dissolving" && (
          <>
            {/* Soft pastel Insta veil — gradient field that follows behind bloom */}
            <motion.div
              key="veil"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none fixed inset-0 z-30"
              style={{
                background:
                  "linear-gradient(135deg, #fff4dc 0%, #fdd5e5 28%, #e5d4fa 58%, #fef0e3 100%)",
              }}
            />

            {/* Bloom — expanding glowing disc from orb center */}
            <motion.div
              key="bloom"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 9, opacity: [0, 1, 0.75] }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.9,
                times: [0, 0.45, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
              className="pointer-events-none fixed left-1/2 top-1/2 z-40 size-[24vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(254,218,119,0.85) 22%, rgba(221,42,123,0.55) 52%, rgba(129,52,175,0.25) 78%, transparent 100%)",
                filter: "blur(28px)",
              }}
            />

            {/* Sweep — thin bright ring that washes outward as a portal lip */}
            <motion.div
              key="sweep"
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 7, opacity: [0, 0.6, 0] }}
              transition={{
                duration: 0.85,
                times: [0, 0.35, 1],
                ease: "easeOut",
              }}
              className="pointer-events-none fixed left-1/2 top-1/2 z-40 size-[24vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.9), 0 0 24px 6px rgba(254,218,119,0.7), 0 0 48px 12px rgba(221,42,123,0.5)",
              }}
            />

            {/* Soft initial flash — single subtle pulse */}
            <motion.div
              key="flash"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.45, 0] }}
              transition={{ duration: 0.5, times: [0, 0.4, 1], ease: "easeOut" }}
              className="pointer-events-none fixed inset-0 z-50 bg-white"
            />
          </>
        )}
      </AnimatePresence>
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
