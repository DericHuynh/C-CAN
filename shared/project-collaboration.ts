/** Presence documents hold awareness only; authored CYOA content stays behind actions. */
export const projectCollabId = (id: string) => `cyoa:${id}`;
export const collabProjectId = (id: string) =>
  id.startsWith("cyoa:") ? id.slice(5) || null : null;
