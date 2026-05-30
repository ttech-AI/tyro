import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Refresh01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { PastelVoiceOrb } from "@/components/brand/PastelVoiceOrb"
import { ChatComposer } from "./ChatComposer"
import { ChatMessage } from "./ChatMessage"
import { QuickChips } from "./QuickChips"
import { useLocale } from "@/hooks/useLocale"
import { useConfig } from "@/hooks/useConfig"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMe } from "@/hooks/useMe"
import { loadMessages, saveMessages, clearMessages } from "@/lib/chatPersistence"
import { cn } from "@/lib/utils"

function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return "chat.greeting.morning"
  if (hour >= 12 && hour < 18) return "chat.greeting.afternoon"
  if (hour >= 18 && hour < 22) return "chat.greeting.evening"
  return "chat.greeting.night"
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return String(Date.now()) + Math.random().toString(36).slice(2, 8)
}

// Distance from the bottom (in px) below which we treat the user as "pinned
// to the latest" and auto-scroll on new messages. Above the threshold we
// show a floating "↓ N new" pill instead. 120 px is the value ChatGPT /
// Claude / Gemini all converge on.
const NEAR_BOTTOM_THRESHOLD_PX = 120

export function ChatScreen({ onReset, initialAgent }) {
  const { t } = useLocale()
  const { agents, getAgent } = useConfig()
  const isMobile = useIsMobile()
  const defaultAgentId = agents[0]?.id ?? null
  const [agent, setAgent] = useState(initialAgent || defaultAgentId)
  // Hydrate from sessionStorage on first render so back-nav doesn't drop the
  // conversation. The `?reset=` URL param at the route level remounts this
  // component (via key), which gives us a fresh empty state by design.
  const [messages, setMessages] = useState(() => loadMessages(initialAgent || defaultAgentId))
  const [orbState, setOrbState] = useState("idle")
  const [input, setInput] = useState("")
  const [speakingLevel, setSpeakingLevel] = useState(0)
  // Scroll-trap state — auto-scroll only when isNearBottom; otherwise count
  // unseen messages and surface a pill.
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [unread, setUnread] = useState(0)
  const scrollRef = useRef(null)
  const greetHour = new Date().getHours()
  const me = useMe()
  const firstName = me.name || ""

  // Speaking-mode level oscillation for the orb.
  useEffect(() => {
    if (orbState !== "speaking") return
    const id = setInterval(() => {
      setSpeakingLevel(0.22 + Math.random() * 0.78)
    }, 95)
    return () => clearInterval(id)
  }, [orbState])

  const effectiveLevel = orbState === "speaking" ? speakingLevel : 0

  // Persist on every message change so back-nav (or even sidebar nav) hydrates
  // a fresh ChatScreen with the same conversation.
  useEffect(() => {
    saveMessages(agent, messages)
  }, [messages, agent])

  // Auto-scroll trap: snap to bottom if the user was already near it; else
  // surface a "new message" pill. We track everything in refs to avoid
  // setState inside a layout effect (cascading-render risk). The pill's
  // displayed count is derived from messages.length - lastSeenLengthRef.
  const lastSeenLengthRef = useRef(messages.length)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
      lastSeenLengthRef.current = messages.length
      if (unread !== 0) setUnread(0) // eslint-disable-line react-hooks/set-state-in-effect
    } else if (messages.length > 0) {
      const last = messages[messages.length - 1]
      // Don't count user's own message as "unread" — the user just sent it.
      if (last?.role !== "user") {
        const next = messages.length - lastSeenLengthRef.current
        if (next !== unread) setUnread(next) // eslint-disable-line react-hooks/set-state-in-effect
      } else {
        lastSeenLengthRef.current = messages.length
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const near = distance < NEAR_BOTTOM_THRESHOLD_PX
    setIsNearBottom(near)
    if (near) {
      setUnread(0)
      lastSeenLengthRef.current = messages.length
    }
  }

  function scrollToBottom() {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    setUnread(0)
    setIsNearBottom(true)
    lastSeenLengthRef.current = messages.length
  }

  function cycleOrbState() {
    setOrbState((s) =>
      s === "idle" ? "listening" : s === "listening" ? "thinking" : s === "thinking" ? "speaking" : "idle",
    )
  }

  function handleMicToggle() {
    setOrbState((s) => (s === "listening" ? "idle" : "listening"))
  }

  function handleChip(prefix) {
    setInput((v) => prefix + v.replace(/^([^:]+:\s*)/, ""))
  }

  function handleInputChange(next) {
    setInput(next)
    if (next.trim() && orbState === "idle") {
      setOrbState("listening")
    } else if (!next.trim() && orbState === "listening") {
      setOrbState("idle")
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text) return
    const userMsg = {
      id: makeId(),
      role: "user",
      content: text,
      time: new Date(),
    }
    // Force isNearBottom true on send — the user just acted; they expect to
    // see their message at the bottom even if they had scrolled up.
    setIsNearBottom(true)
    setMessages((m) => [...m, userMsg])
    setInput("")
    setOrbState("thinking")
    await new Promise((r) => setTimeout(r, 1500))
    const activeAgent = getAgent(agent)
    const replyText =
      activeAgent?.description?.trim() ||
      `${activeAgent?.name ?? "Agent"} — ${t("chat.subtitle.lead")} ${t("chat.subtitle.highlight")}`
    const reply = {
      id: makeId(),
      role: "assistant",
      agent,
      content: replyText,
      time: new Date(),
    }
    setMessages((m) => [...m, reply])
    setOrbState("speaking")
    setTimeout(() => setOrbState("idle"), 2400)
  }

  function handleResetLocal() {
    setMessages([])
    clearMessages(agent)
    setOrbState("idle")
    setInput("")
    setUnread(0)
    setIsNearBottom(true)
    onReset?.()
  }

  const isEmpty = messages.length === 0

  if (isEmpty) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-6 sm:py-10">
        <PastelVoiceOrb
          state={orbState}
          level={effectiveLevel}
          size={isMobile ? 110 : 150}
          onClick={cycleOrbState}
        />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 space-y-1 text-center sm:mt-10"
        >
          <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {t(greetingKey(greetHour))}, {firstName}
          </h1>
          <p className="text-xl tracking-tight text-foreground/90 sm:text-2xl md:text-3xl">
            {t("chat.subtitle.lead")}{" "}
            <span className="bg-gradient-to-r from-brand-from via-brand-via to-brand-to bg-clip-text text-transparent">
              {t("chat.subtitle.highlight")}
            </span>
          </p>
        </motion.div>
        <ChatComposer
          value={input}
          onChange={handleInputChange}
          onSend={handleSend}
          agent={agent}
          onAgentChange={setAgent}
          onMicToggle={handleMicToggle}
          micActive={orbState === "listening"}
          disabled={orbState === "thinking"}
          className="mt-8 w-full max-w-3xl sm:mt-12"
        />
        <div className="mt-4 sm:mt-5">
          <QuickChips onChip={handleChip} />
        </div>
      </div>
    )
  }

  const activeAgent = getAgent(agent)
  // Canonical 3-row chat layout:
  //   row 1: header  (auto)
  //   row 2: scroll  (flex-1 min-h-0 overflow-y-auto overscroll-contain)
  //   row 3: composer (auto, pb-safe)
  // min-h-0 on the scroller is non-negotiable — without it flex children
  // can't shrink below their content height, so the scroller would push the
  // composer off-screen. Composer is NOT sticky — the 3-row flex naturally
  // pins it. Sticky inside a transformed/overflow-hidden ancestor is fragile
  // on iOS Safari. Root uses h-full to inherit from DashboardLayout's main,
  // which itself is flex-1 of the viewport.
  return (
    // min-h-0 + h-full lock the chat shell to its parent's height so the
    // flex-1 scroller below cannot grow taller than the viewport. Without
    // min-h-0, 10+ messages push this column past 100dvh and the WHOLE
    // page starts scrolling — the chat header and composer disappear.
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-1 flex-col px-3 pt-2 sm:px-4 sm:pt-3">
      {/* Row 1 — header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <PastelVoiceOrb state={orbState} level={effectiveLevel} size={32} />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{activeAgent?.name}</span>
            <span className="text-[10px] text-muted-foreground">
              {orbState === "thinking"
                ? "..."
                : orbState === "speaking"
                  ? "●"
                  : orbState === "listening"
                    ? "◉"
                    : "○"}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetLocal}
          className="h-11 w-11 shrink-0 gap-1.5 p-0 text-xs text-muted-foreground hover:text-foreground sm:h-8 sm:w-auto sm:px-3"
          aria-label={t("chat.reset")}
        >
          <HugeiconsIcon icon={Refresh01Icon} className="size-4 sm:size-3.5" />
          <span className="hidden sm:inline">{t("chat.reset")}</span>
        </Button>
      </div>

      {/* Row 2 — message scroller. overscroll-contain blocks Android PTR +
          iOS rubber-band from bubbling to the page. onTouchStart blurs the
          textarea so the soft keyboard dismisses when the user taps an
          older message — matches ChatGPT/Claude mobile behavior. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={() => {
          if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        }}
        className="relative flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain px-1 py-3"
      >
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
      </div>

      {/* Floating new-message pill — appears above the composer when the user
          has scrolled up and a new assistant message arrives. */}
      <div className="pointer-events-none relative z-10 -mb-2 flex justify-center">
        <AnimatePresence>
          {unread > 0 && !isNearBottom && (
            <motion.button
              key="new-msg-pill"
              type="button"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={scrollToBottom}
              className={cn(
                "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/90 px-3 py-1.5",
                "text-xs font-medium text-foreground shadow-lg backdrop-blur",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              )}
              aria-label={t("chat.scrollToLatest")}
            >
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" strokeWidth={2} />
              <span>{t("chat.newMessagePill").replace("{count}", String(unread))}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Row 3 — composer. The padding-bottom uses an inline max() so even
          in a browser tab (insets=0) the touch surface has a small breathing
          gap, while in PWA standalone the home-indicator area is fully
          cleared. Solid bg at the bottom keeps the indicator from bleeding
          through the gradient. */}
      <div
        className="shrink-0 bg-background pt-2 sm:pt-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          agent={agent}
          onAgentChange={setAgent}
          onMicToggle={handleMicToggle}
          micActive={orbState === "listening"}
          disabled={orbState === "thinking"}
        />
      </div>
    </div>
  )
}
