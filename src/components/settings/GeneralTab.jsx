import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Refresh01Icon,
  Sun01Icon,
  ColorsIcon,
  GlobalIcon,
  Database02Icon,
  HardDriveIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { TyroLogo } from "@/components/brand/TyroLogo"
import { useLocale } from "@/hooks/useLocale"
import { useTheme } from "@/hooks/useTheme"
import { usePalette } from "@/hooks/usePalette"
import { useConfig } from "@/hooks/useConfig"
import { appMeta, localStorageRegistry } from "@/data/appMeta"
import { cn } from "@/lib/utils"

const ENTRY_ICON = {
  "tyro-theme": Sun01Icon,
  "tyro-palette": ColorsIcon,
  "tyro-locale": GlobalIcon,
  "tyro-config-v1": Database02Icon,
}

function byteSize(str) {
  if (!str) return 0
  if (typeof Blob !== "undefined") return new Blob([str]).size
  return new TextEncoder().encode(str).length
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function GeneralTab() {
  const { t } = useLocale()
  const { theme } = useTheme()
  const { palette } = usePalette()
  const { locale } = useLocale()
  const config = useConfig()
  const [bump, setBump] = useState(0)

  const summaries = useMemo(
    () => ({
      "tyro-theme": theme,
      "tyro-palette": palette,
      "tyro-locale": locale,
      "tyro-config-v1": `${config.agents.length} agent · ${config.aiApps.length} AI · ${config.businessApps.length} iş`,
    }),
    [theme, palette, locale, config.agents.length, config.aiApps.length, config.businessApps.length],
  )

  const entries = useMemo(() => {
    void bump
    return localStorageRegistry.map((entry) => {
      const raw = window.localStorage.getItem(entry.key)
      return {
        ...entry,
        raw,
        size: byteSize(raw),
        present: raw !== null,
        summary: summaries[entry.key] ?? "—",
      }
    })
  }, [summaries, bump])

  const totalSize = entries.reduce((sum, e) => sum + e.size, 0)
  const presentCount = entries.filter((e) => e.present).length

  function handleRefresh() {
    setBump((b) => b + 1)
    toast.success(t("settings.general.toast.refreshed"))
  }

  function handleClearKey(key) {
    window.localStorage.removeItem(key)
    setBump((b) => b + 1)
    toast.success(t("settings.general.toast.cleared").replace("{key}", key))
  }

  function handleClearAll() {
    for (const entry of localStorageRegistry) {
      window.localStorage.removeItem(entry.key)
    }
    setBump((b) => b + 1)
    toast.success(t("settings.general.toast.clearedAll"))
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <div className="space-y-10">
      {/* App identity */}
      <section className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="grid size-24 shrink-0 place-items-center">
          <TyroLogo size={64} className="size-16" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">{appMeta.name}</h2>
            <span className="font-mono text-xs text-muted-foreground">v{appMeta.version}</span>
          </div>
          <p className="text-sm text-muted-foreground">{appMeta.brand}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground/70">
            {appMeta.stack.map((tech, i) => (
              <span key={tech} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground/30">·</span>}
                <span>{tech}</span>
              </span>
            ))}
          </p>
          <p className="pt-1 text-[11px] text-muted-foreground/60">
            © {appMeta.releaseDate} {appMeta.parent}
          </p>
        </div>
      </section>

      {/* Storage section */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              {t("settings.general.storage.sectionTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.general.storage.sectionSubtitle")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleRefresh}
            >
              <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
              {t("settings.general.storage.refresh")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={handleClearAll}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              {t("settings.general.storage.clearAll")}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card">
          {entries.map((entry, i) => {
            const Icon = ENTRY_ICON[entry.key] ?? Database02Icon
            return (
              <div
                key={entry.key}
                className={cn(
                  "group flex items-center gap-4 px-5 py-4 transition",
                  i > 0 && "border-t border-border/60",
                  !entry.present && "opacity-60",
                )}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft/50 text-brand-deep">
                  <HugeiconsIcon icon={Icon} className="size-4" strokeWidth={1.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-foreground">{t(entry.labelKey)}</p>
                    <code className="font-mono text-[10px] text-muted-foreground/70">
                      {entry.key}
                    </code>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.present
                      ? entry.summary
                      : t("settings.general.storage.empty")}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatSize(entry.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-8 shrink-0 text-muted-foreground/60 transition hover:text-destructive",
                    "opacity-0 group-hover:opacity-100",
                    !entry.present && "pointer-events-none",
                  )}
                  disabled={!entry.present}
                  onClick={() => handleClearKey(entry.key)}
                  title={t("settings.general.storage.clearEntry")}
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                </Button>
              </div>
            )
          })}

          {/* Footer summary */}
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-5 py-3 text-xs">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <HugeiconsIcon icon={HardDriveIcon} className="size-3.5" strokeWidth={1.6} />
              {presentCount} / {entries.length}{" "}
              <span className="text-muted-foreground/60">·</span>{" "}
              {t("settings.general.storage.total").toLowerCase()}
            </span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatSize(totalSize)}
            </span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          {t("settings.general.storage.note")}
        </p>
      </section>
    </div>
  )
}
