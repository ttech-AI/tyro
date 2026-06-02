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
import { startConversation, sendMessage, sendAction, resolveSuggestedAction } from "@/lib/copilot"
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
  // Composer'ı yalnızca bot GERÇEKTEN yanıt üretirken kilitler. orbState
  // "thinking" kullanıcı yazarken de tetiklendiği için (kozmetik orb), Enter'ı
  // ona bağlamak yazma sonrası gereksiz bekleme yaratıyordu — bunun yerine busy.
  const [busy, setBusy] = useState(false)
  // Header "yeni sohbet" butonu bunu artırır → init effect yeniden çalışır
  // (Copilot konuşmasını SIFIRDAN başlatır + greeting'i tekrar getirir).
  // Sidebar "Yeni sohbet" tüm komponenti remount ettiği için ayrı; bu, aynı
  // mount içindeki sıfırlama için.
  const [resetNonce, setResetNonce] = useState(0)
  // Aktif agent + schema adı render'da hesaplanır. schemaName init effect'in
  // bağımlılığıdır: agents (ConfigProvider) ASENKRON yüklenir; agent zaten HR
  // olsa bile ilk render'da getAgent() undefined dönebilir → init erken çıkar.
  // schemaName deps'te olduğu için agents yüklenince init kendiliğinden çalışır.
  const activeAgent = getAgent(agent)
  const schemaName = activeAgent?.agentId
  const [input, setInput] = useState("")
  const [speakingLevel, setSpeakingLevel] = useState(0)
  const { isSpeaking: ttsSpeaking, speak, cancel: cancelTts } = useSpeechSynthesis()
  // Debounce timer for typing → thinking → idle transitions.
  const typingTimerRef = useRef(null)
  const copilotClientRef = useRef(null)
  const abortGenRef = useRef(0)
  // Konuşma hazır-kapısı: init akışı (startConversation + greeting auto-submit)
  // TAMAMEN bitene kadar resolve OLMAZ. handleSend bunu bekleyerek aynı sunucu
  // konuşmasına ikinci bir turun çakışmasını (→ "Sohbet durduruldu") önler.
  const conversationReadyRef = useRef(Promise.resolve())
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

  // isNearBottom'u ref'te de tut: ResizeObserver geri-çağrısı bunu yeniden
  // abone olmadan okuyabilsin.
  const isNearBottomRef = useRef(true)
  useEffect(() => {
    isNearBottomRef.current = isNearBottom
  }, [isNearBottom])

  // İçerik yüksekliği değiştikçe (Adaptive Card'lar DOM'a ASENKRON eklenir,
  // "yazıyor" → metin geçişi yüksekliği büyütür) dibe sabit kal. Tek seferlik
  // messages-effect scroll'u kart render'ından önce çalıştığı için yetmiyordu.
  const contentRef = useRef(null)
  useEffect(() => {
    const content = contentRef.current
    const scroller = scrollRef.current
    if (!content || !scroller || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => {
      if (isNearBottomRef.current) scroller.scrollTop = scroller.scrollHeight
    })
    ro.observe(content)
    return () => ro.disconnect()
  }, [])

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
    if (!schemaName || schemaName === "agent-id") return

    copilotClientRef.current = null
    const gen = ++abortGenRef.current
    // Yeni bir hazır-kapısı kur; init tamamen bitince (finally) resolve edilir.
    let resolveReady
    conversationReadyRef.current = new Promise((r) => { resolveReady = r })

    async function initConversation() {
      const greetingId = makeId()
      // Init (greeting + auto-submit) boyunca composer'ı KİLİTLE. Aksi halde
      // kullanıcı network beklerken yazıp gönderebiliyor ve init'in yanıtı onun
      // mesajından sonra listeye eklenip "sanki bu cevap geldi" karmaşası yaratıyor.
      setBusy(true)
      setOrbState("thinking")
      // Konuşmayı SIFIRDAN başlat: Copilot sunucu konuşması reload/agent
      // değişiminde devam ettirilemez, bu yüzden eski (ölü) mesajları temizle
      // ve tek bir selamlama baloncuğu göster — yığılmayı önler.
      setMessages([{ id: greetingId, role: "assistant", agent, content: "", attachments: [], time: new Date() }])
      let greetingText = ""
      let greetingAttachments = []
      let greetingSuggested = []
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
          greetingSuggested = chunk.suggestedActions || []
          setMessages((m) => m.map((msg) => msg.id === greetingId ? { ...msg, content: greetingText, attachments: greetingAttachments, suggestedActions: greetingSuggested } : msg))
        }
        if (abortGenRef.current !== gen) return
        if (!greetingText && !greetingAttachments.length && !greetingSuggested.length) {
          setMessages((m) => m.filter((msg) => msg.id !== greetingId))
        }

        // Selamlama kartındaki ilk Action.Submit'i otomatik gönder ve YANITI
        // GÖRÜNÜR yap (menüyü göster). Bu tur init'in içinde, kullanıcı turundan
        // ÖNCE bitmeli — handleSend hazır-kapısını beklediği için çakışmaz.
        if (copilotClient && greetingAttachments.length) {
          const firstCard = greetingAttachments.find((a) => a.contentType === "application/vnd.microsoft.card.adaptive")
          if (firstCard?.content) {
            const actions = extractSubmitActions(firstCard.content.body || [])
            const firstAction = actions.find((a) => a.style === "positive") || actions[0]
            if (firstAction) {
              await streamReply(sendAction(copilotClient, firstAction.data ?? {}), gen)
            }
          }
        }
      } catch (err) {
        console.error("Copilot init error:", err)
      } finally {
        // Init ne olursa olsun (başarı / abort / hata) kapıyı aç ki handleSend
        // sonsuza kadar beklemesin. Yalnızca hâlâ güncel tur isek composer'ı aç.
        resolveReady()
        if (abortGenRef.current === gen) {
          setBusy(false)
          setOrbState((s) => (s === "thinking" ? "idle" : s))
        }
      }
    }

    initConversation()
  // schemaName: agents async yüklenince init'in tetiklenmesi için şart.
  // resetNonce: header "yeni sohbet" ile aynı mount'ta yeniden başlatma.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, schemaName, resetNonce])

  // Bir Copilot generator'ını tüketir, tek bir assistant baloncuğunu
  // streaming boyunca günceller (text + kartlar + suggestedActions).
  // İçerik gelmezse baloncuğu kaldırır. Abort olursa { aborted:true } döner.
  async function streamReply(generator, gen) {
    const replyId = makeId()
    setMessages((m) => [...m, { id: replyId, role: "assistant", agent, content: "", attachments: [], suggestedActions: [], time: new Date() }])
    let fullText = ""
    let fullAttachments = []
    let fullSuggested = []
    for await (const chunk of generator) {
      if (abortGenRef.current !== gen) return { aborted: true }
      if (chunk.done) break
      fullText = chunk.text
      fullAttachments = chunk.attachments || []
      fullSuggested = chunk.suggestedActions || []
      setMessages((m) => m.map((msg) => msg.id === replyId ? { ...msg, content: fullText, attachments: fullAttachments, suggestedActions: fullSuggested } : msg))
    }
    if (!fullText && !fullAttachments.length && !fullSuggested.length) {
      setMessages((m) => m.filter((msg) => msg.id !== replyId))
    }
    return { fullText, fullAttachments, fullSuggested }
  }

  // suggestedActions chip'ine tıklanınca: imBack/messageBack → mesaj gönder,
  // postBack → action gönder, openUrl → yeni sekme.
  async function handleSuggestedAction(action) {
    const { kind, payload } = resolveSuggestedAction(action)
    if (kind === "url") {
      if (payload) window.open(payload, "_blank", "noopener,noreferrer")
      return
    }
    await conversationReadyRef.current
    const client = copilotClientRef.current?.client
    if (!client) return
    // Kullanıcının seçimini kendi baloncuğu olarak göster
    setIsNearBottom(true)
    setMessages((m) => [...m, { id: makeId(), role: "user", content: action.title, time: new Date() }])
    setOrbState("thinking")
    setBusy(true)
    const gen = ++abortGenRef.current
    try {
      const generator = kind === "action"
        ? sendAction(client, typeof payload === "object" ? payload : { value: payload })
        : sendMessage(client, String(payload))
      const res = await streamReply(generator, gen)
      if (res.aborted) return
      setOrbState("speaking")
      setTimeout(() => setOrbState("idle"), 2400)
    } catch (err) {
      console.error("Suggested action error:", err)
      setOrbState("idle")
    } finally {
      if (abortGenRef.current === gen) setBusy(false)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text) return

    const userMsg = { id: makeId(), role: "user", content: text, time: new Date() }
    setIsNearBottom(true)
    setMessages((m) => [...m, userMsg])
    setInput("")
    setOrbState("thinking")
    setBusy(true)

    // KRİTİK: init akışı (greeting + auto-submit) tamamen bitene kadar bekle.
    // gen'i bundan ÖNCE artırmıyoruz; yoksa init'in turunu yarıda kesip aynı
    // konuşmaya çakışan ikinci tur göndererek "Sohbet durduruldu" hatasını
    // tetikleriz.
    await conversationReadyRef.current

    const gen = ++abortGenRef.current
    try {
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

      const client = copilotClientRef.current.client
      const res = await streamReply(sendMessage(client, text), gen)
      if (res.aborted) return
      setOrbState("speaking")
      setTimeout(() => setOrbState("idle"), 2400)
    } catch (err) {
      if (abortGenRef.current !== gen) return
      console.error("Copilot Studio error:", err)
      setMessages((m) => [...m, { id: makeId(), role: "assistant", agent, content: t("chat.error") || "Bağlantı hatası oluştu.", attachments: [], time: new Date() }])
      setOrbState("idle")
    } finally {
      if (abortGenRef.current === gen) setBusy(false)
    }
  }

  async function handleCardAction(actionData) {
    await conversationReadyRef.current
    const client = copilotClientRef.current?.client
    if (!client) return
    const gen = ++abortGenRef.current
    setOrbState("thinking")
    setBusy(true)
    try {
      const res = await streamReply(sendAction(client, actionData), gen)
      if (res.aborted) return
      setOrbState("speaking")
      setTimeout(() => setOrbState("idle"), 2400)
    } catch (err) {
      console.error("Card action error:", err)
      setOrbState("idle")
    } finally {
      if (abortGenRef.current === gen) setBusy(false)
    }
  }

  function handleResetLocal() {
    clearMessages(agent)
    setOrbState("idle")
    setInput("")
    setUnread(0)
    setIsNearBottom(true)
    // Copilot konuşmasını sıfırdan başlat: init effect'i resetNonce ile yeniden
    // tetikle (eski client/mesajları temizleyip yeni greeting'i getirir).
    setResetNonce((n) => n + 1)
    onReset?.()
  }

  // "Boş" = gösterilecek GERÇEK içerik yok. init effect'i ağ beklemesi
  // başlarken içeriği boş bir placeholder assistant balonu ekliyor; bunu
  // "dolu" saymak orb karşılama ekranını anında tam chat layout'una atlatıp
  // boş bir "yazıyor" balonu flash'liyordu. İçeriksiz balonları yok sayarak
  // greeting (metin/kart/suggested) GERÇEKTEN gelene kadar orb ekranında
  // kalıyoruz — orb'un "thinking" animasyonu zaten yükleniyor göstergesi.
  const hasRenderableContent = (m) =>
    Boolean(m.content) || m.attachments?.length > 0 || m.suggestedActions?.length > 0
  const isEmpty = !messages.some(hasRenderableContent)

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
          disabled={busy}
          className="mt-8 w-full max-w-3xl sm:mt-12"
        />
        <div className="mt-4 sm:mt-5">
          <QuickChips onChip={handleChip} />
        </div>
      </div>
    )
  }

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
        className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 py-3"
      >
        <div ref={contentRef} className="space-y-4">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} onCardAction={handleCardAction} onSuggestedAction={handleSuggestedAction} />
          ))}
        </div>
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
          disabled={busy}
        />
      </div>
    </div>
  )
}
