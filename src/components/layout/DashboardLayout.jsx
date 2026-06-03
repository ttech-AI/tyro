import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./Sidebar"
import { Header } from "./Header"
import { CommandPalette } from "@/components/common/CommandPalette"
import { useHotkey } from "@/hooks/useHotkey"
import { cn } from "@/lib/utils"

export function DashboardLayout({ children, activeId, onActiveIdChange, onNewChat }) {
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  useHotkey("mod+k", () => setSearchOpen((v) => !v))

  return (
    <SidebarProvider
      // h-[var(--app-height,100dvh)] + overflow-hidden caps the whole
      // dashboard at the viewport — without an UPPER bound at the top of the
      // flex chain, every `min-h-0` further down is toothless because the
      // parent has no defined height to constrain children against. The
      // shadcn primitive only sets `min-h-svh` (LOWER bound), so chat thread
      // content was growing the whole page and scrolling the body.
      // --app-height (JS-measured, set in index.html) is used over raw 100dvh
      // because iOS miscomputes dvh on a standalone PWA's first paint, leaving
      // a bottom gap until the first scroll; 100dvh is the pre-script fallback.
      className="bg-sidebar h-[var(--app-height,100dvh)] overflow-hidden"
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
      <SidebarInset
        className={cn(
          "bg-background overflow-hidden md:m-2 md:ml-0 md:rounded-xl md:shadow-sm md:peer-data-[state=collapsed]:ml-2 md:transition-[margin] md:duration-200 md:ease-linear",
          // PWA standalone (iOS Add-to-Home Screen): the webview takes the
          // FULL viewport including under the status bar / Dynamic Island
          // and the home indicator. Without these insets, the Header
          // disappears behind the system clock. Browser-tab visits get
          // insets=0, so nothing changes there.
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:pt-0 md:pb-0",
          // `min-h-0` so this flex-1 child cannot push the parent past its
          // bounds when nested scrollers (chat thread, settings list) have
          // taller content than the viewport. Without it, the chat header /
          // composer scroll off-screen with the page.
          "min-h-0",
        )}
      >
        <Header
          activeId={activeId}
          onOpenSearch={() => setSearchOpen(true)}
          onNavigate={navigate}
          onNewChat={onNewChat}
        />
        {/* min-h-0 here too — main is a flex-1 inside SidebarInset, same
            principle. Together with the chat root's min-h-0 (in ChatScreen)
            this makes the flex chain strictly bounded so only the chat
            scroller scrolls, never the page. */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </SidebarInset>
      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={navigate}
        onNewChat={onNewChat}
      />
    </SidebarProvider>
  )
}
