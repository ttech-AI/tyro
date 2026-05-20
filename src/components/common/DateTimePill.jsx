import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar05Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/hooks/useLocale"

function format(now, locale) {
  const intl = locale === "tr" ? "tr-TR" : "en-US"
  return {
    day: new Intl.DateTimeFormat(intl, { weekday: "short" }).format(now),
    date: new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" }).format(now),
  }
}

export function DateTimePill({ className = "" }) {
  const { locale } = useLocale()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const { day, date } = format(now, locale)

  return (
    <div className={"hidden md:flex h-9 items-center gap-2 px-2 " + className}>
      <span className="grid size-6 place-items-center rounded-lg bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white">
        <HugeiconsIcon icon={Calendar05Icon} className="size-3.5" />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
          {day}
        </span>
        <span className="text-[10px] text-muted-foreground">{date}</span>
      </div>
    </div>
  )
}
