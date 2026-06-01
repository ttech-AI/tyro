import { memo, useState } from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"
import { getDateTimeFormat } from "@/lib/intl-cache"
import { useLocale } from "@/hooks/useLocale"
import { PastelOrb } from "@/components/brand/PastelOrb"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { useConfig } from "@/hooks/useConfig"

const TIME_FORMAT_OPTIONS = { hour: "2-digit", minute: "2-digit" }

// Render a single Adaptive Card element, collecting inputs into formValues via onChange
function CardElement({ item, formValues, onChange }) {
  if (!item) return null

  switch (item.type) {
    case "TextBlock": {
      if (!item.text) return null
      const cls = cn(
        "my-0.5 text-sm leading-relaxed text-foreground",
        item.weight === "bolder" && "font-semibold",
        item.size === "medium" && "text-base",
        item.size === "large" && "text-lg",
        item.isSubtle && "text-muted-foreground",
      )
      return (
        <div className={cls}>
          <ReactMarkdown components={{ p: ({ children }) => <span>{children}</span> }}>
            {item.text}
          </ReactMarkdown>
        </div>
      )
    }
    case "RichTextBlock": {
      const text = (item.inlines || []).map((i) => i.text || "").join("")
      if (!text) return null
      return <div className="my-0.5 text-sm leading-relaxed text-foreground">{text}</div>
    }
    case "Input.Text":
      return (
        <input
          key={item.id}
          id={item.id}
          placeholder={item.placeholder || item.label || ""}
          defaultValue={item.value || ""}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
          onChange={(e) => onChange(item.id, e.target.value)}
        />
      )
    case "Input.Number":
      return (
        <input
          type="number"
          key={item.id}
          id={item.id}
          placeholder={item.placeholder || item.label || ""}
          defaultValue={item.value || ""}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
          onChange={(e) => onChange(item.id, e.target.value)}
        />
      )
    case "Input.Date":
      return (
        <input
          type="date"
          key={item.id}
          id={item.id}
          defaultValue={item.value || ""}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
          onChange={(e) => onChange(item.id, e.target.value)}
        />
      )
    case "Input.Toggle":
      return (
        <label key={item.id} className="mt-1 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            defaultChecked={item.value === item.valueOn}
            className="h-4 w-4 rounded accent-brand-via"
            onChange={(e) => onChange(item.id, e.target.checked ? (item.valueOn || "true") : (item.valueOff || "false"))}
          />
          {item.title}
        </label>
      )
    case "Input.ChoiceSet": {
      if (item.isMultiSelect) {
        return (
          <div key={item.id} className="mt-1 flex flex-col gap-1">
            {(item.choices || []).map((choice) => (
              <label key={choice.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={choice.value}
                  defaultChecked={String(item.value) === String(choice.value)}
                  className="h-4 w-4 rounded accent-brand-via"
                  onChange={(e) => {
                    const current = (formValues[item.id] || "").split(",").filter(Boolean)
                    const next = e.target.checked
                      ? [...current, choice.value]
                      : current.filter((v) => v !== choice.value)
                    onChange(item.id, next.join(","))
                  }}
                />
                {choice.title}
              </label>
            ))}
          </div>
        )
      }
      if (item.style === "expanded") {
        return (
          <div key={item.id} className="mt-1 flex flex-col gap-1">
            {(item.choices || []).map((choice) => (
              <label key={choice.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={item.id}
                  value={choice.value}
                  defaultChecked={String(item.value) === String(choice.value)}
                  className="h-4 w-4 accent-brand-via"
                  onChange={() => onChange(item.id, choice.value)}
                />
                {choice.title}
              </label>
            ))}
          </div>
        )
      }
      return (
        <select
          key={item.id}
          id={item.id}
          defaultValue={item.value || ""}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
          onChange={(e) => onChange(item.id, e.target.value)}
        >
          <option value="">{item.placeholder || "Seçiniz..."}</option>
          {(item.choices || []).map((choice) => (
            <option key={choice.value} value={choice.value}>{choice.title}</option>
          ))}
        </select>
      )
    }
    case "ActionSet":
      return null // rendered separately at the bottom
    case "ColumnSet":
      return (
        <div className="flex flex-wrap gap-3">
          {(item.columns || []).map((col, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col gap-1">
              {(col.items || []).map((child, j) => (
                <CardElement key={j} item={child} formValues={formValues} onChange={onChange} />
              ))}
            </div>
          ))}
        </div>
      )
    case "Container":
      return (
        <div className="flex flex-col gap-1">
          {(item.items || []).map((child, i) => (
            <CardElement key={i} item={child} formValues={formValues} onChange={onChange} />
          ))}
        </div>
      )
    default:
      return null
  }
}

function collectActions(items) {
  if (!Array.isArray(items)) return []
  const acc = []
  for (const item of items) {
    if (item.type === "ActionSet" && item.actions) acc.push(...item.actions)
    if (item.body) acc.push(...collectActions(item.body))
    if (item.columns) for (const col of item.columns) acc.push(...collectActions(col.items || []))
    if (item.items) acc.push(...collectActions(item.items))
  }
  return acc
}

function AdaptiveCard({ card, onCardAction }) {
  const [formValues, setFormValues] = useState({})
  const [submitted, setSubmitted] = useState(false)

  function handleChange(id, value) {
    setFormValues((v) => ({ ...v, [id]: value }))
  }

  function handleSubmit(action) {
    setSubmitted(true)
    const base = action.type === "Action.Execute"
      ? { verb: action.verb, ...action.data }
      : { ...action.data }
    onCardAction?.({ ...base, ...formValues })
  }

  const body = card.body || []
  // Butonlar body içindeki ActionSet'te veya card.actions'da (üst seviye) olabilir
  const allActions = [
    ...collectActions(body),
    ...(card.actions || []),
  ].filter((a) => a.type === "Action.Submit" || a.type === "Action.Execute" || a.type === "Action.OpenUrl")

  return (
    <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm">
      <div className="flex flex-col gap-1.5">
        {body.map((item, i) => (
          <CardElement key={i} item={item} formValues={formValues} onChange={handleChange} />
        ))}
      </div>
      {allActions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {allActions.map((action, i) => {
            if (action.type === "Action.OpenUrl") {
              return (
                <a
                  key={i}
                  href={action.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  {action.title}
                </a>
              )
            }
            // Action.Submit ve Action.Execute ikisi de form submit olarak davranır
            return (
              <button
                key={i}
                type="button"
                disabled={submitted}
                onClick={() => handleSubmit(action)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50",
                  action.style === "positive"
                    ? "bg-brand-via text-white hover:opacity-90"
                    : action.style === "destructive"
                      ? "bg-destructive text-destructive-foreground hover:opacity-90"
                      : "border border-border bg-muted text-foreground hover:bg-accent",
                )}
              >
                {action.title}
              </button>
            )
          })}
        </div>
      )}
    </div>
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

function ChatMessageInner({ message, onCardAction }) {
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
              )}
            >
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
          {message.attachments?.map((att, i) =>
            att.contentType === "application/vnd.microsoft.card.adaptive" ? (
              <AdaptiveCard key={i} card={att.content} onCardAction={onCardAction} />
            ) : null,
          )}
          {!message.content && !message.attachments?.length && (
            <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">…</div>
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
  prev.message === next.message && prev.onCardAction === next.onCardAction,
)
