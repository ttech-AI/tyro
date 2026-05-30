import { Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useIsAuthenticated, useMsal } from "@azure/msal-react"
import { InteractionStatus } from "@azure/msal-browser"
import { isMsalConfigured, MOCK_LOGGED_IN_KEY } from "@/lib/msal"
import { Toaster } from "@/components/ui/sonner"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { SectionCards } from "@/components/dashboard/SectionCards"
import { ChartAreaInteractive } from "@/components/dashboard/ChartAreaInteractive"
import { DataTable } from "@/components/dashboard/DataTable"
import { HeroSection } from "@/components/dashboard/HeroSection"
import { AppLauncher } from "@/components/dashboard/AppLauncher"
import { ChatScreen } from "@/components/chat/ChatScreen"
import { SettingsPage } from "@/components/settings/SettingsPage"
import { HelpPage } from "@/components/help/HelpPage"
import { LoginPage } from "@/components/auth/LoginPage"

// MOCK_LOGGED_IN_KEY (from @/lib/msal) is the sessionStorage flag used only when MSAL
// isn't configured (no VITE_MSAL_CLIENT_ID), so login is required every browser session.
function readMockLoggedIn() {
  if (typeof window === "undefined") return false
  return window.sessionStorage.getItem(MOCK_LOGGED_IN_KEY) === "1"
}

const PATH_TO_ID = {
  "/dashboard": "dashboard",
  "/chat": "chat",
  "/analytics": "analytics",
  "/settings": "settings",
  "/help": "help",
}

const ID_TO_PATH = {
  dashboard: "/dashboard",
  chat: "/chat",
  analytics: "/analytics",
  settings: "/settings",
  help: "/help",
}

function AnalyticsContent() {
  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <HeroSection />
        </div>
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[720px] sm:min-w-0">
            <DataTable />
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatRoute() {
  const [params] = useSearchParams()
  const agent = params.get("agent")
  const reset = params.get("reset") || "0"
  return <ChatScreen key={reset} initialAgent={agent} />
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { instance, inProgress } = useMsal()
  const isMsalAuthenticated = useIsAuthenticated()

  // While MSAL is starting up or processing a redirect callback, don't make
  // auth-gate decisions yet — useIsAuthenticated can briefly return false
  // before the active-account event propagates after handleRedirectPromise.
  const msalSettling = isMsalConfigured && inProgress !== InteractionStatus.None

  // Authoritative auth check: useIsAuthenticated for reactivity + direct
  // getActiveAccount() to cover the first render after redirect (the hook
  // sometimes lags by a tick on initial mount).
  const isAuthenticated = isMsalConfigured
    ? isMsalAuthenticated || !!instance.getActiveAccount()
    : readMockLoggedIn()

  const activeId = PATH_TO_ID[location.pathname] ?? "dashboard"

  function handleActiveIdChange(id) {
    const path = ID_TO_PATH[id] ?? "/dashboard"
    navigate(path)
  }

  function handleNewChat() {
    navigate(`/chat?reset=${Date.now()}`)
  }

  function handleOpenChatWithAgent(agentId) {
    navigate(`/chat?agent=${encodeURIComponent(agentId)}&reset=${Date.now()}`)
  }

  // Authenticated user landing on /login (e.g. fresh AAD redirect back) →
  // skip the login page entirely.
  if (location.pathname === "/login" && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // Login is a standalone layout — no sidebar/header chrome
  if (location.pathname === "/login") {
    return (
      <>
        <LoginPage />
        <Toaster richColors position="bottom-center" />
      </>
    )
  }

  // MSAL still settling — render nothing rather than flashing the gate.
  if (msalSettling) {
    return null
  }

  // Auth gate — if not logged in, redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <DashboardLayout
        activeId={activeId}
        onActiveIdChange={handleActiveIdChange}
        onNewChat={handleNewChat}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={<AppLauncher onOpenChat={handleOpenChatWithAgent} onNewChat={handleNewChat} />}
          />
          <Route path="/chat" element={<ChatRoute />} />
          <Route path="/analytics" element={<AnalyticsContent />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
      <Toaster richColors position="bottom-center" />
    </>
  )
}

export default App
