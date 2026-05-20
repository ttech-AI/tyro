import {
  DashboardCircleIcon,
  Analytics01Icon,
  AiChat02Icon,
  Settings02Icon,
  HelpCircleIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { motion } from "motion/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { TyroLogo } from "@/components/brand/TyroLogo"
import { BrandText } from "@/components/brand/BrandText"
import { NavMain } from "./NavMain"
import { NavApps } from "./NavApps"
import { NavSecondary } from "./NavSecondary"
import { NavUser } from "./NavUser"
import { SidebarCopyright } from "./SidebarCopyright"
import { useLocale } from "@/hooks/useLocale"

const navMain = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: DashboardCircleIcon, ready: true },
  { id: "chat", labelKey: "nav.chat", icon: AiChat02Icon, ready: true },
  { id: "analytics", labelKey: "nav.analytics", icon: Analytics01Icon, ready: true },
]

function showComingSoon(label, t) {
  toast.custom(
    (id) => (
      <motion.div
        initial={{ opacity: 0, y: 56, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 22, mass: 0.9 }}
        className="pointer-events-auto flex w-[440px] items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-2xl ring-1 ring-brand/15"
      >
        <motion.div
          initial={{ rotate: -25, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.06 }}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white shadow-md"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
          </svg>
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold leading-tight">
            {t("construction.title").replace("{label}", label)}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground leading-snug">
            {t("construction.body")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {t("construction.dismiss")}
        </button>
      </motion.div>
    ),
    { duration: 5000 },
  )
}

export function AppSidebar({ activeId, onSelectActiveId, onNewChat, ...props }) {
  const { t } = useLocale()

  const handleSelect = (item) => {
    if (item.ready) {
      onSelectActiveId?.(item.id)
      return
    }
    showComingSoon(t(item.labelKey), t)
  }

  const navSecondary = [
    { id: "settings", labelKey: "nav.settings", icon: Settings02Icon, ready: true },
    { id: "help", labelKey: "nav.help", icon: HelpCircleIcon },
  ]

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onSelectActiveId?.("dashboard")
          }}
          className="flex items-center gap-1.5 py-2 pl-[3px] pr-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <TyroLogo size={28} className="size-7 shrink-0" />
          <BrandText className="overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200 ease-linear group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 max-w-[200px] opacity-100" />
        </a>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} activeId={activeId} onSelect={handleSelect} onQuickAction={onNewChat} />
        <NavApps />
        <div className="mt-auto">
          <SidebarCopyright />
          <div
            aria-hidden="true"
            className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent group-data-[collapsible=icon]:hidden"
          />
          <NavSecondary
            items={navSecondary}
            activeId={activeId}
            onSelect={handleSelect}
          />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
