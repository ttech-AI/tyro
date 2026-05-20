import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/hooks/useLocale"
import { useConfig } from "@/hooks/useConfig"
import { cn } from "@/lib/utils"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { currentUser } from "@/data/user"

function LauncherCard({ iconName, logo, title, subtitle, onClick, index = 0, accent = "brand" }) {
  const accentClass =
    accent === "brand"
      ? "bg-gradient-to-br from-brand-from via-brand-via to-brand-to"
      : accent === "business"
        ? "bg-brand-deep"
        : ""
  const accentStyle =
    accent === "ai"
      ? {
          background:
            "color-mix(in oklab, var(--brand-via) 60%, var(--brand-deep) 40%)",
        }
      : undefined
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        "group relative flex h-full w-full flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left",
        "transition-all duration-200 hover:border-brand/40 hover:shadow-lg",
      )}
    >
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl text-white shadow-sm",
          accentClass,
        )}
        style={accentStyle}
      >
        <IconOrLogo iconName={iconName} logo={logo} className="size-5" />
      </div>
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-4 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-brand"
          />
        </div>
        <p className="text-xs leading-snug text-muted-foreground line-clamp-2">{subtitle}</p>
      </div>
    </motion.button>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </section>
  )
}

function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return "chat.greeting.morning"
  if (hour >= 12 && hour < 18) return "chat.greeting.afternoon"
  if (hour >= 18 && hour < 22) return "chat.greeting.evening"
  return "chat.greeting.night"
}

export function AppLauncher({ onOpenChat }) {
  const { t, locale } = useLocale()
  const { agents, aiApps, businessApps } = useConfig()
  const greetHour = new Date().getHours()
  const firstName = currentUser.name || ""

  const agentSubtitle =
    locale === "tr" ? "Sohbet başlat ve sorularını sor" : "Start a chat and ask your questions"

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {t(greetingKey(greetHour))}, {firstName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("launcher.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("launcher.subtitle")}</p>
      </header>

      <Section title={t("launcher.agents.title")} subtitle={t("launcher.agents.subtitle")}>
        {agents.map((agent, i) => (
          <LauncherCard
            key={agent.id}
            iconName={agent.iconName}
            logo={agent.logo}
            title={agent.name}
            subtitle={agent.description || agentSubtitle}
            onClick={() => onOpenChat?.(agent.id)}
            index={i}
          />
        ))}
      </Section>

      <Section title={t("launcher.aiApps.title")} subtitle={t("launcher.aiApps.subtitle")}>
        {aiApps.map((app, i) => (
          <LauncherCard
            key={app.id}
            iconName={app.iconName}
            logo={app.logo}
            title={app.name}
            subtitle={app.description}
            onClick={() => app.url && window.open(app.url, "_blank", "noopener,noreferrer")}
            index={i}
            accent="ai"
          />
        ))}
      </Section>

      <Section title={t("launcher.businessApps.title")} subtitle={t("launcher.businessApps.subtitle")}>
        {businessApps.map((app, i) => (
          <LauncherCard
            key={app.id}
            iconName={app.iconName}
            logo={app.logo}
            title={app.name}
            subtitle={app.description}
            onClick={() => app.url && window.open(app.url, "_blank", "noopener,noreferrer")}
            index={i}
            accent="business"
          />
        ))}
      </Section>
    </div>
  )
}
