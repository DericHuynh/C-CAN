/** Throw a helpful error when a lookup condition fails. */
export function assertFound(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
