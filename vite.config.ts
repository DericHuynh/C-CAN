import { agentNative } from "@agent-native/core/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite-plus";

const reactRouterPlugins = reactRouter as unknown as () => any[];
const agentNativePlugins = agentNative as unknown as (
  options?: Parameters<typeof agentNative>[0],
) => any[];

export default defineConfig({
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
  plugins: [
    ...reactRouterPlugins(),
    ...agentNativePlugins({
      // shiki only runs in AssistantChat's useEffect — keep it out of the
      // CF Pages Functions bundle (25 MiB limit).
      ssrStubs: ["shiki"],
    }),
  ],
});
