import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignCircleIcon } from "@hugeicons/core-free-icons"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useLocale } from "@/hooks/useLocale"
import { cn } from "@/lib/utils"

const GROUP_LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55"

export function NavMain({ items, activeId, onSelect, onQuickAction }) {
  const { t } = useLocale()
  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onQuickAction}
                tooltip={t("nav.quickAction", "Yeni sohbet")}
                className="bg-gradient-to-r from-brand-from via-brand-via to-brand-to text-white shadow-sm duration-200 ease-linear hover:brightness-110 hover:text-white active:text-white"
              >
                <HugeiconsIcon icon={PlusSignCircleIcon} />
                <span>{t("nav.quickAction", "Yeni sohbet")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel className={GROUP_LABEL}>
          {t("nav.workspace")}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const active = activeId === item.id
              return (
                <SidebarMenuItem key={item.id} className="relative">
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-2 top-1/2 z-10 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand shadow-[1px_0_6px_-1px_color-mix(in_oklch,var(--brand-text),transparent_45%)]"
                    />
                  )}
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={t(item.labelKey)}
                    disabled={!!item.comingSoon}
                    onClick={() => onSelect(item)}
                    className={cn(
                      active && "text-brand [&_svg]:text-brand font-semibold",
                    )}
                  >
                    {item.icon && <HugeiconsIcon icon={item.icon} />}
                    <span>{t(item.labelKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
