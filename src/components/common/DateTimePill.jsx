import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar05Icon } from "@hugeicons/core-free-icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/hooks/useLocale"

function format(now, locale) {
  const intl = locale === "tr" ? "tr-TR" : "en-US"
  return {
    // Compact display (visible in the header)
    weekdayShort: new Intl.DateTimeFormat(intl, { weekday: "short" }).format(now),
    dateShort: new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" }).format(now),
    // Verbose tooltip — full weekday + day + month + year + clock
    weekdayLong: new Intl.DateTimeFormat(intl, { weekday: "long" }).format(now),
    fullDate: new Intl.DateTimeFormat(intl, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now),
    time: new Intl.DateTimeFormat(intl, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now),
  }
}

export function DateTimePill({ className = "" }) {
  const { locale } = useLocale()
  const [now, setNow] = useState(() => new Date())

  // Refresh every minute so the tooltip's clock reading stays current
  // when the user hovers (was: hourly, which left the clock stale).
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const { weekdayShort, dateShort, weekdayLong, fullDate, time } = format(now, locale)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${weekdayLong}, ${fullDate} · ${time}`}
          className={
            "hidden md:flex h-9 items-center gap-2 px-2 rounded-md transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 " +
            className
          }
        >
          <span className="grid size-6 place-items-center rounded-lg bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white">
            <HugeiconsIcon icon={Calendar05Icon} className="size-3.5" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
              {weekdayShort}
            </span>
            <span className="text-[10px] text-muted-foreground">{dateShort}</span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="flex-col items-center gap-0 px-3 py-2 text-center">
        {/* Tooltip primitive paints bg-foreground + text-background, so use
            text-background (NOT text-foreground) — otherwise the text is
            invisible against the matching bg. */}
        <div className="text-[11px] font-semibold uppercase tracking-wider text-background">
          {weekdayLong}
        </div>
        <div className="mt-0.5 text-xs text-background/90">{fullDate}</div>
        <div className="mt-0.5 text-[11px] tabular-nums text-background/65">{time}</div>
      </TooltipContent>
    </Tooltip>
  )
}
