import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const layers = ["app", "actions", "server", "shared"];
function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.[cm]?[jt]sx?$/.test(file) && !/\.(spec|test)\./.test(file)
        ? [file]
        : [];
  });
}
const files = layers.flatMap(sourceFiles);
const graph = new Map<string, string[]>();
const violations: string[] = [];
for (const file of files) {
  const source = readFileSync(path.join(root, file), "utf8");
  const dependencies: string[] = [];
  // Static imports/re-exports and literal dynamic imports, including type imports.
  for (const match of source.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g,
  )) {
    const specifier = match[1].split("?")[0];
    let local: string | undefined;
    if (specifier.startsWith("@/")) local = `app/${specifier.slice(2)}`;
    else if (specifier.startsWith("@shared/")) local = `shared/${specifier.slice(8)}`;
    else if (specifier.startsWith("."))
      local = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    if (local) {
      const bare = local.replace(/\.js$/, "");
      const resolved = [local, `${bare}.ts`, `${bare}.tsx`, `${bare}/index.ts`].find((candidate) =>
        existsSync(path.join(root, candidate)),
      );
      if (!resolved) violations.push(`${file}: unresolved local import ${specifier}`);
      else dependencies.push(resolved);
      const targetLayer = local.split("/")[0];
      if (file.startsWith("shared/") && targetLayer !== "shared")
        violations.push(`${file}: shared code depends on ${specifier}`);
      if (file.startsWith("app/") && ["server", "actions"].includes(targetLayer))
        violations.push(`${file}: browser code imports ${specifier}`);
      if (file.startsWith("actions/") && local.startsWith("server/db/"))
        violations.push(`${file}: action bypasses project persistence with ${specifier}`);
      if (file.startsWith("actions/") && targetLayer === "app")
        violations.push(`${file}: action imports UI ${specifier}`);
      if (file.startsWith("server/") && ["app", "actions"].includes(targetLayer))
        violations.push(`${file}: server service imports an entry point ${specifier}`);
      if (
        file.startsWith("app/features/viewer/") &&
        /^app\/features\/(editor|projects)\//.test(local)
      )
        violations.push(`${file}: viewer imports authoring ${specifier}`);
      if (
        file.startsWith("server/") &&
        !file.startsWith("server/plugins/") &&
        local.startsWith("server/plugins/")
      )
        violations.push(`${file}: service imports a startup plugin ${specifier}`);
    } else if (file.startsWith("shared/") && /^(node:|@agent-native\/core)/.test(specifier)) {
      violations.push(`${file}: domain code imports infrastructure ${specifier}`);
    } else if (
      file.startsWith("app/") &&
      file !== "app/entry.server.tsx" &&
      /^(node:|@agent-native\/core(?:$|\/(?!client)))/.test(specifier)
    ) {
      violations.push(`${file}: browser code imports a server API ${specifier}`);
    }
  }
  graph.set(file, dependencies);
}

describe("application architecture", () => {
  it("keeps domain, UI, actions, infrastructure and startup dependencies directional", () => {
    expect(violations).toEqual([]);
  });
  it("has no circular local module dependencies", () => {
    const done = new Set<string>();
    const stack: string[] = [];
    const cycles: string[] = [];
    function visit(file: string) {
      if (stack.includes(file)) {
        cycles.push([...stack.slice(stack.indexOf(file)), file].join(" -> "));
        return;
      }
      if (done.has(file)) return;
      stack.push(file);
      for (const dependency of graph.get(file) ?? []) visit(dependency);
      stack.pop();
      done.add(file);
    }
    files.forEach(visit);
    expect(cycles).toEqual([]);
  });
  it("keeps implementation helpers outside action discovery", () => {
    expect(files.filter((file) => /^actions\/_/.test(file))).toEqual([]);
  });
});
