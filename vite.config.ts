import { fileURLToPath } from "node:url";

import { agentNative } from "@agent-native/core/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

const reactRouterPlugins = reactRouter as unknown as () => any[];
const agentNativePlugins = agentNative as unknown as (
  options?: Parameters<typeof agentNative>[0],
) => any[];

export default defineConfig(({ mode }) => ({
  // Safety guard for `vp fmt` / `vp check --fix`: never reformat the multi-MB
  // example documents, build output, or generated files.
  fmt: {
    ignorePatterns: [
      "examples/**",
      ".react-router/**",
      ".generated/**",
      "build/**",
      "dist/**",
      ".output/**",
      "data/**",
      "node_modules/**",
    ],
  },
  // Unit tests must not boot Nitro, auth, MCP clients, or React Router's HMR runtime.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./app", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  optimizeDeps: {
    // File routes and lazy editor panels aren't all reachable from Vite's
    // initial HTML entry. Discover their dependencies before serving the UI:
    // discovering them on first navigation rebuilds the prebundle and reloads
    // the document, sometimes abandoning the in-flight route change.
    entries: ["app/**/*.{ts,tsx}", "!app/**/*.spec.{ts,tsx}", "!app/entry.server.tsx"],
    // Core's lazy chat surfaces also import Toolkit leaves which aren't
    // visible to the app-entry scan. Include their public browser subpaths
    // together so they can't invalidate already-served shared chunks.
    include: [
      "yjs",
      "y-protocols/awareness",
      "@agent-native/toolkit/sharing",
      "@agent-native/toolkit/collab-ui",
      "@agent-native/toolkit/composer",
      "@agent-native/toolkit/composer/*",
      "@agent-native/toolkit/context-ui",
      "@agent-native/toolkit/ui/*",
    ],
  },
  plugins:
    mode === "test"
      ? []
      : lazyPlugins(() => [
          ...reactRouterPlugins(),
          ...agentNativePlugins({
            // shiki only runs in AssistantChat's useEffect — keep it out of the
            // CF Pages Functions bundle (25 MiB limit).
            ssrStubs: ["shiki"],
          }),
        ]),
}));
