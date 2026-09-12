import { describe, expect, it } from "vite-plus/test";
import { legacyProjectLocation, projectPath, projectStoragePath } from "./project-routes";
import { navigationForLocation, pathForCommand } from "../app/lib/navigation-state";

describe("project resource routes", () => {
  it.each(["editor", "viewer", "veditor"])(
    "roundtrips %s navigation with selection and tabs",
    (mode) => {
      const command = {
        view: "projects",
        projectId: "story / one",
        mode,
        tab: "rows",
        rowId: "row&1",
        choiceId: "choice",
      };
      const url = new URL(pathForCommand(command), "https://example.test");
      expect(url.searchParams.has("mode")).toBe(false);
      expect(navigationForLocation({ pathname: url.pathname, search: url.search })).toMatchObject(
        command,
      );
    },
  );

  it("redirects old links without losing selected entities or anchors", () => {
    expect(legacyProjectLocation("story", "?mode=veditor&tab=rows&choiceId=sleep", "#sleep")).toBe(
      "/projects/story/visual-editor?tab=rows&choiceId=sleep#sleep",
    );
    expect(legacyProjectLocation("story", "")).toBe("/projects/story/editor");
    expect(legacyProjectLocation("story", "?mode=viewer")).toBe("/projects/story/viewer");
  });

  it("uses the route instead of a stale mode parameter", () => {
    expect(
      navigationForLocation({ pathname: "/projects/story/editor", search: "?mode=viewer" }).mode,
    ).toBe("editor");
  });

  it.each(["editor", "viewer", "veditor"])(
    "keeps old saved builds and preferences accessible in %s",
    (mode) => {
      expect(projectStoragePath(`/apps/c-can${projectPath("story", mode)}`)).toBe(
        "/apps/c-can/projects/story",
      );
      expect(projectStoragePath("/projects/story")).toBe("/projects/story");
    },
  );
});
