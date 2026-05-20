import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/useLocale"
import { PastelOrb } from "@/components/brand/PastelOrb"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { useConfig } from "@/hooks/useConfig"
import { currentUser } from "@/data/user"

function formatTime(date, locale) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function ChatMessage({ message }) {
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
        <div className="flex max-w-[80%] flex-col items-end">
          <div className="rounded-2xl rounded-tr-md border border-brand-via/30 bg-brand-soft/40 px-4 py-2.5 text-sm leading-relaxed text-foreground">
            {message.content}
          </div>
          <span className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">
            {formatTime(time, locale)}
          </span>
        </div>
        <PastelOrb className="size-7 shrink-0">
          <span className="text-[10px] font-semibold text-brand-deep">{currentUser.initials}</span>
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
      <div className="flex max-w-[80%] flex-col items-start">
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
