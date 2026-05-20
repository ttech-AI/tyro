import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Database02Icon,
  Delete02Icon,
  Refresh01Icon,
  Layers01Icon,
  Calendar01Icon,
  Tag01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TyroLogo } from "@/components/brand/TyroLogo"
import { useLocale } from "@/hooks/useLocale"
import { useTheme } from "@/hooks/useTheme"
import { usePalette } from "@/hooks/usePalette"
import { useConfig } from "@/hooks/useConfig"
import { appMeta, localStorageRegistry } from "@/data/appMeta"
import { getPalette } from "@/data/palettes"
import { cn } from "@/lib/utils"

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

  const activePalette = getPalette(palette)
  const [swatch1, swatch2, swatch3] = activePalette.swatch
  const logoColors = {
    gradStart: swatch1,
    gradEnd: swatch3,
    fillA: swatch2,
    fillB: swatch1,
    fillC: swatch3,
  }

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
    <div className="space-y-8">
      {/* App identity card */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <div className="grid size-20 shrink-0 place-items-center rounded-2xl border border-border bg-white p-3 shadow-md">
            <TyroLogo size={56} className="size-14" themeColors={logoColors} />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight">{appMeta.name}</h3>
              <Badge variant="outline" className="h-5 border-brand/40 px-2 text-[10px] text-brand-deep">
                v{appMeta.version}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{appMeta.brand}</p>
            <p className="text-xs text-muted-foreground/80">© {appMeta.releaseDate} {appMeta.parent}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-3">
          <MetaCell
            icon={Tag01Icon}
            label={t("settings.general.app.versionLabel")}
            value={`v${appMeta.version}`}
          />
          <MetaCell
            icon={Calendar01Icon}
            label={t("settings.general.app.releaseLabel")}
            value={appMeta.releaseDate}
          />
          <MetaCell
            icon={Layers01Icon}
            label={t("settings.general.app.stackLabel")}
            value={appMeta.stack.join(" · ")}
          />
        </div>
      </section>

      {/* localStorage inventory */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-deep">
              <HugeiconsIcon icon={Database02Icon} className="size-4" strokeWidth={1.6} />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {t("settings.general.storage.sectionTitle")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("settings.general.storage.sectionSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={handleRefresh}
            >
              <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
              {t("settings.general.storage.refresh")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleClearAll}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              {t("settings.general.storage.clearAll")}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="grid grid-cols-12 gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div className="col-span-4">{t("settings.general.storage.colKey")}</div>
            <div className="col-span-5">{t("settings.general.storage.colValue")}</div>
            <div className="col-span-2 text-right">{t("settings.general.storage.colSize")}</div>
            <div className="col-span-1" />
          </div>
          {entries.map((entry) => (
            <div
              key={entry.key}
              className="grid grid-cols-12 items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="col-span-4 min-w-0">
                <div className="flex items-center gap-2">
                  <code
                    className={cn(
                      "rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]",
                      !entry.present && "text-muted-foreground/60 line-through",
                    )}
                  >
                    {entry.key}
                  </code>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(entry.labelKey)} — {t(entry.descriptionKey)}
                </p>
              </div>
              <div className="col-span-5 min-w-0">
                {entry.present ? (
                  <p className="truncate text-sm text-foreground">{entry.summary}</p>
                ) : (
                  <p className="text-xs italic text-muted-foreground/60">
                    {t("settings.general.storage.empty")}
                  </p>
                )}
              </div>
              <div className="col-span-2 text-right">
                <span
                  className={cn(
                    "font-mono text-xs tabular-nums",
                    entry.present ? "text-muted-foreground" : "text-muted-foreground/40",
                  )}
                >
                  {formatSize(entry.size)}
                </span>
              </div>
              <div className="col-span-1 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={!entry.present}
                  onClick={() => handleClearKey(entry.key)}
                  title={t("settings.general.storage.clearEntry")}
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("settings.general.storage.total")}
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatSize(totalSize)}
            </span>
          </div>
        </div>

        <p className="px-1 text-[11px] text-muted-foreground/80">
          {t("settings.general.storage.note")}
        </p>
      </section>
    </div>
  )
}

function MetaCell({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 bg-card px-5 py-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-3.5" strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}
