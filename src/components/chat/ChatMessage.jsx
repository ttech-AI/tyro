import { memo, useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { normalizeBotMarkdown } from "@/lib/markdown"
import { getDateTimeFormat } from "@/lib/intl-cache"
import { useLocale } from "@/hooks/useLocale"
import { PastelOrb } from "@/components/brand/PastelOrb"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { useConfig } from "@/hooks/useConfig"
import { AdaptiveCardView } from "./AdaptiveCardView"

const TIME_FORMAT_OPTIONS = { hour: "2-digit", minute: "2-digit" }

// "Yazıyor" göstergesi — premium: brand-gradient shimmer ile parlayan, yumuşak
// crossfade ile ilerleyen durum kelimesi + ince nokta dalgası. Kelimeler doğal
// bir ilerleme verir (Düşünüyor → Yanıt hazırlanıyor → Neredeyse hazır) ve son
// adımda bekler (yanıt gecikse de "başa sarmaz").
function TypingIndicator() {
  const { t } = useLocale()
  const phrases = [t("chat.typing.0"), t("chat.typing.1"), t("chat.typing.2")]
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (step >= phrases.length - 1) return
    const id = setTimeout(() => setStep((s) => s + 1), 1600)
    return () => clearTimeout(id)
  }, [step, phrases.length])

  return (
    <span aria-live="polite" aria-label={phrases[step]} className="inline-flex items-center gap-2 py-0.5">
      <span className="grid">
        <AnimatePresence initial={false}>
          <motion.span
            key={step}
            initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="chat-shimmer-text text-sm font-medium tracking-tight [grid-area:1/1] whitespace-nowrap"
          >
            {phrases[step]}
          </motion.span>
        </AnimatePresence>
      </span>
      <span aria-hidden className="inline-flex items-center gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="chat-typing-dot size-1 rounded-full bg-brand-via/70"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </span>
    </span>
  )
}

function formatTime(date, locale) {
  return getDateTimeFormat(locale, TIME_FORMAT_OPTIONS).format(date)
}

// Bubble width tokens — wider on phones (more reading room when the user
// only sees one bubble at a time), narrower on tablet/desktop where two
// columns of context fit. ch-based caps on md+ keep long replies readable
// (max ~ 65 characters per line, the typographic comfort range).
const BUBBLE_MAX_WIDTH = "max-w-[88%] sm:max-w-[78%] md:max-w-[65ch]"

// Copy-to-clipboard button rendered next to the timestamp on assistant
// messages. Always visible on touch (no hover-reveal trap). Shows a brief
// "copied" tick on success.
function CopyButton({ content }) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content ?? "")
      setCopied(true)
      toast.success(t("chat.message.copied"))
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error(t("chat.message.copyFailed"))
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t("chat.message.copy")}
      title={t("chat.message.copy")}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60",
        "transition hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
      )}
    >
      <HugeiconsIcon
        icon={copied ? Tick01Icon : Copy01Icon}
        className={cn("size-3.5", copied && "text-brand-via")}
        strokeWidth={1.8}
      />
    </button>
  )
}

function ChatMessageInner({ message, onCardAction, onSuggestedAction }) {
  const { locale } = useLocale()
  const { getAgent } = useConfig()
  const isUser = message.role === "user"
  const time = message.time instanceof Date ? message.time : new Date(message.time)

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start justify-end gap-2"
      >
        <div className={cn("flex flex-col items-end", BUBBLE_MAX_WIDTH)}>
          <div className="rounded-2xl rounded-tr-md border border-brand-via/30 bg-brand-soft/40 px-4 py-2.5 text-sm leading-relaxed text-foreground">
            {message.content}
          </div>
          <span className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">
            {formatTime(time, locale)}
          </span>
        </div>
        {/* User avatar — pastel gradient orb only, no initials inside.
            The orb itself is the identity cue; initials added noise. */}
        <PastelOrb className="size-7 shrink-0" />
      </motion.div>
    )
  }

  const agent = getAgent(message.agent)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start gap-2"
    >
      <div className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white">
        <IconOrLogo iconName={agent?.iconName} logo={agent?.logo} className="size-3.5" />
      </div>
      <div className={cn("flex flex-col items-start", BUBBLE_MAX_WIDTH)}>
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-foreground/80">{agent?.name}</span>
        </div>
        <div className="flex flex-col gap-2">
          {message.content && (
            <div
              className={cn(
                "rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5",
                "text-sm leading-relaxed text-foreground",
                "prose prose-sm max-w-none dark:prose-invert",
                "prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
                "prose-strong:font-semibold prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5",
                "prose-hr:my-3 prose-blockquote:my-2",
                "prose-a:text-brand-via prose-a:no-underline hover:prose-a:underline",
                // GFM tabloları: yatay kaydırma + ince kenarlık + başlık vurgusu.
                "prose-table:my-2 prose-table:block prose-table:w-full prose-table:overflow-x-auto",
                "prose-th:border prose-th:border-border prose-th:bg-muted/60 prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold",
                "prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1 prose-td:align-top",
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeBotMarkdown(message.content)}</ReactMarkdown>
            </div>
          )}
          {message.attachments?.map((att, i) =>
            att.contentType === "application/vnd.microsoft.card.adaptive" ? (
              <div key={i} className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3">
                <AdaptiveCardView card={att.content} onAction={onCardAction} />
              </div>
            ) : null,
          )}
          {!message.content && !message.attachments?.length && !message.suggestedActions?.length && (
            <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5">
              <TypingIndicator />
            </div>
          )}
          {message.suggestedActions?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {message.suggestedActions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSuggestedAction?.(action)}
                  className={cn(
                    "rounded-full border border-brand-via/40 bg-brand-soft/30 px-3.5 py-1.5",
                    "text-xs font-medium text-foreground transition hover:bg-brand-soft/60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                  )}
                >
                  {action.title || action.value}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Timestamp + copy action row. Copy button always visible on touch
            (no hover-reveal) — matches ChatGPT/Claude mobile pattern. */}
        <div className="mt-0.5 flex items-center gap-1 text-muted-foreground/70">
          <span className="text-[10px] tabular-nums">{formatTime(time, locale)}</span>
          <CopyButton content={message.content} />
        </div>
      </div>
    </motion.div>
  )
}

// React.memo with shallow prop compare — message objects are immutable
// (new objects on every append), so default referential equality is
// enough to skip re-renders for older bubbles when a new message arrives.
// Big win on long conversations: previously every assistant token-stream
// update re-rendered the entire list (N motion.divs); now only the last
// bubble re-renders.
export const ChatMessage = memo(ChatMessageInner, (prev, next) =>
  prev.message === next.message &&
  prev.onCardAction === next.onCardAction &&
  prev.onSuggestedAction === next.onSuggestedAction,
)
