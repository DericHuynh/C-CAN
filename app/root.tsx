import { configureTracking } from "@agent-native/core/client/analytics";
import { appPath } from "@agent-native/core/client/api-path";
import { useDbSync, useSession } from "@agent-native/core/client/hooks";
import { AppProviders, createAgentNativeQueryClient } from "@agent-native/core/client/hooks";
import { getLocaleInitScript, useT } from "@agent-native/core/client/i18n";
import { CommandMenu, useCommandMenuShortcut } from "@agent-native/core/client/navigation";
import { getThemeInitScript, RequireSession } from "@agent-native/core/client/ui";
import { IconHierarchy2, IconSun, IconMoon } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useCallback, useState } from "react";
import {
  Links,
  Meta,
  Outlet,
  ScrollRestoration,
  Scripts,
  useLocation,
  useNavigate,
} from "react-router";
import type { LinksFunction } from "react-router";

import { Layout as AppLayout } from "@/components/layout/Layout";
import { AppToolkitProvider } from "@/components/ui/toolkit-provider";
import { useNavigationState } from "@/hooks/use-navigation-state";
import { APP_TITLE } from "@/lib/app-config";
import { TAB_ID } from "@/lib/tab-id";

import changelog from "../CHANGELOG.md?raw";
import { i18nCatalog } from "./i18n";

import stylesheet from "./global.css?url";

configureTracking({
  getDefaultProps: (_name, properties) => ({
    ...properties,
    app: "iccplus-agent-native",
    template: "chat",
  }),
});

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

const THEME_INIT_SCRIPT = getThemeInitScript();
const LOCALE_INIT_SCRIPT = getLocaleInitScript();

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          data-agent-native-locale-init
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: LOCALE_INIT_SCRIPT }}
        />
        <link rel="manifest" href={appPath("/manifest.json")} />
        <meta name="theme-color" content="#18181B" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_TITLE} />
        <link rel="icon" type="image/svg+xml" href={appPath("/favicon.svg")} />
        <link rel="apple-touch-icon" href={appPath("/icon-180.svg")} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function DbSyncSetup() {
  const qc = useQueryClient();
  useNavigationState();
  useDbSync({
    queryClient: qc,
    ignoreSource: TAB_ID,
  });
  return null;
}

/**
 * CYOA share links (`/projects/{id}/viewer`) must open for recipients
 * without an account: bypass the app's RequireSession redirect on project
 * pages. The project access checks still gate the data — private projects 403
 * and every mutation requires the owner/editor role — so signed-out visitors
 * only ever see public CYOAs read-only.
 */
function isPublicPathname(pathname: string): boolean {
  return (
    pathname.startsWith("/projects/") ||
    pathname === "/explorer" ||
    pathname.startsWith("/explorer/") ||
    pathname.startsWith("/play/")
  );
}

function ThemeToggleItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useT();
  const isDark = resolvedTheme === "dark";
  return (
    <CommandMenu.Item
      onSelect={() => setTheme(isDark ? "light" : "dark")}
      keywords={["theme", "dark", "light", "mode"]}
    >
      {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      {t("root.toggleTheme")}
    </CommandMenu.Item>
  );
}

function AppContent() {
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const navigate = useNavigate();
  const t = useT();
  useCommandMenuShortcut(useCallback(() => setCmdkOpen(true), []));
  return (
    <>
      <CommandMenu
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        changelog={changelog}
        changelogKey="chat"
      >
        <CommandMenu.Group heading={t("root.commandActions")}>
          {(
            [
              ["/projects", "navigation.projects"],
              ["/explorer", "publishing.explorer"],
              ["/", "navigation.chat"],
              ["/settings", "navigation.settings"],
              ["/extensions", "navigation.extensions"],
              ["/database", "navigation.database"],
              ["/observability", "navigation.observability"],
            ] as const
          ).map(([path, label]) => (
            <CommandMenu.Item key={path} onSelect={() => navigate(path)}>
              {t(label)}
            </CommandMenu.Item>
          ))}
          <CommandMenu.Item
            onSelect={() => navigate("/agent")}
            keywords={["agent", "context", "files", "connections", "jobs", "access"]}
          >
            <IconHierarchy2 size={16} />
            {t("settings.openAgentSettings")}
          </CommandMenu.Item>
        </CommandMenu.Group>
        <CommandMenu.Group heading={t("root.commandAppearance")}>
          <ThemeToggleItem />
        </CommandMenu.Group>
      </CommandMenu>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </>
  );
}

export default function Root() {
  const [queryClient] = useState(() => createAgentNativeQueryClient());
  return (
    <AppToolkitProvider>
      <SessionAwareProviders queryClient={queryClient} />
    </AppToolkitProvider>
  );
}

function SessionAwareProviders({
  queryClient,
}: {
  queryClient: ReturnType<typeof createAgentNativeQueryClient>;
}) {
  return (
    <AppProviders
      queryClient={queryClient}
      // Keep the provider tree stable across public/private route changes.
      // SessionAwareApp below owns the same Core session gate.
      sessionBypass
      i18n={{ catalog: i18nCatalog }}
    >
      <SessionAwareApp />
    </AppProviders>
  );
}

function SessionAwareApp() {
  const location = useLocation();
  const { session } = useSession();
  return (
    // Switching RequireSession's bypass changes its component tree. Once
    // signed in, keep it bypassed on every route so the shell, command menu
    // and navigation listeners aren't remounted during each app switch.
    <RequireSession bypass={Boolean(session) || isPublicPathname(location.pathname)}>
      <DbSyncSetup />
      <AppContent />
    </RequireSession>
  );
}

export { ErrorBoundary } from "@agent-native/core/client/ui";
