import {
  AgentSidebar,
  focusAgentChat,
  isAgentChatHomeHandoffActive,
  navigateWithAgentChatViewTransition,
  useAgentChatHomeHandoff,
  useAgentChatHomeHandoffLinks,
} from "@agent-native/core/client/agent-chat";
import { useT } from "@agent-native/core/client/i18n";
import { HeaderActionsProvider } from "@agent-native/toolkit/app-shell";
import { IconMenu2 } from "@tabler/icons-react";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TAB_ID } from "@/lib/tab-id";

import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSE_KEY = "chat.sidebar.collapsed";

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const isChatRoute = location.pathname === "/" || location.pathname.startsWith("/chat/");
  const chatHomeHandoffActive = useAgentChatHomeHandoff({
    storageKey: "chat",
    activePath: location.pathname,
    enabled: !isChatRoute,
  });
  const chatHomeHandoffPending = isAgentChatHomeHandoffActive("chat");
  useAgentChatHomeHandoffLinks({
    storageKey: "chat",
    isChatPath: (pathname) => pathname === "/" || pathname.startsWith("/chat/"),
    requireActiveHandoff: true,
  });

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeMobileSidebar = () => setMobileSidebarOpen(false);
    window.addEventListener("agent-chat:open-thread", closeMobileSidebar);
    return () => {
      window.removeEventListener("agent-chat:open-thread", closeMobileSidebar);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      if (stored !== null) setSidebarCollapsed(stored === "1");
    } catch {
      // Ignore storage access errors; the default collapsed state still works.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // Ignore storage access errors.
    }
  }, [sidebarCollapsed]);

  function openAskAgentFullscreen() {
    focusAgentChat();
    navigateWithAgentChatViewTransition(navigate, "/");
  }

  const contentFrame = (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="fixed bottom-3 left-3 z-40 bg-background shadow-sm md:hidden"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label={t("navigation.openNavigation")}
      >
        <IconMenu2 className="size-4" />
      </Button>
      <main className="agent-native-app-main min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </main>
    </div>
  );

  return (
    <HeaderActionsProvider>
      <div className="agent-layout-shell flex h-dvh w-full overflow-hidden bg-background text-foreground">
        <div className="agent-layout-left-drawer hidden md:block">
          <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        </div>
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="p-0 w-[260px]">
            <SheetTitle className="sr-only">{t("navigation.navigation")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("navigation.navigationDescription")}
            </SheetDescription>
            <Sidebar collapsed={false} collapsible={false} />
          </SheetContent>
        </Sheet>
        {isChatRoute ? (
          <div className="agent-layout-main-surface flex min-w-0 flex-1 overflow-hidden">
            {contentFrame}
          </div>
        ) : (
          <AgentSidebar
            position="right"
            chatViewTransition
            chatViewTransitionHandoff={chatHomeHandoffPending}
            storageKey="chat"
            browserTabId={TAB_ID}
            openOnChatRunning={chatHomeHandoffActive}
            onFullscreenRequest={openAskAgentFullscreen}
            emptyStateText={t("chat.inspectEmptyState")}
            agentPageHref="/agent"
            suggestions={[
              t("chat.inspectSuggestionCapabilities"),
              t("chat.inspectSuggestionHello"),
              t("chat.inspectSuggestionAction"),
            ]}
          >
            {contentFrame}
          </AgentSidebar>
        )}
      </div>
    </HeaderActionsProvider>
  );
}
