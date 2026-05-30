import { memo } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/useLocale"
import { PastelOrb } from "@/components/brand/PastelOrb"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { useConfig } from "@/hooks/useConfig"
import { useMe } from "@/hooks/useMe"

function formatTime(date, locale) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

// Bubble width tokens — wider on phones (more reading room when the user
// only sees one bubble at a time), narrower on tablet/desktop where two
// columns of context fit. ch-based caps on md+ keep long replies readable
// (max ~ 65 characters per line, the typographic comfort range).
const BUBBLE_MAX_WIDTH = "max-w-[88%] sm:max-w-[78%] md:max-w-[65ch]"

function ChatMessageInner({ message }) {
  const { locale } = useLocale()
  const { getAgent } = useConfig()
  const me = useMe()
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
        <PastelOrb className="size-7 shrink-0">
          <span className="text-[10px] font-semibold text-brand-deep">{me.initials}</span>
        </PastelOrb>
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
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5",
            "text-sm leading-relaxed text-foreground",
          )}
        >
          {message.content}
        </div>
        <span className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">
          {formatTime(time, locale)}
        </span>
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
export const ChatMessage = memo(ChatMessageInner)
