export function pathForView(view?: string): string {
  switch (view) {
    case "chat":
    case "home":
    case "ask":
      return "/";
    case "explorer":
      return "/explorer";
    case "projects":
      return "/projects";
    case "database":
      return "/database";
    case "extensions":
      return "/extensions";
    case "observability":
      return "/observability";
    case "agent":
      return "/agent";
    case "settings":
      return "/settings";
    case "team":
      return "/settings/organization";
    default:
      return "/";
  }
}
