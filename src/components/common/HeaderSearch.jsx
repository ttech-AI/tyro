import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Moon02Icon,
  Sun03Icon,
  LanguageSquareIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useLocale } from "@/hooks/useLocale"
import { useTheme } from "@/hooks/useTheme"
import { apps, getApp } from "@/data/apps"
import { activities } from "@/data/activities"
import { formatRelative } from "@/lib/date"
import { safeExternalUrl } from "@/lib/utils"

export function HeaderSearch() {
  const { t, locale, toggle: toggleLocale } = useLocale()
  const { theme, toggle: toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const openApp = (url) => {
    const safe = safeExternalUrl(url)
    if (safe !== "#") window.open(safe, "_blank", "noopener,noreferrer")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("header.searchAria")}
          className="ml-auto hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-input/80 bg-background/60 text-sm text-muted-foreground hover:bg-accent hover:text-foreground hover:border-input transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56 lg:w-72"
        >
          <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0" />
          <span className="flex-1 text-left truncate">Ara…</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[380px] p-0 overflow-hidden"
      >
        <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-10 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          <CommandInput placeholder={t("header.search")} />
          <CommandList>
            <CommandEmpty>{t("cmd.empty")}</CommandEmpty>

            <CommandGroup heading={t("cmd.groupApps")}>
              {apps.map((app) => (
                <CommandItem
                  key={app.id}
                  value={`${app.name} ${app.description[locale] ?? app.description.tr}`}
                  onSelect={() => openApp(app.url)}
                >
                  <HugeiconsIcon icon={app.icon} />
                  <div className="flex-1 flex items-center justify-between gap-3">
                    <span className="font-medium">{app.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {app.description[locale] ?? app.description.tr}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={t("cmd.groupActivities")}>
              {activities.slice(0, 4).map((a) => {
                const app = getApp(a.appId)
                const targetText = a.target[locale] ?? a.target.tr
                return (
                  <CommandItem
                    key={a.id}
                    value={`${a.actor ?? ""} ${targetText} ${app?.name ?? ""}`}
                    onSelect={() => openApp(app?.url)}
                  >
                    {app && <HugeiconsIcon icon={app.icon} />}
                    <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                      <span className="truncate">
                        {a.actor && <span className="font-medium">{a.actor} </span>}
                        <span className="text-muted-foreground">{targetText}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatRelative(a.timestamp, locale)}
                      </span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={t("cmd.groupActions")}>
              <CommandItem onSelect={() => { toggleTheme(); setOpen(false) }}>
                <HugeiconsIcon icon={theme === "dark" ? Sun03Icon : Moon02Icon} />
                {t("cmd.actionToggleTheme")}
              </CommandItem>
              <CommandItem onSelect={() => { toggleLocale(); setOpen(false) }}>
                <HugeiconsIcon icon={LanguageSquareIcon} />
                {t("cmd.actionToggleLocale")}
              </CommandItem>
              <CommandItem onSelect={() => setOpen(false)}>
                <HugeiconsIcon icon={Settings02Icon} />
                {t("cmd.actionOpenSettings")}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
