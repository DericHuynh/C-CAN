import { describe, expect, it } from "vite-plus/test";

import { navigationForLocation, pathForCommand } from "./navigation-state";

describe("agent navigation", () => {
  it.each([
    ["/", "chat"],
    ["/projects", "projects"],
    ["/projects/story", "projects"],
    ["/settings", "settings"],
    ["/team", "settings"],
    ["/agent", "agent"],
    ["/database", "database"],
    ["/observability", "observability"],
    ["/extensions/example/page", "extensions"],
  ])("identifies %s as %s", (pathname, view) => {
    expect(navigationForLocation({ pathname }).view).toBe(view);
  });

  it("exposes project selection and preserves the complete viewer URL", () => {
    expect(
      navigationForLocation({
        pathname: "/projects/a%20story/viewer",
        search: "?tab=groups",
        hash: "#result",
      }),
    ).toEqual({
      view: "projects",
      path: "/projects/a%20story/viewer?tab=groups#result",
      projectId: "a story",
      mode: "viewer",
      tab: "groups",
    });
  });

  it("retains settings anchors and chat thread ids", () => {
    expect(navigationForLocation({ pathname: "/settings", hash: "#organization" }).path).toBe(
      "/settings#organization",
    );
    expect(navigationForLocation({ pathname: "/chat/story%20planning" }).threadId).toBe(
      "story planning",
    );
  });

  it("handles malformed encoded ids without breaking the app shell", () => {
    expect(navigationForLocation({ pathname: "/projects/%zz" }).projectId).toBeUndefined();
    expect(navigationForLocation({ pathname: "/chat/%zz" }).threadId).toBeUndefined();
  });

  it("opens the library and specific project tabs from agent commands", () => {
    expect(pathForCommand({ view: "projects" })).toBe("/projects");
    expect(
      pathForCommand({ view: "projects", projectId: "story/one", mode: "viewer", tab: "groups" }),
    ).toBe("/projects/story%2Fone/viewer?tab=groups");
    expect(pathForCommand({ view: "team" })).toBe("/settings#organization");
  });
});

it("roundtrips a planning addon selection through agent navigation", () => {
  const command = {
    view: "projects",
    projectId: "story",
    tab: "plan",
    rowId: "row &",
    choiceId: "choice",
    addonId: "addon",
  };
  const url = new URL(pathForCommand(command), "https://example.com");
  expect(navigationForLocation({ pathname: url.pathname, search: url.search })).toMatchObject(
    command,
  );
});
