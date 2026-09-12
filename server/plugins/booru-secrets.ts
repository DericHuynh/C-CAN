/**
 * Optional e621 / Derpibooru credentials for image sourcing (login support).
 *
 * Both sites are usable anonymously, but NSFW/restricted content —
 * especially on Derpibooru, which hides higher ratings from anonymous
 * visitors — requires an account:
 *
 * - e621: username + API key (Account → API Access). Sent as HTTP Basic auth.
 * - Derpibooru: API key (Account → API). Sent as a Bearer token.
 *
 * Secrets are registered through the framework's standard flow
 * (Settings → Secrets, per-user, encrypted at rest) and read at request time
 * by actions/_booru.ts. The validators hit the real APIs with the stored
 * value so the Test button means something.
 */
import { registerRequiredSecret } from "@agent-native/core/secrets";
import { getRequestUserEmail } from "@agent-native/core/server";
import { readAppSecret } from "@agent-native/core/secrets";
import { defineNitroPlugin } from "@agent-native/core/server";

const USER_AGENT = "ICCPlus-CYOA-Studio/1.0 (agent-native app)";

export const E621_USERNAME_KEY = "E621_USERNAME";
export const E621_API_KEY_KEY = "E621_API_KEY";
export const DERPIBOORU_API_KEY_KEY = "DERPIBOORU_API_KEY";

/** The e621 API key validator needs the paired username (same user scope). */
async function readE621Username(): Promise<string | null> {
  const email = getRequestUserEmail();
  if (!email) return null;
  try {
    const result = await readAppSecret({ key: E621_USERNAME_KEY, scope: "user", scopeId: email });
    return result?.value ?? null;
  } catch {
    return null;
  }
}

registerRequiredSecret({
  key: E621_USERNAME_KEY,
  label: "e621 Username",
  description:
    "e621 account username, paired with the API key (enables authenticated search and higher limits).",
  docsUrl: "https://e621.net/help/api",
  scope: "user",
  kind: "api-key",
  required: false,
});

registerRequiredSecret({
  key: E621_API_KEY_KEY,
  label: "e621 API Key",
  description:
    "e621 API key from Account → API Access. Sent as HTTP Basic auth when searching e621.",
  docsUrl: "https://e621.net/users/home",
  scope: "user",
  kind: "api-key",
  required: false,
  validator: async (value: string) => {
    const username = await readE621Username();
    if (!username) {
      return { ok: false, error: "Set the e621 Username secret first — the key validates against it." };
    }
    try {
      const res = await fetch("https://e621.net/profile.json", {
        headers: {
          "User-Agent": USER_AGENT,
          Authorization: `Basic ${Buffer.from(`${username}:${value}`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(15_000),
      });
      return res.ok
        ? { ok: true }
        : { ok: false, error: `e621 rejected the key (HTTP ${res.status})` };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not reach e621",
      };
    }
  },
});

registerRequiredSecret({
  key: DERPIBOORU_API_KEY_KEY,
  label: "Derpibooru API Key",
  description:
    "Derpibooru API key from Account → API. Sent as a Bearer token; required for NSFW/restricted content on Derpibooru.",
  docsUrl: "https://derpibooru.org/account",
  scope: "user",
  kind: "api-key",
  required: false,
  validator: async (value: string) => {
    try {
      // Derpibooru authenticates via the `key` query parameter. A valid key
      // returns explicit-rated results; an invalid or unprivileged key
      // returns zero — this both validates the key and proves NSFW access.
      const res = await fetch(
        `https://derpibooru.org/api/v1/json/search/images?q=explicit&per_page=1&key=${encodeURIComponent(value)}`,
        {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!res.ok) return { ok: false, error: `Derpibooru rejected the key (HTTP ${res.status})` };
      const data = (await res.json()) as { images?: unknown[] };
      return Array.isArray(data.images) && data.images.length > 0
        ? { ok: true }
        : { ok: false, error: "Key is invalid or does not have access to explicit content." };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not reach Derpibooru",
      };
    }
  },
});

export default defineNitroPlugin(() => {
  // Secrets are registered at module load; nothing to do at boot.
});
