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
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis"
import { loadMessages, saveMessages, clearMessages } from "@/lib/chatPersistence"
import { startConversation, sendMessage, sendAction } from "@/lib/copilot"
import { cn } from "@/lib/utils"

function extractSubmitActions(items) {
  if (!Array.isArray(items)) return []
  const actions = []
  for (const item of items) {
    if (item.type === "ActionSet" && item.actions) actions.push(...item.actions.filter((a) => a.type === "Action.Submit"))
    if (item.body) actions.push(...extractSubmitActions(item.body))
    if (item.columns) for (const col of item.columns) actions.push(...extractSubmitActions(col.items || []))
    if (item.items) actions.push(...extractSubmitActions(item.items))
  }
  return actions
}

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
  const { t, locale } = useLocale()
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
  const { isSpeaking: ttsSpeaking, speak, cancel: cancelTts } = useSpeechSynthesis()
  // Debounce timer for typing → thinking → idle transitions.
  const typingTimerRef = useRef(null)
  const copilotClientRef = useRef(null)
  const abortGenRef = useRef(0)
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

  // Orb click → speak the greeting line (the static text under the orb,
  // with the user's name woven in) in the current locale. While speaking,
  // an effect below forces orb into "speaking" mode. Click again to cancel.
  // No-op while the mic is listening (Web Speech in & out collide on iOS).
  function handleOrbClick() {
    if (orbState === "listening") return
    if (ttsSpeaking) {
      cancelTts()
      return
    }
    const greeting = t(greetingKey(greetHour))
    const lead = t("chat.subtitle.lead")
    const highlight = t("chat.subtitle.highlight")
    const fullText = `${greeting}, ${firstName}. ${lead} ${highlight}`
    const lang = locale === "tr" ? "tr-TR" : "en-US"
    // Slight slowdown (rate 0.95) gives Turkish a smoother, less choppy
    // cadence — the default 1.0 made the engine clip syllables on the
    // bundled Windows Tolga voice. Cloud / neural voices handle 0.95
    // naturally too.
    speak(fullText, { lang, rate: 0.95 })
  }

  // The composer drives the recognizer; we only need to mirror its boolean
  // listening flag into orbState. Listening always wins over any other mode.
  function handleMicToggle(nextListening) {
    if (nextListening) setOrbState("listening")
    else setOrbState((s) => (s === "listening" ? "idle" : s))
  }

  function handleChip(prefix) {
    setInput((v) => prefix + v.replace(/^([^:]+:\s*)/, ""))
  }

  // User-typing → "thinking" with a 600 ms idle debounce. Mic listening and
  // TTS speaking both outrank typing — don't flap them.
  function handleInputChange(next) {
    setInput(next)
    if (orbState === "listening" || orbState === "speaking" || ttsSpeaking) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    if (next.trim()) {
      if (orbState !== "thinking") setOrbState("thinking")
      typingTimerRef.current = setTimeout(() => {
        setOrbState((s) => (s === "thinking" ? "idle" : s))
      }, 600)
    } else {
      setOrbState((s) => (s === "thinking" ? "idle" : s))
    }
  }

  // Force orb into "speaking" while the TTS engine is playing the greeting,
  // revert to "idle" when it finishes (unless something else has claimed
  // the orb in the meantime). This is a legitimate external-signal-to-state
  // mirror (the speechSynthesis engine fires onstart/onend through the hook
  // and we need to reflect that in the orb's visual mode).
  useEffect(() => {
    if (ttsSpeaking) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrbState("speaking")
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrbState((s) => (s === "speaking" ? "idle" : s))
    }
  }, [ttsSpeaking])

  // Tear down the typing debounce on unmount.
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    }
  }, [])

  // Agent değişince (veya ilk yüklemede) Copilot konuşmasını başlat ve selamlamayı göster.
  // Bu sayede kullanıcı ilk mesajını gönderdiğinde bot zaten hazır olur.
  useEffect(() => {
    const activeAgent = getAgent(agent)
    const schemaName = activeAgent?.agentId
    if (!schemaName || schemaName === "agent-id") return

    copilotClientRef.current = null
    const gen = ++abortGenRef.current

    async function initConversation() {
      const greetingId = makeId()
      setMessages((m) => [...m, { id: greetingId, role: "assistant", agent, content: "", attachments: [], time: new Date() }])
      let greetingText = ""
      let greetingAttachments = []
      let copilotClient = null
      try {
        for await (const chunk of startConversation(schemaName)) {
          if (abortGenRef.current !== gen) return
          if (chunk.done) {
            copilotClient = chunk.client
            copilotClientRef.current = { client: copilotClient, agentId: agent }
            break
          }
          greetingText = chunk.text
          greetingAttachments = chunk.attachments || []
          setMessages((m) => m.map((msg) => msg.id === greetingId ? { ...msg, content: greetingText, attachments: greetingAttachments } : msg))
        }
      } catch (err) {
        console.error("Copilot init error:", err)
      }
      if (abortGenRef.current !== gen) return
      if (!greetingText && !greetingAttachments.length) {
        setMessages((m) => m.filter((msg) => msg.id !== greetingId))
      }

      // Selamlama kartındaki ilk Action.Submit'i otomatik gönder.
      // Bot diyalogu "başlat" butonuna tıklanmış gibi ilerler — kullanıcı
      // ilk mesajını gönderdiğinde bot doğru state'te hazır bekler.
      if (copilotClient && greetingAttachments.length) {
        const firstCard = greetingAttachments.find((a) => a.contentType === "application/vnd.microsoft.card.adaptive")
        if (firstCard?.content) {
          const actions = extractSubmitActions(firstCard.content.body || [])
          console.log("[copilot] greeting actions found:", JSON.stringify(actions))
          const firstAction = actions.find((a) => a.style === "positive") || actions[0]
          // data yoksa {} gönder — buton data olmadan da geçerli bir submit olabilir
          if (firstAction) {
            try {
              for await (const _ of sendAction(copilotClient, firstAction.data ?? {})) {
                if (abortGenRef.current !== gen) return
              }
            } catch (err) {
              console.warn("Auto-submit greeting action failed:", err)
            }
          }
        }
      }
    }

    initConversation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent])

  async function handleSend() {
    const text = input.trim()
    if (!text) return

    const userMsg = { id: makeId(), role: "user", content: text, time: new Date() }
    setIsNearBottom(true)
    setMessages((m) => [...m, userMsg])
    setInput("")
    setOrbState("thinking")

    const gen = ++abortGenRef.current
    const activeAgent = getAgent(agent)
    const schemaName = activeAgent?.agentId

    if (!schemaName || schemaName === "agent-id") {
      // Agent henüz yapılandırılmamış — mock fallback
      await new Promise((r) => setTimeout(r, 1000))
      if (abortGenRef.current !== gen) return
      const replyText = activeAgent?.description?.trim() || `${activeAgent?.name ?? "Agent"} — ${t("chat.subtitle.lead")} ${t("chat.subtitle.highlight")}`
      setMessages((m) => [...m, { id: makeId(), role: "assistant", agent, content: replyText, time: new Date() }])
      setOrbState("speaking")
      setTimeout(() => setOrbState("idle"), 2400)
      return
    }

    // Bot hazır değilse bekle (startConversation hâlâ çalışıyor olabilir)
    if (!copilotClientRef.current || copilotClientRef.current.agentId !== agent) {
      setMessages((m) => [...m, { id: makeId(), role: "assistant", agent, content: t("chat.error") || "Agent bağlanıyor, lütfen bir saniye bekleyin.", attachments: [], time: new Date() }])
      setOrbState("idle")
      return
    }

    try {
      const client = copilotClientRef.current.client

      // Kullanıcının mesajını gönder ve streaming yanıtı al
      const replyId = makeId()
      setMessages((m) => [...m, { id: replyId, role: "assistant", agent, content: "", attachments: [], time: new Date() }])
      let fullText = ""
      let fullAttachments = []
      for await (const chunk of sendMessage(client, text)) {
        if (abortGenRef.current !== gen) return
        if (chunk.done) break
        fullText = chunk.text
        fullAttachments = chunk.attachments || []
        setMessages((m) => m.map((msg) => msg.id === replyId ? { ...msg, content: fullText, attachments: fullAttachments } : msg))
      }
      // Yanıt içerik yoksa bubble'ı kaldır
      if (!fullText && !fullAttachments.length) setMessages((m) => m.filter((msg) => msg.id !== replyId))
      setOrbState("speaking")
      if (fullText) speak(fullText, { lang: locale === "tr" ? "tr-TR" : "en-US", rate: 0.95 })
      setTimeout(() => setOrbState("idle"), 2400)
    } catch (err) {
      if (abortGenRef.current !== gen) return
      console.error("Copilot Studio error:", err)
      setMessages((m) => [...m, { id: makeId(), role: "assistant", agent, content: t("chat.error") || "Bağlantı hatası oluştu.", attachments: [], time: new Date() }])
      setOrbState("idle")
    }
  }

  async function handleCardAction(actionData) {
    const client = copilotClientRef.current?.client
    if (!client) return
    const gen = ++abortGenRef.current
    setOrbState("thinking")
    const replyId = makeId()
    setMessages((m) => [...m, { id: replyId, role: "assistant", agent, content: "", attachments: [], time: new Date() }])
    let fullText = ""
    let fullAttachments = []
    try {
      for await (const chunk of sendAction(client, actionData)) {
        if (abortGenRef.current !== gen) return
        if (chunk.done) break
        fullText = chunk.text
        fullAttachments = chunk.attachments || []
        setMessages((m) => m.map((msg) => msg.id === replyId ? { ...msg, content: fullText, attachments: fullAttachments } : msg))
      }
      if (!fullText && !fullAttachments.length) setMessages((m) => m.filter((msg) => msg.id !== replyId))
      setOrbState("speaking")
      if (fullText) speak(fullText, { lang: locale === "tr" ? "tr-TR" : "en-US", rate: 0.95 })
      setTimeout(() => setOrbState("idle"), 2400)
    } catch (err) {
      console.error("Card action error:", err)
      setOrbState("idle")
    }
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
          onClick={handleOrbClick}
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
          onAgentChange={(id) => setAgent(id)}
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
      {/* Row 1 — header. Mini orb on the left mirrors the modes the big
          orb plays (idle / listening / thinking / speaking) so the user
          gets a visual "agent state" cue. Below the agent name we show
          the agent's description by default, swapping in "Yazıyor…" when
          the orb is in thinking mode so the user gets a clear in-progress
          signal. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <PastelVoiceOrb
            state={orbState}
            level={effectiveLevel}
            size={40}
            onClick={handleOrbClick}
          />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{activeAgent?.name}</span>
            {orbState === "thinking" ? (
              <span className="truncate text-[11px] font-medium text-brand-deep">
                {t("chat.status.thinking")}
              </span>
            ) : activeAgent?.description ? (
              <span className="truncate text-[11px] text-muted-foreground">
                {activeAgent.description}
              </span>
            ) : null}
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
          <ChatMessage key={m.id} message={m} onCardAction={handleCardAction} />
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

      {/* Row 3 — composer. Symmetric py only: the safe-area-inset-bottom
          is ALREADY applied one level up by SidebarInset
          (pb-[env(safe-area-inset-bottom)] in DashboardLayout). Adding env()
          here too would double the home-indicator gutter (~68 px on iOS PWA)
          and leave a tall bg-background band above the indicator — the
          "white gap" regression. Solid bg keeps the indicator from bleeding
          through the gradient. */}
      <div className="shrink-0 bg-background py-2 sm:py-3">
        <ChatComposer
          value={input}
          onChange={handleInputChange}
          onSend={handleSend}
          agent={agent}
          onAgentChange={(id) => setAgent(id)}
          onMicToggle={handleMicToggle}
          micActive={orbState === "listening"}
          disabled={orbState === "thinking"}
        />
      </div>
    </div>
  )
}
