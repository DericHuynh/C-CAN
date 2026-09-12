// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { projectMode } from "@shared/project-routes";
import { ProjectModeNavigation } from "./ProjectModeNavigation";

let root: Root;
let container: HTMLDivElement;
let router: ReturnType<typeof createMemoryRouter>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  router.dispose();
  container.remove();
  vi.unstubAllGlobals();
});

it("lets one click cancel a slow mode change, preserving selection and history", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  function Page() {
    const { id, mode } = useParams();
    return <ProjectModeNavigation projectId={id!} mode={projectMode(mode)} />;
  }
  router = createMemoryRouter(
    [
      {
        path: "/projects/:id/:mode",
        Component: Page,
        loader: async ({ params }) => {
          if (params.mode === "visual-editor") await pending;
          return null;
        },
      },
    ],
    { initialEntries: ["/projects/example/editor?tab=images&choiceId=choice#detail"] },
  );
  await act(async () => {
    root.render(<RouterProvider router={router} />);
  });
  const link = (mode: string) =>
    container.querySelector<HTMLAnchorElement>(`a[href*="/${mode}?"]`)!;
  await act(async () => {
    link("visual-editor").click();
  });
  expect(router.state.navigation.state).toBe("loading");
  expect(link("editor").getAttribute("aria-current")).toBe("page");
  // The still-selected editor is a real destination while another mode loads.
  await act(async () => {
    link("editor").click();
  });
  expect(router.state.navigation.state).toBe("idle");
  expect(router.state.location.pathname).toBe("/projects/example/editor");
  await act(async () => {
    release();
  });
  expect(router.state.location.pathname).toBe("/projects/example/editor");
  await act(async () => {
    link("viewer").click();
  });
  expect(router.state.location.pathname).toBe("/projects/example/viewer");
  expect(router.state.location.search).toBe("?tab=images&choiceId=choice");
  expect(router.state.location.hash).toBe("#detail");
  expect(link("viewer").getAttribute("aria-current")).toBe("page");
  await act(async () => {
    await router.navigate(-1);
  });
  expect(router.state.location.pathname).toBe("/projects/example/editor");
  await act(async () => {
    await router.navigate(1);
  });
  expect(router.state.location.pathname).toBe("/projects/example/viewer");
});
