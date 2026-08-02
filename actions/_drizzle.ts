/**
 * Private re-export of the Drizzle ORM operators used by the CYOA actions.
 *
 * `drizzle-orm` is a transitive dependency of `@agent-native/core`, so a bare
 * `import { eq } from "drizzle-orm"` does not resolve from this package. The
 * framework's dialect-agnostic schema module re-exports the operators we need,
 * so we re-export them from there instead of reaching into the pnpm store.
 */
export { eq, desc, and, or } from "@agent-native/core/db/schema";
