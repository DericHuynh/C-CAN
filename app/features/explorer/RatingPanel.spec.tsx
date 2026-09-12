// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";
import { summarizeRatings } from "@shared/publications";
import { RatingPanel } from "./RatingPanel";
vi.mock("@agent-native/core/client/hooks", () => ({
  useSession: () => ({ session: { email: "reader@local.test" } }),
}));
vi.mock("@agent-native/core/client/i18n", () => ({ useT: () => (key: string) => key }));
vi.mock("./use-publications", () => ({
  useRatePublication: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
it("clears a draft ballot when navigating to a different unrated publication", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const publication = { id: "first", ratings: summarizeRatings([]), myRating: null, canRate: true };
  try {
    act(() => root.render(<RatingPanel publication={publication as never} onSaved={() => {}} />));
    act(() =>
      (
        container.querySelector('input[name="rating-overall"][value="5"]') as HTMLInputElement
      ).click(),
    );
    expect(container.querySelectorAll("input:checked")).toHaveLength(1);
    act(() =>
      root.render(
        <RatingPanel publication={{ ...publication, id: "second" } as never} onSaved={() => {}} />,
      ),
    );
    expect(container.querySelectorAll("input:checked")).toHaveLength(0);
  } finally {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
