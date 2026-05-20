import { useState } from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./Sidebar"
import { Header } from "./Header"
import { CommandPalette } from "@/components/common/CommandPalette"
import { useHotkey } from "@/hooks/useHotkey"

export function DashboardLayout({ children, activeId, onActiveIdChange, onNewChat }) {
  const [searchOpen, setSearchOpen] = useState(false)
  useHotkey("mod+k", () => setSearchOpen((v) => !v))

  return (
    <SidebarProvider
      className="bg-sidebar"
      style={{
        "--sidebar-width": "15rem",
        "--sidebar-width-icon": "3rem",
      }}
    >
      <AppSidebar
        activeId={activeId}
        onSelectActiveId={onActiveIdChange}
        onNewChat={onNewChat}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <SidebarInset className="bg-background overflow-hidden md:m-2 md:ml-0 md:rounded-xl md:shadow-sm md:peer-data-[state=collapsed]:ml-2 md:transition-[margin] md:duration-200 md:ease-linear">
        <Header activeId={activeId} onOpenSearch={() => setSearchOpen(true)} />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </SidebarInset>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  )
}
