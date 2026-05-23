import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Refresh01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { PastelVoiceOrb } from "@/components/brand/PastelVoiceOrb"
import { ChatComposer } from "./ChatComposer"
import { ChatMessage } from "./ChatMessage"
import { QuickChips } from "./QuickChips"
import { useLocale } from "@/hooks/useLocale"
import { useConfig } from "@/hooks/useConfig"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMe } from "@/hooks/useMe"

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

export function ChatScreen({ onReset, initialAgent }) {
  const { t } = useLocale()
  const { agents, getAgent } = useConfig()
  const isMobile = useIsMobile()
  const defaultAgentId = agents[0]?.id ?? null
  const [messages, setMessages] = useState([])
  const [agent, setAgent] = useState(initialAgent || defaultAgentId)
  const [orbState, setOrbState] = useState("idle")
  const [input, setInput] = useState("")
  const [speakingLevel, setSpeakingLevel] = useState(0)
  const scrollRef = useRef(null)
  const greetHour = new Date().getHours()
  const me = useMe()
  const firstName = me.name || ""

  useEffect(() => {
    if (orbState !== "speaking") return
    const id = setInterval(() => {
      setSpeakingLevel(0.22 + Math.random() * 0.78)
    }, 95)
    return () => clearInterval(id)
  }, [orbState])

  const effectiveLevel = orbState === "speaking" ? speakingLevel : 0

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
    setOrbState("idle")
    setInput("")
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
  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 sm:gap-3 sm:px-4 sm:pb-4 sm:pt-3">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
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
          className="h-9 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:h-8"
          aria-label={t("chat.reset")}
        >
          <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
          <span className="hidden sm:inline">{t("chat.reset")}</span>
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 py-3">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-3 bg-gradient-to-t from-background via-background to-transparent px-3 pt-2 sm:relative sm:mx-0 sm:bg-none sm:px-0 sm:pt-0">
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
