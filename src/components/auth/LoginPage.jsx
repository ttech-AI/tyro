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

          {/* Orb container — the orb visual NEVER changes. During connecting
              we wrap it in a 3D-perspective transform: rotateZ continuous (the
              "spin axis") + small rotateY/rotateX oscillation ("axial wobble"
              like Earth's 23.5° tilt). A static directional shading overlay
              keeps the sphere optically anchored so the spin doesn't read as
              a coin flip. Orbital ring + two satellites give the outer-depth
              cue that confirms "this is a globe rotating, not a disc". */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10"
            style={{ width: orbSize, height: orbSize, perspective: 1200 }}
          >
            <motion.div
              animate={
                isSpinning
                  ? {
                      rotateZ: 360,
                      rotateY: [-10, 10, -10],
                      rotateX: [3, -3, 3],
                    }
                  : { rotateZ: 0, rotateY: 0, rotateX: 0 }
              }
              transition={
                isSpinning
                  ? {
                      rotateZ: { duration: 4.5, repeat: Infinity, ease: "linear" },
                      rotateY: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
                      rotateX: { duration: 5.2, repeat: Infinity, ease: "easeInOut" },
                    }
                  : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
              }
              style={{ transformStyle: "preserve-3d", width: orbSize, height: orbSize }}
              className="relative"
            >
              <PastelVoiceOrb state={orbState} level={effectiveLevel} size={orbSize} />

              {/* Sphere depth shading — counter-rotates with the orb's spin so
                  the highlight + shadow stay fixed in screen space, giving the
                  illusion that the orb is a 3D ball with a stable light source.
                  Without this the spin would read as 2D (everything moves). */}
              <AnimatePresence>
                {isSpinning && (
                  <motion.div
                    key="sphere-shading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, rotate: -360 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      opacity: { duration: 0.4 },
                      rotate: { duration: 4.5, repeat: Infinity, ease: "linear" },
                    }}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.22) 0%, transparent 38%), radial-gradient(circle at 72% 78%, rgba(10,10,20,0.32) 0%, transparent 55%)",
                      mixBlendMode: "soft-light",
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.div>

            {/* Orbital ring + 2 satellites — counter-rotate slower for depth
                contrast. Only visible during connect. */}
            <AnimatePresence>
              {isSpinning && (
                <motion.div
                  key="orbital-ring"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1, rotate: -360 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{
                    opacity: { duration: 0.4 },
                    scale: { duration: 0.4 },
                    rotate: { duration: 6, repeat: Infinity, ease: "linear" },
                  }}
                  className="pointer-events-none absolute inset-0 z-20"
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-[4%] rounded-full border border-white/12"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute left-1/2 top-[4%] -ml-[5px] size-2.5 rounded-full bg-white"
                    style={{
                      boxShadow:
                        "0 0 10px 3px rgba(255,255,255,0.65), 0 0 22px 7px rgba(221,42,123,0.4)",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute left-1/2 bottom-[4%] -ml-[3px] size-1.5 rounded-full bg-[#feda77]"
                    style={{
                      boxShadow:
                        "0 0 8px 3px rgba(254,218,119,0.7), 0 0 18px 5px rgba(129,52,175,0.35)",
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

      {/* Corporate transition — deep navy wash, text-led, no logo splash.
          Stripe / Microsoft 365 / Linear pattern: the page they came from
          owned the brand mark; this 500ms handoff just confirms the system
          is authenticating. No saturated colors, no logo, no bouncing dots. */}
      <AnimatePresence>
        {phase === "dissolving" && (
          <motion.div
            key="corporate-wash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            // No pointer-events-none — the page is mid-redirect and shouldn't
            // accept clicks on the header controls underneath. The overlay
            // covers the viewport completely, so blocking input is correct.
            className="fixed inset-0 z-50 grid place-items-center bg-[#0a1628]"
            aria-live="polite"
            aria-busy="true"
          >
            {/* Whisper-quiet purple depth glow — keeps the brand thread without
                tipping into pastel. 14% opacity at the center, fades by 70%. */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 50% 45%, rgba(129,52,175,0.14) 0%, rgba(129,52,175,0.04) 35%, transparent 70%)",
              }}
            />

            {/* Indeterminate hairline progress at the top — Stripe-style.
                White at low opacity, with a moving highlight that travels
                left→right on a 1.4s loop. Replaces the previous saturated
                Insta-gradient stripe which read as Tumblr SaaS. */}
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-0 h-px overflow-hidden bg-white/10"
            >
              <motion.div
                className="absolute left-0 top-0 h-full w-[28%] bg-white/55"
                animate={{ x: ["-100%", "380%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex flex-col items-center gap-5 px-6"
            >
              <p
                className="text-[13px] font-medium text-white/80 sm:text-sm"
                style={{ letterSpacing: "0.04em" }}
              >
                {t("login.connectingTitle")}
              </p>
              {/* Sliding bar — singular, restrained. Matches the top hairline
                  motion, gives a clear "operating" signal without typing-
                  indicator vibes. */}
              <div
                aria-hidden="true"
                className="relative h-px w-40 overflow-hidden bg-white/10"
              >
                <motion.div
                  className="absolute left-0 top-0 h-full w-1/3 bg-white/70"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </motion.div>
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
