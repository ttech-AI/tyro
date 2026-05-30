import { HugeiconsIcon } from "@hugeicons/react"
import {
  Moon01Icon,
  Sun01Icon,
  LanguageCircleIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import {
  CommandDialog,
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

export function CommandPalette({ open, onOpenChange }) {
  const { t, locale, toggle: toggleLocale } = useLocale()
  const { theme, toggle: toggleTheme } = useTheme()

  const close = () => onOpenChange?.(false)

  const openApp = (url) => {
    const safe = safeExternalUrl(url)
    if (safe !== "#") {
      window.open(safe, "_blank", "noopener,noreferrer")
    }
    close()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t("cmd.placeholder")}>
      <CommandInput placeholder={t("cmd.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("cmd.empty")}</CommandEmpty>

        <CommandGroup heading={t("cmd.groupApps")}>
          {apps.map((app) => (
            <CommandItem
              key={app.id}
              value={`${app.name} ${app.description[locale] ?? app.description.tr}`}
              onSelect={() => openApp(app.url)}
            >
              <HugeiconsIcon icon={app.icon} size={16} strokeWidth={1.5} />
              <div className="flex-1 flex items-center justify-between">
                <span className="font-medium">{app.name}</span>
                <span className="text-xs text-muted-foreground truncate ml-3">
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
                {app && <HugeiconsIcon icon={app.icon} size={16} strokeWidth={1.5} />}
                <div className="flex-1 flex items-center justify-between gap-3">
                  <span className="truncate">
                    {a.actor && <span className="font-medium">{a.actor} </span>}
                    <span className="text-muted-foreground">{targetText}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {app?.name} · {formatRelative(a.timestamp, locale)}
                  </span>
                </div>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("cmd.groupActions")}>
          <CommandItem
            onSelect={() => {
              toggleTheme()
              close()
            }}
          >
            <HugeiconsIcon icon={theme === "dark" ? Sun01Icon : Moon01Icon} size={16} strokeWidth={1.5} />
            {t("cmd.actionToggleTheme")}
          </CommandItem>
          <CommandItem
            onSelect={() => {
              toggleLocale()
              close()
            }}
          >
            <HugeiconsIcon icon={LanguageCircleIcon} size={16} strokeWidth={1.5} />
            {t("cmd.actionToggleLocale")}
          </CommandItem>
          <CommandItem onSelect={close}>
            <HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={1.5} />
            {t("cmd.actionOpenSettings")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
