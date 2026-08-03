---
type: fixed
date: 2026-08-02
---

DeepSeek engine: fixed two streaming bugs in `server/agent/deepseek-engine.ts`.

- **HTTP 400 "Invalid assistant message: content or tool_calls must be set" (occasional)**: a reasoning turn that produced chain-of-thought but no text and no tool call (e.g. a truncated or reasoning-only reply) was persisted, then translated back to the API as `{ role: "assistant" }` with neither `content` nor `tool_calls` — which DeepSeek rejects. `engineMessagesToDeepSeek` now falls back to the thinking text as `content` when a turn has no text and no tool calls, and drops a fully-empty assistant message instead of sending it.
- **Display: answer appearing while thoughts stream / text overwriting itself**: the final `assistant-content` parts were assembled **text-first, thinking-second**, while the live stream delivered thinking first. When the turn completed, the persisted message reordered the parts — the answer jumped above the "Thought" cell and the message re-rendered, looking like the text overwrote itself. Parts are now assembled in stream order (thinking before text), so the final message matches the live preview exactly. (The framework's chat UI intentionally collapses the thinking cell once the answer starts — that collapse is framework behavior, not the engine.)

Both are covered by new engine tests (reasoning-only assistant turns round-trip with content; fully-empty assistant turns are dropped; thinking precedes text in the assembled turn). 525 tests pass.
