---
type: changed
date: 2026-08-02
---

Agent context limit: the framework's model catalog now treats `deepseek-*` as a 1M-token window. The Context X-Ray meter (and the agent context tab) resolve the budget via `getContextWindowForModel()` in `@agent-native/core`, which fell back to a conservative 128k for `deepseek-v4-flash` — that's why the meter showed 84.4k at 66%. The catalog table lives in the installed package, so the change is a **pnpm patched dependency** (`patches/@agent-native__core@0.133.1.patch`, wired in `pnpm-workspace.yaml`):

- `deepseek-v4-flash` and `deepseek-reasoner` added to the exact-match table → 1,000,000.
- A `deepseek-` family heuristic (→ 1,000,000) so future DeepSeek model ids resolve the same way instead of falling to the 128k floor.

Re-applies on any clean install (`pnpm install`); keep the patch in sync when bumping `@agent-native/core` (bump the version key in `pnpm-workspace.yaml` and re-run `pnpm patch`). Note: this controls what the Context X-Ray reports as the window; the actual sendable context is still bounded by DeepSeek's real API limit. Verified end-to-end in the served Vite pre-bundle (`"deepseek-v4-flash": 1e6` + the family heuristic reach the browser), typecheck and the 523-test suite pass.
