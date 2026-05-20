import { useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { SectionCards } from "@/components/dashboard/SectionCards"
import { ChartAreaInteractive } from "@/components/dashboard/ChartAreaInteractive"
import { DataTable } from "@/components/dashboard/DataTable"
import { HeroSection } from "@/components/dashboard/HeroSection"
import { AppLauncher } from "@/components/dashboard/AppLauncher"
import { ChatScreen } from "@/components/chat/ChatScreen"
import { SettingsPage } from "@/components/settings/SettingsPage"

function AnalyticsContent() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <HeroSection />
        </div>
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <DataTable />
      </div>
    </div>
  )
}

function App() {
  const [activeId, setActiveId] = useState("dashboard")
  const [chatResetKey, setChatResetKey] = useState(0)
  const [chatPrefilledAgent, setChatPrefilledAgent] = useState(null)

  function handleNewChat() {
    setChatResetKey((k) => k + 1)
    setChatPrefilledAgent(null)
    setActiveId("chat")
  }

  function handleOpenChatWithAgent(agentId) {
    setChatResetKey((k) => k + 1)
    setChatPrefilledAgent(agentId)
    setActiveId("chat")
  }

  let content
  if (activeId === "chat") {
    content = <ChatScreen key={chatResetKey} initialAgent={chatPrefilledAgent} />
  } else if (activeId === "analytics") {
    content = <AnalyticsContent />
  } else if (activeId === "settings") {
    content = <SettingsPage />
  } else {
    content = <AppLauncher onOpenChat={handleOpenChatWithAgent} />
  }

  return (
    <>
      <DashboardLayout
        activeId={activeId}
        onActiveIdChange={setActiveId}
        onNewChat={handleNewChat}
      >
        {content}
      </DashboardLayout>
      <Toaster richColors position="bottom-center" />
    </>
  )
}

export default App
