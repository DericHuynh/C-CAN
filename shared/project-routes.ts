export type ProjectMode = "editor" | "veditor" | "viewer";

export function projectMode(segment: string | null | undefined): ProjectMode {
  return segment === "viewer"
    ? "viewer"
    : segment === "visual-editor" || segment === "veditor"
      ? "veditor"
      : "editor";
}

export function projectPath(id: string, mode: string = "editor"): string {
  const resource = projectMode(mode) === "veditor" ? "visual-editor" : projectMode(mode);
  return `/projects/${encodeURIComponent(id)}/${resource}`;
}

/** Keep existing browser build slots/preferences shared across project modes. */
export function projectStoragePath(pathname: string): string {
  return pathname.replace(/(\/projects\/[^/]+)\/(?:editor|visual-editor|viewer)\/?$/, "$1");
}

export function legacyProjectLocation(id: string, search: string, hash = ""): string {
  const params = new URLSearchParams(search);
  const mode = projectMode(params.get("mode"));
  params.delete("mode");
  const query = params.toString();
  return `${projectPath(id, mode)}${query ? `?${query}` : ""}${hash}`;
}
