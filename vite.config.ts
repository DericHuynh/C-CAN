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
